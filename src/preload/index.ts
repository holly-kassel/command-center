import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
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
import type {
  TranscriptionResult,
  TranscriptionAndSummaryResult,
} from '../shared/types/transcription'
import { isMicrosoftAuthConfigurationError } from '../shared/constants/auth'

// Obsidian API exposed to renderer
const obsidianApi = {
  findVault: (): Promise<string> => ipcRenderer.invoke('obsidian:findVault'),
  setVaultPath: (path: string): Promise<void> => ipcRenderer.invoke('obsidian:setVaultPath', path),
  getVaultStatus: (): Promise<VaultStatus> => ipcRenderer.invoke('obsidian:getVaultStatus'),
  getTodaySection: (): Promise<TodaySection | null> =>
    ipcRenderer.invoke('obsidian:getTodaySection'),
  getDaySection: (dateStr: string): Promise<TodaySection | null> =>
    ipcRenderer.invoke('obsidian:getDaySection', dateStr),
  getCurrentFocus: (): Promise<string | null> => ipcRenderer.invoke('obsidian:getCurrentFocus'),
  getWeeklyNote: (): Promise<WeeklyNote | null> => ipcRenderer.invoke('obsidian:getWeeklyNote'),
  appendToToday: (text: string): Promise<void> =>
    ipcRenderer.invoke('obsidian:appendToToday', text),
  updateTodayContent: (content: string): Promise<void> =>
    ipcRenderer.invoke('obsidian:updateTodayContent', content),
  toggleCheckbox: (lineOffset: number): Promise<void> =>
    ipcRenderer.invoke('obsidian:toggleCheckbox', lineOffset),
  executeSlashCommand: (text: string): Promise<SlashCommandResult> =>
    ipcRenderer.invoke('obsidian:executeSlashCommand', text),
  getSlashCommands: (): Promise<SlashCommandInfo[]> =>
    ipcRenderer.invoke('obsidian:getSlashCommands'),
  onFileChanged: (callback: (data: { filePath: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { filePath: string }): void => {
      callback(data)
    }
    ipcRenderer.on('obsidian:file-changed', handler)
    return () => ipcRenderer.removeListener('obsidian:file-changed', handler)
  },
  onSyncUpdate: (callback: (data: { todaySection: unknown; currentFocus: string | null }) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { todaySection: unknown; currentFocus: string | null }): void => callback(data)
    ipcRenderer.on('sync:obsidian', handler)
    return () => ipcRenderer.removeListener('sync:obsidian', handler)
  },
}

// Auth API exposed to renderer
const authApi = {
  loginMicrosoft: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('auth:loginMicrosoft'),
  isAuthenticated: (): Promise<boolean> => ipcRenderer.invoke('auth:isAuthenticated'),
  logout: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('auth:logout'),
}

// Calendar API exposed to renderer
const calendarApi = {
  getTodayEvents: async (): Promise<CalendarEvent[]> => {
    try {
      return await ipcRenderer.invoke('calendar:getTodayEvents')
    } catch (error) {
      if (isMicrosoftAuthConfigurationError(error)) {
        return []
      }
      throw error
    }
  },
  getNextMeeting: async (): Promise<CalendarEvent | null> => {
    try {
      return await ipcRenderer.invoke('calendar:getNextMeeting')
    } catch (error) {
      if (isMicrosoftAuthConfigurationError(error)) {
        return null
      }
      throw error
    }
  },
  getEvents: async (startISO: string, endISO: string): Promise<CalendarEvent[]> => {
    try {
      return await ipcRenderer.invoke('calendar:getEvents', startISO, endISO)
    } catch (error) {
      if (isMicrosoftAuthConfigurationError(error)) {
        return []
      }
      throw error
    }
  },
  refresh: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('calendar:refresh'),
  onSyncUpdate: (callback: (events: CalendarEvent[]) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, events: CalendarEvent[]): void => callback(events)
    ipcRenderer.on('sync:calendar', handler)
    return () => ipcRenderer.removeListener('sync:calendar', handler)
  },
  onNextMeetingUpdate: (callback: (meeting: CalendarEvent | null) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, meeting: CalendarEvent | null): void => callback(meeting)
    ipcRenderer.on('sync:nextMeeting', handler)
    return () => ipcRenderer.removeListener('sync:nextMeeting', handler)
  },
}

// GitHub API exposed to renderer
const githubApi = {
  getNotifications: (): Promise<GitHubNotification[]> =>
    ipcRenderer.invoke('github:getNotifications'),
  getPullRequests: (): Promise<GitHubPullRequest[]> =>
    ipcRenderer.invoke('github:getPullRequests'),
  markAsRead: (threadId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('github:markAsRead', threadId),
  isConfigured: (): Promise<boolean> =>
    ipcRenderer.invoke('github:isConfigured'),
  setPAT: (pat: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('github:setPAT', pat),
  onSyncUpdate: (callback: (notifications: GitHubNotification[]) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, notifs: GitHubNotification[]): void => callback(notifs)
    ipcRenderer.on('sync:github', handler)
    return () => ipcRenderer.removeListener('sync:github', handler)
  },
}

// Slack API exposed to renderer
const slackApi = {
  parseThread: (rawText: string): Promise<ParsedSlackThread> =>
    ipcRenderer.invoke('slack:parseThread', rawText),
  saveToObsidian: (thread: ParsedSlackThread, customTitle?: string): Promise<{ success: boolean; path: string }> =>
    ipcRenderer.invoke('slack:saveToObsidian', thread, customTitle),
}

// Ritual API exposed to renderer
const ritualApi = {
  getDailyLog: (date: string): Promise<DailyLog> =>
    ipcRenderer.invoke('ritual:getDailyLog', date),
  getTodayLog: (): Promise<DailyLog> =>
    ipcRenderer.invoke('ritual:getTodayLog'),
  saveDailyLog: (date: string, partial: Partial<DailyLog>): Promise<DailyLog> =>
    ipcRenderer.invoke('ritual:saveDailyLog', date, partial),
  getLogsInRange: (start: string, end: string): Promise<DailyLog[]> =>
    ipcRenderer.invoke('ritual:getLogsInRange', start, end),
  getStreak: (type: StreakType): Promise<Streak> =>
    ipcRenderer.invoke('ritual:getStreak', type),
  getAllStreaks: (): Promise<Record<StreakType, Streak>> =>
    ipcRenderer.invoke('ritual:getAllStreaks'),
  updateStreak: (type: StreakType): Promise<Streak> =>
    ipcRenderer.invoke('ritual:updateStreak', type),
  checkFullDayStreak: (): Promise<Streak | null> =>
    ipcRenderer.invoke('ritual:checkFullDayStreak'),
  getWeeklyMetrics: (weekStart?: string): Promise<WeeklyRitualMetrics> =>
    ipcRenderer.invoke('ritual:getWeeklyMetrics', weekStart),
  onSyncUpdate: (callback: (data: { todayLog: DailyLog; streaks: Record<StreakType, Streak> }) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { todayLog: DailyLog; streaks: Record<StreakType, Streak> }): void => callback(data)
    ipcRenderer.on('sync:ritual', handler)
    return () => ipcRenderer.removeListener('sync:ritual', handler)
  },
}

// Goal API exposed to renderer
const goalApi = {
  create: (input: CreateGoalInput): Promise<Goal> =>
    ipcRenderer.invoke('goal:create', input),
  get: (id: string): Promise<Goal | null> =>
    ipcRenderer.invoke('goal:get', id),
  getAll: (): Promise<Goal[]> =>
    ipcRenderer.invoke('goal:getAll'),
  update: (id: string, updates: UpdateGoalInput): Promise<Goal | null> =>
    ipcRenderer.invoke('goal:update', id, updates),
  delete: (id: string): Promise<boolean> =>
    ipcRenderer.invoke('goal:delete', id),
  getByLevel: (level: GoalLevel): Promise<Goal[]> =>
    ipcRenderer.invoke('goal:getByLevel', level),
  getByCategory: (category: GoalCategory): Promise<Goal[]> =>
    ipcRenderer.invoke('goal:getByCategory', category),
  getByStatus: (status: GoalStatus): Promise<Goal[]> =>
    ipcRenderer.invoke('goal:getByStatus', status),
  getActive: (): Promise<Goal[]> =>
    ipcRenderer.invoke('goal:getActive'),
  getChildren: (parentId: string): Promise<Goal[]> =>
    ipcRenderer.invoke('goal:getChildren', parentId),
  getTree: (): Promise<GoalWithChildren[]> =>
    ipcRenderer.invoke('goal:getTree'),
  getSuggestedParents: (level: GoalLevel): Promise<Goal[]> =>
    ipcRenderer.invoke('goal:getSuggestedParents', level),
  linkTask: (goalId: string, taskText: string): Promise<GoalTaskLink> =>
    ipcRenderer.invoke('goal:linkTask', goalId, taskText),
  unlinkTask: (linkId: string): Promise<boolean> =>
    ipcRenderer.invoke('goal:unlinkTask', linkId),
  getTaskLinks: (goalId: string): Promise<GoalTaskLink[]> =>
    ipcRenderer.invoke('goal:getTaskLinks', goalId),
  getAllTaskLinks: (): Promise<GoalTaskLink[]> =>
    ipcRenderer.invoke('goal:getAllTaskLinks'),
  updateTaskCompletion: (taskText: string, completed: boolean): Promise<GoalTaskLink[]> =>
    ipcRenderer.invoke('goal:updateTaskCompletion', taskText, completed),
  recalculateProgress: (goalId: string): Promise<number> =>
    ipcRenderer.invoke('goal:recalculateProgress', goalId),
  getSummary: (): Promise<{ totalActive: number; byLevel: Record<GoalLevel, number>; byCategory: Record<GoalCategory, number>; completedThisWeek: number }> =>
    ipcRenderer.invoke('goal:getSummary'),
  onSyncUpdate: (callback: (data: { goals: Goal[]; summary: { totalActive: number; completedThisWeek: number } }) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { goals: Goal[]; summary: { totalActive: number; completedThisWeek: number } }): void => callback(data)
    ipcRenderer.on('sync:goal', handler)
    return () => ipcRenderer.removeListener('sync:goal', handler)
  },
}

// Transcription API exposed to renderer
const transcriptionApi = {
  transcribe: (audioBuffer: ArrayBuffer, durationSeconds: number): Promise<TranscriptionResult> =>
    ipcRenderer.invoke('transcription:transcribe', audioBuffer, durationSeconds),
  transcribeAndSummarize: (audioBuffer: ArrayBuffer, durationSeconds: number): Promise<TranscriptionAndSummaryResult> =>
    ipcRenderer.invoke('transcription:transcribeAndSummarize', audioBuffer, durationSeconds),
}

// App utilities
const appApi = {
  getSound: (filename: string): Promise<ArrayBuffer | null> =>
    ipcRenderer.invoke('app:getSound', filename),
}

// Settings API exposed to renderer
const settingsApi = {
  getAll: (): Promise<AppSettings> => ipcRenderer.invoke('settings:getAll'),
  update: (partial: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update', partial),
  get: <K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> =>
    ipcRenderer.invoke('settings:get', key),
  browseVaultPath: (): Promise<string | null> =>
    ipcRenderer.invoke('settings:browseVaultPath'),
  onFocusModeToggle: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('app:toggleFocusMode', handler)
    return () => ipcRenderer.removeListener('app:toggleFocusMode', handler)
  },
  onOpenSettings: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('menu:openSettings', handler)
    return () => ipcRenderer.removeListener('menu:openSettings', handler)
  },
}

// Custom APIs for renderer
const api = {
  obsidian: obsidianApi,
  auth: authApi,
  calendar: calendarApi,
  github: githubApi,
  slack: slackApi,
  ritual: ritualApi,
  goal: goalApi,
  transcription: transcriptionApi,
  settings: settingsApi,
  app: appApi,
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
