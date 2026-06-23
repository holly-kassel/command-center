/**
 * GitHub IPC Handlers
 *
 * Registers ipcMain.handle() for GitHub notification channels.
 * Bridges renderer ↔ GitHubService.
 */
import { ipcMain } from 'electron'
import log from 'electron-log'
import type { TriagePriority, TriageStatus } from '../../shared/types/github'
import { getGitHubService } from '../services/github/GitHubService'
import { getTriageService } from '../services/github/TriageService'

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
        error: error instanceof Error ? error.message : 'Unknown error'
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
        error: error instanceof Error ? error.message : 'Unknown error'
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

  // ─── Triage ──────────────────────────────────────────────────
  const triage = getTriageService()

  ipcMain.handle('github:getAllTriageData', () => {
    try {
      return triage.getAllTriageData()
    } catch (error) {
      log.error('[IPC] github:getAllTriageData error:', error)
      throw error
    }
  })

  ipcMain.handle('github:setTriageStatus', (_event, notificationId: string, status: string) => {
    try {
      return triage.setTriageStatus(notificationId, status as TriageStatus)
    } catch (error) {
      log.error('[IPC] github:setTriageStatus error:', error)
      throw error
    }
  })

  ipcMain.handle('github:setTriagePriority', (_event, notificationId: string, priority: number) => {
    try {
      return triage.setTriagePriority(notificationId, priority as TriagePriority)
    } catch (error) {
      log.error('[IPC] github:setTriagePriority error:', error)
      throw error
    }
  })

  ipcMain.handle('github:setTriageNotes', (_event, notificationId: string, notes: string) => {
    try {
      return triage.setTriageNotes(notificationId, notes)
    } catch (error) {
      log.error('[IPC] github:setTriageNotes error:', error)
      throw error
    }
  })

  ipcMain.handle('github:getTriageSortOrder', () => {
    try {
      return triage.getSortOrder()
    } catch (error) {
      log.error('[IPC] github:getTriageSortOrder error:', error)
      throw error
    }
  })

  ipcMain.handle('github:setTriageSortOrder', (_event, order: string[]) => {
    try {
      triage.setSortOrder(order)
    } catch (error) {
      log.error('[IPC] github:setTriageSortOrder error:', error)
      throw error
    }
  })
}
