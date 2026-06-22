/**
 * Auth IPC Handlers
 *
 * Registers ipcMain.handle() for authentication channels.
 * Bridges renderer ↔ WorkIQ-backed calendar connection.
 *
 * "Authentication" here means having a working WorkIQ connection to Microsoft
 * 365. WorkIQ handles the actual Microsoft sign-in itself (device-code + EULA),
 * so there is no Azure app registration or MSAL token to manage in this app.
 */
import { ipcMain } from 'electron'
import { getCalendarService } from '../services/calendar/CalendarService'
import log from 'electron-log'

export function registerAuthIpc(): void {
  const calendar = getCalendarService()

  ipcMain.handle('auth:loginMicrosoft', async () => {
    try {
      await calendar.connect()
      return { success: true }
    } catch (error) {
      log.error('[IPC] auth:loginMicrosoft error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  ipcMain.handle('auth:isAuthenticated', () => {
    return calendar.isConnected()
  })

  ipcMain.handle('auth:logout', async () => {
    try {
      await calendar.disconnect()
      return { success: true }
    } catch (error) {
      log.error('[IPC] auth:logout error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })
}
