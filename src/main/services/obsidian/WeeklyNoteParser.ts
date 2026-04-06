/**
 * Weekly Note Parser
 *
 * Parses Holly's Obsidian weekly notes to extract day sections, subsections,
 * and focus/priority markers.
 *
 * File format (verified from actual vault):
 * - Filename: "YYYY-MM-DD-week.md" where date is the Monday
 * - Day headers: "## Monday 2026-02-09" or "## Tuesday" (date optional)
 * - Subsections: ### Schedule, ### Tasks & Notes, ### Priority Updates
 * - Days separated by "---"
 * - Non-day sections: "## Weekly Priorities" (top), "## Weekly Reflection" (bottom)
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { TodaySection, WeeklyNote } from '../../../shared/types/obsidian'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

/**
 * Regex to match day section headers.
 * Matches: "## Monday 2026-02-09" or "## Tuesday" (date optional)
 */
const DAY_HEADER_RE = /^## (Monday|Tuesday|Wednesday|Thursday|Friday)(?:\s+(\d{4}-\d{2}-\d{2}))?$/

// ─── Date helpers ────────────────────────────────────────────────

/** Get the Monday of the week containing `date` */
export function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Get day-of-week name for a Date */
export function getDayOfWeek(date: Date): string {
  return DAY_NAMES[date.getDay()]
}

/** Format a Date as "YYYY-MM-DD" */
export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ─── Filename ────────────────────────────────────────────────────

/** Get the weekly note filename for the week containing `date` */
export function getWeekFilename(date: Date = new Date()): string {
  const monday = getMonday(date)
  return `${formatDate(monday)}-week.md`
}

/** Get full path to the weekly note in the vault */
export function getWeekFilePath(vaultPath: string, date: Date = new Date()): string {
  return join(vaultPath, 'weekly-notes', getWeekFilename(date))
}

// ─── Parsing ─────────────────────────────────────────────────────

/**
 * Parse a weekly note markdown string into day sections.
 * Returns a map of day names to parsed content, plus weekly-level sections.
 */
export function parseWeeklyNote(markdown: string): WeeklyNote {
  const lines = markdown.split('\n')
  const result: WeeklyNote = {
    filePath: '',
    weekStart: '',
    weekEnd: '',
    days: {},
    weeklyPriorities: '',
    weeklyReflection: ''
  }

  // Track current section
  let currentSection: 'priorities' | 'reflection' | 'day' | null = null
  let currentDay: string | null = null
  let currentDayDate: string | undefined
  const sectionLines: string[] = []

  function flushSection(): void {
    const content = sectionLines.join('\n').trim()
    if (currentSection === 'priorities') {
      result.weeklyPriorities = content
    } else if (currentSection === 'reflection') {
      result.weeklyReflection = content
    } else if (currentSection === 'day' && currentDay) {
      result.days[currentDay] = {
        dayOfWeek: currentDay,
        date: currentDayDate,
        rawContent: content,
        subsections: extractSubsections(content)
      }
    }
    sectionLines.length = 0
  }

  for (const line of lines) {
    // Check for H1 (week title) — extract week range
    if (line.startsWith('# Week of ')) {
      const match = line.match(/# Week of (\d{4}-\d{2}-\d{2}) - (\d{4}-\d{2}-\d{2})/)
      if (match) {
        result.weekStart = match[1]
        result.weekEnd = match[2]
      }
      continue
    }

    // Check for H2 sections
    if (line.startsWith('## ')) {
      flushSection()

      // Check for non-day sections
      const sectionName = line.slice(3).trim()
      if (sectionName === 'Weekly Priorities') {
        currentSection = 'priorities'
        currentDay = null
        continue
      }
      if (sectionName === 'Weekly Reflection' || sectionName.startsWith('Weekly Reflection')) {
        currentSection = 'reflection'
        currentDay = null
        continue
      }

      // Check for day header
      const dayMatch = line.match(DAY_HEADER_RE)
      if (dayMatch) {
        currentSection = 'day'
        currentDay = dayMatch[1]
        currentDayDate = dayMatch[2]
        continue
      }

      // Unknown H2 section — treat as generic content
      currentSection = null
      currentDay = null
      continue
    }

    // Skip --- separators (don't include in content)
    if (line.trim() === '---') {
      continue
    }

    // Accumulate lines for current section
    if (currentSection) {
      sectionLines.push(line)
    }
  }

  // Flush final section
  flushSection()

  return result
}

/**
 * Extract ### subsections from a day's content.
 * Returns: { "Schedule": "...", "Tasks & Notes": "...", "Priority Updates": "..." }
 */
export function extractSubsections(dayContent: string): Record<string, string> {
  const lines = dayContent.split('\n')
  const subsections: Record<string, string> = {}
  let currentSub: string | null = null
  const subLines: string[] = []

  function flushSub(): void {
    if (currentSub) {
      subsections[currentSub] = subLines.join('\n').trim()
    }
    subLines.length = 0
  }

  for (const line of lines) {
    if (line.startsWith('### ')) {
      flushSub()
      currentSub = line.slice(4).trim()
      continue
    }
    if (currentSub) {
      subLines.push(line)
    }
  }
  flushSub()

  return subsections
}

// ─── High-level accessors ────────────────────────────────────────

/**
 * Get today's section from the current week's note.
 * Returns the parsed day content, or null if not found.
 */
export async function getTodaySection(vaultPath: string): Promise<TodaySection | null> {
  return getDaySection(vaultPath, new Date())
}

/**
 * Get a specific day's section from the appropriate weekly note.
 * Works for any date — current week, past weeks, etc.
 */
export async function getDaySection(vaultPath: string, date: Date): Promise<TodaySection | null> {
  const dayOfWeek = getDayOfWeek(date)

  // Only weekdays have sections
  if (!WEEKDAY_NAMES.includes(dayOfWeek)) {
    return null
  }

  const filePath = getWeekFilePath(vaultPath, date)
  if (!existsSync(filePath)) {
    return null
  }

  const markdown = await readFile(filePath, 'utf-8')
  const parsed = parseWeeklyNote(markdown)
  const day = parsed.days[dayOfWeek]

  if (!day) {
    return null
  }

  return {
    content: day.rawContent,
    dayOfWeek,
    filePath,
    date: day.date ?? formatDate(date)
  }
}

/**
 * Extract the current focus/priority from today's section.
 * Looks for:
 *  - Bold markers: **🔔 Triage: ...**, **Priority: ...**, **Focus: ...**
 *  - Quick capture format: 🎯 Focus: ...
 * Returns the LAST (most recent) match so focus updates take effect.
 */
export function extractCurrentFocus(dayContent: string): string | null {
  const lines = dayContent.split('\n')
  let lastFocus: string | null = null
  for (const line of lines) {
    // Match bold markers: **🔔 Triage: ...**, **Priority: ...**, **Focus: ...**
    const boldMatch = line.match(/\*\*(?:🔔\s*)?(?:Triage|Priority|Focus):\s*(.*?)\*\*/)
    if (boldMatch) {
      lastFocus = boldMatch[1].trim()
      continue
    }
    // Match quick capture format: 🎯 Focus: ...
    const emojiMatch = line.match(/🎯\s*Focus:\s*(.+)/)
    if (emojiMatch) {
      lastFocus = emojiMatch[1].trim()
    }
  }
  return lastFocus
}

// ─── Scaffolding ─────────────────────────────────────────────────

/**
 * Generate the markdown content for a new weekly note.
 * Matches the format used in the vault: H1 title, Weekly Priorities,
 * day sections (Mon–Fri) with Schedule / Tasks & Notes subsections,
 * and a Weekly Reflection section at the bottom.
 */
export function generateWeeklyNoteContent(monday: Date): string {
  const friday = new Date(monday)
  friday.setDate(friday.getDate() + 4)
  const mondayStr = formatDate(monday)
  const fridayStr = formatDate(friday)

  const lines: string[] = [
    `# Week of ${mondayStr} - ${fridayStr}`,
    '',
    '## Weekly Priorities',
    '',
    '- [ ] Priority 1',
    '- [ ] Priority 2',
    '- [ ] Priority 3'
  ]

  for (let i = 0; i < 5; i++) {
    const dayDate = new Date(monday)
    dayDate.setDate(dayDate.getDate() + i)
    const dayName = WEEKDAY_NAMES[i]
    const dateStr = formatDate(dayDate)

    lines.push(
      '',
      '---',
      '',
      `## ${dayName} ${dateStr}`,
      '### Schedule',
      '- ',
      '',
      '### Tasks & Notes',
      '- '
    )
  }

  lines.push('', '---', '', '## Weekly Reflection', '', '')

  return lines.join('\n')
}

/**
 * Create a new weekly note file if it doesn't already exist.
 * Returns the file path (whether newly created or already existing).
 */
export async function ensureWeeklyNote(
  vaultPath: string,
  date: Date = new Date()
): Promise<string> {
  const weeklyNotesDir = join(vaultPath, 'weekly-notes')
  if (!existsSync(weeklyNotesDir)) {
    await mkdir(weeklyNotesDir, { recursive: true })
  }

  const filePath = getWeekFilePath(vaultPath, date)
  if (existsSync(filePath)) {
    return filePath
  }

  const monday = getMonday(date)
  const content = generateWeeklyNoteContent(monday)
  await writeFile(filePath, content, 'utf-8')

  return filePath
}
