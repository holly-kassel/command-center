import { ElectronAPI } from '@electron-toolkit/preload'
import type { TodaySection, VaultStatus, WeeklyNote } from '../shared/types/obsidian'

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

interface Api {
  obsidian: ObsidianApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}
