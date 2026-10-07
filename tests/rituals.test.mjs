import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { compileFunction } from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const clock = new Date('2026-09-30T12:00:00-05:00')
class TestDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [clock.getTime()]))
  }
  static now() {
    return clock.getTime()
  }
}

function load(path, mocks = {}, environment = {}) {
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const module = { exports: {} }
  compileFunction(code, ['require', 'module', 'exports', 'window', 'Date'], { filename: path })(
    (name) => (Object.hasOwn(mocks, name) ? mocks[name] : require(name)),
    module,
    module.exports,
    environment.window,
    TestDate
  )
  return module.exports
}

const logic = load('src/shared/ritualLogic.ts')
function completed(date, fields = {}) {
  return { ...logic.emptyLog(date), morningRitualCompleted: true, ...fields }
}

function createService(legacy = { dailyLogs: {}, streaks: {} }) {
  let saved = structuredClone(legacy)
  let writes = 0
  let failWrites = false
  class MemoryStore {
    get(key) {
      return structuredClone(saved[key])
    }
    get store() {
      return structuredClone(saved)
    }
    set store(value) {
      if (failWrites) throw new Error('Disk is unavailable')
      saved = structuredClone(value)
      writes++
    }
  }
  const { RitualService } = load('src/main/services/ritual/RitualService.ts', {
    'electron-store': MemoryStore,
    '../../utils/logger': {
      default: {
        info() {
          return undefined
        }
      }
    },
    '../../../shared/ritualLogic': logic
  })
  const service = new RitualService()
  return {
    service,
    saved: () => structuredClone(saved),
    writes: () => writes,
    fail: (value) => {
      failWrites = value
    },
    restart: () => new RitualService()
  }
}

function draft(type = 'morning', date = '2026-09-30', answers = {}) {
  return {
    id: randomUUID(),
    type,
    date,
    step: type === 'touch_grass' ? 1 : 3,
    answers: {
      ...logic.answersFromLog(logic.emptyLog(date)),
      intention: 'Make progress',
      ...answers
    },
    updatedAt: clock.toISOString()
  }
}
function finish(service, value) {
  service.saveDraft(value)
  return service.complete({ draft: value, operationId: `complete:${value.id}` })
}

test('local dates respect evening and positive UTC offsets', () => {
  const original = process.env.TZ
  try {
    process.env.TZ = 'America/Chicago'
    assert.equal(logic.localDate(new Date('2026-09-30T20:00:00-05:00')), '2026-09-30')
    process.env.TZ = 'Asia/Tokyo'
    assert.equal(logic.localDate(new Date('2026-10-01T00:30:00+09:00')), '2026-10-01')
  } finally {
    process.env.TZ = original
  }
})

test('local date arithmetic works across both DST transitions and week rollover', () => {
  const original = process.env.TZ
  try {
    process.env.TZ = 'America/Chicago'
    assert.equal(logic.addDays('2026-03-08', 1), '2026-03-09')
    assert.equal(logic.addDays('2026-11-01', 1), '2026-11-02')
    assert.equal(logic.weekStart('2026-10-04'), '2026-09-28')
    assert.equal(logic.weekStart('2026-10-05'), '2026-10-05')
    assert.throws(() => logic.parseLocalDate('2026-02-30'), /Invalid/)
  } finally {
    process.env.TZ = original
  }
})

test('weekday streaks bridge weekends, ignore weekend entries, and expire after a missed weekday', () => {
  const logs = Object.fromEntries(
    ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-28'].map((date) => [date, completed(date)])
  )
  assert.equal(logic.deriveStreak(logs, 'morning_ritual', '2026-09-28').currentCount, 3)
  assert.equal(logic.deriveStreak(logs, 'morning_ritual', '2026-09-29').currentCount, 3)
  const expired = logic.deriveStreak(logs, 'morning_ritual', '2026-09-30')
  assert.equal(expired.currentCount, 0)
  assert.equal(expired.bestCount, 3)
})

test('full-day and focus streaks require actual completions and outcomes', () => {
  const logs = {
    '2026-09-29': completed('2026-09-29', { eveningRitualCompleted: true, focusCommitted: true }),
    '2026-09-30': completed('2026-09-30', { focusAchieved: true })
  }
  assert.equal(logic.deriveStreak(logs, 'focus', '2026-09-30').currentCount, 1)
  assert.equal(logic.deriveStreak(logs, 'full_day', '2026-09-30').currentCount, 1)
})

test('completion is a single persisted write and morning commitment is not achievement', () => {
  const instance = createService()
  const value = draft('morning', undefined, { focusCommitted: true })
  instance.service.saveDraft(value)
  const before = instance.writes()
  const result = instance.service.complete({ draft: value, operationId: `complete:${value.id}` })
  assert.equal(instance.writes() - before, 1)
  assert.equal(result.todayLog.focusCommitted, true)
  assert.equal(result.todayLog.focusAchieved, null)
  assert.equal(result.weeklyMetrics.focusDays, 0)
  assert.equal(result.drafts.length, 0)
})

test('retrying completion cannot increment resets or resurrect a completed draft', () => {
  const { service } = createService()
  const value = draft('touch_grass', undefined, { waterConfirmed: true })
  finish(service, value)
  service.saveDraft(value)
  const retry = service.complete({ draft: value, operationId: `complete:${value.id}` })
  assert.equal(retry.todayLog.touchGrassCount, 1)
  assert.equal(retry.drafts.length, 0)
  finish(service, draft('touch_grass', undefined, { waterConfirmed: true }))
  assert.equal(service.getTodayLog().touchGrassCount, 2)
})

test('editing a completed ritual preserves the original timestamp and streak count', () => {
  const { service } = createService()
  const first = finish(service, draft())
  const edited = finish(service, draft('morning', undefined, { intention: 'An edited plan' }))
  assert.equal(edited.todayLog.morningRitualTime, first.todayLog.morningRitualTime)
  assert.equal(edited.streaks.morning_ritual.currentCount, 1)
  assert.equal(edited.todayLog.intention, 'An edited plan')
})

test('unanswered energy remains null and only explicit evening focus counts', () => {
  const { service } = createService()
  const result = finish(service, draft('evening', undefined, { focusAchieved: true }))
  assert.equal(result.todayLog.energyLevel, null)
  assert.equal(result.weeklyMetrics.averageEnergy, null)
  assert.equal(result.weeklyMetrics.focusDays, 1)
})

test('failed writes leave log, receipt, and draft unchanged and can be retried', () => {
  const instance = createService()
  const value = draft()
  instance.service.saveDraft(value)
  const before = instance.saved()
  instance.fail(true)
  assert.throws(
    () => instance.service.complete({ draft: value, operationId: `complete:${value.id}` }),
    /Disk/
  )
  assert.deepEqual(instance.saved(), before)
  instance.fail(false)
  assert.equal(
    instance.service.complete({ draft: value, operationId: `complete:${value.id}` }).todayLog
      .morningRitualCompleted,
    true
  )
})

test('drafts survive restart, keep their date across midnight, and can be discarded', () => {
  const instance = createService()
  const value = draft('morning', '2026-09-29', { intention: 'Yesterday' })
  instance.service.saveDraft(value)
  assert.equal(instance.restart().getSnapshot().drafts[0].answers.intention, 'Yesterday')
  const result = instance.service.complete({ draft: value, operationId: `complete:${value.id}` })
  assert.equal(result.todayLog.morningRitualCompleted, false)
  assert.equal(instance.service.getDailyLog('2026-09-29').morningRitualCompleted, true)
  const another = draft()
  instance.service.saveDraft(another)
  assert.equal(instance.service.discardDraft(another.id).drafts.length, 0)
})

test('main process rejects invalid answers, future dates, identity changes, and duplicate drafts', () => {
  const { service } = createService()
  assert.throws(() => service.saveDraft(draft('morning', '2026-10-01')), /future/)
  assert.throws(() => service.saveDraft(draft('evening', undefined, { energyLevel: 6 })), /answers/)
  assert.throws(() => service.saveDraft({ ...draft(), id: '__proto__' }), /draft/)
  assert.throws(
    () => finish(service, draft('morning', undefined, { intention: '  ' })),
    /intention/
  )
  const saved = service.getSnapshot().drafts[0]
  assert.throws(() => service.saveDraft({ ...saved, date: '2026-09-29' }), /cannot change/)
  assert.throws(() => service.saveDraft(draft()), /already exists/)
})

test('migration repairs timestamp-backed dates without inventing focus outcomes', () => {
  const original = process.env.TZ
  try {
    process.env.TZ = 'America/Chicago'
    const legacy = {
      dailyLogs: {
        '2026-09-30': completed('2026-09-30', {
          morningRitualTime: '2026-09-30T14:00:00Z',
          intention: 'Morning',
          focusAchieved: true
        }),
        '2026-10-01': {
          ...logic.emptyLog('2026-10-01'),
          eveningRitualCompleted: true,
          eveningRitualTime: '2026-10-01T01:00:00Z',
          gratitude: 'Evening',
          touchGrassCount: 2
        }
      },
      streaks: { focus: { currentCount: 99 } }
    }
    const instance = createService(legacy)
    const repaired = instance.service.getDailyLog('2026-09-30')
    assert.equal(repaired.morningRitualCompleted, true)
    assert.equal(repaired.eveningRitualCompleted, true)
    assert.equal(repaired.focusAchieved, null)
    assert.equal(instance.service.getDailyLog('2026-10-01').touchGrassCount, 2)
    assert.deepEqual(instance.saved().legacyBackup, legacy)
    const before = instance.writes()
    instance.restart()
    assert.equal(instance.writes(), before)
  } finally {
    process.env.TZ = original
  }
})

test('migration resolves chained collisions without losing any original answer', () => {
  const original = process.env.TZ
  try {
    process.env.TZ = 'America/Chicago'
    const logs = {
      '2026-09-28': completed('2026-09-28', {
        intention: 'A',
        morningRitualTime: '2026-09-29T12:00:00Z'
      }),
      '2026-09-29': completed('2026-09-29', {
        intention: 'B',
        morningRitualTime: '2026-09-28T12:00:00Z'
      }),
      '2026-09-30': completed('2026-09-30', {
        intention: 'C',
        morningRitualTime: '2026-09-29T12:00:00Z'
      })
    }
    const result = logic.migrateLegacyLogs(logs)
    assert.deepEqual(
      Object.values(result)
        .map((log) => log.intention)
        .sort(),
      ['A', 'B', 'C']
    )
    assert.equal(result['2026-09-28'].intention, 'A')
    assert.equal(result['2026-09-29'].intention, 'B')
  } finally {
    process.env.TZ = original
  }
})

function createRenderer(instance, overrides = {}) {
  const api = {
    getSnapshot: async () => instance.service.getSnapshot(),
    getDailyLog: async (date) => instance.service.getDailyLog(date),
    saveDraft: async (value) => instance.service.saveDraft(value),
    discardDraft: async (id) => instance.service.discardDraft(id),
    complete: async (value) => instance.service.complete(value),
    onSyncUpdate() {
      return undefined
    },
    ...overrides
  }
  return load(
    'src/renderer/src/store/ritualStore.ts',
    { '@shared/ritualLogic': logic },
    {
      window: {
        api: { ritual: api },
        addEventListener() {
          return undefined
        }
      }
    }
  ).useRitualStore
}

test('renderer exposes load errors instead of empty success', async () => {
  const store = createRenderer(createService(), {
    getSnapshot: async () => {
      throw new Error('Cannot read data')
    }
  })
  await store.getState().initialize()
  assert.equal(store.getState().isLoading, false)
  assert.equal(store.getState().todayLog, null)
  assert.match(store.getState().error, /Cannot read/)
})

test('renderer guards repeated start, persists answers on pause, and resumes the same step', async () => {
  const store = createRenderer(createService())
  await store.getState().initialize()
  await Promise.all([
    store.getState().startRitual('morning'),
    store.getState().startRitual('morning')
  ])
  assert.equal(store.getState().drafts.length, 1)
  store.getState().updateDraft({ step: 2, answers: { intention: 'Persist this' } })
  await store.getState().pauseRitual()
  assert.equal(store.getState().activeRitual, null)
  await store.getState().startRitual('morning')
  assert.equal(store.getState().draft.step, 2)
  assert.equal(store.getState().draft.answers.intention, 'Persist this')
  await store.getState().discardDraft()
})

test('renderer keeps answers visible on failure and retries once with the same receipt', async () => {
  const instance = createService()
  let failure = true
  let calls = 0
  const store = createRenderer(instance, {
    complete: async (value) => {
      calls++
      if (failure) throw new Error('Cannot write ritual')
      return instance.service.complete(value)
    }
  })
  await store.getState().initialize()
  await store.getState().startRitual('touch_grass')
  store.getState().updateDraft({ step: 1, answers: { waterConfirmed: true } })
  await store.getState().completeRitual()
  assert.match(store.getState().error, /Cannot write/)
  assert.equal(store.getState().draft.answers.waterConfirmed, true)
  failure = false
  await Promise.all([store.getState().completeRitual(), store.getState().completeRitual()])
  assert.equal(calls, 2)
  assert.equal(store.getState().todayLog.touchGrassCount, 1)
  assert.equal(store.getState().activeRitual, null)
})

test('renderer reconciles a lost completion response without duplicate resets or drafts', async () => {
  const instance = createService()
  let loseResponse = true
  const store = createRenderer(instance, {
    complete: async (value) => {
      const result = instance.service.complete(value)
      if (loseResponse) {
        loseResponse = false
        throw new Error('Response lost')
      }
      return result
    }
  })
  await store.getState().initialize()
  await store.getState().startRitual('touch_grass')
  store.getState().updateDraft({ answers: { waterConfirmed: true } })
  await store.getState().completeRitual()
  await store.getState().completeRitual()
  assert.equal(store.getState().todayLog.touchGrassCount, 1)
  assert.equal(store.getState().drafts.length, 0)
})
