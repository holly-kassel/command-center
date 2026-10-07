// eslint-disable-next-line @typescript-eslint/no-require-imports
const ElectronStore = require('electron-store')
import logger from '../../utils/logger'
import {
  addDays,
  deriveStreak,
  emptyLog,
  localDate,
  migrateLegacyLogs,
  parseLocalDate,
  weekStart
} from '../../../shared/ritualLogic'
import type {
  DailyLog,
  RitualCompletion,
  RitualDraft,
  RitualSnapshot,
  Streak,
  StreakType,
  WeeklyRitualMetrics
} from '../../../shared/types/ritual'

interface RitualData {
  schemaVersion: number
  revision: number
  dailyLogs: Record<string, DailyLog>
  drafts: Record<string, RitualDraft>
  operations: string[]
  legacyNotice: string | null
  legacyBackup?: Record<string, unknown>
}

const store = new (ElectronStore.default || ElectronStore)({
  name: 'ritual-data',
  defaults: { dailyLogs: {}, streaks: {} }
})

const STREAK_TYPES: StreakType[] = ['morning_ritual', 'evening_ritual', 'full_day', 'focus']
const DRAFT_ID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i

export class RitualService {
  constructor() {
    if (store.get('schemaVersion') === 2) return
    const original = store.store
    const logs = (store.get('dailyLogs') ?? {}) as Record<string, DailyLog>
    const migrated = migrateLegacyLogs(logs)
    const hasLegacy = Object.keys(logs).length > 0
    store.store = {
      schemaVersion: 2,
      revision: 0,
      dailyLogs: migrated,
      drafts: {},
      operations: [],
      legacyNotice: hasLegacy
        ? "Older records were imported using this device's time zone. Ambiguous dates and reset counts were preserved. Historic focus outcomes are unknown. Original data is backed up."
        : null,
      ...(hasLegacy ? { legacyBackup: original } : {})
    } satisfies RitualData
    logger.info('[Ritual] Migrated ritual data to local-date schema')
  }

  private data(): RitualData {
    return store.store as RitualData
  }

  private commit(data: RitualData): RitualSnapshot {
    data.revision += 1
    store.store = data
    return this.getSnapshot()
  }

  getDailyLog(date: string): DailyLog {
    parseLocalDate(date)
    return this.data().dailyLogs[date] ?? emptyLog(date)
  }

  getTodayLog(): DailyLog {
    return this.getDailyLog(localDate())
  }

  getLogsInRange(start: string, end: string): DailyLog[] {
    parseLocalDate(start)
    parseLocalDate(end)
    if (
      start > end ||
      parseLocalDate(end).getTime() - parseLocalDate(start).getTime() > 366 * 86400000
    ) {
      throw new Error('Choose a ritual history range of at most one year.')
    }
    const logs: DailyLog[] = []
    for (let date = start; date <= end; date = addDays(date, 1)) logs.push(this.getDailyLog(date))
    return logs
  }

  getAllStreaks(): Record<StreakType, Streak> {
    const logs = this.data().dailyLogs
    return {
      morning_ritual: deriveStreak(logs, 'morning_ritual', localDate()),
      evening_ritual: deriveStreak(logs, 'evening_ritual', localDate()),
      full_day: deriveStreak(logs, 'full_day', localDate()),
      focus: deriveStreak(logs, 'focus', localDate())
    }
  }

  getStreak(type: StreakType): Streak {
    if (!STREAK_TYPES.includes(type)) throw new Error('Invalid ritual streak type.')
    return this.getAllStreaks()[type]
  }

  getWeeklyMetrics(start = weekStart(localDate())): WeeklyRitualMetrics {
    const logs = this.getLogsInRange(start, addDays(start, 4))
    const energies = logs.flatMap((log) => (log.energyLevel === null ? [] : [log.energyLevel]))
    return {
      weekStart: start,
      morningCompleted: logs.filter((log) => log.morningRitualCompleted).length,
      eveningCompleted: logs.filter((log) => log.eveningRitualCompleted).length,
      fullDays: logs.filter((log) => log.morningRitualCompleted && log.eveningRitualCompleted)
        .length,
      focusDays: logs.filter((log) => log.focusAchieved === true).length,
      averageEnergy: energies.length
        ? Math.round((energies.reduce((a, b) => a + b, 0) / energies.length) * 10) / 10
        : null,
      dailyStatuses: logs.map((log) => ({
        date: log.date,
        morning: log.morningRitualCompleted,
        evening: log.eveningRitualCompleted
      }))
    }
  }

  getSnapshot(): RitualSnapshot {
    const data = this.data()
    return {
      revision: data.revision,
      todayLog: this.getTodayLog(),
      streaks: this.getAllStreaks(),
      weeklyMetrics: this.getWeeklyMetrics(),
      drafts: Object.values(data.drafts),
      legacyNotice: data.legacyNotice
    }
  }

  private validateDraft(draft: RitualDraft): void {
    if (!draft || !['morning', 'evening', 'touch_grass'].includes(draft.type)) {
      throw new Error('Invalid ritual type.')
    }
    parseLocalDate(draft.date)
    if (draft.date > localDate()) throw new Error('Rituals cannot be saved for a future date.')
    const steps = draft.type === 'touch_grass' ? 2 : 4
    if (
      !Number.isInteger(draft.step) ||
      draft.step < 0 ||
      draft.step >= steps ||
      typeof draft.id !== 'string' ||
      !DRAFT_ID.test(draft.id)
    ) {
      throw new Error('Invalid ritual draft.')
    }
    const answers = draft.answers
    if (
      !answers ||
      !['intention', 'untrackedWins', 'wentWell', 'couldImprove', 'gratitude'].every(
        (key) =>
          typeof answers[key as keyof typeof answers] === 'string' &&
          String(answers[key as keyof typeof answers]).length <= 20000
      ) ||
      typeof answers.focusCommitted !== 'boolean' ||
      typeof answers.waterConfirmed !== 'boolean' ||
      !(answers.focusAchieved === null || typeof answers.focusAchieved === 'boolean') ||
      !(
        answers.energyLevel === null ||
        (Number.isInteger(answers.energyLevel) &&
          answers.energyLevel >= 1 &&
          answers.energyLevel <= 5)
      )
    )
      throw new Error('Invalid ritual answers.')
  }

  saveDraft(draft: RitualDraft): RitualSnapshot {
    this.validateDraft(draft)
    const data = this.data()
    if (data.operations.includes(`complete:${draft.id}`)) return this.getSnapshot()
    const existing = data.drafts[draft.id]
    if (existing && (existing.date !== draft.date || existing.type !== draft.type)) {
      throw new Error('A ritual draft cannot change its date or type.')
    }
    if (
      Object.values(data.drafts).some(
        (saved) => saved.id !== draft.id && saved.type === draft.type && saved.date === draft.date
      )
    )
      throw new Error('A draft already exists for this ritual. Refresh and resume it.')
    data.drafts[draft.id] = { ...draft, updatedAt: new Date().toISOString() }
    return this.commit(data)
  }

  discardDraft(id: string): RitualSnapshot {
    if (typeof id !== 'string' || !DRAFT_ID.test(id)) throw new Error('Invalid ritual draft.')
    const data = this.data()
    delete data.drafts[id]
    return this.commit(data)
  }

  complete({ draft, operationId }: RitualCompletion): RitualSnapshot {
    this.validateDraft(draft)
    if (operationId !== `complete:${draft.id}`) {
      throw new Error('Invalid ritual save operation.')
    }
    const data = this.data()
    if (data.operations.includes(operationId)) return this.getSnapshot()
    const saved = data.drafts[draft.id]
    if (!saved || saved.date !== draft.date || saved.type !== draft.type) {
      throw new Error('Save your draft before completing the ritual.')
    }
    const log = data.dailyLogs[draft.date] ?? emptyLog(draft.date)
    const answers = draft.answers
    const now = new Date().toISOString()
    if (draft.type === 'morning') {
      if (!answers.intention.trim())
        throw new Error('Set an intention before saving your morning ritual.')
      Object.assign(log, {
        morningRitualCompleted: true,
        morningRitualTime: log.morningRitualTime ?? now,
        intention: answers.intention.trim(),
        focusCommitted: answers.focusCommitted
      })
    } else if (draft.type === 'evening') {
      Object.assign(log, {
        eveningRitualCompleted: true,
        eveningRitualTime: log.eveningRitualTime ?? now,
        untrackedWins: answers.untrackedWins.trim(),
        reflection: {
          wentWell: answers.wentWell.trim(),
          couldImprove: answers.couldImprove.trim()
        },
        gratitude: answers.gratitude.trim(),
        energyLevel: answers.energyLevel,
        focusAchieved: answers.focusAchieved
      })
    } else {
      if (!answers.waterConfirmed) throw new Error('Confirm hydration before saving your reset.')
      log.touchGrassCount += 1
    }
    data.dailyLogs[draft.date] = log
    delete data.drafts[draft.id]
    data.operations.push(operationId)
    const snapshot = this.commit(data)
    logger.info(`[Ritual] Saved ${draft.type} for ${draft.date}`)
    return snapshot
  }
}

let instance: RitualService | null = null
export function getRitualService(): RitualService {
  if (!instance) instance = new RitualService()
  return instance
}
