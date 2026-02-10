/**
 * Obsidian IPC Handlers
 *
 * Registers ipcMain.handle() for all obsidian-related channels.
 * Called once at app startup from main/index.ts.
 */
import { ipcMain } from 'electron'
import { getObsidianService } from '../services/obsidian/ObsidianService'
import { getFileWatcher } from '../services/obsidian/FileWatcher'
import { join } from 'node:path'
import log from 'electron-log'

export function registerObsidianIpc(): void {
  const obsidian = getObsidianService()
  const watcher = getFileWatcher()

  // ─── Vault ─────────────────────────────────────────────────────

  ipcMain.handle('obsidian:findVault', async () => {
    try {
      return await obsidian.findVault()
    } catch (error) {
      log.error('[IPC] obsidian:findVault error:', error)
      throw error
    }
  })

  ipcMain.handle('obsidian:setVaultPath', async (_event, path: string) => {
    try {
      await obsidian.setVaultPath(path)
      // Start watching the weekly-notes directory
      watcher.start(join(path, 'weekly-notes'))
    } catch (error) {
      log.error('[IPC] obsidian:setVaultPath error:', error)
      throw error
    }
  })

  ipcMain.handle('obsidian:getVaultStatus', async () => {
    try {
      return await obsidian.getVaultStatus()
    } catch (error) {
      log.error('[IPC] obsidian:getVaultStatus error:', error)
      throw error
    }
  })

  // ─── Reading ───────────────────────────────────────────────────

  ipcMain.handle('obsidian:getTodaySection', async () => {
    try {
      return await obsidian.getTodaySection()
    } catch (error) {
      log.error('[IPC] obsidian:getTodaySection error:', error)
      throw error
    }
  })

  ipcMain.handle('obsidian:getCurrentFocus', async () => {
    try {
      return await obsidian.getCurrentFocus()
    } catch (error) {
      log.error('[IPC] obsidian:getCurrentFocus error:', error)
      throw error
    }
  })

  ipcMain.handle('obsidian:getWeeklyNote', async () => {
    try {
      return await obsidian.getWeeklyNote()
    } catch (error) {
      log.error('[IPC] obsidian:getWeeklyNote error:', error)
      throw error
    }
  })

  // ─── Writing ───────────────────────────────────────────────────

  ipcMain.handle('obsidian:appendToToday', async (_event, text: string) => {
    try {
      await obsidian.appendToToday(text)
    } catch (error) {
      log.error('[IPC] obsidian:appendToToday error:', error)
      throw error
    }
  })

  ipcMain.handle('obsidian:updateTodayContent', async (_event, content: string) => {
    try {
      await obsidian.updateTodayContent(content)
    } catch (error) {
      log.error('[IPC] obsidian:updateTodayContent error:', error)
      throw error
    }
  })

  ipcMain.handle('obsidian:toggleCheckbox', async (_event, lineOffset: number) => {
    try {
      await obsidian.toggleCheckbox(lineOffset)
    } catch (error) {
      log.error('[IPC] obsidian:toggleCheckbox error:', error)
      throw error
    }
  })
}

/**
 * Initialize the Obsidian service on app startup:
 * 1. Find the vault
 * 2. Start file watcher if vault found
 */
export async function initObsidian(): Promise<void> {
  const obsidian = getObsidianService()
  const path = await obsidian.findVault()

  if (path) {
    const watcher = getFileWatcher()
    watcher.start(join(path, 'weekly-notes'))
    log.info(`[Obsidian] Initialized with vault: ${path}`)
  } else {
    log.warn('[Obsidian] No vault found — user will need to configure manually')
  }
}
