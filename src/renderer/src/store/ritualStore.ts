/**
 * Ritual Zustand Store
 *
 * Manages ritual state in the renderer process.
 * Handles morning/evening ritual flows and streak tracking.
 */
import { create } from 'zustand'
import type { DailyLog, Streak, StreakType, WeeklyRitualMetrics } from '@shared/types/ritual'

interface RitualState {
  // State
  todayLog: DailyLog | null
  streaks: Record<StreakType, Streak> | null
  weeklyMetrics: WeeklyRitualMetrics | null
  activeRitual: 'morning' | 'evening' | null
  isLoading: boolean
  error: string | null

  // Actions
  initialize: () => Promise<void>
  loadToday: () => Promise<void>
  loadStreaks: () => Promise<void>
  loadWeeklyMetrics: () => Promise<void>
  saveMorningRitual: (data: { intention: string; focusCommitted: boolean }) => Promise<void>
  saveEveningRitual: (data: {
    untrackedWins: string
    wentWell: string
    couldImprove: string
    gratitude: string
    energyLevel: number
  }) => Promise<void>
  startRitual: (type: 'morning' | 'evening') => void
  endRitual: () => void
  refreshAll: () => Promise<void>
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

export const useRitualStore = create<RitualState>((set, get) => ({
  todayLog: null,
  streaks: null,
  weeklyMetrics: null,
  activeRitual: null,
  isLoading: false,
  error: null,

  initialize: async () => {
    set({ isLoading: true, error: null })
    try {
      await Promise.all([get().loadToday(), get().loadStreaks(), get().loadWeeklyMetrics()])
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to initialize rituals' })
    } finally {
      set({ isLoading: false })
    }
  },

  loadToday: async () => {
    try {
      const todayLog = await window.api.ritual.getTodayLog()
      set({ todayLog })
    } catch (error) {
      console.error('[RitualStore] loadToday error:', error)
    }
  },

  loadStreaks: async () => {
    try {
      const streaks = await window.api.ritual.getAllStreaks()
      set({ streaks })
    } catch (error) {
      console.error('[RitualStore] loadStreaks error:', error)
    }
  },

  loadWeeklyMetrics: async () => {
    try {
      const weeklyMetrics = await window.api.ritual.getWeeklyMetrics()
      set({ weeklyMetrics })
    } catch (error) {
      console.error('[RitualStore] loadWeeklyMetrics error:', error)
    }
  },

  saveMorningRitual: async ({ intention, focusCommitted }) => {
    try {
      const today = formatDate(new Date())
      await window.api.ritual.saveDailyLog(today, {
        morningRitualCompleted: true,
        morningRitualTime: new Date().toISOString(),
        intention,
        focusAchieved: focusCommitted,
      })
      await window.api.ritual.updateStreak('morning_ritual')
      await window.api.ritual.checkFullDayStreak()

      // Reload state
      await Promise.all([get().loadToday(), get().loadStreaks(), get().loadWeeklyMetrics()])
      set({ activeRitual: null })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save morning ritual' })
      throw error
    }
  },

  saveEveningRitual: async ({ untrackedWins, wentWell, couldImprove, gratitude, energyLevel }) => {
    try {
      const today = formatDate(new Date())
      await window.api.ritual.saveDailyLog(today, {
        eveningRitualCompleted: true,
        eveningRitualTime: new Date().toISOString(),
        reflection: { wentWell, couldImprove },
        gratitude,
        untrackedWins,
        energyLevel,
      })
      await window.api.ritual.updateStreak('evening_ritual')
      await window.api.ritual.checkFullDayStreak()

      // Reload state
      await Promise.all([get().loadToday(), get().loadStreaks(), get().loadWeeklyMetrics()])
      set({ activeRitual: null })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save evening ritual' })
      throw error
    }
  },

  startRitual: (type) => set({ activeRitual: type }),
  endRitual: () => set({ activeRitual: null }),

  refreshAll: async () => {
    await Promise.all([get().loadToday(), get().loadStreaks(), get().loadWeeklyMetrics()])
  },
}))

// Listen for push updates from SyncManager
window.api.ritual.onSyncUpdate(({ todayLog, streaks }) => {
  useRitualStore.setState({ todayLog, streaks })
})
