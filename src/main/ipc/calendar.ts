/**
 * Calendar IPC Handlers
 *
 * Registers ipcMain.handle() for calendar event channels.
 * Bridges renderer ↔ CalendarService.
 */
import { ipcMain } from 'electron'
import { getCalendarService } from '../services/calendar/CalendarService'
import log from 'electron-log'

export function registerCalendarIpc(): void {
  const calendar = getCalendarService()

  ipcMain.handle('calendar:getTodayEvents', async () => {
    try {
      return await calendar.getTodayEvents()
    } catch (error) {
      log.error('[IPC] calendar:getTodayEvents error:', error)
      throw error
    }
  })

  ipcMain.handle('calendar:getNextMeeting', async () => {
    try {
      return await calendar.getNextMeeting()
    } catch (error) {
      log.error('[IPC] calendar:getNextMeeting error:', error)
      throw error
    }
  })

  ipcMain.handle(
    'calendar:getEvents',
    async (_event, startISO: string, endISO: string) => {
      try {
        return await calendar.getEvents(new Date(startISO), new Date(endISO))
      } catch (error) {
        log.error('[IPC] calendar:getEvents error:', error)
        throw error
      }
    }
  )

  ipcMain.handle('calendar:refresh', () => {
    calendar.invalidateCache()
    return { success: true }
  })
}
