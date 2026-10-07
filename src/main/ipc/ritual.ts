import { ipcMain } from 'electron'
import { getRitualService } from '../services/ritual/RitualService'
import logger from '../utils/logger'
import type { RitualCompletion, RitualDraft, StreakType } from '../../shared/types/ritual'

export function registerRitualIpc(): void {
  const ritual = getRitualService()
  ipcMain.handle('ritual:getSnapshot', () => ritual.getSnapshot())
  ipcMain.handle('ritual:getDailyLog', (_event, date: string) => ritual.getDailyLog(date))
  ipcMain.handle('ritual:getTodayLog', () => ritual.getTodayLog())
  ipcMain.handle('ritual:getLogsInRange', (_event, start: string, end: string) =>
    ritual.getLogsInRange(start, end)
  )
  ipcMain.handle('ritual:getStreak', (_event, type: StreakType) => ritual.getStreak(type))
  ipcMain.handle('ritual:getAllStreaks', () => ritual.getAllStreaks())
  ipcMain.handle('ritual:getWeeklyMetrics', (_event, weekStart?: string) =>
    ritual.getWeeklyMetrics(weekStart)
  )
  ipcMain.handle('ritual:saveDraft', (_event, draft: RitualDraft) => ritual.saveDraft(draft))
  ipcMain.handle('ritual:discardDraft', (_event, id: string) => ritual.discardDraft(id))
  ipcMain.handle('ritual:complete', (_event, input: RitualCompletion) => ritual.complete(input))
  logger.info('[IPC] Ritual handlers registered')
}
