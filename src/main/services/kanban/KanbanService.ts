// eslint-disable-next-line @typescript-eslint/no-require-imports
const ElectronStore = require('electron-store')
import log from 'electron-log'
import type { KanbanTask, KanbanStatus } from '../../../shared/types/goal'

interface KanbanStoreSchema {
  tasks: KanbanTask[]
}

const STORE_DEFAULTS: KanbanStoreSchema = {
  tasks: [],
}

export class KanbanService {
  private store: InstanceType<typeof ElectronStore>

  constructor() {
    this.store = new (ElectronStore.default || ElectronStore)({
      name: 'kanban-tasks',
      defaults: STORE_DEFAULTS,
    })
  }

  getAllTasks(): KanbanTask[] {
    return this.store.get('tasks') as KanbanTask[]
  }

  addTask(
    text: string,
    source: KanbanTask['source'] = 'manual',
    sourceNotificationId?: string,
    sourceUrl?: string,
  ): KanbanTask {
    const tasks = this.getAllTasks()
    const todoTasks = tasks.filter((t) => t.status === 'todo')
    const task: KanbanTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      status: 'todo',
      createdAt: new Date().toISOString(),
      completedAt: null,
      completedDate: null,
      source,
      sourceNotificationId: sourceNotificationId ?? null,
      sourceUrl: sourceUrl ?? null,
      position: todoTasks.length,
    }
    tasks.push(task)
    this.store.set('tasks', tasks)
    log.info(`[Kanban] Added task: ${text} (source: ${source})`)
    return task
  }

  moveTask(taskId: string, newStatus: KanbanStatus, newPosition: number): KanbanTask | null {
    const tasks = this.getAllTasks()
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return null

    const oldStatus = task.status
    task.status = newStatus
    task.position = newPosition

    if (newStatus === 'done' && oldStatus !== 'done') {
      task.completedAt = new Date().toISOString()
      const now = new Date()
      task.completedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    }
    if (newStatus !== 'done' && oldStatus === 'done') {
      task.completedAt = null
      task.completedDate = null
    }

    const columnTasks = tasks
      .filter((t) => t.status === newStatus && t.id !== taskId)
      .sort((a, b) => a.position - b.position)
    columnTasks.splice(newPosition, 0, task)
    columnTasks.forEach((columnTask, index) => {
      columnTask.position = index
    })

    this.store.set('tasks', tasks)
    log.info(`[Kanban] Moved task ${taskId} to ${newStatus} at position ${newPosition}`)
    return task
  }

  reorderTask(taskId: string, newPosition: number): KanbanTask | null {
    const tasks = this.getAllTasks()
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return null

    const columnTasks = tasks
      .filter((t) => t.status === task.status && t.id !== taskId)
      .sort((a, b) => a.position - b.position)
    columnTasks.splice(newPosition, 0, task)
    columnTasks.forEach((columnTask, index) => {
      columnTask.position = index
    })

    this.store.set('tasks', tasks)
    return task
  }

  updateTaskText(taskId: string, text: string): KanbanTask | null {
    const tasks = this.getAllTasks()
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return null
    task.text = text
    this.store.set('tasks', tasks)
    return task
  }

  deleteTask(taskId: string): boolean {
    const tasks = this.getAllTasks()
    const index = tasks.findIndex((t) => t.id === taskId)
    if (index === -1) return false
    tasks.splice(index, 1)
    this.store.set('tasks', tasks)
    log.info(`[Kanban] Deleted task ${taskId}`)
    return true
  }

  findByNotificationId(notificationId: string): KanbanTask | null {
    return this.getAllTasks().find((t) => t.sourceNotificationId === notificationId) ?? null
  }
}

let instance: KanbanService | null = null

export function getKanbanService(): KanbanService {
  if (!instance) instance = new KanbanService()
  return instance
}
