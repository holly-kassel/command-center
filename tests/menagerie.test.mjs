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

const village = load('src/renderer/src/windows/Menagerie/layout.ts', {
  '../../../../shared/types/menagerie': types
})

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
