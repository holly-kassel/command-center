import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { TodaySection, VaultStatus, WeeklyNote } from '../shared/types/obsidian'
import type { CalendarEvent } from '../shared/types/calendar'
import type { GitHubNotification } from '../shared/types/github'

// Obsidian API exposed to renderer
const obsidianApi = {
  findVault: (): Promise<string> => ipcRenderer.invoke('obsidian:findVault'),
  setVaultPath: (path: string): Promise<void> => ipcRenderer.invoke('obsidian:setVaultPath', path),
  getVaultStatus: (): Promise<VaultStatus> => ipcRenderer.invoke('obsidian:getVaultStatus'),
  getTodaySection: (): Promise<TodaySection | null> =>
    ipcRenderer.invoke('obsidian:getTodaySection'),
  getCurrentFocus: (): Promise<string | null> => ipcRenderer.invoke('obsidian:getCurrentFocus'),
  getWeeklyNote: (): Promise<WeeklyNote | null> => ipcRenderer.invoke('obsidian:getWeeklyNote'),
  appendToToday: (text: string): Promise<void> =>
    ipcRenderer.invoke('obsidian:appendToToday', text),
  onFileChanged: (callback: (data: { filePath: string }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { filePath: string }): void => {
      callback(data)
    }
    ipcRenderer.on('obsidian:file-changed', handler)
    return () => ipcRenderer.removeListener('obsidian:file-changed', handler)
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
  getTodayEvents: (): Promise<CalendarEvent[]> =>
    ipcRenderer.invoke('calendar:getTodayEvents'),
  getNextMeeting: (): Promise<CalendarEvent | null> =>
    ipcRenderer.invoke('calendar:getNextMeeting'),
  getEvents: (startISO: string, endISO: string): Promise<CalendarEvent[]> =>
    ipcRenderer.invoke('calendar:getEvents', startISO, endISO),
  refresh: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('calendar:refresh'),
}

// GitHub API exposed to renderer
const githubApi = {
  getNotifications: (): Promise<GitHubNotification[]> =>
    ipcRenderer.invoke('github:getNotifications'),
  markAsRead: (threadId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('github:markAsRead', threadId),
  isConfigured: (): Promise<boolean> =>
    ipcRenderer.invoke('github:isConfigured'),
  setPAT: (pat: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('github:setPAT', pat),
}

// Custom APIs for renderer
const api = {
  obsidian: obsidianApi,
  auth: authApi,
  calendar: calendarApi,
  github: githubApi,
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
