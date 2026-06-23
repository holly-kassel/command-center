import { ipcMain } from 'electron'
import log from 'electron-log'
import { getKanbanService } from '../services/kanban/KanbanService'
import type { KanbanTask, KanbanStatus } from '../../shared/types/goal'

export function registerKanbanIpc(): void {
  const kanban = getKanbanService()

  ipcMain.handle('kanban:getAllTasks', () => {
    try {
      return kanban.getAllTasks()
    } catch (error) {
      log.error('[IPC] kanban:getAllTasks error:', error)
      throw error
    }
  })

  ipcMain.handle(
    'kanban:addTask',
    (_event, text: string, source?: string, sourceNotificationId?: string, sourceUrl?: string) => {
      try {
        return kanban.addTask(
          text,
          (source as KanbanTask['source'] | undefined) ?? 'manual',
          sourceNotificationId,
          sourceUrl,
        )
      } catch (error) {
        log.error('[IPC] kanban:addTask error:', error)
        throw error
      }
    },
  )

  ipcMain.handle('kanban:moveTask', (_event, taskId: string, newStatus: string, newPosition: number) => {
    try {
      return kanban.moveTask(taskId, newStatus as KanbanStatus, newPosition)
    } catch (error) {
      log.error('[IPC] kanban:moveTask error:', error)
      throw error
    }
  })

  ipcMain.handle('kanban:reorderTask', (_event, taskId: string, newPosition: number) => {
    try {
      return kanban.reorderTask(taskId, newPosition)
    } catch (error) {
      log.error('[IPC] kanban:reorderTask error:', error)
      throw error
    }
  })

  ipcMain.handle('kanban:updateTaskText', (_event, taskId: string, text: string) => {
    try {
      return kanban.updateTaskText(taskId, text)
    } catch (error) {
      log.error('[IPC] kanban:updateTaskText error:', error)
      throw error
    }
  })

  ipcMain.handle('kanban:deleteTask', (_event, taskId: string) => {
    try {
      return kanban.deleteTask(taskId)
    } catch (error) {
      log.error('[IPC] kanban:deleteTask error:', error)
      throw error
    }
  })

  ipcMain.handle('kanban:findByNotificationId', (_event, notificationId: string) => {
    try {
      return kanban.findByNotificationId(notificationId)
    } catch (error) {
      log.error('[IPC] kanban:findByNotificationId error:', error)
      throw error
    }
  })
}
