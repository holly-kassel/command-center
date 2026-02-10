/**
 * Obsidian Service
 *
 * Handles vault discovery, quick capture, and coordinates with the
 * WeeklyNoteParser for reading weekly notes.
 */
import { readFile, writeFile, copyFile, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import log from 'electron-log'
import { settings } from '../../config/settings'
import {
  getWeekFilePath,
  getTodaySection,
  parseWeeklyNote,
  extractCurrentFocus,
  getDayOfWeek,
} from './WeeklyNoteParser'
import type { TodaySection, VaultStatus } from '../../../shared/types/obsidian'

const COMMON_VAULT_PATHS = [
  'Documents/obsidian-notes',
  'Documents/Obsidian',
  'Documents/ObsidianVault',
  'obsidian-notes',
]

export class ObsidianService {
  private vaultPath: string = ''

  constructor() {
    // Try to load saved vault path
    const saved = settings.getObsidianVaultPath()
    if (saved && existsSync(saved)) {
      this.vaultPath = saved
    }
  }

  // ─── Vault Discovery ────────────────────────────────────────────

  /**
   * Find the Obsidian vault by checking:
   * 1. Stored setting
   * 2. Common paths relative to home directory
   * 3. Returns empty string if not found (user can set manually)
   */
  async findVault(): Promise<string> {
    // 1. Check stored setting
    const stored = settings.getObsidianVaultPath()
    if (stored && (await this.isValidVault(stored))) {
      this.vaultPath = stored
      log.info(`[Obsidian] Using stored vault path: ${stored}`)
      return stored
    }

    // 2. Check common paths
    const home = homedir()
    for (const relPath of COMMON_VAULT_PATHS) {
      const fullPath = join(home, relPath)
      if (await this.isValidVault(fullPath)) {
        this.vaultPath = fullPath
        settings.setObsidianVaultPath(fullPath)
        log.info(`[Obsidian] Found vault at: ${fullPath}`)
        return fullPath
      }
    }

    log.warn('[Obsidian] Vault not found in common paths')
    return ''
  }

  /**
   * Check if a path is a valid Obsidian vault (contains .obsidian/ directory)
   */
  async isValidVault(path: string): Promise<boolean> {
    return existsSync(path) && existsSync(join(path, '.obsidian'))
  }

  /**
   * Manually set the vault path
   */
  async setVaultPath(path: string): Promise<void> {
    if (!(await this.isValidVault(path))) {
      throw new Error(`Invalid vault path: ${path} (no .obsidian directory found)`)
    }
    this.vaultPath = path
    settings.setObsidianVaultPath(path)
    log.info(`[Obsidian] Vault path set to: ${path}`)
  }

  /** Get current vault path */
  getVaultPath(): string {
    return this.vaultPath
  }

  /** Get vault status for renderer */
  async getVaultStatus(): Promise<VaultStatus> {
    const weeklyNotesDir = this.vaultPath ? join(this.vaultPath, 'weekly-notes') : ''
    const filePath = this.vaultPath ? getWeekFilePath(this.vaultPath) : ''

    return {
      found: !!this.vaultPath,
      path: this.vaultPath,
      weeklyNotesDir,
      hasCurrentWeekNote: !!filePath && existsSync(filePath),
    }
  }

  // ─── Reading ─────────────────────────────────────────────────────

  /** Get today's section from the current week's note */
  async getTodaySection(): Promise<TodaySection | null> {
    if (!this.vaultPath) {
      throw new Error('Vault path not set. Call findVault() or setVaultPath() first.')
    }
    return getTodaySection(this.vaultPath)
  }

  /** Get the current focus/priority from today's section */
  async getCurrentFocus(): Promise<string | null> {
    const today = await this.getTodaySection()
    if (!today) return null
    return extractCurrentFocus(today.content)
  }

  /** Read the full weekly note and return parsed structure */
  async getWeeklyNote(): Promise<ReturnType<typeof parseWeeklyNote> | null> {
    if (!this.vaultPath) return null
    const filePath = getWeekFilePath(this.vaultPath)
    if (!existsSync(filePath)) return null
    const markdown = await readFile(filePath, 'utf-8')
    const parsed = parseWeeklyNote(markdown)
    parsed.filePath = filePath
    return parsed
  }

  // ─── Quick Capture (append to today) ─────────────────────────────

  /**
   * Append a timestamped entry to today's "Tasks & Notes" subsection.
   *
   * Strategy:
   * 1. Find today's day section in the weekly note
   * 2. Within that section, find "### Tasks & Notes"
   * 3. Insert the entry at the end of Tasks & Notes, before ### Priority Updates
   * 4. Use backup + atomic write for safety
   */
  async appendToToday(text: string): Promise<void> {
    if (!this.vaultPath) {
      throw new Error('Vault path not set')
    }

    const filePath = getWeekFilePath(this.vaultPath)
    if (!existsSync(filePath)) {
      throw new Error(`Weekly note not found: ${filePath}`)
    }

    const backupPath = `${filePath}.backup`
    const now = new Date()
    const dayOfWeek = getDayOfWeek(now)

    // Format timestamp: "HH:MM AM/PM"
    const hours = now.getHours()
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const h12 = hours % 12 || 12
    const timestamp = `${h12}:${minutes} ${ampm}`
    const entry = `- [${timestamp}] ${text}`

    try {
      // Create backup
      await copyFile(filePath, backupPath)

      // Read current content
      const content = await readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      // Find today's section boundaries
      const { sectionStart, sectionEnd } = findDaySection(lines, dayOfWeek)
      if (sectionStart === -1) {
        throw new Error(`Could not find section for ${dayOfWeek} in ${filePath}`)
      }

      // Within today's section, find "### Tasks & Notes" and its end
      const insertLine = findTasksNotesInsertPoint(lines, sectionStart, sectionEnd)
      if (insertLine === -1) {
        throw new Error(`Could not find "### Tasks & Notes" subsection for ${dayOfWeek}`)
      }

      // Insert the entry
      lines.splice(insertLine, 0, entry)

      // Write atomically
      await writeFile(filePath, lines.join('\n'), 'utf-8')

      // Remove backup on success
      await unlink(backupPath)

      log.info(`[Obsidian] Appended quick capture to ${dayOfWeek}: ${text}`)
    } catch (error) {
      // Attempt to restore from backup
      if (existsSync(backupPath)) {
        try {
          await copyFile(backupPath, filePath)
          await unlink(backupPath)
          log.info('[Obsidian] Restored from backup after error')
        } catch {
          log.error('[Obsidian] Failed to restore backup')
        }
      }
      throw error
    }
  }
}

// ─── Internal helpers ──────────────────────────────────────────────

/**
 * Find the line range of a specific day's section.
 * Returns { sectionStart, sectionEnd } where sectionEnd is the line
 * BEFORE the next "---" separator or next "## " header.
 */
function findDaySection(
  lines: string[],
  dayOfWeek: string
): { sectionStart: number; sectionEnd: number } {
  let sectionStart = -1
  let sectionEnd = lines.length

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Match day header: "## Monday 2026-02-09" or "## Monday"
    if (line.startsWith(`## ${dayOfWeek}`)) {
      const match = line.match(new RegExp(`^## ${dayOfWeek}(?:\\s+\\d{4}-\\d{2}-\\d{2})?$`))
      if (match) {
        sectionStart = i + 1
        continue
      }
    }

    // After finding start, look for end (next ## or ---)
    if (sectionStart !== -1 && i > sectionStart) {
      if (line.startsWith('## ') || line.trim() === '---') {
        sectionEnd = i
        break
      }
    }
  }

  return { sectionStart, sectionEnd }
}

/**
 * Within a day section, find where to insert a new entry in "### Tasks & Notes".
 * Returns the line number to insert BEFORE (end of Tasks & Notes content,
 * before the next ### or section end).
 */
function findTasksNotesInsertPoint(
  lines: string[],
  sectionStart: number,
  sectionEnd: number
): number {
  let tasksStart = -1
  let insertPoint = -1

  for (let i = sectionStart; i < sectionEnd; i++) {
    const line = lines[i]

    if (line.trim() === '### Tasks & Notes') {
      tasksStart = i + 1
      continue
    }

    // If we're inside Tasks & Notes, look for the next ### header
    if (tasksStart !== -1 && i >= tasksStart) {
      if (line.startsWith('### ')) {
        // Insert before this header — but find the last non-empty line above
        insertPoint = i
        // Walk back past empty lines to insert right after content
        while (insertPoint > tasksStart && lines[insertPoint - 1].trim() === '') {
          insertPoint--
        }
        return insertPoint
      }
    }
  }

  // If Tasks & Notes is the last subsection, insert before sectionEnd
  if (tasksStart !== -1) {
    insertPoint = sectionEnd
    while (insertPoint > tasksStart && lines[insertPoint - 1].trim() === '') {
      insertPoint--
    }
    return insertPoint
  }

  return -1
}

// Singleton instance
let instance: ObsidianService | null = null

export function getObsidianService(): ObsidianService {
  if (!instance) {
    instance = new ObsidianService()
  }
  return instance
}
