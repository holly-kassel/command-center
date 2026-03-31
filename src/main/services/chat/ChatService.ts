/**
 * Chat Service — Katya's Brain 🐾
 *
 * Manages conversation state, builds context-rich system prompts,
 * streams LLM responses, handles tool calls, persists per-day history,
 * and schedules proactive nudges.
 */
import log from 'electron-log'
import type { BrowserWindow } from 'electron'
import { chatCompletionStream, loadLLMContext } from '../llm'
import { loadVaultFiles } from '../llm/contextLoader'
import type { ChatMessage as LLMMessage } from '../llm'
import { getObsidianService } from '../obsidian/ObsidianService'
import { getCalendarService } from '../calendar/CalendarService'
import { getGoalService } from '../goal/GoalService'
import { getKatyaPersona, buildContextSection, buildNudgeMessage } from './katyaPrompt'
import { parseToolCalls, stripToolCalls, executeTool, formatToolResults } from './chatTools'
import type { ChatMessage, ChatConversation, NudgeConfig } from '../../../shared/types/chat'
import { DEFAULT_NUDGE_CONFIG } from '../../../shared/types/chat'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ElectronStore = require('electron-store')

const CONTEXT_FILES = ['business-profile.md', 'billing-domain.md', 'billing-experience-team.md']
const BILLING_EXPERIENCE_FILES = [
  'billing-experience/what-we-build.md',
  'billing-experience/tbb-customer-research.md',
  'billing-experience/user-level-budgets-dashboard.md',
]
const CONVERSATION_TTL_DAYS = 7
const CONTEXT_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

class ChatService {
  private store: InstanceType<typeof ElectronStore>
  private conversation: ChatConversation
  private mainWindow: BrowserWindow | null = null
  private nudgeTimers: ReturnType<typeof setInterval>[] = []
  private nudgedMeetingIds = new Set<string>()
  private cachedLLMContext: string | null = null
  private contextCacheTime = 0
  private isProcessing = false

  constructor() {
    this.store = new (ElectronStore.default || ElectronStore)({
      name: 'katya-chat',
      defaults: {
        nudgeConfig: DEFAULT_NUDGE_CONFIG,
      },
    })

    // Load today's conversation or start fresh
    const today = this.getTodayKey()
    const saved = this.store.get(`conversations.${today}`) as ChatConversation | undefined
    this.conversation = saved || { date: today, messages: [] }

    // Clean up old conversations on startup
    this.cleanupOldConversations()
  }

  // ─── Public API ───────────────────────────────────────────────

  /**
   * Send a user message and stream the assistant response.
   * Returns the final complete assistant message.
   */
  async sendMessage(text: string): Promise<ChatMessage> {
    if (this.isProcessing) {
      throw new Error('Already processing a message. Please wait.')
    }

    this.isProcessing = true

    try {
      // Add user message
      const userMessage: ChatMessage = {
        id: this.generateId(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      }
      this.conversation.messages.push(userMessage)

      // Build system prompt with fresh context
      const systemPrompt = await this.buildSystemPrompt()

      // Convert conversation to LLM format (cap at last 40 messages to limit token growth)
      const MAX_HISTORY_MESSAGES = 40
      const chatMessages = this.conversation.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
      const recentMessages = chatMessages.length > MAX_HISTORY_MESSAGES
        ? chatMessages.slice(-MAX_HISTORY_MESSAGES)
        : chatMessages
      const llmMessages: LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        ...recentMessages
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ]

      // Create assistant message placeholder
      const assistantMessage: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
      }

      // Stream the response
      let fullContent = ''
      for await (const chunk of chatCompletionStream(llmMessages, {
        temperature: 0.5,
        maxTokens: 1500,
      })) {
        fullContent += chunk
        this.sendStreamChunk(assistantMessage.id, chunk)
      }

      // Check for tool calls in the response
      const toolCalls = parseToolCalls(fullContent)
      if (toolCalls.length > 0) {
        // Strip tool markers from displayed content
        const displayContent = stripToolCalls(fullContent)
        fullContent = displayContent

        // Execute tools
        const results = await Promise.all(toolCalls.map(executeTool))
        const toolContext = formatToolResults(results)

        // Send a follow-up completion with tool results
        const followUpMessages: LLMMessage[] = [
          ...llmMessages,
          { role: 'assistant', content: displayContent },
          {
            role: 'system',
            content: `The following tool results are available. Use them to provide a complete answer to the user's question. Don't mention the tools directly — just incorporate the information naturally.\n${toolContext}`,
          },
        ]

        // Stream the follow-up
        let followUpContent = ''
        for await (const chunk of chatCompletionStream(followUpMessages, {
          temperature: 0.5,
          maxTokens: 1500,
        })) {
          followUpContent += chunk
          this.sendStreamChunk(assistantMessage.id, chunk)
        }

        fullContent = displayContent + (followUpContent ? '\n\n' + followUpContent : '')
      }

      // Finalize the assistant message
      assistantMessage.content = fullContent
      assistantMessage.isStreaming = false
      this.conversation.messages.push(assistantMessage)

      // Signal stream complete
      this.sendStreamDone(assistantMessage.id)

      // Persist conversation
      this.saveConversation()

      return assistantMessage
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log.error('[ChatService] sendMessage error:', msg)

      // Send an error message as Katya
      const errorMessage: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: `Oh no, something went wrong and I can't think right now 🐾 (${msg}). Try again in a sec?`,
        timestamp: Date.now(),
      }
      this.conversation.messages.push(errorMessage)
      this.sendStreamDone(errorMessage.id)
      this.saveConversation()
      return errorMessage
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Get the current conversation (or a specific date's).
   */
  getConversation(date?: string): ChatConversation {
    const key = date || this.getTodayKey()
    if (key === this.conversation.date) {
      return this.conversation
    }
    const saved = this.store.get(`conversations.${key}`) as ChatConversation | undefined
    return saved || { date: key, messages: [] }
  }

  /**
   * Clear the current conversation.
   */
  clearConversation(): void {
    this.conversation = { date: this.getTodayKey(), messages: [] }
    this.saveConversation()
  }

  /**
   * Get nudge configuration.
   */
  getNudgeConfig(): NudgeConfig {
    return (this.store.get('nudgeConfig') as NudgeConfig) || DEFAULT_NUDGE_CONFIG
  }

  /**
   * Update nudge configuration.
   */
  setNudgeConfig(config: Partial<NudgeConfig>): NudgeConfig {
    const current = this.getNudgeConfig()
    const updated = { ...current, ...config }
    this.store.set('nudgeConfig', updated)

    // Restart nudge timers with new config
    if (this.mainWindow) {
      this.stopNudges()
      this.scheduleNudges(this.mainWindow)
    }

    return updated
  }

  /**
   * Initialize the nudge scheduler.
   */
  scheduleNudges(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow
    const config = this.getNudgeConfig()
    if (!config.enabled) return

    log.info('[ChatService] Starting nudge scheduler')

    // Meeting reminder check — every 60 seconds
    const meetingTimer = setInterval(async () => {
      try {
        await this.checkMeetingNudge(config)
      } catch (error) {
        log.warn('[ChatService] Meeting nudge check failed:', error)
      }
    }, 60_000)
    this.nudgeTimers.push(meetingTimer)

    // Focus check-in — configurable interval
    const focusTimer = setInterval(async () => {
      try {
        await this.sendFocusCheckIn()
      } catch (error) {
        log.warn('[ChatService] Focus check-in failed:', error)
      }
    }, config.checkInIntervalMinutes * 60_000)
    this.nudgeTimers.push(focusTimer)

    // End-of-day prompt — check every minute starting at configured hour
    const eodTimer = setInterval(() => {
      const now = new Date()
      if (now.getHours() === config.endOfDayHour && now.getMinutes() === 30) {
        this.sendEndOfDayNudge()
      }
    }, 60_000)
    this.nudgeTimers.push(eodTimer)
  }

  /**
   * Stop all nudge timers.
   */
  stopNudges(): void {
    for (const timer of this.nudgeTimers) {
      clearInterval(timer)
    }
    this.nudgeTimers = []
    this.nudgedMeetingIds.clear()
  }

  // ─── System Prompt Builder ────────────────────────────────────

  private async buildSystemPrompt(): Promise<string> {
    const parts: string[] = []

    // Static persona
    parts.push(getKatyaPersona())

    // LLM context from vault (cached 5 min)
    const llmContext = await this.getCachedLLMContext()
    if (llmContext) {
      parts.push(llmContext)
    }

    // Dynamic context (schedule, tasks, focus, goals)
    try {
      const [todaySection, currentFocus, todayEvents, activeGoals] = await Promise.all([
        getObsidianService().getTodaySection(),
        getObsidianService().getCurrentFocus(),
        getCalendarService().getTodayEvents(),
        getGoalService().getActiveGoals(),
      ])

      const now = new Date()
      const contextSection = buildContextSection({
        currentTime: now.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        }),
        dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
        todaySection: todaySection?.content || null,
        currentFocus: currentFocus,
        upcomingMeetings: todayEvents,
        activeGoals: activeGoals.filter((g) => g.level === 'weekly').slice(0, 5),
      })
      parts.push(contextSection)
    } catch (error) {
      log.warn('[ChatService] Failed to load dynamic context:', error)
    }

    return parts.join('\n\n')
  }

  private async getCachedLLMContext(): Promise<string> {
    const now = Date.now()
    if (this.cachedLLMContext && now - this.contextCacheTime < CONTEXT_CACHE_TTL) {
      return this.cachedLLMContext
    }

    // Load LLM-context/ files + billing-experience/ vault docs
    const [llmContext, billingContext] = await Promise.all([
      loadLLMContext(CONTEXT_FILES),
      loadVaultFiles(BILLING_EXPERIENCE_FILES),
    ])

    this.cachedLLMContext = llmContext + billingContext
    this.contextCacheTime = now
    return this.cachedLLMContext
  }

  // ─── Nudge Handlers ───────────────────────────────────────────

  private async checkMeetingNudge(config: NudgeConfig): Promise<void> {
    if (!this.mainWindow) return

    const nextMeeting = await getCalendarService().getNextMeeting()
    if (!nextMeeting) return

    // Skip if already nudged for this meeting
    if (this.nudgedMeetingIds.has(nextMeeting.id)) return

    const startTime = new Date(nextMeeting.start).getTime()
    const now = Date.now()
    const minutesUntil = (startTime - now) / 60_000

    if (minutesUntil > 0 && minutesUntil <= config.meetingReminderMinutes) {
      const content = buildNudgeMessage('meeting', {
        meetingTitle: nextMeeting.title,
        minutesUntil: Math.round(minutesUntil),
      })

      this.sendNudge(content)
      this.nudgedMeetingIds.add(nextMeeting.id)
    }
  }

  private async sendFocusCheckIn(): Promise<void> {
    if (!this.mainWindow) return

    try {
      const currentFocus = await getObsidianService().getCurrentFocus()
      const content = buildNudgeMessage('focus_check', { currentFocus })
      this.sendNudge(content)
    } catch {
      // Silently skip if obsidian isn't available
    }
  }

  private sendEndOfDayNudge(): void {
    if (!this.mainWindow) return
    const content = buildNudgeMessage('end_of_day', {})
    this.sendNudge(content)
  }

  private sendNudge(content: string): void {
    const nudgeMessage: ChatMessage = {
      id: this.generateId(),
      role: 'nudge',
      content,
      timestamp: Date.now(),
    }

    this.conversation.messages.push(nudgeMessage)
    this.saveConversation()

    this.mainWindow?.webContents.send('chat:nudge', nudgeMessage)
  }

  // ─── IPC Helpers ──────────────────────────────────────────────

  private sendStreamChunk(messageId: string, chunk: string): void {
    this.mainWindow?.webContents.send('chat:stream-chunk', { messageId, chunk })
  }

  private sendStreamDone(messageId: string): void {
    this.mainWindow?.webContents.send('chat:stream-done', { messageId })
  }

  // ─── Persistence ──────────────────────────────────────────────

  private saveConversation(): void {
    this.store.set(`conversations.${this.conversation.date}`, this.conversation)
  }

  private cleanupOldConversations(): void {
    const all = (this.store.get('conversations') || {}) as Record<string, ChatConversation>
    const cutoff = Date.now() - CONVERSATION_TTL_DAYS * 24 * 60 * 60 * 1000
    let cleaned = 0

    for (const [dateKey, convo] of Object.entries(all)) {
      // Parse date key to check age
      const dateMs = new Date(dateKey).getTime()
      if (dateMs < cutoff && convo.messages.length > 0) {
        this.store.delete(`conversations.${dateKey}`)
        cleaned++
      }
    }

    if (cleaned > 0) {
      log.info(`[ChatService] Cleaned up ${cleaned} old conversations`)
    }
  }

  // ─── Utilities ────────────────────────────────────────────────

  private getTodayKey(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  /**
   * Set the main window reference for IPC communication.
   */
  setMainWindow(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow
  }
}

// Singleton
let instance: ChatService | null = null

export function getChatService(): ChatService {
  if (!instance) {
    instance = new ChatService()
  }
  return instance
}
