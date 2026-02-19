/**
 * Ritual IPC handlers
 *
 * Bridges the RitualService to the renderer via IPC.
 */
import { ipcMain } from 'electron'
import { getRitualService } from '../services/ritual/RitualService'
import logger from '../utils/logger'
import type { StreakType, DailyLog } from '../../shared/types/ritual'

export function registerRitualIpc(): void {
  const ritual = getRitualService()

  // Get daily log for a date
  ipcMain.handle('ritual:getDailyLog', (_event, date: string) => {
    return ritual.getDailyLog(date)
  })

  // Get today's log
  ipcMain.handle('ritual:getTodayLog', () => {
    return ritual.getTodayLog()
  })

  // Save (upsert) daily log
  ipcMain.handle('ritual:saveDailyLog', (_event, date: string, partial: Partial<DailyLog>) => {
    return ritual.saveDailyLog(date, partial)
  })

  // Get logs in range
  ipcMain.handle('ritual:getLogsInRange', (_event, start: string, end: string) => {
    return ritual.getLogsInRange(start, end)
  })

  // Get a single streak
  ipcMain.handle('ritual:getStreak', (_event, type: StreakType) => {
    return ritual.getStreak(type)
  })

  // Get all streaks
  ipcMain.handle('ritual:getAllStreaks', () => {
    return ritual.getAllStreaks()
  })

  // Update a streak (call on ritual completion)
  ipcMain.handle('ritual:updateStreak', (_event, type: StreakType) => {
    return ritual.updateStreak(type)
  })

  // Check full-day streak
  ipcMain.handle('ritual:checkFullDayStreak', () => {
    return ritual.checkFullDayStreak()
  })

  // Get weekly metrics
  ipcMain.handle('ritual:getWeeklyMetrics', (_event, weekStart?: string) => {
    return ritual.getWeeklyMetrics(weekStart)
  })

  logger.info('[IPC] Ritual handlers registered')
}
