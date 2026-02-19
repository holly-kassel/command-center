import { ElectronAPI } from '@electron-toolkit/preload'
import type { TodaySection, VaultStatus, WeeklyNote, SlashCommandResult, SlashCommandInfo } from '../shared/types/obsidian'
import type { CalendarEvent } from '../shared/types/calendar'
import type { GitHubNotification, GitHubPullRequest } from '../shared/types/github'
import type { ParsedSlackThread } from '../shared/types/slack'
import type { AppSettings } from '../shared/types/settings'
import type { DailyLog, Streak, StreakType, WeeklyRitualMetrics } from '../shared/types/ritual'
import type {
  Goal,
  GoalWithChildren,
  GoalTaskLink,
  CreateGoalInput,
  UpdateGoalInput,
  GoalLevel,
  GoalCategory,
  GoalStatus,
} from '../shared/types/goal'

interface ObsidianApi {
  findVault(): Promise<string>
  setVaultPath(path: string): Promise<void>
  getVaultStatus(): Promise<VaultStatus>
  getTodaySection(): Promise<TodaySection | null>
  getCurrentFocus(): Promise<string | null>
  getWeeklyNote(): Promise<WeeklyNote | null>
  appendToToday(text: string): Promise<void>
  updateTodayContent(content: string): Promise<void>
  toggleCheckbox(lineOffset: number): Promise<void>
  executeSlashCommand(text: string): Promise<SlashCommandResult>
  getSlashCommands(): Promise<SlashCommandInfo[]>
  onFileChanged(callback: (data: { filePath: string }) => void): () => void
  onSyncUpdate(callback: (data: { todaySection: TodaySection | null; currentFocus: string | null }) => void): () => void
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
  onSyncUpdate(callback: (events: CalendarEvent[]) => void): () => void
  onNextMeetingUpdate(callback: (meeting: CalendarEvent | null) => void): () => void
}

interface GitHubApi {
  getNotifications(): Promise<GitHubNotification[]>
  getPullRequests(): Promise<GitHubPullRequest[]>
  markAsRead(threadId: string): Promise<{ success: boolean; error?: string }>
  isConfigured(): Promise<boolean>
  setPAT(pat: string): Promise<{ success: boolean; error?: string }>
  onSyncUpdate(callback: (notifications: GitHubNotification[]) => void): () => void
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
  onFocusModeToggle(callback: () => void): () => void
  onOpenSettings(callback: () => void): () => void
}

interface RitualApi {
  getDailyLog(date: string): Promise<DailyLog>
  getTodayLog(): Promise<DailyLog>
  saveDailyLog(date: string, partial: Partial<DailyLog>): Promise<DailyLog>
  getLogsInRange(start: string, end: string): Promise<DailyLog[]>
  getStreak(type: StreakType): Promise<Streak>
  getAllStreaks(): Promise<Record<StreakType, Streak>>
  updateStreak(type: StreakType): Promise<Streak>
  checkFullDayStreak(): Promise<Streak | null>
  getWeeklyMetrics(weekStart?: string): Promise<WeeklyRitualMetrics>
  onSyncUpdate(callback: (data: { todayLog: DailyLog; streaks: Record<StreakType, Streak> }) => void): () => void
}

interface GoalApi {
  create(input: CreateGoalInput): Promise<Goal>
  get(id: string): Promise<Goal | null>
  getAll(): Promise<Goal[]>
  update(id: string, updates: UpdateGoalInput): Promise<Goal | null>
  delete(id: string): Promise<boolean>
  getByLevel(level: GoalLevel): Promise<Goal[]>
  getByCategory(category: GoalCategory): Promise<Goal[]>
  getByStatus(status: GoalStatus): Promise<Goal[]>
  getActive(): Promise<Goal[]>
  getChildren(parentId: string): Promise<Goal[]>
  getTree(): Promise<GoalWithChildren[]>
  getSuggestedParents(level: GoalLevel): Promise<Goal[]>
  linkTask(goalId: string, taskText: string): Promise<GoalTaskLink>
  unlinkTask(linkId: string): Promise<boolean>
  getTaskLinks(goalId: string): Promise<GoalTaskLink[]>
  getAllTaskLinks(): Promise<GoalTaskLink[]>
  updateTaskCompletion(taskText: string, completed: boolean): Promise<GoalTaskLink[]>
  recalculateProgress(goalId: string): Promise<number>
  getSummary(): Promise<{ totalActive: number; byLevel: Record<GoalLevel, number>; byCategory: Record<GoalCategory, number>; completedThisWeek: number }>
  onSyncUpdate(callback: (data: { goals: Goal[]; summary: { totalActive: number; completedThisWeek: number } }) => void): () => void
}

interface Api {
  obsidian: ObsidianApi
  auth: AuthApi
  calendar: CalendarApi
  github: GitHubApi
  slack: SlackApi
  ritual: RitualApi
  goal: GoalApi
  settings: SettingsApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
