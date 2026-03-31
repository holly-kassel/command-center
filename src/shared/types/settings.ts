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
  openaiApiKey: string
  meetingSummaryModel: string
  decisionEvalModel: string
}
