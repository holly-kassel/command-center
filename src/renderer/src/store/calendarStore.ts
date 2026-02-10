/**
 * Calendar Zustand Store
 *
 * Manages calendar event state, auth status, and countdown timer.
 */
import { create } from 'zustand'
import type { CalendarEvent } from '@shared/types/calendar'

interface CalendarState {
  events: CalendarEvent[]
  nextMeeting: CalendarEvent | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  lastRefresh: number | null

  // Actions
  initialize: () => Promise<void>
  fetchTodayEvents: () => Promise<void>
  fetchNextMeeting: () => Promise<void>
  refreshAll: () => Promise<void>
  login: () => Promise<void>
  logout: () => Promise<void>
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  events: [],
  nextMeeting: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  lastRefresh: null,

  initialize: async () => {
    try {
      const authed = await window.api.auth.isAuthenticated()
      set({ isAuthenticated: authed })

      if (authed) {
        await get().refreshAll()
      }
    } catch (error) {
      console.error('[CalendarStore] init error:', error)
    }
  },

  fetchTodayEvents: async () => {
    try {
      set({ isLoading: true, error: null })
      const events = await window.api.calendar.getTodayEvents()
      set({ events, isLoading: false, lastRefresh: Date.now() })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch events',
      })
    }
  },

  fetchNextMeeting: async () => {
    try {
      const nextMeeting = await window.api.calendar.getNextMeeting()
      set({ nextMeeting })
    } catch (error) {
      console.error('[CalendarStore] fetchNextMeeting error:', error)
    }
  },

  refreshAll: async () => {
    await window.api.calendar.refresh()
    await Promise.all([get().fetchTodayEvents(), get().fetchNextMeeting()])
  },

  login: async () => {
    try {
      set({ isLoading: true, error: null })
      const result = await window.api.auth.loginMicrosoft()
      if (result.success) {
        set({ isAuthenticated: true })
        await get().refreshAll()
      } else {
        set({ error: result.error || 'Login failed' })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Login failed',
      })
    } finally {
      set({ isLoading: false })
    }
  },

  logout: async () => {
    await window.api.auth.logout()
    set({
      isAuthenticated: false,
      events: [],
      nextMeeting: null,
      lastRefresh: null,
    })
  },
}))

// Listen for push updates from SyncManager
window.api.calendar.onSyncUpdate((events) => {
  useCalendarStore.setState({ events, lastRefresh: Date.now() })
})
window.api.calendar.onNextMeetingUpdate((meeting) => {
  useCalendarStore.setState({ nextMeeting: meeting })
})
