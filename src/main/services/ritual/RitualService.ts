/**
 * RitualService
 *
 * Manages daily ritual logs and streak tracking.
 * Persists data to electron-store (JSON on disk).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ElectronStore = require('electron-store')
import logger from '../../utils/logger'
import type { DailyLog, Streak, StreakType, WeeklyRitualMetrics } from '../../../shared/types/ritual'

// ─── Store Schema ────────────────────────────────────────────

interface RitualStoreSchema {
  dailyLogs: Record<string, DailyLog>
  streaks: Record<StreakType, Streak>
}

const DEFAULT_STREAK: Streak = {
  streakType: 'morning_ritual',
  currentCount: 0,
  bestCount: 0,
  lastDate: '',
}

const store = new (ElectronStore.default || ElectronStore)({
  name: 'ritual-data',
  defaults: {
    dailyLogs: {},
    streaks: {
      morning_ritual: { ...DEFAULT_STREAK, streakType: 'morning_ritual' },
      evening_ritual: { ...DEFAULT_STREAK, streakType: 'evening_ritual' },
      full_day: { ...DEFAULT_STREAK, streakType: 'full_day' },
      focus: { ...DEFAULT_STREAK, streakType: 'focus' },
    },
  } satisfies RitualStoreSchema,
})

// ─── Helpers ─────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function getYesterday(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  return formatDate(d)
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function emptyLog(date: string): DailyLog {
  return {
    date,
    morningRitualCompleted: false,
    morningRitualTime: null,
    intention: null,
    touchGrassCount: 0,
    eveningRitualCompleted: false,
    eveningRitualTime: null,
    reflection: null,
    gratitude: null,
    untrackedWins: null,
    focusAchieved: false,
    energyLevel: null,
  }
}

// ─── Service ─────────────────────────────────────────────────

export class RitualService {
  /**
   * Get the daily log for a specific date.
   */
  getDailyLog(date: string): DailyLog {
    const logs = store.get('dailyLogs') as Record<string, DailyLog>
    return logs[date] || emptyLog(date)
  }

  /**
   * Get today's daily log.
   */
  getTodayLog(): DailyLog {
    return this.getDailyLog(formatDate(new Date()))
  }

  /**
   * Save (upsert) a daily log. Merges with existing data.
   */
  saveDailyLog(date: string, partial: Partial<DailyLog>): DailyLog {
    const logs = store.get('dailyLogs') as Record<string, DailyLog>
    const existing = logs[date] || emptyLog(date)
    const updated: DailyLog = { ...existing, ...partial, date }
    logs[date] = updated
    store.set('dailyLogs', logs)
    logger.info(`[Ritual] Saved daily log for ${date}`)
    return updated
  }

  /**
   * Get logs for a date range (inclusive).
   */
  getLogsInRange(start: string, end: string): DailyLog[] {
    const logs = store.get('dailyLogs') as Record<string, DailyLog>
    const results: DailyLog[] = []

    const current = new Date(start + 'T12:00:00')
    const endDate = new Date(end + 'T12:00:00')

    while (current <= endDate) {
      const dateStr = formatDate(current)
      results.push(logs[dateStr] || emptyLog(dateStr))
      current.setDate(current.getDate() + 1)
    }

    return results
  }

  /**
   * Get a streak by type.
   */
  getStreak(type: StreakType): Streak {
    const streaks = store.get('streaks') as Record<StreakType, Streak>
    return streaks[type] || { ...DEFAULT_STREAK, streakType: type }
  }

  /**
   * Get all streaks.
   */
  getAllStreaks(): Record<StreakType, Streak> {
    return store.get('streaks') as Record<StreakType, Streak>
  }

  /**
   * Update a streak — called when a ritual is completed.
   * Increments if yesterday was the last date, resets if gap.
   */
  updateStreak(type: StreakType): Streak {
    const today = formatDate(new Date())
    const streaks = store.get('streaks') as Record<StreakType, Streak>
    const streak = streaks[type] || { ...DEFAULT_STREAK, streakType: type }

    if (streak.lastDate === today) {
      // Already counted today
      return streak
    }

    const yesterday = getYesterday(today)

    if (streak.lastDate === yesterday) {
      // Consecutive — increment
      streak.currentCount += 1
    } else {
      // Gap — reset to 1
      streak.currentCount = 1
    }

    streak.lastDate = today
    if (streak.currentCount > streak.bestCount) {
      streak.bestCount = streak.currentCount
    }

    streaks[type] = streak
    store.set('streaks', streaks)
    logger.info(`[Ritual] Streak ${type}: ${streak.currentCount} (best: ${streak.bestCount})`)
    return streak
  }

  /**
   * Check and update the full_day streak (both rituals completed same day).
   */
  checkFullDayStreak(): Streak | null {
    const today = formatDate(new Date())
    const log = this.getDailyLog(today)

    if (log.morningRitualCompleted && log.eveningRitualCompleted) {
      return this.updateStreak('full_day')
    }
    return null
  }

  /**
   * Get weekly ritual metrics for a given week.
   */
  getWeeklyMetrics(weekStartDate?: string): WeeklyRitualMetrics {
    const monday = weekStartDate
      ? new Date(weekStartDate + 'T12:00:00')
      : getMonday(new Date())
    const weekStart = formatDate(monday)

    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4) // Mon-Fri
    const weekEnd = formatDate(friday)

    const logs = this.getLogsInRange(weekStart, weekEnd)

    let morningCompleted = 0
    let eveningCompleted = 0
    let fullDays = 0
    let focusDays = 0
    let energySum = 0
    let energyCount = 0

    const dailyStatuses: WeeklyRitualMetrics['dailyStatuses'] = []

    for (const log of logs) {
      if (log.morningRitualCompleted) morningCompleted++
      if (log.eveningRitualCompleted) eveningCompleted++
      if (log.morningRitualCompleted && log.eveningRitualCompleted) fullDays++
      if (log.focusAchieved) focusDays++
      if (log.energyLevel !== null) {
        energySum += log.energyLevel
        energyCount++
      }

      dailyStatuses.push({
        date: log.date,
        morning: log.morningRitualCompleted,
        evening: log.eveningRitualCompleted,
      })
    }

    return {
      weekStart,
      morningCompleted,
      eveningCompleted,
      fullDays,
      focusDays,
      averageEnergy: energyCount > 0 ? Math.round((energySum / energyCount) * 10) / 10 : null,
      dailyStatuses,
    }
  }
}

// Singleton
let instance: RitualService | null = null

export function getRitualService(): RitualService {
  if (!instance) {
    instance = new RitualService()
  }
  return instance
}
