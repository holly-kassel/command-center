/**
 * Obsidian Zustand Store
 *
 * Manages Obsidian state in the renderer process.
 * Communicates with main process via window.api.obsidian.
 */
import { create } from 'zustand'
import type { TodaySection, VaultStatus, WeeklyNoteSummary } from '../../../shared/types/obsidian'

interface ObsidianState {
  // State
  vaultStatus: VaultStatus | null
  todaySection: TodaySection | null
  currentFocus: string | null
  isLoading: boolean
  error: string | null

  // Notes sidebar state
  weeklyNotes: WeeklyNoteSummary[]
  selectedDate: string | null
  sidebarLoading: boolean

  // Actions
  initialize: () => Promise<void>
  fetchTodaySection: () => Promise<void>
  fetchWeeklyNotesList: () => Promise<void>
  selectDate: (dateStr: string) => void
  appendToToday: (text: string) => Promise<void>
  updateTodayContent: (content: string) => Promise<void>
  updateDayContent: (dateStr: string, content: string) => Promise<void>
  toggleCheckbox: (lineOffset: number) => Promise<void>
  refreshAll: () => Promise<void>
}

export const useObsidianStore = create<ObsidianState>((set, get) => ({
  vaultStatus: null,
  todaySection: null,
  currentFocus: null,
  isLoading: false,
  error: null,
  weeklyNotes: [],
  selectedDate: null,
  sidebarLoading: false,

  initialize: async () => {
    set({ isLoading: true, error: null })
    try {
      // Find vault
      await window.api.obsidian.findVault()
      const vaultStatus = await window.api.obsidian.getVaultStatus()
      set({ vaultStatus })

      if (vaultStatus.found) {
        // Ensure current week's note exists before fetching
        await window.api.obsidian.ensureCurrentWeekNote()

        // Fetch today's data + sidebar list in parallel
        await Promise.all([
          get().fetchTodaySection(),
          get().fetchWeeklyNotesList(),
        ])

        // Listen for file changes
        window.api.obsidian.onFileChanged(() => {
          get().fetchTodaySection()
          get().fetchWeeklyNotesList()
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

  fetchWeeklyNotesList: async () => {
    set({ sidebarLoading: true })
    try {
      const weeklyNotes = await window.api.obsidian.listWeeklyNotes()
      set({ weeklyNotes, sidebarLoading: false })
    } catch {
      set({ sidebarLoading: false })
    }
  },

  selectDate: (dateStr: string) => {
    set({ selectedDate: dateStr })
  },

  appendToToday: async (text: string) => {
    try {
      await window.api.obsidian.appendToToday(text)
      await get().fetchTodaySection()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to append'
      set({ error: message })
      throw error
    }
  },

  updateTodayContent: async (content: string) => {
    try {
      await window.api.obsidian.updateTodayContent(content)
      await get().fetchTodaySection()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save'
      set({ error: message })
      throw error
    }
  },

  updateDayContent: async (dateStr: string, content: string) => {
    try {
      await window.api.obsidian.updateDayContent(dateStr, content)
      // If editing today, refresh the live section too
      const todayStr = new Date().toISOString().slice(0, 10)
      if (dateStr === todayStr) {
        await get().fetchTodaySection()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save'
      set({ error: message })
      throw error
    }
  },

  toggleCheckbox: async (lineOffset: number) => {
    try {
      await window.api.obsidian.toggleCheckbox(lineOffset)
      await get().fetchTodaySection()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to toggle checkbox'
      set({ error: message })
      throw error
    }
  },

  refreshAll: async () => {
    set({ isLoading: true })
    try {
      const vaultStatus = await window.api.obsidian.getVaultStatus()
      set({ vaultStatus })
      if (vaultStatus.found) {
        await Promise.all([
          get().fetchTodaySection(),
          get().fetchWeeklyNotesList(),
        ])
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
