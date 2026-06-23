/**
 * Chat Types — shared between main process (ChatService) and renderer (chatStore)
 */

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'nudge'
  content: string
  timestamp: number
  isStreaming?: boolean
}

export interface ChatConversation {
  date: string // YYYY-MM-DD
  messages: ChatMessage[]
}

export interface ChatContextSummary {
  todaySection: string | null
  upcomingMeetings: string[]
  currentFocus: string | null
  activeGoals: string[]
}

export interface NudgeConfig {
  enabled: boolean
  meetingReminderMinutes: number
  checkInIntervalMinutes: number
  endOfDayHour: number // 24h format, e.g. 16 for 4pm
}

export const DEFAULT_NUDGE_CONFIG: NudgeConfig = {
  enabled: true,
  meetingReminderMinutes: 10,
  checkInIntervalMinutes: 90,
  endOfDayHour: 16,
}

export interface ChatStreamChunk {
  messageId: string
  chunk: string
}
