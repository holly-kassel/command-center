/**
 * GitHub Zustand Store
 *
 * Manages notification state, PAT configuration, and MCP connection status.
 */
import { create } from 'zustand'
import type { GitHubNotification } from '@shared/types/github'

interface GitHubState {
  notifications: GitHubNotification[]
  isConfigured: boolean
  isLoading: boolean
  error: string | null
  lastRefresh: number | null

  // Computed
  actionableCount: number

  // Actions
  initialize: () => Promise<void>
  fetchNotifications: () => Promise<void>
  markAsRead: (threadId: string) => Promise<void>
  setPAT: (pat: string) => Promise<void>
}

export const useGitHubStore = create<GitHubState>((set, get) => ({
  notifications: [],
  isConfigured: false,
  isLoading: false,
  error: null,
  lastRefresh: null,
  actionableCount: 0,

  initialize: async () => {
    try {
      const configured = await window.api.github.isConfigured()
      set({ isConfigured: configured })

      if (configured) {
        await get().fetchNotifications()
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
        lastRefresh: Date.now(),
      })
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

  markAsRead: async (threadId: string) => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === threadId ? { ...n, unread: false } : n
      ),
      actionableCount: Math.max(0, state.actionableCount - 1),
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
        error: error instanceof Error ? error.message : 'Failed to save PAT',
      })
    } finally {
      set({ isLoading: false })
    }
  },
}))

// Listen for push updates from SyncManager
window.api.github.onSyncUpdate((notifications) => {
  useGitHubStore.setState({
    notifications,
    actionableCount: notifications.filter((n) => n.unread).length,
    lastRefresh: Date.now(),
  })
})
