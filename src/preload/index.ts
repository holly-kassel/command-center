import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { TodaySection, VaultStatus, WeeklyNote, SlashCommandResult, SlashCommandInfo, WeeklyNoteSummary, WeeklySectionResult } from '../shared/types/obsidian'
import type { CalendarEvent } from '../shared/types/calendar'
import type { GitHubNotification, GitHubPullRequest, NotificationTriageData, TriageStatus, TriagePriority } from '../shared/types/github'
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
  KanbanTask,
  KanbanStatus,
} from '../shared/types/goal'
import type {
  TranscriptionResult,
  TranscriptionAndSummaryResult,
  MeetingSegment,
  MeetingNotes,
  SavedMeeting,
  EvaluatedDecision,
} from '../shared/types/transcription'
import type { ChatConversation, ChatMessage, ChatStreamChunk, NudgeConfig } from '../shared/types/chat'

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
  appendBlockToToday: (block: string): Promise<void> =>
    ipcRenderer.invoke('obsidian:appendBlockToToday', block),
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
  listWeeklyNotes: (): Promise<WeeklyNoteSummary[]> =>
    ipcRenderer.invoke('obsidian:listWeeklyNotes'),
  ensureCurrentWeekNote: (): Promise<string> =>
    ipcRenderer.invoke('obsidian:ensureCurrentWeekNote'),
  updateDayContent: (dateStr: string, content: string): Promise<void> =>
    ipcRenderer.invoke('obsidian:updateDayContent', dateStr, content),
  getWeeklySection: (dateStr: string, section: string): Promise<WeeklySectionResult | null> =>
    ipcRenderer.invoke('obsidian:getWeeklySection', dateStr, section),
  updateWeeklySection: (dateStr: string, section: string, content: string): Promise<void> =>
    ipcRenderer.invoke('obsidian:updateWeeklySection', dateStr, section, content),
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
  getTodayEvents: (): Promise<CalendarEvent[]> =>
    ipcRenderer.invoke('calendar:getTodayEvents'),
  getNextMeeting: (): Promise<CalendarEvent | null> =>
    ipcRenderer.invoke('calendar:getNextMeeting'),
  getEvents: (startISO: string, endISO: string): Promise<CalendarEvent[]> =>
    ipcRenderer.invoke('calendar:getEvents', startISO, endISO),
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
  getAllTriageData: (): Promise<Record<string, NotificationTriageData>> =>
    ipcRenderer.invoke('github:getAllTriageData'),
  setTriageStatus: (notificationId: string, status: TriageStatus): Promise<NotificationTriageData> =>
    ipcRenderer.invoke('github:setTriageStatus', notificationId, status),
  setTriagePriority: (notificationId: string, priority: TriagePriority): Promise<NotificationTriageData> =>
    ipcRenderer.invoke('github:setTriagePriority', notificationId, priority),
  setTriageNotes: (notificationId: string, notes: string): Promise<NotificationTriageData> =>
    ipcRenderer.invoke('github:setTriageNotes', notificationId, notes),
  getTriageSortOrder: (): Promise<string[]> =>
    ipcRenderer.invoke('github:getTriageSortOrder'),
  setTriageSortOrder: (order: string[]): Promise<void> =>
    ipcRenderer.invoke('github:setTriageSortOrder', order),
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

const kanbanApi = {
  getAllTasks: (): Promise<KanbanTask[]> => ipcRenderer.invoke('kanban:getAllTasks'),
  addTask: (
    text: string,
    source?: string,
    sourceNotificationId?: string,
    sourceUrl?: string,
  ): Promise<KanbanTask> =>
    ipcRenderer.invoke('kanban:addTask', text, source, sourceNotificationId, sourceUrl),
  moveTask: (
    taskId: string,
    newStatus: KanbanStatus,
    newPosition: number,
  ): Promise<KanbanTask | null> =>
    ipcRenderer.invoke('kanban:moveTask', taskId, newStatus, newPosition),
  reorderTask: (taskId: string, newPosition: number): Promise<KanbanTask | null> =>
    ipcRenderer.invoke('kanban:reorderTask', taskId, newPosition),
  updateTaskText: (taskId: string, text: string): Promise<KanbanTask | null> =>
    ipcRenderer.invoke('kanban:updateTaskText', taskId, text),
  deleteTask: (taskId: string): Promise<boolean> => ipcRenderer.invoke('kanban:deleteTask', taskId),
  findByNotificationId: (notificationId: string): Promise<KanbanTask | null> =>
    ipcRenderer.invoke('kanban:findByNotificationId', notificationId),
}

// Transcription API exposed to renderer
const transcriptionApi = {
  transcribe: (audioBuffer: ArrayBuffer, durationSeconds: number): Promise<TranscriptionResult> =>
    ipcRenderer.invoke('transcription:transcribe', audioBuffer, durationSeconds),
  transcribeAndSummarize: (audioBuffer: ArrayBuffer, durationSeconds: number): Promise<TranscriptionAndSummaryResult> =>
    ipcRenderer.invoke('transcription:transcribeAndSummarize', audioBuffer, durationSeconds),
  transcribeChunk: (audioBuffer: ArrayBuffer, options: { language?: string; speakerDiarization?: boolean }): Promise<MeetingSegment[]> =>
    ipcRenderer.invoke('transcription:transcribeChunk', audioBuffer, options),
  summarizeMeeting: (transcript: string, participants?: string[]): Promise<MeetingNotes> =>
    ipcRenderer.invoke('transcription:summarizeMeeting', transcript, participants),
  saveMeeting: (meeting: SavedMeeting): Promise<SavedMeeting> =>
    ipcRenderer.invoke('transcription:saveMeeting', meeting),
  getMeetings: (): Promise<SavedMeeting[]> =>
    ipcRenderer.invoke('transcription:getMeetings'),
  deleteMeeting: (meetingId: string): Promise<boolean> =>
    ipcRenderer.invoke('transcription:deleteMeeting', meetingId),
  saveTranscriptToVault: (meeting: SavedMeeting): Promise<{ filename: string; path: string }> =>
    ipcRenderer.invoke('transcription:saveTranscriptToVault', meeting),
}

// Decision Evaluation API exposed to renderer
const decisionEvalApi = {
  evaluate: (decisions: string[]): Promise<EvaluatedDecision[]> =>
    ipcRenderer.invoke('decisionEval:evaluate', decisions),
  invalidateCache: (): Promise<void> =>
    ipcRenderer.invoke('decisionEval:invalidateCache'),
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

// Chat API exposed to renderer
const chatApi = {
  sendMessage: (text: string): Promise<ChatMessage> =>
    ipcRenderer.invoke('chat:send-message', text),
  getConversation: (date?: string): Promise<ChatConversation> =>
    ipcRenderer.invoke('chat:get-conversation', date),
  clearConversation: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('chat:clear-conversation'),
  getNudgeConfig: (): Promise<NudgeConfig> =>
    ipcRenderer.invoke('chat:get-nudge-config'),
  setNudgeConfig: (config: Partial<NudgeConfig>): Promise<NudgeConfig> =>
    ipcRenderer.invoke('chat:set-nudge-config', config),
  onStreamChunk: (callback: (data: ChatStreamChunk) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: ChatStreamChunk): void => callback(data)
    ipcRenderer.on('chat:stream-chunk', handler)
    return () => ipcRenderer.removeListener('chat:stream-chunk', handler)
  },
  onStreamDone: (callback: (data: { messageId: string }) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { messageId: string }): void => callback(data)
    ipcRenderer.on('chat:stream-done', handler)
    return () => ipcRenderer.removeListener('chat:stream-done', handler)
  },
  onNudge: (callback: (message: ChatMessage) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, message: ChatMessage): void => callback(message)
    ipcRenderer.on('chat:nudge', handler)
    return () => ipcRenderer.removeListener('chat:nudge', handler)
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
  kanban: kanbanApi,
  transcription: transcriptionApi,
  decisionEval: decisionEvalApi,
  chat: chatApi,
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
