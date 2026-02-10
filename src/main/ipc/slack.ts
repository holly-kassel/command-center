/**
 * Slack IPC handlers
 *
 * Bridges the SlackParser service to the renderer process.
 */
import { ipcMain } from 'electron'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import log from 'electron-log'
import { SlackParser } from '../services/slack/SlackParser'
import { getObsidianService } from '../services/obsidian/ObsidianService'
import type { ParsedSlackThread } from '../../shared/types/slack'

export function registerSlackIpc(): void {
  ipcMain.handle('slack:parseThread', async (_event, rawText: string): Promise<ParsedSlackThread> => {
    try {
      return SlackParser.parseThread(rawText)
    } catch (err) {
      log.error('[IPC] slack:parseThread error:', err)
      throw err
    }
  })

  ipcMain.handle(
    'slack:saveToObsidian',
    async (_event, thread: ParsedSlackThread, customTitle?: string): Promise<{ success: boolean; path: string }> => {
      try {
        const obsidian = getObsidianService()
        const vaultPath = obsidian.getVaultPath()
        if (!vaultPath) {
          throw new Error('Obsidian vault not configured')
        }

        const markdown = SlackParser.formatForObsidian(thread, customTitle)

        // Save to vault/slack-threads/ directory
        const slackDir = join(vaultPath, 'slack-threads')
        await mkdir(slackDir, { recursive: true })

        // Create filename from title (sanitized)
        const safeTitle = (customTitle || thread.title)
          .replace(/[^a-zA-Z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .slice(0, 60)
          .toLowerCase()
        const dateStr = new Date().toISOString().slice(0, 10)
        const filename = `${dateStr}-${safeTitle}.md`
        const filePath = join(slackDir, filename)

        await writeFile(filePath, markdown, 'utf-8')
        log.info(`[Slack] Saved thread to ${filePath}`)

        // Append a link + preview to today's note
        const title = customTitle || thread.title
        const preview = thread.messages.length > 0
          ? thread.messages[0].content.slice(0, 100).replace(/\n/g, ' ')
          : ''
        const participants = thread.participants.join(', ')
        const noteLink = `[[slack-threads/${filename}|${title}]]`
        const entry = `💬 Saved Slack thread: ${noteLink} (${participants}) — "${preview}${preview.length >= 100 ? '…' : ''}"`

        try {
          await obsidian.appendToToday(entry)
          log.info('[Slack] Added thread reference to today\'s note')
        } catch (appendErr) {
          // Non-fatal — the thread is saved even if we can't link it
          log.warn('[Slack] Could not append to today\'s note:', appendErr)
        }

        return { success: true, path: filePath }
      } catch (err) {
        log.error('[IPC] slack:saveToObsidian error:', err)
        throw err
      }
    }
  )
}
