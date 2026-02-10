import { ElectronAPI } from '@electron-toolkit/preload'
import type { TodaySection, VaultStatus, WeeklyNote } from '../shared/types/obsidian'
import type { CalendarEvent } from '../shared/types/calendar'
import type { GitHubNotification } from '../shared/types/github'
import type { ParsedSlackThread } from '../shared/types/slack'

interface ObsidianApi {
  findVault(): Promise<string>
  setVaultPath(path: string): Promise<void>
  getVaultStatus(): Promise<VaultStatus>
  getTodaySection(): Promise<TodaySection | null>
  getCurrentFocus(): Promise<string | null>
  getWeeklyNote(): Promise<WeeklyNote | null>
  appendToToday(text: string): Promise<void>
  onFileChanged(callback: (data: { filePath: string }) => void): () => void
}

interface AuthApi {
  loginMicrosoft(): Promise<{ success: boolean; error?: string }>
  isAuthenticated(): Promise<boolean>
  logout(): Promise<{ success: boolean; error?: string }>
}

interface CalendarApi {
  getTodayEvents(): Promise<CalendarEvent[]>
  getNextMeeting(): Promise<CalendarEvent | null>
  getEvents(startISO: string, endISO: string): Promise<CalendarEvent[]>
  refresh(): Promise<{ success: boolean }>
}

interface GitHubApi {
  getNotifications(): Promise<GitHubNotification[]>
  markAsRead(threadId: string): Promise<{ success: boolean; error?: string }>
  isConfigured(): Promise<boolean>
  setPAT(pat: string): Promise<{ success: boolean; error?: string }>
}

interface SlackApi {
  parseThread(rawText: string): Promise<ParsedSlackThread>
  saveToObsidian(thread: ParsedSlackThread, customTitle?: string): Promise<{ success: boolean; path: string }>
}

interface Api {
  obsidian: ObsidianApi
  auth: AuthApi
  calendar: CalendarApi
  github: GitHubApi
  slack: SlackApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
