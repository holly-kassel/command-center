import type { DailyLog, RitualAnswers, Streak, StreakType } from './types/ritual'

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parseLocalDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid ritual date.')
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime()) || localDate(date) !== value) {
    throw new Error('Invalid ritual date.')
  }
  return date
}

export function addDays(value: string, days: number): string {
  const date = parseLocalDate(value)
  date.setDate(date.getDate() + days)
  return localDate(date)
}

export function isWeekday(value: string): boolean {
  const day = parseLocalDate(value).getDay()
  return day !== 0 && day !== 6
}

export function previousWorkday(value: string): string {
  let previous = addDays(value, -1)
  while (!isWeekday(previous)) previous = addDays(previous, -1)
  return previous
}

export function weekStart(value: string): string {
  const day = parseLocalDate(value).getDay()
  return addDays(value, day === 0 ? -6 : 1 - day)
}

export function emptyLog(date: string): DailyLog {
  return {
    date,
    morningRitualCompleted: false,
    morningRitualTime: null,
    intention: null,
    eveningRitualCompleted: false,
    eveningRitualTime: null,
    touchGrassCount: 0,
    reflection: null,
    gratitude: null,
    untrackedWins: null,
    focusCommitted: false,
    focusAchieved: null,
    energyLevel: null
  }
}

export function answersFromLog(log: DailyLog): RitualAnswers {
  return {
    intention: log.intention ?? '',
    focusCommitted: log.focusCommitted ?? false,
    focusAchieved: log.focusAchieved,
    untrackedWins: log.untrackedWins ?? '',
    wentWell: log.reflection?.wentWell ?? '',
    couldImprove: log.reflection?.couldImprove ?? '',
    gratitude: log.gratitude ?? '',
    energyLevel: log.energyLevel,
    waterConfirmed: false
  }
}

export function deriveStreak(
  logs: Record<string, DailyLog>,
  type: StreakType,
  today: string
): Streak {
  const dates = Object.keys(logs)
    .filter((date) => date <= today && isWeekday(date))
    .filter((date) => {
      const log = logs[date]
      if (type === 'morning_ritual') return log.morningRitualCompleted
      if (type === 'evening_ritual') return log.eveningRitualCompleted
      if (type === 'full_day') return log.morningRitualCompleted && log.eveningRitualCompleted
      return log.focusAchieved === true
    })
    .sort()
  let run = 0
  let best = 0
  let previous = ''
  for (const date of dates) {
    run = previous === previousWorkday(date) ? run + 1 : 1
    best = Math.max(best, run)
    previous = date
  }
  // Today's unfinished ritual does not break yesterday's streak.
  const active = previous === today || previous === previousWorkday(today)
  return { streakType: type, currentCount: active ? run : 0, bestCount: best, lastDate: previous }
}

export function migrateLegacyLogs(logs: Record<string, DailyLog>): Record<string, DailyLog> {
  const migrated: Record<string, DailyLog> = {}
  for (const [date, log] of Object.entries(logs)) {
    parseLocalDate(date)
    migrated[date] = {
      ...emptyLog(date),
      touchGrassCount: log.touchGrassCount ?? 0,
      legacyData: true
    }
  }
  for (const type of ['morning', 'evening'] as const) {
    const completed = Object.entries(logs).filter(([, log]) =>
      type === 'morning' ? log.morningRitualCompleted : log.eveningRitualCompleted
    )
    const targets = new Map(
      completed.map(([date, log]) => {
        const stamp = type === 'morning' ? log.morningRitualTime : log.eveningRitualTime
        const recovered =
          stamp && !Number.isNaN(new Date(stamp).getTime()) ? localDate(new Date(stamp)) : date
        return [date, recovered]
      })
    )
    // Returning one ambiguous record to its original date can create another collision.
    // Resolve all such collisions before assigning any fields.
    let changed = true
    while (changed) {
      changed = false
      const counts = new Map<string, number>()
      for (const target of targets.values()) counts.set(target, (counts.get(target) ?? 0) + 1)
      for (const [date, target] of targets) {
        if ((counts.get(target) ?? 0) > 1 && target !== date) {
          targets.set(date, date)
          changed = true
        }
      }
    }
    for (const [date, source] of completed) {
      const target = targets.get(date) ?? date
      const log = migrated[target] ?? { ...emptyLog(target), legacyData: true }
      if (type === 'morning') {
        Object.assign(log, {
          morningRitualCompleted: true,
          morningRitualTime: source.morningRitualTime,
          intention: source.intention,
          focusCommitted: source.focusAchieved === true
        })
      } else {
        Object.assign(log, {
          eveningRitualCompleted: true,
          eveningRitualTime: source.eveningRitualTime,
          reflection: source.reflection,
          gratitude: source.gratitude,
          untrackedWins: source.untrackedWins,
          energyLevel: source.energyLevel
        })
      }
      migrated[target] = log
    }
  }
  return migrated
}
