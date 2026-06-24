/**
 * Obsidian Service
 *
 * Handles vault discovery, quick capture, and coordinates with the
 * WeeklyNoteParser for reading weekly notes.
 */
import { readFile, writeFile, copyFile, unlink, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import log from 'electron-log'
import { settings } from '../../config/settings'
import {
  formatDate,
  getWeekFilePath,
  getTodaySection,
  getDaySection,
  parseWeeklyNote,
  extractCurrentFocus,
  getDayOfWeek,
  ensureWeeklyNote,
} from './WeeklyNoteParser'
import type {
  TodaySection,
  VaultStatus,
  WeeklyNoteSummary,
  WeeklySectionResult
} from '../../../shared/types/obsidian'

const COMMON_VAULT_PATHS = [
  'Documents/obsidian-notes',
  'Documents/code/obsidian-notes',
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

  // ─── Weekly Note Lifecycle ────────────────────────────────────────

  /**
   * Ensure the current week's note file exists, creating it from the
   * scaffold template if needed. Called on startup and before any
   * operation that expects the file to be present.
   */
  async ensureCurrentWeekNote(): Promise<string> {
    if (!this.vaultPath) {
      throw new Error('Vault path not set. Call findVault() or setVaultPath() first.')
    }
    const filePath = await ensureWeeklyNote(this.vaultPath)
    log.info(`[Obsidian] Ensured current week note: ${filePath}`)
    return filePath
  }

  // ─── Reading ─────────────────────────────────────────────────────

  /** Get today's section from the current week's note */
  async getTodaySection(): Promise<TodaySection | null> {
    if (!this.vaultPath) {
      throw new Error('Vault path not set. Call findVault() or setVaultPath() first.')
    }
    return getTodaySection(this.vaultPath)
  }

  /** Get a specific day's section by date string (YYYY-MM-DD) */
  async getDaySection(dateStr: string): Promise<TodaySection | null> {
    if (!this.vaultPath) {
      throw new Error('Vault path not set. Call findVault() or setVaultPath() first.')
    }
    const date = new Date(dateStr + 'T12:00:00') // noon to avoid timezone issues
    return getDaySection(this.vaultPath, date)
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

  /** Get a weekly-level section from the weekly note containing the given date */
  async getWeeklySection(
    dateStr: string,
    section: 'priorities' | 'reflection'
  ): Promise<WeeklySectionResult | null> {
    if (!this.vaultPath) {
      throw new Error('Vault path not set. Call findVault() or setVaultPath() first.')
    }

    const date = new Date(`${dateStr}T12:00:00`)
    const filePath = getWeekFilePath(this.vaultPath, date)
    if (!existsSync(filePath)) return null

    const markdown = await readFile(filePath, 'utf-8')
    const parsed = parseWeeklyNote(markdown)

    return {
      content: section === 'priorities' ? parsed.weeklyPriorities : parsed.weeklyReflection,
      filePath,
      weekStart: parsed.weekStart,
      section
    }
  }

  async listWeeklyNotes(): Promise<WeeklyNoteSummary[]> {
    if (!this.vaultPath) return []
    const weeklyNotesDir = join(this.vaultPath, 'weekly-notes')
    if (!existsSync(weeklyNotesDir)) return []

    const files = await readdir(weeklyNotesDir)
    const weeklyFiles = files.filter((f) => /^\d{4}-\d{2}-\d{2}-week\.md$/.test(f))

    const summaries: WeeklyNoteSummary[] = []
    for (const filename of weeklyFiles) {
      const filePath = join(weeklyNotesDir, filename)
      const mondayStr = filename.slice(0, 10)
      const monday = new Date(`${mondayStr}T12:00:00`)
      const friday = new Date(monday)
      friday.setDate(friday.getDate() + 4)

      const janFirst = new Date(monday.getFullYear(), 0, 1)
      const dayOfYear = Math.floor((monday.getTime() - janFirst.getTime()) / 86400000) + 1
      const weekNumber = Math.ceil((dayOfYear + janFirst.getDay()) / 7)

      const markdown = await readFile(filePath, 'utf-8')
      const parsed = parseWeeklyNote(markdown)

      const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      const days = WEEKDAYS.map((dayName, i) => {
        const dayDate = new Date(monday)
        dayDate.setDate(dayDate.getDate() + i)
        const dayData = parsed.days[dayName]
        return {
          date: formatDate(dayDate),
          dayOfWeek: dayName,
          hasContent: !!dayData && !!dayData.rawContent.trim(),
        }
      })

      summaries.push({
        filename,
        filePath,
        year: monday.getFullYear(),
        weekNumber,
        startDate: mondayStr,
        endDate: formatDate(friday),
        days,
      })
    }

    summaries.sort((a, b) => b.startDate.localeCompare(a.startDate))
    return summaries
  }

  // ─── Update today's content ──────────────────────────────────────

  /**
   * Replace today's section content in the weekly note file.
   * Used by the inline markdown editor and checkbox toggling.
   *
   * Strategy:
   * 1. Read the full weekly note
   * 2. Find today's section boundaries
   * 3. Replace the content between boundaries with new content
   * 4. Write back with backup safety
   */
  async updateTodayContent(newContent: string): Promise<void> {
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

    try {
      await copyFile(filePath, backupPath)

      const content = await readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      const { sectionStart, sectionEnd } = findDaySection(lines, dayOfWeek)
      if (sectionStart === -1) {
        throw new Error(`Could not find section for ${dayOfWeek} in ${filePath}`)
      }

      // Replace the section content (between header and next section)
      const newLines = newContent.split('\n')
      lines.splice(sectionStart, sectionEnd - sectionStart, ...newLines)

      await writeFile(filePath, lines.join('\n'), 'utf-8')
      await unlink(backupPath)

      log.info(`[Obsidian] Updated ${dayOfWeek} section content`)
    } catch (error) {
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

  async updateDayContent(dateStr: string, newContent: string): Promise<void> {
    if (!this.vaultPath) {
      throw new Error('Vault path not set')
    }

    const date = new Date(`${dateStr}T12:00:00`)
    const filePath = getWeekFilePath(this.vaultPath, date)
    if (!existsSync(filePath)) {
      throw new Error(`Weekly note not found: ${filePath}`)
    }

    const backupPath = `${filePath}.backup`
    const dayOfWeek = getDayOfWeek(date)

    try {
      await copyFile(filePath, backupPath)

      const content = await readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      const { sectionStart, sectionEnd } = findDaySection(lines, dayOfWeek)
      if (sectionStart === -1) {
        throw new Error(`Could not find section for ${dayOfWeek} in ${filePath}`)
      }

      const newLines = newContent.split('\n')
      lines.splice(sectionStart, sectionEnd - sectionStart, ...newLines)

      await writeFile(filePath, lines.join('\n'), 'utf-8')
      await unlink(backupPath)

      log.info(`[Obsidian] Updated ${dayOfWeek} (${dateStr}) section content`)
    } catch (error) {
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

  async updateWeeklySection(
    dateStr: string,
    section: 'priorities' | 'reflection',
    newContent: string
  ): Promise<void> {
    if (!this.vaultPath) {
      throw new Error('Vault path not set')
    }

    const date = new Date(`${dateStr}T12:00:00`)
    const filePath = getWeekFilePath(this.vaultPath, date)
    if (!existsSync(filePath)) {
      throw new Error(`Weekly note not found: ${filePath}`)
    }

    const backupPath = `${filePath}.backup`

    try {
      await copyFile(filePath, backupPath)

      const content = await readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      const { sectionStart, sectionEnd } = findWeeklySection(lines, section)
      if (sectionStart === -1) {
        const sectionHeader =
          section === 'priorities' ? '## Weekly Priorities' : '## Weekly Reflection'
        throw new Error(`Could not find ${sectionHeader} in ${filePath}`)
      }

      const newLines = newContent.split('\n')
      lines.splice(sectionStart, sectionEnd - sectionStart, ...newLines)

      await writeFile(filePath, lines.join('\n'), 'utf-8')
      await unlink(backupPath)

      log.info(`[Obsidian] Updated weekly ${section} section for ${dateStr}`)
    } catch (error) {
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

  /**
   * Toggle the Nth checkbox (0-based) within today's section.
   * Finds all `- [ ]` / `- [x]` lines in today's section of the file,
   * then toggles the one at the given index.
   */
  async toggleCheckbox(checkboxIndex: number): Promise<void> {
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

    try {
      await copyFile(filePath, backupPath)

      const content = await readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      const { sectionStart, sectionEnd } = findDaySection(lines, dayOfWeek)
      if (sectionStart === -1) {
        throw new Error(`Could not find section for ${dayOfWeek}`)
      }

      // Find all checkbox lines in this section
      const checkboxLines: number[] = []
      for (let i = sectionStart; i < sectionEnd; i++) {
        if (lines[i].match(/^\s*[-*]\s\[[ xX]\]/)) {
          checkboxLines.push(i)
        }
      }

      if (checkboxIndex < 0 || checkboxIndex >= checkboxLines.length) {
        throw new Error(`Checkbox index ${checkboxIndex} out of range (${checkboxLines.length} checkboxes found)`)
      }

      const absoluteLine = checkboxLines[checkboxIndex]
      const line = lines[absoluteLine]

      if (line.match(/^(\s*[-*]\s)\[ \]/)) {
        lines[absoluteLine] = line.replace(/^(\s*[-*]\s)\[ \]/, '$1[x]')
      } else if (line.match(/^(\s*[-*]\s)\[x\]/i)) {
        lines[absoluteLine] = line.replace(/^(\s*[-*]\s)\[x\]/i, '$1[ ]')
      }

      await writeFile(filePath, lines.join('\n'), 'utf-8')
      await unlink(backupPath)

      log.info(`[Obsidian] Toggled checkbox #${checkboxIndex} (line ${absoluteLine}) in ${dayOfWeek}`)
    } catch (error) {
      if (existsSync(backupPath)) {
        try {
          await copyFile(backupPath, filePath)
          await unlink(backupPath)
        } catch {
          log.error('[Obsidian] Failed to restore backup')
        }
      }
      throw error
    }
  }

  // ─── Quick Capture (append to today) ─────────────────────────────

  /**
   * Append a todo checkbox to today's "Tasks & Notes" subsection.
   * Inserts `- [ ] text` at the end of the subsection.
   */
  async appendTodoToToday(text: string): Promise<void> {
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
    const entry = `- [ ] ${text}`

    try {
      await copyFile(filePath, backupPath)
      const content = await readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      const { sectionStart, sectionEnd } = findDaySection(lines, dayOfWeek)
      if (sectionStart === -1) {
        throw new Error(`Could not find section for ${dayOfWeek} in ${filePath}`)
      }

      const insertLine = findTasksNotesInsertPoint(lines, sectionStart, sectionEnd)
      if (insertLine === -1) {
        throw new Error(`Could not find "### Tasks & Notes" subsection for ${dayOfWeek}`)
      }

      lines.splice(insertLine, 0, entry)
      await writeFile(filePath, lines.join('\n'), 'utf-8')
      await unlink(backupPath)

      log.info(`[Obsidian] Added todo to ${dayOfWeek}: ${text}`)
    } catch (error) {
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

  /**
   * Append a raw multi-line block to today's "Tasks & Notes" subsection.
   * Unlike appendToToday, this does NOT wrap in a bullet or timestamp —
   * it inserts the content as-is with a blank line before it.
   * Used by slash commands that produce structured markdown (summaries, details blocks).
   */
  async appendBlockToToday(block: string): Promise<void> {
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

    try {
      await copyFile(filePath, backupPath)

      const content = await readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      const { sectionStart, sectionEnd } = findDaySection(lines, dayOfWeek)
      if (sectionStart === -1) {
        throw new Error(`Could not find section for ${dayOfWeek} in ${filePath}`)
      }

      const insertLine = findTasksNotesInsertPoint(lines, sectionStart, sectionEnd)
      if (insertLine === -1) {
        throw new Error(`Could not find "### Tasks & Notes" subsection for ${dayOfWeek}`)
      }

      // Insert with blank line before for clean separation
      const blockLines = ['', ...block.split('\n')]
      lines.splice(insertLine, 0, ...blockLines)

      await writeFile(filePath, lines.join('\n'), 'utf-8')
      await unlink(backupPath)

      log.info(`[Obsidian] Appended block to ${dayOfWeek} (${blockLines.length} lines)`)
    } catch (error) {
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

  /**
   * Append a timestamped note bullet to today's "Tasks & Notes", grouped under
   * a stable per-meeting heading. If the heading already exists in today's
   * section, the new bullet is added beneath the existing group; otherwise a
   * fresh heading + bullet group is created.
   *
   * `heading` must be a stable single line (e.g. "**🗓️ Standup · 9:00 AM**")
   * so repeated notes for the same meeting cluster together.
   */
  async appendMeetingNoteToToday(heading: string, note: string): Promise<void> {
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

    const hours = now.getHours()
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const h12 = hours % 12 || 12
    const timestamp = `${h12}:${minutes} ${ampm}`
    const bullet = `- [${timestamp}] ${note}`
    const headingLine = heading.trim()

    try {
      await copyFile(filePath, backupPath)

      const content = await readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      const { sectionStart, sectionEnd } = findDaySection(lines, dayOfWeek)
      if (sectionStart === -1) {
        throw new Error(`Could not find section for ${dayOfWeek} in ${filePath}`)
      }

      // Locate the "### Tasks & Notes" subsection and its content range.
      let tasksHeader = -1
      for (let i = sectionStart; i < sectionEnd; i++) {
        if (lines[i].trim() === '### Tasks & Notes') {
          tasksHeader = i
          break
        }
      }
      if (tasksHeader === -1) {
        throw new Error(`Could not find "### Tasks & Notes" subsection for ${dayOfWeek}`)
      }
      let contentEnd = sectionEnd
      for (let i = tasksHeader + 1; i < sectionEnd; i++) {
        if (lines[i].startsWith('### ')) {
          contentEnd = i
          break
        }
      }

      // Is there already a group for this meeting today?
      let headingIdx = -1
      for (let i = tasksHeader + 1; i < contentEnd; i++) {
        if (lines[i].trim() === headingLine) {
          headingIdx = i
          break
        }
      }

      if (headingIdx !== -1) {
        // Insert after the last content line belonging to this group, stopping
        // at the next meeting heading (**...**) or another ### subsection.
        let insertAt = headingIdx + 1
        for (let i = headingIdx + 1; i < contentEnd; i++) {
          const t = lines[i].trim()
          if (t === '') continue
          if (t.startsWith('**') && t.endsWith('**')) break
          if (t.startsWith('#')) break
          insertAt = i + 1
        }
        lines.splice(insertAt, 0, bullet)
      } else {
        // New group: append heading + bullet at the end of Tasks & Notes.
        const insertPoint = findTasksNotesInsertPoint(lines, sectionStart, sectionEnd)
        if (insertPoint === -1) {
          throw new Error(`Could not find "### Tasks & Notes" subsection for ${dayOfWeek}`)
        }
        lines.splice(insertPoint, 0, '', headingLine, bullet)
      }

      await writeFile(filePath, lines.join('\n'), 'utf-8')
      await unlink(backupPath)

      log.info(`[Obsidian] Appended meeting note to ${dayOfWeek}: ${headingLine}`)
    } catch (error) {
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

function findWeeklySection(
  lines: string[],
  section: 'priorities' | 'reflection'
): { sectionStart: number; sectionEnd: number } {
  const sectionHeader = section === 'priorities' ? '## Weekly Priorities' : '## Weekly Reflection'
  let sectionStart = -1
  let sectionEnd = lines.length

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === sectionHeader) {
      sectionStart = i + 1
      continue
    }

    if (sectionStart !== -1 && i >= sectionStart && lines[i].startsWith('## ')) {
      sectionEnd = i
      break
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
