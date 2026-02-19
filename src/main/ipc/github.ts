/**
 * GitHub IPC Handlers
 *
 * Registers ipcMain.handle() for GitHub notification channels.
 * Bridges renderer ↔ GitHubService.
 */
import { ipcMain } from 'electron'
import { getGitHubService } from '../services/github/GitHubService'
import log from 'electron-log'

export function registerGitHubIpc(): void {
  const github = getGitHubService()

  ipcMain.handle('github:getNotifications', async () => {
    try {
      return await github.getNotifications()
    } catch (error) {
      log.error('[IPC] github:getNotifications error:', error)
      throw error
    }
  })

  ipcMain.handle('github:markAsRead', async (_event, threadId: string) => {
    try {
      await github.markAsRead(threadId)
      return { success: true }
    } catch (error) {
      log.error('[IPC] github:markAsRead error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('github:isConfigured', () => {
    return github.isConfigured()
  })

  ipcMain.handle('github:setPAT', async (_event, pat: string) => {
    try {
      await github.setPAT(pat)
      return { success: true }
    } catch (error) {
      log.error('[IPC] github:setPAT error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  ipcMain.handle('github:getPullRequests', async () => {
    try {
      return await github.getMyPullRequests()
    } catch (error) {
      log.error('[IPC] github:getPullRequests error:', error)
      throw error
    }
  })
}
