/**
 * Obsidian-specific type definitions
 * Used across main + renderer via preload bridge
 */

/** Result from parsing today's section of a weekly note */
export interface TodaySection {
  /** The full markdown content of today's day section */
  content: string
  /** Day name, e.g. "Monday" */
  dayOfWeek: string
  /** Full path to the weekly note file */
  filePath: string
  /** The date string, e.g. "2026-02-09" */
  date: string
}

/** A subsection within a day (Schedule, Tasks & Notes, Priority Updates) */
export interface DaySubsection {
  name: string
  content: string
}

/** Parsed day section with subsections */
export interface ParsedDay {
  dayOfWeek: string
  date?: string
  rawContent: string
  subsections: Record<string, string>
}

/** Weekly note metadata */
export interface WeeklyNote {
  filePath: string
  weekStart: string // YYYY-MM-DD (Monday)
  weekEnd: string // YYYY-MM-DD (Friday)
  days: Record<string, ParsedDay>
  weeklyPriorities: string
  weeklyReflection: string
}

/** Quick capture entry */
export interface CaptureEntry {
  text: string
  timestamp: string // HH:MM AM/PM
}

/** Vault status for renderer */
export interface VaultStatus {
  found: boolean
  path: string
  weeklyNotesDir: string
  hasCurrentWeekNote: boolean
}

/** Result from executing a slash command */
export interface SlashCommandResult {
  success: boolean
  command: string
  message: string
}

/** Metadata for a registered slash command */
export interface SlashCommandInfo {
  name: string
  description: string
  argHint: string
  multiline?: boolean
}

/** Summary of a weekly note file for the sidebar */
export interface WeeklyNoteSummary {
  /** Filename, e.g. "2026-03-16-week.md" */
  filename: string
  /** Full path to the weekly note file */
  filePath: string
  /** Year */
  year: number
  /** ISO week number */
  weekNumber: number
  /** Monday date as YYYY-MM-DD */
  startDate: string
  /** Friday date as YYYY-MM-DD */
  endDate: string
  /** Days present in this weekly note */
  days: WeeklyNoteDaySummary[]
}

/** Summary of a single day within a weekly note */
export interface WeeklyNoteDaySummary {
  /** YYYY-MM-DD */
  date: string
  /** e.g. "Monday" */
  dayOfWeek: string
  /** Whether this day has any content in the note */
  hasContent: boolean
}

/** Result from reading a weekly-level section (priorities or reflection) */
export interface WeeklySectionResult {
  content: string
  filePath: string
  weekStart: string
  section: 'priorities' | 'reflection'
}
