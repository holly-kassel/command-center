/**
 * Persistent settings store using electron-store
 * Wraps electron-store with typed accessors for app configuration
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ElectronStore = require('electron-store')

interface StoreSchema {
  obsidianVaultPath: string
  windowBounds: { width: number; height: number; x?: number; y?: number }
  lastSyncTime: number
}

const store = new (ElectronStore.default || ElectronStore)({
  defaults: {
    obsidianVaultPath: '',
    windowBounds: { width: 1200, height: 800 },
    lastSyncTime: 0,
  },
})

export const settings = {
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K] {
    return store.get(key)
  },

  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void {
    store.set(key, value)
  },

  getObsidianVaultPath(): string {
    return store.get('obsidianVaultPath')
  },

  setObsidianVaultPath(path: string): void {
    store.set('obsidianVaultPath', path)
  },
}
