import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { compileFunction } from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)

function load(path, mocks = {}) {
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const module = { exports: {} }
  compileFunction(code, ['require', 'module', 'exports'], { filename: path })(
    (name) => (Object.hasOwn(mocks, name) ? mocks[name] : require(name)),
    module,
    module.exports
  )
  return module.exports
}

const types = load('src/shared/types/menagerie.ts')
const src = load('src/main/services/menagerie/sessionSources.ts', {
  '../../../shared/types/menagerie': { ...types, MENAGERIE_RETENTION_HOURS: 24 }
})

const now = new Date('2026-03-10T12:00:00Z')
const iso = (hoursAgo) => new Date(now.getTime() - hoursAgo * 3_600_000).toISOString()
const ev = (type, hoursAgo = 0, data) => ({ type, timestamp: iso(hoursAgo), data })

test('deriveStatus: shutdown wins over everything', () => {
  assert.equal(
    src.deriveStatus({ alive: true, events: [ev('assistant.turn_start'), ev('session.shutdown')] }),
    'done'
  )
})

test('deriveStatus: dead process with no shutdown is recent', () => {
  assert.equal(src.deriveStatus({ alive: false, events: [ev('assistant.turn_start')] }), 'recent')
})

test('deriveStatus: unanswered permission is waiting', () => {
  const events = [ev('assistant.turn_start'), ev('permission.requested')]
  assert.equal(src.deriveStatus({ alive: true, events }), 'waiting')
  events.push(ev('permission.completed'))
  assert.equal(src.deriveStatus({ alive: true, events }), 'working')
})

test('deriveStatus: open turn is working, closed turn is idle', () => {
  assert.equal(src.deriveStatus({ alive: true, events: [ev('tool.execution_start')] }), 'working')
  assert.equal(
    src.deriveStatus({
      alive: true,
      events: [ev('assistant.turn_start'), ev('assistant.turn_end')]
    }),
    'idle'
  )
  assert.equal(src.deriveStatus({ alive: true, events: [] }), 'idle')
})

test('parseWorkspaceYaml reads flat key/values and ignores comments', () => {
  const meta = src.parseWorkspaceYaml(
    [
      '# header',
      'id: abc-123',
      'cwd: /Users/h/repo',
      'repository: "holly/repo"',
      'client_name: copilot-cli',
      '',
      'bad line'
    ].join('\n')
  )
  assert.equal(meta.id, 'abc-123')
  assert.equal(meta.cwd, '/Users/h/repo')
  assert.equal(meta.repository, 'holly/repo')
  assert.equal(src.clientFromName(meta.client_name), 'cli')
})

test('parseEventsTail skips a torn first line', () => {
  const text = [
    '{"type":"x","timest',
    JSON.stringify(ev('assistant.turn_start')),
    JSON.stringify(ev('assistant.turn_end'))
  ].join('\n')
  const events = src.parseEventsTail(text)
  assert.equal(events.length, 2)
  assert.equal(events[0].type, 'assistant.turn_start')
})

test('speciesFor is deterministic and within coat range', () => {
  const a = src.speciesFor('session-one')
  const b = src.speciesFor('session-one')
  assert.deepEqual(a, b)
  assert.ok(['puppy', 'kitten'].includes(a.species))
  const max = a.species === 'puppy' ? src.PUPPY_COATS : src.KITTEN_COATS
  assert.ok(a.coat >= 0 && a.coat < max)
})

test('isWithinRetention respects the 24-hour window', () => {
  assert.equal(src.isWithinRetention(iso(20), now), true)
  assert.equal(src.isWithinRetention(iso(30), now), false)
  assert.equal(src.isWithinRetention(null, now), false)
})

test('yardLabel falls back to cwd basename, then Stray', () => {
  assert.equal(src.yardLabel('holly/repo', '/x/y'), 'holly/repo')
  assert.equal(src.yardLabel(null, '/Users/h/projects/thing/'), 'thing')
  assert.equal(src.yardLabel(null, null), 'Stray')
})

test('buildCritter merges row + meta and prefers newest timestamp', () => {
  const critter = src.buildCritter({
    row: {
      id: 's1',
      cwd: '/r',
      repository: 'holly/r',
      branch: 'main',
      summary: 'Fix the thing',
      created_at: iso(5),
      updated_at: iso(4)
    },
    meta: { client_name: 'copilot-autopilot' },
    events: [ev('assistant.turn_start', 1)],
    pid: 42,
    alive: true
  })
  assert.equal(critter.name, 'Fix the thing')
  assert.equal(critter.client, 'autopilot')
  assert.equal(critter.status, 'working')
  assert.equal(critter.lastActivityAt, iso(1))
  assert.equal(critter.pid, 42)
})

test('assembleSnapshot drops stale critters, groups by repo, sorts busiest first', () => {
  const mk = (id, repository, status, hoursAgo) => ({
    id,
    name: id,
    repository,
    branch: null,
    cwd: null,
    status,
    client: 'cli',
    species: 'puppy',
    coat: 0,
    lastActivityAt: iso(hoursAgo),
    lastActivity: null,
    pid: null
  })
  const snap = src.assembleSnapshot(
    [
      mk('a', 'quiet/repo', 'recent', 2),
      mk('b', 'busy/repo', 'idle', 1),
      mk('c', 'busy/repo', 'waiting', 1),
      mk('d', 'old/repo', 'done', 24 * 9),
      mk('e', 'busy/repo', 'working', 24 * 9)
    ],
    now
  )
  assert.deepEqual(
    snap.yards.map((y) => y.repository),
    ['busy/repo', 'quiet/repo']
  )
  assert.deepEqual(
    snap.yards[0].critters.map((c) => c.id),
    ['c', 'e', 'b']
  )
  assert.deepEqual(snap.counts, { working: 1, waiting: 1, idle: 1, recent: 1, done: 0 })
  assert.equal(snap.generatedAt, now.toISOString())
})

test('countNewCompletions counts turn_end after the cursor and advances it', () => {
  const events = [
    ev('assistant.turn_end', 5),
    ev('assistant.turn_start', 2),
    ev('assistant.turn_end', 1),
    { type: 'assistant.turn_end' }
  ]
  const first = src.countNewCompletions(events, null)
  assert.equal(first.count, 2)
  assert.equal(first.latest, iso(1))

  const again = src.countNewCompletions(events, first.latest)
  assert.equal(again.count, 0)
  assert.equal(again.latest, iso(1))

  const partial = src.countNewCompletions(events, iso(3))
  assert.equal(partial.count, 1)
})

test('assembleSnapshot attaches completedTasks per yard, defaulting to 0', () => {
  const critter = (id, repository) => ({
    id,
    name: id,
    repository,
    branch: null,
    cwd: `/r/${repository}`,
    status: 'idle',
    client: 'cli',
    species: 'puppy',
    coat: 0,
    lastActivityAt: iso(1),
    lastActivity: null,
    pid: null
  })
  const snap = src.assembleSnapshot([critter('a', 'o/one'), critter('b', 'o/two')], now, [], {
    'o/one': 4
  })
  const byRepo = Object.fromEntries(snap.yards.map((y) => [y.repository, y.completedTasks]))
  assert.deepEqual(byRepo, { 'o/one': 4, 'o/two': 0 })
})

test('houseLevel steps through the upgrade thresholds', () => {
  assert.equal(types.houseLevel(0), 0)
  assert.equal(types.houseLevel(4), 0)
  assert.equal(types.houseLevel(5), 1)
  assert.equal(types.houseLevel(14), 1)
  assert.equal(types.houseLevel(15), 2)
  assert.equal(types.houseLevel(120), 6)
  assert.equal(types.houseLevel(999), 6)
})

test('currentTool: reports the open tool title, clears on turn end', () => {
  const events = [
    ev('assistant.turn_start'),
    ev('tool.execution_start', 0, { toolCallId: 'a', toolName: 'bash', toolTitle: 'Run tests' })
  ]
  assert.equal(src.currentTool(events), 'Run tests')
  events.push(ev('tool.execution_start', 0, { toolCallId: 'b', toolName: 'view' }))
  assert.equal(src.currentTool(events), 'Using view')
  events.push(ev('tool.execution_complete', 0, { toolCallId: 'b' }))
  assert.equal(src.currentTool(events), 'Run tests')
  events.push(ev('assistant.turn_end'))
  assert.equal(src.currentTool(events), null)
})

test('activeSubagents: started minus finished, reset at turn end', () => {
  const events = [ev('subagent.started'), ev('subagent.started'), ev('subagent.completed')]
  assert.equal(src.activeSubagents(events), 1)
  events.push(ev('subagent.started'), ev('subagent.failed'))
  assert.equal(src.activeSubagents(events), 1)
  events.push(ev('assistant.turn_end'))
  assert.equal(src.activeSubagents(events), 0)
})

test('streakDays counts back from today, or yesterday when today is quiet', () => {
  const today = '2026-03-10'
  assert.equal(types.streakDays({}, today), 0)
  assert.equal(types.streakDays({ '2026-03-10': 1, '2026-03-09': 2, '2026-03-08': 1 }, today), 3)
  assert.equal(types.streakDays({ '2026-03-09': 2, '2026-03-08': 1 }, today), 2)
  assert.equal(types.streakDays({ '2026-03-10': 1, '2026-03-08': 1 }, today), 1)
  assert.equal(types.streakDays({ '2026-03-07': 1 }, today), 0)
})

test('pruneActivity drops days outside the window', () => {
  const today = '2026-03-10'
  const pruned = types.pruneActivity(
    { '2026-03-10': 1, [types.shiftDay(today, -(types.ACTIVITY_DAYS - 1))]: 1, '2025-01-01': 9 },
    today
  )
  assert.equal(Object.keys(pruned).length, 2)
  assert.equal(pruned['2025-01-01'], undefined)
})

test('dayKey/shiftDay use local calendar days', () => {
  assert.equal(types.shiftDay('2026-03-01', -1), '2026-02-28')
  assert.equal(types.shiftDay('2026-12-31', 1), '2027-01-01')
  assert.match(types.dayKey(new Date()), /^\d{4}-\d{2}-\d{2}$/)
})

test('pendingPermission: summarizes the newest unanswered shell request', () => {
  const events = [
    ev('assistant.turn_start'),
    ev('permission.requested', 0, {
      requestId: 'r1',
      permissionRequest: {
        kind: 'shell',
        fullCommandText: 'git status',
        intention: 'Check tree',
        commands: [{ identifier: 'git status', readOnly: true }]
      }
    })
  ]
  const p = src.pendingPermission(events)
  assert.equal(p.requestId, 'r1')
  assert.equal(p.kind, 'shell')
  assert.equal(p.detail, 'git status')
  assert.equal(p.intention, 'Check tree')
  assert.equal(p.readOnly, true)
  events.push(ev('permission.completed', 0, { requestId: 'r1', result: { kind: 'approved' } }))
  assert.equal(src.pendingPermission(events), null)
})

test('pendingPermission: write redirection and writes are not read-only; turn end clears', () => {
  const events = [
    ev('permission.requested', 0, {
      requestId: 'r2',
      permissionRequest: {
        kind: 'shell',
        fullCommandText: 'echo hi > out.txt',
        commands: [{ identifier: 'echo', readOnly: true }],
        hasWriteFileRedirection: true
      }
    })
  ]
  assert.equal(src.pendingPermission(events).readOnly, false)
  events.push(
    ev('permission.requested', 0, {
      requestId: 'r3',
      permissionRequest: { kind: 'write', fileName: '/repo/src/a.ts', intention: 'Edit file' }
    })
  )
  const w = src.pendingPermission(events)
  assert.equal(w.requestId, 'r3')
  assert.equal(w.kind, 'write')
  assert.equal(w.detail, '/repo/src/a.ts')
  events.push(ev('assistant.turn_end'))
  assert.equal(src.pendingPermission(events), null)
})

test('pendingPermission: extension access and mcp kinds are mapped', () => {
  const ext = src.summarizePermission(
    ev('permission.requested', 0, {
      requestId: 'r4',
      permissionRequest: {
        kind: 'extension-permission-access',
        extensionName: 'plugin:foo',
        capabilities: ['skip tool permission prompts']
      }
    })
  )
  assert.equal(ext.kind, 'extension')
  assert.equal(ext.detail, 'plugin:foo: skip tool permission prompts')
  const mcp = src.summarizePermission(
    ev('permission.requested', 0, {
      requestId: 'r5',
      permissionRequest: {
        kind: 'mcp',
        serverName: 'trino',
        toolTitle: 'execute_query',
        readOnly: true
      }
    })
  )
  assert.equal(mcp.kind, 'mcp')
  assert.equal(mcp.detail, 'trino · execute_query')
  assert.equal(mcp.readOnly, true)
})

test('buildCritter attaches pendingPermission only while waiting', () => {
  const events = [
    ev('assistant.turn_start'),
    ev('permission.requested', 0, {
      requestId: 'r6',
      permissionRequest: { kind: 'url', url: 'https://example.com' }
    })
  ]
  const c = src.buildCritter({
    row: { id: 'abc', cwd: '/x', updated_at: '2026-01-01T00:00:00Z' },
    meta: null,
    events,
    pid: 1,
    alive: true
  })
  assert.equal(c.status, 'waiting')
  assert.equal(c.pendingPermission.kind, 'url')
  events.push(ev('permission.completed', 0, { requestId: 'r6' }))
  const c2 = src.buildCritter({
    row: { id: 'abc', cwd: '/x', updated_at: '2026-01-01T00:00:00Z' },
    meta: null,
    events,
    pid: 1,
    alive: true
  })
  assert.equal(c2.pendingPermission, null)
})

test('assembleSnapshot groups neighborhood yards together and lists them', () => {
  const critter = (id, repository, n) => ({
    id,
    name: id,
    repository,
    branch: null,
    cwd: null,
    status: 'idle',
    client: 'cli',
    species: 'puppy',
    coat: 0,
    lastActivityAt: iso(1),
    lastActivity: null,
    pid: null,
    _n: n
  })
  // Busiest-first order would be: platform(3), unrelated(2), product(1), projects(1)
  const critters = [
    critter('p1', 'gh/platform'),
    critter('p2', 'gh/platform'),
    critter('p3', 'gh/platform'),
    critter('u1', 'other/unrelated'),
    critter('u2', 'other/unrelated'),
    critter('a1', 'gh/product'),
    critter('b1', 'gh/projects')
  ]
  const snap = src.assembleSnapshot(
    critters,
    now,
    [],
    {},
    {},
    {
      byRepo: { 'gh/platform': 'Billing', 'gh/product': 'Billing', 'gh/projects': 'Billing' },
      sources: { Billing: 'config' },
      configPath: '/tmp/n.json'
    }
  )
  assert.deepEqual(
    snap.yards.map((y) => y.repository),
    ['gh/platform', 'gh/product', 'gh/projects', 'other/unrelated']
  )
  assert.deepEqual(
    snap.yards.map((y) => y.neighborhood),
    ['Billing', 'Billing', 'Billing', null]
  )
  assert.deepEqual(snap.neighborhoods, [
    {
      name: 'Billing',
      repositories: ['gh/platform', 'gh/product', 'gh/projects'],
      source: 'config'
    }
  ])
  assert.equal(snap.neighborhoodsConfigPath, '/tmp/n.json')

  const plain = src.assembleSnapshot(critters, now)
  assert.deepEqual(plain.neighborhoods, [])
  assert.equal(plain.yards[0].neighborhood, null)
})

const sprites = load('src/renderer/src/windows/Menagerie/sprites.ts')
const village = load('src/renderer/src/windows/Menagerie/layout.ts', {
  '../../../../shared/types/menagerie': types,
  './sprites': sprites
})
const sim = load('src/renderer/src/windows/Menagerie/sim.ts', {
  '../../../../shared/types/menagerie': types,
  './layout': village,
  './sprites': sprites
})

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

test('villageScale uses whole-number zoom with no upper cap, never below 2x', () => {
  const world = { w: 224, h: 176 }
  assert.equal(village.villageScale(world, 2560, 1600), 9)
  assert.equal(village.villageScale(world, 700, 500), 2)
  assert.equal(village.villageScale(world, 300, 200), 2)
  assert.equal(village.villageScale(world, 0, 0), 2)
})

test('wildScenery plants plots around and between yards, off the roads, and stays put', () => {
  // Four yards plus the square in a 3x2 grid leave slot (2,1) unused
  const yards = ['a/one', 'a/two', 'a/three', 'a/four'].map((repository) => ({
    repository,
    critters: []
  }))
  const layout = village.buildLayout(yards, 1.6)
  assert.deepEqual([layout.cols, layout.rows], [3, 2])
  const { world, square: sq } = layout
  const taken = [sq, ...layout.yards.map((y) => y.cell)]
  const area = { x: -150, y: -100, w: world.w + 300, h: world.h + 200 }
  const scenery = village.wildScenery(layout, area)
  assert.ok(scenery.trees.length > 0 && scenery.flowers.length > 0)

  const roadY = sq.y + sq.h / 2 - 4
  const roadX = sq.x + sq.w / 2 - 4
  const items = [
    ...scenery.trees.map((p) => ({ ...p, w: 12, h: 16 })),
    ...scenery.flowers.map((p) => ({ ...p, w: 5, h: 6 }))
  ]
  for (const it of items) {
    const at = `${it.x},${it.y}`
    const hits = (c) =>
      it.x + it.w > c.x && it.x < c.x + c.w && it.y + it.h > c.y && it.y < c.y + c.h
    assert.ok(!taken.some(hits), `scenery overlaps a yard or the square at ${at}`)
    assert.ok(!(it.y < roadY + 8 && it.y + it.h > roadY), `scenery on the east-west road at ${at}`)
    assert.ok(
      !(it.x < roadX + 8 && it.x + it.w > roadX),
      `scenery on the north-south road at ${at}`
    )
  }

  // The unused slot inside the grid is planted too
  const unused = village.wildScenery(layout, { x: 224, y: 88, w: 112, h: 88 })
  assert.ok(unused.trees.length + unused.flowers.length > 0)

  // Seeded by plot, so the same view gives the same scenery and a smaller view shows a subset
  assert.deepEqual(village.wildScenery(layout, area), scenery)
  const smaller = village.wildScenery(layout, { x: -40, y: 0, w: world.w + 40, h: world.h })
  assert.ok(smaller.trees.length > 0)
  for (const t of smaller.trees) {
    assert.ok(scenery.trees.some((u) => u.x === t.x && u.y === t.y))
  }

  // A view inside one yard has nothing to plant
  assert.deepEqual(village.wildScenery(layout, { x: 8, y: 8, w: 100, h: 80 }), {
    trees: [],
    flowers: []
  })
})

test('parseWorkspaceYaml reads block-scalar names without letting their lines override keys', () => {
  const meta = src.parseWorkspaceYaml(
    [
      'id: s1',
      'repository: holly/notes',
      'name: |-',
      '  Run the /day workflow for the vault',
      '',
      '  repository: evil/override',
      '  1. Check the time: 4:00pm',
      'branch: main',
      'summary: >-',
      '  folded',
      '  text',
      'client_name: github/autopilot'
    ].join('\n')
  )
  assert.equal(meta.repository, 'holly/notes')
  assert.equal(meta.branch, 'main')
  assert.equal(meta.client_name, 'github/autopilot')
  assert.equal(
    meta.name,
    'Run the /day workflow for the vault\n\nrepository: evil/override\n1. Check the time: 4:00pm'
  )
  assert.equal(meta.summary, 'folded text')
})

test('buildCritter names a session after the first line of a multi-line name', () => {
  const critter = src.buildCritter({
    row: null,
    meta: { id: 's2', name: 'Run the /day workflow\n\nmore steps', updated_at: iso(1) },
    events: [],
    pid: null,
    alive: false
  })
  assert.equal(critter.name, 'Run the /day workflow')
})

test('describeSchedule turns automation schedules into plain English', () => {
  const base = {
    interval: 'daily',
    schedule_hour: 9,
    schedule_minute: 30,
    schedule_day: 1,
    cron_expression: null
  }
  assert.equal(src.describeSchedule(base), 'Daily at 9:30 AM')
  assert.equal(
    src.describeSchedule({
      ...base,
      interval: 'weekly',
      schedule_day: 4,
      schedule_hour: 14,
      schedule_minute: 0
    }),
    'Thursdays at 2:00 PM'
  )
  assert.equal(
    src.describeSchedule({ ...base, interval: 'hourly', schedule_minute: 5 }),
    'Hourly at :05'
  )
  assert.equal(src.describeSchedule({ ...base, interval: 'manual' }), 'Manual')
  assert.equal(
    src.describeSchedule({ ...base, cron_expression: '30 9,16 * * *' }),
    'Daily at 9:30 AM & 4:30 PM'
  )
  assert.equal(
    src.describeSchedule({ ...base, cron_expression: '0 0 * * 1-5' }),
    'Weekdays at 12:00 AM'
  )
  assert.equal(
    src.describeSchedule({ ...base, cron_expression: '15 12 * * 1,3' }),
    'Mon, Wed at 12:15 PM'
  )
  assert.equal(
    src.describeSchedule({ ...base, cron_expression: '*/5 * * * *' }),
    'Cron */5 * * * *'
  )
  assert.equal(src.describeSchedule({ ...base, cron_expression: '0 9 1 * *' }), 'Cron 0 9 1 * *')
})

test('assembleSnapshot moves automation runs out of the yards and into the town square', () => {
  const mk = (id, repository, status, hoursAgo = 1) => ({
    id,
    name: id,
    repository,
    branch: null,
    cwd: null,
    status,
    client: 'autopilot',
    species: 'puppy',
    coat: 0,
    lastActivityAt: iso(hoursAgo),
    lastActivity: null,
    pid: null,
    currentTool: null,
    subagents: 0,
    pendingPermission: null
  })
  const wf = (id, name, enabled, created) => ({
    id,
    name,
    enabled,
    interval: 'daily',
    schedule_hour: 9,
    schedule_minute: 30,
    schedule_day: 1,
    cron_expression: null,
    project: 'notes',
    created_at: created,
    next_run_at: '2026-03-10T21:30:00Z'
  })
  const run = (task_id, session_id, hoursAgo, status = 'completed', extra = {}) => ({
    task_id,
    status,
    session_id,
    started_at: iso(hoursAgo),
    error_message: null,
    taken_over_at: null,
    ...extra
  })
  const snap = src.assembleSnapshot(
    [
      mk('day-1', 'holly/notes', 'done', 2),
      mk('day-2', 'holly/notes', 'working', 0.1),
      mk('mine', 'holly/notes', 'idle'),
      mk('taken', 'holly/notes', 'idle'),
      mk('lonely-run', 'holly/other', 'done'),
      mk('paused-run', 'holly/other', 'waiting')
    ],
    now,
    [],
    {},
    {},
    undefined,
    {
      workflows: [
        wf('w-day', 'Day', 1, '2026-01-02T00:00:00Z'),
        wf('w-quiet', 'Quiet', 1, '2026-01-01T00:00:00Z'),
        wf('w-off', 'Off', 0, '2026-01-03T00:00:00Z'),
        wf('w-gone', 'Gone', 0, '2026-01-04T00:00:00Z'),
        wf('w-other', 'Other\nsecond line', 1, '2026-01-05T00:00:00Z')
      ],
      runs: [
        run('w-day', 'day-1', 2),
        run('w-day', 'day-2', 0.1, 'running'),
        run('w-day', 'taken', 5, 'completed', { taken_over_at: iso(4) }),
        run('w-quiet', null, 30, 'failed', { error_message: 'Failed to create session\nstack' }),
        run('w-off', 'paused-run', 1, 'running'),
        run('w-other', 'lonely-run', 3, 'cancelled'),
        run('w-ghost', 'mine', 1)
      ]
    }
  )
  // Runs leave their yards; your own sessions and a run you took over stay
  assert.deepEqual(
    snap.yards.map((y) => y.repository),
    ['holly/notes']
  )
  assert.deepEqual(snap.yards[0].critters.map((c) => c.id).sort(), ['mine', 'taken'])
  // Enabled automations show without recent runs; paused ones only while a run is around
  assert.deepEqual(
    snap.automations.map((a) => a.name),
    ['Quiet', 'Day', 'Off', 'Other']
  )
  const [quiet, day, off, other] = snap.automations
  assert.deepEqual(
    day.runs.map((c) => c.id),
    ['day-2', 'day-1']
  )
  assert.deepEqual(day.lastRun, {
    status: 'running',
    sessionId: 'day-2',
    startedAt: iso(0.1),
    error: null
  })
  assert.equal(day.schedule, 'Daily at 9:30 AM')
  assert.equal(day.project, 'notes')
  assert.equal(quiet.runs.length, 0)
  assert.equal(quiet.lastRun.status, 'failed')
  assert.equal(quiet.lastRun.error, 'Failed to create session')
  assert.equal(off.enabled, false)
  assert.equal(off.nextRunAt, null)
  assert.deepEqual(
    off.runs.map((c) => c.id),
    ['paused-run']
  )
  assert.equal(other.lastRun.status, 'completed', 'unknown run statuses read as finished')
  // Header counts and the needs-you queue still see every session
  assert.deepEqual(snap.counts, { working: 1, waiting: 1, idle: 2, recent: 0, done: 2 })
  assert.deepEqual(
    types
      .allCritters(snap)
      .map((c) => c.id)
      .sort(),
    ['day-1', 'day-2', 'lonely-run', 'mine', 'paused-run', 'taken']
  )
})

test('automationState: needs-you beats running beats failed; paused while disabled', () => {
  const c = (id, status) => ({ id, status })
  const a = (over) => ({ enabled: true, lastRun: null, runs: [], ...over })
  assert.equal(
    types.automationState(a({ runs: [c('x', 'working'), c('y', 'waiting')] })),
    'waiting'
  )
  assert.equal(types.automationState(a({ runs: [c('x', 'working')] })), 'running')
  // Started in the app, but its session hasn't shown up on disk yet
  assert.equal(
    types.automationState(a({ lastRun: { status: 'pending', sessionId: null } })),
    'running'
  )
  // The app still says running, but the session already finished
  assert.equal(
    types.automationState(
      a({ lastRun: { status: 'running', sessionId: 'x' }, runs: [c('x', 'done')] })
    ),
    'idle'
  )
  assert.equal(
    types.automationState(a({ lastRun: { status: 'failed', sessionId: null } })),
    'failed'
  )
  assert.equal(types.automationState(a({ enabled: false })), 'paused')
  assert.equal(types.automationState(a({})), 'idle')
})

test('isNapping: idle, closed, and finished sessions nap; working and waiting ones roam', () => {
  assert.deepEqual(
    ['working', 'waiting', 'idle', 'recent', 'done'].map((st) => types.isNapping(st)),
    [false, false, true, true, true]
  )
})

test('layout: nap spots sit beside the cottage, clear of the house, tree, and roaming critters', () => {
  const yards = ['a/one', 'a/two', 'b/three', 'c/four', 'd/five'].map((repository) => ({
    repository,
    critters: [],
    completedTasks: 500,
    streak: 9
  }))
  const layout = village.buildLayout(yards, 1.6)
  const dog = sprites.gridSize(sprites.DOG_HOUSE)
  const cat = sprites.gridSize(sprites.CAT_TREE)
  const tree = sprites.gridSize(sprites.TREE)
  for (const y of layout.yards) {
    const dogRect = { ...y.nap.dogHouse, w: dog.w, h: dog.h }
    const catRect = { ...y.nap.catTree, w: cat.w, h: cat.h }
    // A fully upgraded cottage's annex and lantern glow reach 40px right of the house
    const cottage = { x: y.house.x, y: y.house.y, w: 40, h: 28 }
    for (const r of [dogRect, catRect]) {
      assert.ok(r.x >= y.cell.x && r.x + r.w <= y.cell.x + y.cell.w, 'inside the cell')
      assert.ok(r.y - 12 >= y.cell.y && r.y + r.h <= y.cell.y + y.cell.h, 'z and sleeper inside')
      assert.ok(!overlaps(r, cottage), 'clear of the cottage')
      for (const t of y.trees)
        assert.ok(!overlaps(r, { ...t, w: tree.w, h: tree.h }), 'clear of the tree')
    }
    assert.ok(!overlaps(dogRect, catRect))
    assert.equal(dogRect.y + dog.h, catRect.y + cat.h, 'one ground line')
    // The puppy sleeps on the grass in front of the door; nobody roams over it
    const pupBed = village.napEntrance(y, 'puppy')
    assert.ok(pupBed.y + 12 > dogRect.y + dog.h, 'puppy lies in front of the door')
    assert.ok(y.roam.y >= pupBed.y + 12, 'critters roam below the sleepers')
    for (const t of y.trees) assert.ok(t.x + tree.w <= y.cell.x + y.cell.w)
    for (const f of y.flowers) assert.ok(f.y >= y.roam.y)
    const pupDoor = village.napEntrance(y, 'puppy')
    assert.ok(pupDoor.x >= dogRect.x && pupDoor.x + 12 <= dogRect.x + dog.w)
  }
})

test('layout: automation decorations ring the plaza, clear of the roads, fountain, and each other', () => {
  const layout = village.buildLayout([{ repository: 'a/one', critters: [] }], 1)
  const sq = layout.square
  const { w, h } = sprites.DECORATION_SIZE
  const rects = layout.decorations.map((p) => ({ ...p, w, h }))
  assert.equal(rects.length, 12)
  const plaza = { x: sq.x + 6, y: sq.y + 6, w: sq.w - 12, h: sq.h - 12 }
  const roads = [
    { x: sq.x, y: sq.y + sq.h / 2 - 4, w: sq.w, h: 8 },
    { x: sq.x + sq.w / 2 - 4, y: sq.y, w: 8, h: sq.h }
  ]
  const fountain = { ...layout.fountain, w: 8, h: 6 }
  rects.forEach((r, i) => {
    assert.ok(
      r.x >= plaza.x &&
        r.x + r.w <= plaza.x + plaza.w &&
        r.y >= plaza.y &&
        r.y + r.h <= plaza.y + plaza.h,
      `slot ${i} on the plaza`
    )
    for (const road of roads) assert.ok(!overlaps(r, road), `slot ${i} off the roads`)
    assert.ok(!overlaps(r, fountain), `slot ${i} clear of the fountain`)
    rects.forEach((o, j) => {
      if (j !== i) assert.ok(!overlaps(r, o), `slots ${i} and ${j} overlap`)
    })
    assert.ok(
      village.decorationRect(layout.decorations[i]).y >= sq.y,
      `slot ${i} "?" inside the square`
    )
  })
})

test('sprites: nap spots and decorations are rectangular and only use known colours', () => {
  const check = (grid, palette, name) => {
    const width = grid[0].length
    for (const row of grid) {
      assert.equal(row.length, width, `${name}: ragged row`)
      for (const ch of row)
        if (ch !== '.') assert.ok(palette[ch], `${name}: unknown colour '${ch}'`)
    }
  }
  check(sprites.DOG_HOUSE, sprites.PROP_PALETTE, 'DOG_HOUSE')
  check(sprites.CAT_TREE, { ...sprites.PROP_PALETTE, ...sprites.CAT_TREE_PALETTE }, 'CAT_TREE')
  const decoPalette = {
    ...sprites.PROP_PALETTE,
    ...sprites.DECORATION_ACCENTS[0],
    u: sprites.LAMP_LIT
  }
  sprites.DECORATIONS.forEach((d, i) => {
    for (const [label, grid] of [
      ['idle', d.idle],
      ...d.running.map((g, f) => [`running ${f}`, g])
    ]) {
      check(grid, decoPalette, `decoration ${i} ${label}`)
      assert.deepEqual(
        sprites.gridSize(grid),
        { ...sprites.DECORATION_SIZE },
        `decoration ${i} ${label} size`
      )
    }
  })
  check(sprites.BANG, sprites.BANG_PALETTE, 'BANG')
  assert.notEqual(sprites.decorationFor(0).sprite, sprites.decorationFor(1).sprite)
  assert.equal(
    sprites.decorationFor(sprites.DECORATIONS.length).sprite,
    sprites.decorationFor(0).sprite
  )
})

test('sim: only working and waiting critters roam; one that goes idle walks home, then naps', () => {
  const crit = (id, status, species = 'puppy') => ({
    id,
    name: id,
    repository: 'a/one',
    branch: null,
    cwd: null,
    status,
    client: 'cli',
    species,
    coat: 0,
    lastActivityAt: iso(1),
    lastActivity: null,
    pid: null,
    currentTool: null,
    subagents: 0,
    pendingPermission: null
  })
  const snap = (critters) => ({
    yards: [
      {
        repository: 'a/one',
        critters,
        completedTasks: 0,
        activity: {},
        streak: 0,
        neighborhood: null
      }
    ],
    automations: []
  })
  const first = snap([
    crit('w', 'working'),
    crit('q', 'waiting', 'kitten'),
    crit('i', 'idle'),
    crit('d', 'done', 'kitten')
  ])
  const layout = village.buildLayout(first.yards, 1.6)
  const state = sim.createSim()
  sim.syncSim(state, first, layout)
  assert.deepEqual([...state.actors.keys()].sort(), ['q', 'w'])

  // 'w' finishes its turn: it heads for the dog house instead of vanishing on the spot
  sim.syncSim(
    state,
    snap([crit('w', 'idle'), crit('q', 'waiting', 'kitten'), crit('i', 'idle')]),
    layout
  )
  const w = state.actors.get('w')
  assert.equal(w.headingHome, true)
  assert.deepEqual(w.target, village.napEntrance(layout.yards[0], 'puppy'))
  for (let t = 0; t < 200 && state.actors.has('w'); t++) sim.tickSim(state, layout, 0.1)
  assert.equal(state.actors.has('w'), false)
  assert.equal(state.actors.get('q').action, 'sit')

  // Waking up brings a critter back out into the yard
  sim.syncSim(state, snap([crit('i', 'working'), crit('q', 'waiting', 'kitten')]), layout)
  assert.deepEqual([...state.actors.keys()].sort(), ['i', 'q'])
  const roam = layout.yards[0].roam
  const i = state.actors.get('i')
  assert.ok(i.x >= roam.x && i.x <= roam.x + roam.w && i.y >= roam.y && i.y <= roam.y + roam.h)
})

test('sprites: critters keep their size, every coat colours every pixel, and outlines are closed', () => {
  const sets = [
    ['puppy', sprites.PUPPY, sprites.PUPPY_PORTRAIT, sprites.PUPPY_COATS],
    ['kitten', sprites.KITTEN, sprites.KITTEN_PORTRAIT, sprites.KITTEN_COATS]
  ]
  // Like Katya, fur that meets open air is outlined; dirt, yarn and the ground row are exempt
  const openFur = (grid) => {
    const at = (r, c) =>
      r < 0 || c < 0 || c >= grid[0].length ? '.' : r >= grid.length ? 'G' : grid[r][c]
    const gaps = []
    grid.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        if ('.Dxp'.includes(ch)) return
        const near = [at(r - 1, c), at(r + 1, c), at(r, c - 1), at(r, c + 1)]
        if (near.includes('.')) gaps.push(`row ${r} col ${c}`)
      })
    )
    return gaps
  }
  for (const [name, set, portraits, coats] of sets) {
    const frames = Object.values(set).flat()
    for (const g of frames)
      assert.deepEqual(sprites.gridSize(g), { ...sprites.CRITTER_SIZE }, `${name} frame size`)
    for (const g of portraits)
      assert.deepEqual(sprites.gridSize(g), { ...sprites.PORTRAIT_SIZE }, `${name} portrait size`)
    for (const g of [...frames, ...portraits]) {
      for (const row of g) assert.equal(row.length, g[0].length, `${name}: ragged row`)
      assert.deepEqual(openFur(g), [], `${name}: outline has gaps`)
    }
    coats.forEach((coat, i) => {
      const palette = { ...sprites.PROP_PALETTE, ...coat, c: sprites.COLLAR_COLORS.cli }
      for (const g of [...frames, ...portraits]) {
        for (const ch of g.join(''))
          if (ch !== '.') assert.ok(palette[ch], `${name} coat ${i}: no colour for '${ch}'`)
      }
    })
  }
})
