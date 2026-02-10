import { ElectronAPI } from '@electron-toolkit/preload'
import type { TodaySection, VaultStatus, WeeklyNote } from '../shared/types/obsidian'
import type { CalendarEvent } from '../shared/types/calendar'
import type { GitHubNotification } from '../shared/types/github'
import type { ParsedSlackThread } from '../shared/types/slack'
import type { AppSettings } from '../shared/types/settings'

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

interface SettingsApi {
  getAll(): Promise<AppSettings>
  update(partial: Partial<AppSettings>): Promise<AppSettings>
  get<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]>
  browseVaultPath(): Promise<string | null>
}

interface Api {
  obsidian: ObsidianApi
  auth: AuthApi
  calendar: CalendarApi
  github: GitHubApi
  slack: SlackApi
  settings: SettingsApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
