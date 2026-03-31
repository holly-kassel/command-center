import { DEFAULT_NUDGE_CONFIG } from '../../shared/types/chat'
import type { NudgeConfig } from '../../shared/types/chat'
import { DEFAULT_DASHBOARD_LAYOUT } from '../../shared/types/settings'
import type { DashboardLayout } from '../../shared/types/settings'

/**
 * Persistent settings store using electron-store
 * Wraps electron-store with typed accessors for app configuration
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ElectronStore = require('electron-store')

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

export const DEFAULT_SETTINGS: Omit<AppSettings, 'windowBounds' | 'lastSyncTime'> = {
  obsidianVaultPath: '',
  calendarRefreshInterval: 5,
  githubRefreshInterval: 10,
  theme: 'dark',
  userName: 'Holly',
  meetingFilterPatterns: ['Lunch', 'Focus Time', 'OOO', 'No Meetings'],
  katyaNudgeConfig: DEFAULT_NUDGE_CONFIG,
  dashboardLayout: DEFAULT_DASHBOARD_LAYOUT,
  openaiApiKey: '',
  meetingSummaryModel: 'gpt-4o-mini',
  decisionEvalModel: 'gpt-4o-mini'
}

const store = new (ElectronStore.default || ElectronStore)({
  defaults: {
    ...DEFAULT_SETTINGS,
    windowBounds: { width: 1400, height: 900 },
    lastSyncTime: 0
  }
})

export const settings = {
  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return store.get(key)
  },

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    store.set(key, value)
  },

  getAll(): AppSettings {
    return {
      obsidianVaultPath: store.get('obsidianVaultPath') as string,
      calendarRefreshInterval: store.get('calendarRefreshInterval') as number,
      githubRefreshInterval: store.get('githubRefreshInterval') as number,
      theme: store.get('theme') as AppSettings['theme'],
      userName: store.get('userName') as string,
      windowBounds: store.get('windowBounds') as AppSettings['windowBounds'],
      lastSyncTime: store.get('lastSyncTime') as number,
      meetingFilterPatterns: (store.get('meetingFilterPatterns') as string[]) || [
        'Lunch',
        'Focus Time',
        'OOO',
        'No Meetings'
      ],
      katyaNudgeConfig: (store.get('katyaNudgeConfig') as NudgeConfig) || DEFAULT_NUDGE_CONFIG,
      dashboardLayout: (store.get('dashboardLayout') as DashboardLayout) || DEFAULT_DASHBOARD_LAYOUT,
      openaiApiKey: (store.get('openaiApiKey') as string) || '',
      meetingSummaryModel: (store.get('meetingSummaryModel') as string) || 'gpt-4o-mini',
      decisionEvalModel: (store.get('decisionEvalModel') as string) || 'gpt-4o-mini'
    }
  },

  update(partial: Partial<AppSettings>): AppSettings {
    for (const [key, value] of Object.entries(partial)) {
      store.set(key, value)
    }
    return this.getAll()
  },

  getObsidianVaultPath(): string {
    return store.get('obsidianVaultPath')
  },

  setObsidianVaultPath(path: string): void {
    store.set('obsidianVaultPath', path)
  }
}
