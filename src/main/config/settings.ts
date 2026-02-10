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
}

export const DEFAULT_SETTINGS: Omit<AppSettings, 'windowBounds' | 'lastSyncTime'> = {
  obsidianVaultPath: '',
  calendarRefreshInterval: 5,
  githubRefreshInterval: 10,
  theme: 'dark',
  userName: 'Holly',
}

const store = new (ElectronStore.default || ElectronStore)({
  defaults: {
    ...DEFAULT_SETTINGS,
    windowBounds: { width: 1400, height: 900 },
    lastSyncTime: 0,
  },
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
  },
}
