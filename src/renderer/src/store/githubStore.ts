/**
 * GitHub Zustand Store
 *
 * Manages notification state, PAT configuration, and MCP connection status.
 */
import { create } from 'zustand'
import type {
  GitHubNotification,
  GitHubPullRequest,
  NotificationTriageData,
  TriagePriority,
  TriageStatus
} from '@shared/types/github'

interface GitHubState {
  notifications: GitHubNotification[]
  pullRequests: GitHubPullRequest[]
  triageData: Record<string, NotificationTriageData>
  triageSortOrder: string[]
  isConfigured: boolean
  isLoading: boolean
  isPRsLoading: boolean
  triageLoading: boolean
  error: string | null
  lastRefresh: number | null

  // Computed
  actionableCount: number

  // Actions
  initialize: () => Promise<void>
  fetchNotifications: () => Promise<void>
  fetchPullRequests: () => Promise<void>
  loadTriageData: () => Promise<void>
  markAsRead: (threadId: string) => Promise<void>
  setPAT: (pat: string) => Promise<void>
  setTriageStatus: (notificationId: string, status: TriageStatus) => Promise<void>
  setTriagePriority: (notificationId: string, priority: TriagePriority) => Promise<void>
  setTriageNotes: (notificationId: string, notes: string) => Promise<void>
  setTriageSortOrder: (order: string[]) => Promise<void>
}

function createTriageEntry(
  notificationId: string,
  existing?: NotificationTriageData
): NotificationTriageData {
  return (
    existing ?? {
      notificationId,
      status: 'needs_triage',
      priority: 0,
      notes: '',
      updatedAt: new Date().toISOString()
    }
  )
}

function applyTriagePatch(
  notificationId: string,
  existing: NotificationTriageData | undefined,
  patch: Partial<NotificationTriageData>
): NotificationTriageData {
  return {
    ...createTriageEntry(notificationId, existing),
    ...patch,
    notificationId,
    updatedAt: new Date().toISOString()
  }
}

export const useGitHubStore = create<GitHubState>((set, get) => ({
  notifications: [],
  pullRequests: [],
  triageData: {},
  triageSortOrder: [],
  isConfigured: false,
  isLoading: false,
  isPRsLoading: false,
  triageLoading: false,
  error: null,
  lastRefresh: null,
  actionableCount: 0,

  initialize: async () => {
    try {
      const configured = await window.api.github.isConfigured()
      set({ isConfigured: configured })

      if (configured) {
        await Promise.all([
          get().fetchNotifications(),
          get().fetchPullRequests(),
          get().loadTriageData()
        ])
      }
    } catch (error) {
      console.error('[GitHubStore] init error:', error)
    }
  },

  fetchNotifications: async () => {
    try {
      set({ isLoading: true, error: null })
      const notifications = await window.api.github.getNotifications()
      set({
        notifications,
        actionableCount: notifications.filter((n) => n.unread).length,
        isLoading: false,
        lastRefresh: Date.now()
      })
      await get().loadTriageData()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to fetch notifications'

      // Don't show error if just not configured
      if (msg.includes('GITHUB_NOT_CONFIGURED')) {
        set({ isLoading: false, isConfigured: false })
      } else {
        set({ isLoading: false, error: msg })
      }
    }
  },

  fetchPullRequests: async () => {
    try {
      set({ isPRsLoading: true })
      const pullRequests = await window.api.github.getPullRequests()
      set({ pullRequests, isPRsLoading: false })
    } catch (error) {
      console.error('[GitHubStore] fetchPullRequests error:', error)
      set({ isPRsLoading: false })
    }
  },

  loadTriageData: async () => {
    try {
      set({ triageLoading: true })
      const [triageData, triageSortOrder] = await Promise.all([
        window.api.github.getAllTriageData(),
        window.api.github.getTriageSortOrder(),
      ])
      set({ triageData, triageSortOrder, triageLoading: false })
    } catch (error) {
      console.error('[GitHubStore] loadTriageData error:', error)
      set({
        triageLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load triage data'
      })
    }
  },

  markAsRead: async (threadId: string) => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === threadId ? { ...n, unread: false } : n
      ),
      actionableCount: Math.max(0, state.actionableCount - 1)
    }))

    const result = await window.api.github.markAsRead(threadId)
    if (!result.success) {
      // Revert on failure
      await get().fetchNotifications()
    }
  },

  setPAT: async (pat: string) => {
    try {
      set({ isLoading: true, error: null })
      const result = await window.api.github.setPAT(pat)
      if (result.success) {
        set({ isConfigured: true })
        await get().fetchNotifications()
      } else {
        set({ error: result.error || 'Failed to save PAT' })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to save PAT'
      })
    } finally {
      set({ isLoading: false })
    }
  },

  setTriageStatus: async (notificationId: string, status: TriageStatus) => {
    const previous = get().triageData[notificationId]
    const optimistic = applyTriagePatch(notificationId, previous, { status })

    set((state) => ({
      triageData: {
        ...state.triageData,
        [notificationId]: optimistic
      },
      error: null
    }))

    try {
      const saved = await window.api.github.setTriageStatus(notificationId, status)
      set((state) => ({
        triageData: {
          ...state.triageData,
          [notificationId]: saved
        }
      }))
    } catch (error) {
      set((state) => {
        const triageData = { ...state.triageData }
        if (previous) {
          triageData[notificationId] = previous
        } else {
          delete triageData[notificationId]
        }

        return {
          triageData,
          error: error instanceof Error ? error.message : 'Failed to update triage status'
        }
      })
      throw error
    }
  },

  setTriagePriority: async (notificationId: string, priority: TriagePriority) => {
    const previous = get().triageData[notificationId]
    const optimistic = applyTriagePatch(notificationId, previous, { priority })

    set((state) => ({
      triageData: {
        ...state.triageData,
        [notificationId]: optimistic
      },
      error: null
    }))

    try {
      const saved = await window.api.github.setTriagePriority(notificationId, priority)
      set((state) => ({
        triageData: {
          ...state.triageData,
          [notificationId]: saved
        }
      }))
    } catch (error) {
      set((state) => {
        const triageData = { ...state.triageData }
        if (previous) {
          triageData[notificationId] = previous
        } else {
          delete triageData[notificationId]
        }

        return {
          triageData,
          error: error instanceof Error ? error.message : 'Failed to update triage priority'
        }
      })
      throw error
    }
  },

  setTriageNotes: async (notificationId: string, notes: string) => {
    const previous = get().triageData[notificationId]
    const optimistic = applyTriagePatch(notificationId, previous, { notes })

    set((state) => ({
      triageData: {
        ...state.triageData,
        [notificationId]: optimistic
      },
      error: null
    }))

    try {
      const saved = await window.api.github.setTriageNotes(notificationId, notes)
      set((state) => ({
        triageData: {
          ...state.triageData,
          [notificationId]: saved
        }
      }))
    } catch (error) {
      set((state) => {
        const triageData = { ...state.triageData }
        if (previous) {
          triageData[notificationId] = previous
        } else {
          delete triageData[notificationId]
        }

        return {
          triageData,
          error: error instanceof Error ? error.message : 'Failed to update triage notes'
        }
      })
      throw error
    }
  },

  setTriageSortOrder: async (order: string[]) => {
    set({ triageSortOrder: order })
    await window.api.github.setTriageSortOrder(order)
  },
}))

// Listen for push updates from SyncManager
window.api.github.onSyncUpdate((notifications) => {
  useGitHubStore.setState({
    notifications,
    actionableCount: notifications.filter((n) => n.unread).length,
    lastRefresh: Date.now()
  })
})
