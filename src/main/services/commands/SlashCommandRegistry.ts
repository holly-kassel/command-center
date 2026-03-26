/**
 * Slash Command Registry
 *
 * Parses `/command args` text and routes to the appropriate service method.
 * Extensible — register new commands via .register().
 */
import log from 'electron-log'
import { getObsidianService } from '../obsidian/ObsidianService'
import { getKanbanService } from '../kanban/KanbanService'
import { chatCompletion } from '../llm'
import { loadLLMContext } from '../llm/contextLoader'
import { SlackParser } from '../slack/SlackParser'

export interface SlashCommandResult {
  success: boolean
  command: string
  message: string
}

interface SlashCommandDefinition {
  name: string
  description: string
  /** Hint shown in the input when user types `/commandName` */
  argHint: string
  /** If true, the UI should show a textarea instead of a single-line input */
  multiline?: boolean
  execute: (args: string) => Promise<SlashCommandResult>
}

const TRANSCRIPT_SYSTEM_PROMPT = `You are a thorough meeting note summarizer for a product manager's weekly notes.

Given a raw meeting transcript, produce a structured summary in this exact markdown format:

#### 📝 Meeting Summary: [short descriptive title]
**Participants:** [names]

**Key Discussion Points:**
- [point 1]
- [point 2]
- [etc.]

**Action Items:**
- [ ] [owner] [action item]
- [ ] [owner] [action item]

**Decisions Made:**
- [decision 1]
- [decision 2]

**Open Questions:**
- [question 1]

Rules:
- Strip filler words, repetition, and small talk, but do NOT sacrifice completeness
- Use the participants' first names
- If something is unclear from the transcript, note it as "[unclear]"

Action item rules (CRITICAL — err on the side of capturing MORE, not fewer):
- Capture EVERY commitment, next step, or follow-up mentioned — explicit ("I'll do X") or implicit ("we should do X", "let's try X", "can you do X")
- Include the owner's name for each item when identifiable
- Include items that were agreed to even casually (e.g. "yeah I can get that done tomorrow")
- Include items someone volunteered for ("I'll share that out", "let me pull that in")
- If someone said they'd share, review, send, schedule, create, update, or follow up on anything, that's an action item`

/**
 * Context files from LLM-context/ to load for transcript summarization.
 * Follows the routing table in LLM-context/index.md:
 *   work-related → business-profile.md
 *   billing terminology → billing-domain.md
 */
const TRANSCRIPT_CONTEXT_FILES = ['business-profile.md', 'billing-domain.md']

const SLACK_SYSTEM_PROMPT = `You are a Slack thread summarizer for a product manager's weekly notes.

Given a parsed Slack thread, produce a summary and action items in this exact markdown format:

**💬 Slack Thread Summary:** [one-line description of what was discussed]
**Participants:** [names]

**Key Points:**
- [point 1]
- [point 2]

**Action Items:**
- [ ] [owner] [action item]

Rules:
- Be concise for key points, but THOROUGH for action items
- Use first names only

Action item rules (CRITICAL — err on the side of capturing MORE, not fewer):
- Capture EVERY commitment, next step, or follow-up — explicit ("I'll do X") or implicit ("we should do X", "can you look into X")
- Include the owner's name when identifiable
- Include casual commitments ("yeah I can do that", "will take a look")
- If someone said they'd share, review, send, check, update, or follow up on anything, that's an action item
- Only skip the action items section if there are truly ZERO next steps of any kind`

class SlashCommandRegistry {
  private commands = new Map<string, SlashCommandDefinition>()

  constructor() {
    this.registerDefaults()
  }

  private registerDefaults(): void {
    this.register({
      name: 'todo',
      description: "Add a todo checkbox to today's Tasks & Notes",
      argHint: 'what needs doing?',
      execute: async (args: string): Promise<SlashCommandResult> => {
        const text = args.trim()
        if (!text) {
          return { success: false, command: 'todo', message: 'Usage: /todo <task description>' }
        }

        const obsidian = getObsidianService()
        await obsidian.appendTodoToToday(text)

        const kanban = getKanbanService()
        kanban.addTask(text, 'slash_command')

        return {
          success: true,
          command: 'todo',
          message: `Added todo: ${text}`
        }
      }
    })

    this.register({
      name: 'transcript',
      description: "Summarize a meeting transcript and add to today's notes",
      argHint: 'paste transcript text...',
      multiline: true,
      execute: async (args: string): Promise<SlashCommandResult> => {
        const transcript = args.trim()
        if (!transcript || transcript.length < 50) {
          return {
            success: false,
            command: 'transcript',
            message: 'Paste a meeting transcript after /transcript (at least a few lines)'
          }
        }

        log.info(`[SlashCommands] Summarizing transcript (${transcript.length} chars)`)

        // Load personal context from LLM-context/ files
        const context = await loadLLMContext(TRANSCRIPT_CONTEXT_FILES)
        const systemPrompt = TRANSCRIPT_SYSTEM_PROMPT + context

        // Call GitHub Models to summarize
        const result = await chatCompletion(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: transcript }
          ],
          { temperature: 0.2, maxTokens: 4096 }
        )

        // Append the summary as a raw block (no bullet/timestamp wrapping)
        const obsidian = getObsidianService()
        await obsidian.appendBlockToToday(result.content)

        return {
          success: true,
          command: 'transcript',
          message: "Transcript summarized and added to today's notes"
        }
      }
    })

    this.register({
      name: 'slack',
      description: "Summarize a Slack thread and add to today's notes",
      argHint: 'paste copied Slack thread...',
      multiline: true,
      execute: async (args: string): Promise<SlashCommandResult> => {
        const rawText = args.trim()
        if (!rawText || rawText.length < 20) {
          return {
            success: false,
            command: 'slack',
            message: 'Paste a Slack thread after /slack'
          }
        }

        log.info(`[SlashCommands] Processing Slack thread (${rawText.length} chars)`)

        // Parse the Slack thread into structured messages
        const parsed = SlackParser.parseThread(rawText)

        if (parsed.messages.length === 0) {
          return {
            success: false,
            command: 'slack',
            message: 'Could not parse any messages from the pasted text'
          }
        }

        // Format the parsed thread for the <details> block
        const threadLines: string[] = []
        for (const msg of parsed.messages) {
          threadLines.push(`**${msg.author}** [${msg.timestamp}]`)
          threadLines.push(msg.content)
          threadLines.push('')
        }
        const formattedThread = threadLines.join('\n').trim()

        // Summarize with AI
        const context = await loadLLMContext(TRANSCRIPT_CONTEXT_FILES)
        const systemPrompt = SLACK_SYSTEM_PROMPT + context

        const result = await chatCompletion(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: formattedThread }
          ],
          { temperature: 0.2, maxTokens: 512 }
        )

        // Build the final output: summary + collapsible full thread
        const output = [
          result.content,
          '',
          '<details>',
          '<summary>Full Slack thread</summary>',
          '',
          formattedThread,
          '',
          '</details>'
        ].join('\n')

        // Append as a raw block (no bullet/timestamp wrapping)
        const obsidian = getObsidianService()
        await obsidian.appendBlockToToday(output)

        return {
          success: true,
          command: 'slack',
          message: `Slack thread summarized (${parsed.messages.length} messages from ${parsed.participants.join(', ')})`
        }
      }
    })
  }

  register(definition: SlashCommandDefinition): void {
    this.commands.set(definition.name.toLowerCase(), definition)
    log.info(`[SlashCommands] Registered /${definition.name}`)
  }

  /**
   * Check if text starts with a slash command.
   * Returns the command name if found, or null.
   */
  parseCommand(text: string): { command: string; args: string } | null {
    const trimmed = text.trim()
    if (!trimmed.startsWith('/')) return null

    const spaceIndex = trimmed.indexOf(' ')
    const command = (
      spaceIndex === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIndex)
    ).toLowerCase()
    const args = spaceIndex === -1 ? '' : trimmed.slice(spaceIndex + 1)

    if (!this.commands.has(command)) return null
    return { command, args }
  }

  /**
   * Execute a slash command from raw input text.
   */
  async execute(text: string): Promise<SlashCommandResult> {
    const parsed = this.parseCommand(text)
    if (!parsed) {
      return { success: false, command: '', message: 'Not a recognized slash command' }
    }

    const definition = this.commands.get(parsed.command)!
    log.info(`[SlashCommands] Executing /${parsed.command} with args: "${parsed.args}"`)

    try {
      return await definition.execute(parsed.args)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log.error(`[SlashCommands] /${parsed.command} failed:`, msg)
      return { success: false, command: parsed.command, message: `Failed: ${msg}` }
    }
  }

  /**
   * Get all registered commands (for autocomplete / help).
   */
  getCommands(): Array<{
    name: string
    description: string
    argHint: string
    multiline?: boolean
  }> {
    return Array.from(this.commands.values()).map(({ name, description, argHint, multiline }) => ({
      name,
      description,
      argHint,
      multiline
    }))
  }
}

// Singleton
let instance: SlashCommandRegistry | null = null

export function getSlashCommandRegistry(): SlashCommandRegistry {
  if (!instance) {
    instance = new SlashCommandRegistry()
  }
  return instance
}
