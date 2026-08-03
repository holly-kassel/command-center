/**
 * Shared Settings Types
 *
 * Mirrors the main process AppSettings for typed IPC.
 */
import type { NudgeConfig } from './chat'

/** Panel identifiers for dashboard layout */
export type DashboardPanelId =
  | 'notes'
  | 'rituals'
  | 'calendar'
  | 'focus'
  | 'triage'
  | 'pullRequests'
  | 'transcripts'
  | 'goals'

/** Persisted dashboard layout — panel order per column */
export interface DashboardLayout {
  rightColumn: DashboardPanelId[]
}

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  rightColumn: ['rituals', 'calendar', 'focus', 'triage', 'pullRequests', 'transcripts']
}

/** Which LLM provider backs chat completions */
export type LLMProviderId = 'openai' | 'foundry' | 'custom'

export const DEFAULT_LLM_PROVIDER: LLMProviderId = 'openai'

/** Default OpenAI-compatible base URLs per provider (no trailing slash) */
export const OPENAI_BASE_URL = 'https://api.openai.com/v1'

export interface AppSettings {
  obsidianVaultPath: string
  calendarRefreshInterval: number
  githubRefreshInterval: number
  theme: 'light' | 'dark' | 'system'
  userName: string
  windowBounds: { width: number; height: number; x?: number; y?: number }
  lastSyncTime: number
  meetingFilterPatterns: string[]
  katyaNudgeConfig: NudgeConfig
  dashboardLayout: DashboardLayout
  meetingSummaryModel: string
  decisionEvalModel: string
  llmProvider: LLMProviderId
  /** Model used by chat and slash commands (the fast/cheap tier). */
  llmChatModel: string
  /**
   * OpenAI-compatible base URL, used by the `foundry` and `custom` providers.
   * Foundry looks like https://<resource>.openai.azure.com/openai/v1
   */
  llmBaseUrl: string
}
