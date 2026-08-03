import { DEFAULT_NUDGE_CONFIG } from '../../shared/types/chat'
import type { NudgeConfig } from '../../shared/types/chat'
import { DEFAULT_DASHBOARD_LAYOUT, DEFAULT_LLM_PROVIDER } from '../../shared/types/settings'
import type { DashboardLayout, LLMProviderId } from '../../shared/types/settings'

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
  llmProvider: LLMProviderId
  llmChatModel: string
  llmBaseUrl: string
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
  meetingSummaryModel: 'gpt-5',
  decisionEvalModel: 'gpt-4o-mini',
  llmProvider: DEFAULT_LLM_PROVIDER,
  llmChatModel: 'gpt-4.1',
  llmBaseUrl: ''
}

const store = new (ElectronStore.default || ElectronStore)({
  defaults: {
    ...DEFAULT_SETTINGS,
    windowBounds: { width: 1400, height: 900 },
    lastSyncTime: 0
  }
})

if (store.get('meetingSummaryModelDefaultVersion') !== 2) {
  store.set('meetingSummaryModel', 'gpt-5')
  store.set('meetingSummaryModelDefaultVersion', 2)
}

/**
 * GitHub Models was retired on 2026-07-30 and its endpoint now returns HTTP 410.
 * It used namespaced model ids (`openai/gpt-5`); every direct OpenAI-compatible
 * provider uses bare ids (`gpt-5`). Strip the namespace once, and move the stored
 * provider onto the new default.
 */
if (store.get('llmProviderVersion') !== 1) {
  for (const key of ['meetingSummaryModel', 'decisionEvalModel', 'llmChatModel'] as const) {
    const value = store.get(key) as string
    if (typeof value === 'string' && value.includes('/')) {
      store.set(key, value.slice(value.lastIndexOf('/') + 1))
    }
  }
  if (!store.get('llmProvider')) store.set('llmProvider', DEFAULT_LLM_PROVIDER)
  store.set('llmProviderVersion', 1)
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
      meetingSummaryModel: (store.get('meetingSummaryModel') as string) || 'gpt-5',
      decisionEvalModel: (store.get('decisionEvalModel') as string) || 'gpt-4o-mini',
      llmProvider: (store.get('llmProvider') as LLMProviderId) || DEFAULT_LLM_PROVIDER,
      llmChatModel: (store.get('llmChatModel') as string) || 'gpt-4.1',
      llmBaseUrl: (store.get('llmBaseUrl') as string) || ''
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
