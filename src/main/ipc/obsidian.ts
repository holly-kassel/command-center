/**
 * Obsidian IPC Handlers
 *
 * Registers ipcMain.handle() for all obsidian-related channels.
 * Called once at app startup from main/index.ts.
 */
import { ipcMain } from 'electron'
import { getObsidianService } from '../services/obsidian/ObsidianService'
import { getFileWatcher } from '../services/obsidian/FileWatcher'
import { getSlashCommandRegistry } from '../services/commands/SlashCommandRegistry'
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

  ipcMain.handle('obsidian:getDaySection', async (_event, dateStr: string) => {
    try {
      return await obsidian.getDaySection(dateStr)
    } catch (error) {
      log.error('[IPC] obsidian:getDaySection error:', error)
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

  ipcMain.handle(
    'obsidian:getWeeklySection',
    async (_event, dateStr: string, section: 'priorities' | 'reflection') => {
      try {
        return await obsidian.getWeeklySection(dateStr, section)
      } catch (error) {
        log.error('[IPC] obsidian:getWeeklySection error:', error)
        throw error
      }
    }
  )

  // ─── Writing ───────────────────────────────────────────────────

  ipcMain.handle('obsidian:appendToToday', async (_event, text: string) => {
    try {
      await obsidian.appendToToday(text)
    } catch (error) {
      log.error('[IPC] obsidian:appendToToday error:', error)
      throw error
    }
  })

  ipcMain.handle('obsidian:appendBlockToToday', async (_event, block: string) => {
    try {
      await obsidian.appendBlockToToday(block)
    } catch (error) {
      log.error('[IPC] obsidian:appendBlockToToday error:', error)
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

  ipcMain.handle('obsidian:listWeeklyNotes', async () => {
    try {
      return await obsidian.listWeeklyNotes()
    } catch (error) {
      log.error('[IPC] obsidian:listWeeklyNotes error:', error)
      throw error
    }
  })

  ipcMain.handle('obsidian:ensureCurrentWeekNote', async () => {
    try {
      return await obsidian.ensureCurrentWeekNote()
    } catch (error) {
      log.error('[IPC] obsidian:ensureCurrentWeekNote error:', error)
      throw error
    }
  })

  ipcMain.handle('obsidian:updateDayContent', async (_event, dateStr: string, content: string) => {
    try {
      await obsidian.updateDayContent(dateStr, content)
    } catch (error) {
      log.error('[IPC] obsidian:updateDayContent error:', error)
      throw error
    }
  })

  ipcMain.handle(
    'obsidian:updateWeeklySection',
    async (_event, dateStr: string, section: 'priorities' | 'reflection', content: string) => {
      try {
        await obsidian.updateWeeklySection(dateStr, section, content)
      } catch (error) {
        log.error('[IPC] obsidian:updateWeeklySection error:', error)
        throw error
      }
    }
  )

  // ─── Slash Commands ────────────────────────────────────────────

  ipcMain.handle('obsidian:executeSlashCommand', async (_event, text: string) => {
    try {
      const registry = getSlashCommandRegistry()
      return await registry.execute(text)
    } catch (error) {
      log.error('[IPC] obsidian:executeSlashCommand error:', error)
      throw error
    }
  })

  ipcMain.handle('obsidian:getSlashCommands', async () => {
    try {
      const registry = getSlashCommandRegistry()
      return registry.getCommands()
    } catch (error) {
      log.error('[IPC] obsidian:getSlashCommands error:', error)
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
    // Ensure the current week's note exists before watching
    await obsidian.ensureCurrentWeekNote()

    const watcher = getFileWatcher()
    watcher.start(join(path, 'weekly-notes'))
    log.info(`[Obsidian] Initialized with vault: ${path}`)
  } else {
    log.warn('[Obsidian] No vault found — user will need to configure manually')
  }
}
