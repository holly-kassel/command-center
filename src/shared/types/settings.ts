/**
 * Shared Settings Types
 *
 * Mirrors the main process AppSettings for typed IPC.
 */
export interface AppSettings {
  obsidianVaultPath: string
  calendarRefreshInterval: number
  githubRefreshInterval: number
  theme: 'light' | 'dark' | 'system'
  userName: string
  windowBounds: { width: number; height: number; x?: number; y?: number }
  lastSyncTime: number
}
