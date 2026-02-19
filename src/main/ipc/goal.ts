/**
 * Goal IPC Handlers
 *
 * Bridges GoalService methods to the renderer via ipcMain.handle.
 */
import { ipcMain } from 'electron'
import { getGoalService } from '../services/goal/GoalService'
import type {
  CreateGoalInput,
  UpdateGoalInput,
  GoalLevel,
  GoalCategory,
  GoalStatus,
} from '../../shared/types/goal'

export function registerGoalIpc(): void {
  const service = getGoalService()

  // CRUD
  ipcMain.handle('goal:create', (_e, input: CreateGoalInput) => service.createGoal(input))
  ipcMain.handle('goal:get', (_e, id: string) => service.getGoal(id))
  ipcMain.handle('goal:getAll', () => service.getAllGoals())
  ipcMain.handle('goal:update', (_e, id: string, updates: UpdateGoalInput) =>
    service.updateGoal(id, updates)
  )
  ipcMain.handle('goal:delete', (_e, id: string) => service.deleteGoal(id))

  // Filtering
  ipcMain.handle('goal:getByLevel', (_e, level: GoalLevel) => service.getGoalsByLevel(level))
  ipcMain.handle('goal:getByCategory', (_e, category: GoalCategory) =>
    service.getGoalsByCategory(category)
  )
  ipcMain.handle('goal:getByStatus', (_e, status: GoalStatus) => service.getGoalsByStatus(status))
  ipcMain.handle('goal:getActive', () => service.getActiveGoals())

  // Hierarchy
  ipcMain.handle('goal:getChildren', (_e, parentId: string) => service.getChildren(parentId))
  ipcMain.handle('goal:getTree', () => service.getGoalTree())
  ipcMain.handle('goal:getSuggestedParents', (_e, level: GoalLevel) =>
    service.getSuggestedParents(level)
  )

  // Task links
  ipcMain.handle('goal:linkTask', (_e, goalId: string, taskText: string) =>
    service.linkTask(goalId, taskText)
  )
  ipcMain.handle('goal:unlinkTask', (_e, linkId: string) => service.unlinkTask(linkId))
  ipcMain.handle('goal:getTaskLinks', (_e, goalId: string) => service.getTaskLinksForGoal(goalId))
  ipcMain.handle('goal:getAllTaskLinks', () => service.getAllTaskLinks())
  ipcMain.handle('goal:updateTaskCompletion', (_e, taskText: string, completed: boolean) =>
    service.updateTaskCompletion(taskText, completed)
  )

  // Progress
  ipcMain.handle('goal:recalculateProgress', (_e, goalId: string) =>
    service.recalculateProgress(goalId)
  )

  // Summary
  ipcMain.handle('goal:getSummary', () => service.getSummary())
}
