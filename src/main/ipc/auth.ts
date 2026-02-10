/**
 * Auth IPC Handlers
 *
 * Registers ipcMain.handle() for authentication channels.
 * Bridges renderer ↔ GraphAuthService.
 */
import { ipcMain } from 'electron'
import { getGraphAuthService } from '../services/auth/OAuthFlow'
import log from 'electron-log'

export function registerAuthIpc(): void {
  const auth = getGraphAuthService()

  ipcMain.handle('auth:loginMicrosoft', async () => {
    try {
      await auth.acquireTokenInteractive()
      return { success: true }
    } catch (error) {
      log.error('[IPC] auth:loginMicrosoft error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('auth:isAuthenticated', () => {
    return auth.isAuthenticated()
  })

  ipcMain.handle('auth:logout', async () => {
    try {
      await auth.logout()
      return { success: true }
    } catch (error) {
      log.error('[IPC] auth:logout error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })
}
