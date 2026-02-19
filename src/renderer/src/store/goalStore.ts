/**
 * Goal Store (Zustand)
 *
 * Client-side state management for the goal hierarchy system.
 * Mirrors the pattern used by ritualStore.
 */
import { create } from 'zustand'
import type {
  Goal,
  GoalWithChildren,
  GoalTaskLink,
  CreateGoalInput,
  UpdateGoalInput,
  GoalLevel,
  GoalCategory,
} from '@shared/types/goal'

// ─── State ────────────────────────────────────────────────

interface GoalState {
  goals: Goal[]
  goalTree: GoalWithChildren[]
  taskLinks: GoalTaskLink[]
  summary: {
    totalActive: number
    byLevel: Record<GoalLevel, number>
    byCategory: Record<GoalCategory, number>
    completedThisWeek: number
  } | null
  isLoading: boolean
  error: string | null

  // Filters
  levelFilter: GoalLevel | 'all'
  categoryFilter: GoalCategory | 'all'

  // Actions
  initialize: () => Promise<void>
  loadGoals: () => Promise<void>
  loadTree: () => Promise<void>
  loadSummary: () => Promise<void>
  loadTaskLinks: () => Promise<void>
  createGoal: (input: CreateGoalInput) => Promise<Goal>
  updateGoal: (id: string, updates: UpdateGoalInput) => Promise<Goal | null>
  deleteGoal: (id: string) => Promise<boolean>
  linkTask: (goalId: string, taskText: string) => Promise<GoalTaskLink>
  unlinkTask: (linkId: string) => Promise<boolean>
  updateTaskCompletion: (taskText: string, completed: boolean) => Promise<void>
  setLevelFilter: (level: GoalLevel | 'all') => void
  setCategoryFilter: (category: GoalCategory | 'all') => void
  refreshAll: () => Promise<void>
}

// ─── Store ────────────────────────────────────────────────

export const useGoalStore = create<GoalState>((set, get) => ({
  goals: [],
  goalTree: [],
  taskLinks: [],
  summary: null,
  isLoading: false,
  error: null,
  levelFilter: 'all',
  categoryFilter: 'all',

  initialize: async () => {
    set({ isLoading: true })
    try {
      await Promise.all([
        get().loadGoals(),
        get().loadTree(),
        get().loadSummary(),
        get().loadTaskLinks(),
      ])
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to initialize goals' })
    } finally {
      set({ isLoading: false })
    }
  },

  loadGoals: async () => {
    const goals = await window.api.goal.getAll()
    set({ goals })
  },

  loadTree: async () => {
    const goalTree = await window.api.goal.getTree()
    set({ goalTree })
  },

  loadSummary: async () => {
    const summary = await window.api.goal.getSummary()
    set({ summary })
  },

  loadTaskLinks: async () => {
    const taskLinks = await window.api.goal.getAllTaskLinks()
    set({ taskLinks })
  },

  createGoal: async (input) => {
    const goal = await window.api.goal.create(input)
    // Optimistic: add to local state, then refresh tree
    set((s) => ({ goals: [...s.goals, goal] }))
    await Promise.all([get().loadTree(), get().loadSummary()])
    return goal
  },

  updateGoal: async (id, updates) => {
    const updated = await window.api.goal.update(id, updates)
    if (updated) {
      set((s) => ({
        goals: s.goals.map((g) => (g.id === id ? updated : g)),
      }))
      await Promise.all([get().loadTree(), get().loadSummary()])
    }
    return updated
  },

  deleteGoal: async (id) => {
    const success = await window.api.goal.delete(id)
    if (success) {
      set((s) => ({
        goals: s.goals.filter((g) => g.id !== id),
      }))
      await Promise.all([get().loadTree(), get().loadSummary()])
    }
    return success
  },

  linkTask: async (goalId, taskText) => {
    const link = await window.api.goal.linkTask(goalId, taskText)
    set((s) => ({ taskLinks: [...s.taskLinks, link] }))
    return link
  },

  unlinkTask: async (linkId) => {
    const success = await window.api.goal.unlinkTask(linkId)
    if (success) {
      set((s) => ({
        taskLinks: s.taskLinks.filter((l) => l.id !== linkId),
      }))
    }
    return success
  },

  updateTaskCompletion: async (taskText, completed) => {
    await window.api.goal.updateTaskCompletion(taskText, completed)
    // Refresh everything since progress may have changed
    await get().refreshAll()
  },

  setLevelFilter: (levelFilter) => set({ levelFilter }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),

  refreshAll: async () => {
    await Promise.all([
      get().loadGoals(),
      get().loadTree(),
      get().loadSummary(),
      get().loadTaskLinks(),
    ])
  },
}))

// ─── Push listener for SyncManager updates ────────────────

if (typeof window !== 'undefined' && window.api?.goal?.onSyncUpdate) {
  window.api.goal.onSyncUpdate((data) => {
    useGoalStore.setState({
      goals: data.goals,
      summary: {
        totalActive: data.summary.totalActive,
        completedThisWeek: data.summary.completedThisWeek,
        byLevel: { vision: 0, yearly: 0, quarterly: 0, weekly: 0 },
        byCategory: { career: 0, health: 0, learning: 0, relationships: 0, finance: 0, creative: 0, personal: 0 },
      },
    })
  })
}
