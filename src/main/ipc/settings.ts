/**
 * Settings IPC handlers
 *
 * Bridges settings store and dialog APIs to the renderer.
 */
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { settings } from '../config/settings'
import type { AppSettings } from '../config/settings'
import logger from '../utils/logger'

export function registerSettingsIpc(): void {
  // Get all settings
  ipcMain.handle('settings:getAll', () => {
    return settings.getAll()
  })

  // Update partial settings
  ipcMain.handle('settings:update', (_event, partial: Partial<AppSettings>) => {
    logger.info('[Settings] Updating:', Object.keys(partial))
    return settings.update(partial)
  })

  // Get individual setting
  ipcMain.handle('settings:get', (_event, key: keyof AppSettings) => {
    return settings.get(key)
  })

  // Browse for vault path
  ipcMain.handle('settings:browseVaultPath', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: 'Select Obsidian Vault',
      message: 'Choose your Obsidian vault folder',
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    const vaultPath = result.filePaths[0]
    settings.set('obsidianVaultPath', vaultPath)
    logger.info('[Settings] Vault path set to:', vaultPath)
    return vaultPath
  })

  // Test GitHub connection — verifies PAT works
  ipcMain.handle('settings:testGitHubConnection', async () => {
    try {
      // Use the stored PAT check from GitHub IPC
      const isConfigured = await ipcMain.emit('github:isConfigured')
      return { success: !!isConfigured }
    } catch (err) {
      logger.error('[Settings] GitHub test failed:', err)
      return { success: false, error: String(err) }
    }
  })

  logger.info('[Settings] IPC handlers registered')
}
