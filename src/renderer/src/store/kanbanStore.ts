import { create } from 'zustand'
import type { KanbanTask, KanbanStatus, KanbanTaskSource } from '@shared/types/goal'

interface KanbanState {
  tasks: KanbanTask[]
  isLoading: boolean
  error: string | null

  initialize: () => Promise<void>
  addTask: (
    text: string,
    source?: KanbanTaskSource,
    sourceNotificationId?: string,
    sourceUrl?: string
  ) => Promise<KanbanTask>
  moveTask: (taskId: string, newStatus: KanbanStatus, newPosition: number) => Promise<void>
  reorderTask: (taskId: string, newPosition: number) => Promise<void>
  updateTaskText: (taskId: string, text: string) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  refreshTasks: () => Promise<void>
}

export const useKanbanStore = create<KanbanState>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,

  initialize: async () => {
    set({ isLoading: true, error: null })
    try {
      const tasks = await window.api.kanban.getAllTasks()
      set({ tasks })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load tasks' })
    } finally {
      set({ isLoading: false })
    }
  },

  refreshTasks: async () => {
    try {
      const tasks = await window.api.kanban.getAllTasks()
      set({ tasks, error: null })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to refresh tasks' })
    }
  },

  addTask: async (text, source, sourceNotificationId, sourceUrl) => {
    const task = await window.api.kanban.addTask(text, source, sourceNotificationId, sourceUrl)
    await get().refreshTasks()
    return task
  },

  moveTask: async (taskId, newStatus, newPosition) => {
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId ? { ...task, status: newStatus, position: newPosition } : task
      )
    }))
    await window.api.kanban.moveTask(taskId, newStatus, newPosition)
    await get().refreshTasks()
  },

  reorderTask: async (taskId, newPosition) => {
    await window.api.kanban.reorderTask(taskId, newPosition)
    await get().refreshTasks()
  },

  updateTaskText: async (taskId, text) => {
    set((state) => ({
      tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, text } : task))
    }))
    await window.api.kanban.updateTaskText(taskId, text)
  },

  deleteTask: async (taskId) => {
    set((state) => ({ tasks: state.tasks.filter((task) => task.id !== taskId) }))
    await window.api.kanban.deleteTask(taskId)
  }
}))
