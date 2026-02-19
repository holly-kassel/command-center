/**
 * Slash Command Registry
 *
 * Parses `/command args` text and routes to the appropriate service method.
 * Extensible — register new commands via .register().
 */
import log from 'electron-log'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getObsidianService } from '../obsidian/ObsidianService'
import { chatCompletion } from '../llm'
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

const TRANSCRIPT_SYSTEM_PROMPT = `You are a concise meeting note summarizer for a product manager's weekly notes.

Given a raw meeting transcript, produce a structured summary in this exact markdown format:

#### 📝 Meeting Summary: [short descriptive title]
**Participants:** [names]

**Key Discussion Points:**
- [point 1]
- [point 2]
- [etc.]

**Action Items:**
- [ ] [action item with owner if clear]
- [ ] [action item]

**Decisions Made:**
- [decision 1]
- [decision 2]

Rules:
- Be concise — strip filler words, repetition, and small talk
- Focus on decisions, action items, and key info
- Use the participants' first names
- If something is unclear from the transcript, note it as "[unclear]"
- Keep the total summary under 300 words
- Action items should be specific and actionable`

/**
 * Context files from LLM-context/ to load for transcript summarization.
 * Follows the routing table in LLM-context/index.md:
 *   work-related → business-profile.md
 *   billing terminology → billing-domain.md
 */
const TRANSCRIPT_CONTEXT_FILES = ['business-profile.md', 'billing-domain.md']

const SLACK_SYSTEM_PROMPT = `You are a concise Slack thread summarizer for a product manager's weekly notes.

Given a parsed Slack thread, produce a brief summary and action items in this exact markdown format:

**💬 Slack Thread Summary:** [one-line description of what was discussed]
**Participants:** [names]

**Key Points:**
- [point 1]
- [point 2]

**Action Items:**
- [ ] [action item with owner if clear]

Rules:
- Be very concise — 3-5 bullet points max for key points
- Only include action items if there are actual next steps discussed
- Use first names only
- Skip the action items section entirely if there are none
- Keep the total summary under 150 words`

/**
 * Load LLM context files from the Obsidian vault.
 * Returns the combined content, or empty string if vault/files not found.
 */
async function loadLLMContext(fileNames: string[]): Promise<string> {
  const vaultPath = getObsidianService().getVaultPath()
  if (!vaultPath) return ''

  const contextDir = join(vaultPath, 'LLM-context')
  if (!existsSync(contextDir)) return ''

  const sections: string[] = []

  for (const fileName of fileNames) {
    const filePath = join(contextDir, fileName)
    if (!existsSync(filePath)) {
      log.warn(`[SlashCommands] Context file not found: ${filePath}`)
      continue
    }

    try {
      const content = await readFile(filePath, 'utf-8')
      sections.push(`--- ${fileName} ---\n${content}`)
    } catch (err) {
      log.warn(`[SlashCommands] Failed to read context file: ${fileName}`, err)
    }
  }

  if (sections.length === 0) return ''

  return (
    '\n\n## Personal Context (use this to understand the user, their team, and domain terminology)\n\n' +
    sections.join('\n\n')
  )
}

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
          { temperature: 0.2, maxTokens: 1024 }
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
