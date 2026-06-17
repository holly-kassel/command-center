/**
 * Calendar IPC Handlers
 *
 * Registers ipcMain.handle() for calendar event channels.
 * Bridges renderer ↔ CalendarService.
 */
import { ipcMain } from 'electron'
import { getCalendarService } from '../services/calendar/CalendarService'
import log from 'electron-log'
import { isMicrosoftAuthConfigurationError } from '../../shared/constants/auth'

export function registerCalendarIpc(): void {
  const calendar = getCalendarService()

  ipcMain.handle('calendar:getTodayEvents', async () => {
    try {
      return await calendar.getTodayEvents()
    } catch (error) {
      if (isMicrosoftAuthConfigurationError(error)) {
        log.warn('[IPC] calendar:getTodayEvents not configured; returning empty events')
        return []
      }
      log.error('[IPC] calendar:getTodayEvents error:', error)
      throw error
    }
  })

  ipcMain.handle('calendar:getNextMeeting', async () => {
    try {
      return await calendar.getNextMeeting()
    } catch (error) {
      if (isMicrosoftAuthConfigurationError(error)) {
        log.warn('[IPC] calendar:getNextMeeting not configured; returning null meeting')
        return null
      }
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
        if (isMicrosoftAuthConfigurationError(error)) {
          log.warn('[IPC] calendar:getEvents not configured; returning empty events')
          return []
        }
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
