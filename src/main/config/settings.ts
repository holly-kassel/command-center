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
  meetingSummaryModel: 'openai/gpt-5',
  decisionEvalModel: 'openai/gpt-4o-mini'
}

const store = new (ElectronStore.default || ElectronStore)({
  defaults: {
    ...DEFAULT_SETTINGS,
    windowBounds: { width: 1400, height: 900 },
    lastSyncTime: 0
  }
})

const storedSummaryModel = store.get('meetingSummaryModel') as string
if (storedSummaryModel === 'gpt-4.1') {
  store.set('meetingSummaryModel', 'openai/gpt-4.1')
} else if (storedSummaryModel === 'gpt-4o-mini') {
  store.set(
    'meetingSummaryModel',
    store.get('meetingSummaryModelExplicit') ? 'openai/gpt-4o-mini' : 'openai/gpt-4.1'
  )
}
if (store.get('decisionEvalModel') === 'gpt-4o-mini') {
  store.set('decisionEvalModel', 'openai/gpt-4o-mini')
}
if (store.get('meetingSummaryModelDefaultVersion') !== 2) {
  store.set('meetingSummaryModel', 'openai/gpt-5')
  store.set('meetingSummaryModelDefaultVersion', 2)
}

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
      dashboardLayout:
        (store.get('dashboardLayout') as DashboardLayout) || DEFAULT_DASHBOARD_LAYOUT,
      meetingSummaryModel: (store.get('meetingSummaryModel') as string) || 'openai/gpt-5',
      decisionEvalModel: (store.get('decisionEvalModel') as string) || 'openai/gpt-4o-mini'
    }
  },

  update(partial: Partial<AppSettings>): AppSettings {
    for (const [key, value] of Object.entries(partial)) {
      store.set(key, value)
    }
    if (partial.meetingSummaryModel) {
      store.set('meetingSummaryModelExplicit', true)
    }
    return this.getAll()
  },

  getLegacyOpenAIApiKey(): string {
    return (store.get('openaiApiKey') as string) || ''
  },

  deleteLegacyOpenAIApiKey(): void {
    store.delete('openaiApiKey')
  },

  getObsidianVaultPath(): string {
    return store.get('obsidianVaultPath')
  },

  setObsidianVaultPath(path: string): void {
    store.set('obsidianVaultPath', path)
  }
}
