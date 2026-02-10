/**
 * Obsidian Zustand Store
 *
 * Manages Obsidian state in the renderer process.
 * Communicates with main process via window.api.obsidian.
 */
import { create } from 'zustand'
import type { TodaySection, VaultStatus } from '../../../shared/types/obsidian'

interface ObsidianState {
  // State
  vaultStatus: VaultStatus | null
  todaySection: TodaySection | null
  currentFocus: string | null
  isLoading: boolean
  error: string | null

  // Actions
  initialize: () => Promise<void>
  fetchTodaySection: () => Promise<void>
  appendToToday: (text: string) => Promise<void>
  refreshAll: () => Promise<void>
}

export const useObsidianStore = create<ObsidianState>((set, get) => ({
  vaultStatus: null,
  todaySection: null,
  currentFocus: null,
  isLoading: false,
  error: null,

  initialize: async () => {
    set({ isLoading: true, error: null })
    try {
      // Find vault
      await window.api.obsidian.findVault()
      const vaultStatus = await window.api.obsidian.getVaultStatus()
      set({ vaultStatus })

      if (vaultStatus.found) {
        // Fetch today's data
        await get().fetchTodaySection()

        // Listen for file changes
        window.api.obsidian.onFileChanged(() => {
          get().fetchTodaySection()
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize Obsidian'
      set({ error: message })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchTodaySection: async () => {
    try {
      const todaySection = await window.api.obsidian.getTodaySection()
      const currentFocus = await window.api.obsidian.getCurrentFocus()
      set({ todaySection, currentFocus, error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch today section'
      set({ error: message })
    }
  },

  appendToToday: async (text: string) => {
    try {
      await window.api.obsidian.appendToToday(text)
      // Refresh after appending
      await get().fetchTodaySection()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to append'
      set({ error: message })
      throw error // Re-throw so UI can show toast
    }
  },

  refreshAll: async () => {
    set({ isLoading: true })
    try {
      const vaultStatus = await window.api.obsidian.getVaultStatus()
      set({ vaultStatus })
      if (vaultStatus.found) {
        await get().fetchTodaySection()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Refresh failed'
      set({ error: message })
    } finally {
      set({ isLoading: false })
    }
  },
}))

// Listen for push updates from SyncManager
window.api.obsidian.onSyncUpdate(({ todaySection, currentFocus }) => {
  useObsidianStore.setState({
    todaySection,
    currentFocus,
    error: null,
  })
})
