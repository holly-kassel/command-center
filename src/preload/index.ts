import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { TodaySection, VaultStatus, WeeklyNote } from '../shared/types/obsidian'

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

// Custom APIs for renderer
const api = {
  obsidian: obsidianApi,
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
