/**
 * Pure helpers for turning raw ~/.copilot artifacts into Critters.
 * No Electron, no fs — everything here takes strings/records so it's
 * easy to unit test. The MenagerieService does the I/O.
 */
import type {
  Neighborhood,
  Critter,
  CritterClient,
  CritterSpecies,
  CritterStatus,
  MenagerieSnapshot,
  PendingPermission,
  PermissionKind,
  Yard
} from '../../../shared/types/menagerie'
import {
  dayKey,
  MENAGERIE_RETENTION_HOURS,
  pruneActivity,
  streakDays
} from '../../../shared/types/menagerie'

export const PUPPY_COATS = 4
export const KITTEN_COATS = 4

/** Row shape from ~/.copilot/session-store.db `sessions` */
export interface SessionRow {
  id: string
  cwd: string | null
  repository: string | null
  branch: string | null
  summary: string | null
  created_at: string
  updated_at: string
}

/** Parsed from session-state/<id>/workspace.yaml */
export interface WorkspaceMeta {
  id?: string
  cwd?: string
  git_root?: string
  repository?: string
  branch?: string
  client_name?: string
  name?: string
  user_named?: string
  created_at?: string
  updated_at?: string
}

/** Minimal line-oriented event shape from events.jsonl */
export interface SessionEvent {
  type: string
  timestamp?: string
  data?: Record<string, unknown>
}

/**
 * workspace.yaml is a flat `key: value` file written by Copilot CLI.
 * Values may be quoted. We deliberately avoid a yaml dependency.
 */
export function parseWorkspaceYaml(text: string): WorkspaceMeta {
  const out: Record<string, string> = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (value === 'null' || value === '~' || value === '') continue
    out[key] = value
  }
  return out as WorkspaceMeta
}

/** Parse the trailing lines of events.jsonl, skipping partial/corrupt lines. */
export function parseEventsTail(text: string): SessionEvent[] {
  const events: SessionEvent[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const parsed = JSON.parse(trimmed) as SessionEvent
      if (parsed && typeof parsed.type === 'string') events.push(parsed)
    } catch {
      // partial first line from a tail read, ignore
    }
  }
  return events
}

export interface StatusInput {
  alive: boolean
  events: SessionEvent[]
}

/**
 * Status rules (checked in order):
 *  - last event is session.shutdown → done
 *  - not alive → recent
 *  - permission.requested with no later permission.completed → waiting
 *  - turn_start / tool.execution_start after the last turn_end → working
 *  - otherwise → idle
 */
export function deriveStatus({ alive, events }: StatusInput): CritterStatus {
  const last = events[events.length - 1]
  if (last && last.type === 'session.shutdown') return 'done'
  if (!alive) return 'recent'

  let pendingPermission = false
  let inTurn = false
  for (const ev of events) {
    switch (ev.type) {
      case 'permission.requested':
        pendingPermission = true
        break
      case 'permission.completed':
        pendingPermission = false
        break
      case 'assistant.turn_start':
      case 'tool.execution_start':
        inTurn = true
        break
      case 'assistant.turn_end':
      case 'agent_idle':
      case 'session.shutdown':
        inTurn = false
        pendingPermission = false
        break
    }
  }
  if (pendingPermission) return 'waiting'
  if (inTurn) return 'working'
  return 'idle'
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** Flatten a `permission.requested` payload into something a bubble can show. */
export function summarizePermission(ev: SessionEvent): PendingPermission | null {
  const data = ev.data ?? {}
  const requestId = str(data.requestId)
  if (!requestId) return null
  const req = (data.permissionRequest ?? data.promptRequest ?? {}) as Record<string, unknown>
  const rawKind = str(req.kind) ?? 'other'
  const kinds: PermissionKind[] = [
    'shell',
    'write',
    'read',
    'path',
    'url',
    'mcp',
    'custom-tool',
    'memory'
  ]
  let kind: PermissionKind = kinds.includes(rawKind as PermissionKind)
    ? (rawKind as PermissionKind)
    : rawKind === 'extension-permission-access'
      ? 'extension'
      : 'other'
  if (kind === 'other' && str(req.extensionName)) kind = 'extension'

  let detail: string | null = null
  let readOnly = false
  switch (kind) {
    case 'shell': {
      detail = str(req.fullCommandText)
      const cmds = Array.isArray(req.commands) ? (req.commands as Record<string, unknown>[]) : []
      readOnly = cmds.length > 0 && cmds.every((c) => c.readOnly === true)
      if (req.hasWriteFileRedirection === true) readOnly = false
      break
    }
    case 'write':
      detail = str(req.fileName) ?? str(req.path)
      break
    case 'read':
    case 'path':
      detail = str(req.path) ?? str(req.fileName)
      readOnly = kind === 'read'
      break
    case 'url':
      detail = str(req.url)
      readOnly = true
      break
    case 'mcp':
      detail = [str(req.serverName), str(req.toolTitle) ?? str(req.toolName)]
        .filter(Boolean)
        .join(' · ')
      readOnly = req.readOnly === true
      break
    case 'custom-tool':
      detail = str(req.toolName)
      break
    case 'extension': {
      const caps = Array.isArray(req.capabilities) ? req.capabilities.map(String).join(', ') : ''
      detail = [str(req.extensionName), caps].filter(Boolean).join(': ')
      break
    }
    default:
      detail = str(req.toolName) ?? str(req.path) ?? str(req.url)
  }

  return {
    requestId,
    kind,
    intention: str(req.intention),
    detail: detail && detail.length > 400 ? detail.slice(0, 397) + '…' : detail,
    readOnly,
    requestedAt: ev.timestamp ?? new Date(0).toISOString()
  }
}

/** The newest `permission.requested` that has not been answered or superseded by a turn boundary. */
export function pendingPermission(events: SessionEvent[]): PendingPermission | null {
  let pending: SessionEvent | null = null
  for (const ev of events) {
    switch (ev.type) {
      case 'permission.requested':
        pending = ev
        break
      case 'permission.completed':
        if (!pending || pending.data?.requestId === ev.data?.requestId || !ev.data?.requestId)
          pending = null
        break
      case 'assistant.turn_end':
      case 'agent_idle':
      case 'session.shutdown':
        pending = null
        break
    }
  }
  return pending ? summarizePermission(pending) : null
}

function toolTitle(data: Record<string, unknown>): string | null {
  if (typeof data.toolTitle === 'string' && data.toolTitle.trim()) return data.toolTitle.trim()
  if (typeof data.toolName === 'string' && data.toolName.trim()) return `Using ${data.toolName}`
  return null
}

/**
 * Title of the tool currently running: the newest `tool.execution_start`
 * since the last turn boundary, unless it has already completed.
 */
export function currentTool(events: SessionEvent[]): string | null {
  const open = new Map<string, string>()
  for (const ev of events) {
    const data = ev.data ?? {}
    switch (ev.type) {
      case 'tool.execution_start': {
        const title = toolTitle(data)
        if (title) open.set(String(data.toolCallId ?? open.size), title)
        break
      }
      case 'tool.execution_complete':
        open.delete(String(data.toolCallId ?? ''))
        break
      case 'assistant.turn_start':
      case 'assistant.turn_end':
      case 'session.shutdown':
        open.clear()
        break
    }
  }
  let last: string | null = null
  for (const title of open.values()) last = title
  return last
}

/** Sub-agents started but not yet completed in this session. */
export function activeSubagents(events: SessionEvent[]): number {
  let n = 0
  for (const ev of events) {
    if (ev.type === 'subagent.started') n++
    else if (ev.type === 'subagent.completed' || ev.type === 'subagent.failed')
      n = Math.max(0, n - 1)
    else if (ev.type === 'assistant.turn_end' || ev.type === 'session.shutdown') n = 0
  }
  return n
}

/** A one-liner describing the newest meaningful event, for the speech bubble. */
export function describeLastActivity(events: SessionEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i]
    const data = ev.data ?? {}
    switch (ev.type) {
      case 'tool.execution_start':
        return toolTitle(data) ?? 'Using a tool'
      case 'permission.requested':
        return 'Waiting for your permission'
      case 'assistant.turn_start':
        return 'Thinking…'
      case 'assistant.turn_end':
        return 'Finished a turn'
      case 'user.message':
        return 'Read your message'
      case 'session.shutdown':
        return 'Clocked out'
      case 'session.start':
      case 'session.resume':
        return 'Just arrived'
    }
  }
  return null
}

/** Newest timestamp we can find for the session. */
export function latestTimestamp(
  updatedAt: string | undefined,
  events: SessionEvent[]
): string | null {
  let best: string | null = updatedAt ?? null
  for (const ev of events) {
    if (ev.timestamp && (!best || ev.timestamp > best)) best = ev.timestamp
  }
  return best
}

export function clientFromName(clientName: string | undefined): CritterClient {
  if (!clientName) return 'unknown'
  if (clientName.includes('autopilot')) return 'autopilot'
  if (clientName.includes('cli')) return 'cli'
  return 'unknown'
}

/** djb2 — small, deterministic, good enough to scatter coats. */
export function hashString(input: string): number {
  let h = 5381
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0
  }
  return h
}

export function speciesFor(id: string): { species: CritterSpecies; coat: number } {
  const h = hashString(id)
  const species: CritterSpecies = h % 2 === 0 ? 'puppy' : 'kitten'
  const coats = species === 'puppy' ? PUPPY_COATS : KITTEN_COATS
  return { species, coat: (h >>> 1) % coats }
}

export function isWithinRetention(
  iso: string | null,
  now: Date,
  hours = MENAGERIE_RETENTION_HOURS
): boolean {
  if (!iso) return false
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return false
  return now.getTime() - t <= hours * 60 * 60 * 1000
}

/** Pick a yard label: prefer `owner/repo`, else the last folder of cwd. */
export function yardLabel(repository: string | null | undefined, cwd: string | null): string {
  if (repository && repository.trim()) return repository.trim()
  if (cwd) {
    const parts = cwd.replace(/\/+$/, '').split('/')
    return parts[parts.length - 1] || 'Somewhere'
  }
  return 'Stray'
}

export interface BuildCritterInput {
  row: SessionRow | null
  meta: WorkspaceMeta | null
  events: SessionEvent[]
  pid: number | null
  alive: boolean
}

export function buildCritter(input: BuildCritterInput): Critter | null {
  const { row, meta, events, pid, alive } = input
  const id = row?.id ?? meta?.id
  if (!id) return null

  const cwd = row?.cwd ?? meta?.cwd ?? null
  const repository = yardLabel(row?.repository ?? meta?.repository, cwd)
  const lastActivityAt = latestTimestamp(row?.updated_at ?? meta?.updated_at, events)
  if (!lastActivityAt) return null

  const { species, coat } = speciesFor(id)
  const name = meta?.name?.trim() || row?.summary?.trim() || id.slice(0, 8)
  const status = deriveStatus({ alive, events })

  return {
    id,
    name,
    repository,
    branch: row?.branch ?? meta?.branch ?? null,
    cwd,
    status,
    client: clientFromName(meta?.client_name),
    species,
    coat,
    lastActivityAt,
    lastActivity: describeLastActivity(events),
    pid: alive ? pid : null,
    currentTool: status === 'working' ? currentTool(events) : null,
    subagents: status === 'working' ? activeSubagents(events) : 0,
    pendingPermission: status === 'waiting' ? pendingPermission(events) : null
  }
}

const STATUS_WEIGHT: Record<CritterStatus, number> = {
  waiting: 0,
  working: 1,
  idle: 2,
  recent: 3,
  done: 4
}

export function isLive(status: CritterStatus): boolean {
  return STATUS_WEIGHT[status] <= 2
}

/** Group, filter by retention, and sort yards busiest-first. */
/**
 * Count `assistant.turn_end` events newer than `sinceIso` (exclusive) and
 * report the newest one seen, so the caller can persist a cursor per session
 * and keep counting across events.jsonl tail truncation.
 */
export function countNewCompletions(
  events: SessionEvent[],
  sinceIso: string | null
): { count: number; latest: string | null; timestamps: string[] } {
  let count = 0
  let latest = sinceIso
  const timestamps: string[] = []
  for (const e of events) {
    if (e.type !== 'assistant.turn_end' || !e.timestamp) continue
    if (sinceIso && e.timestamp <= sinceIso) continue
    count++
    timestamps.push(e.timestamp)
    if (!latest || e.timestamp > latest) latest = e.timestamp
  }
  return { count, latest, timestamps }
}

/** repo → neighborhood name, plus where each grouping came from */
export interface NeighborhoodInput {
  byRepo: Record<string, string>
  sources: Record<string, Neighborhood['source']>
  configPath: string | null
}

const EMPTY_NEIGHBORHOODS: NeighborhoodInput = { byRepo: {}, sources: {}, configPath: null }

export function assembleSnapshot(
  critters: Critter[],
  now: Date,
  warnings: string[] = [],
  completedByRepo: Record<string, number> = {},
  activityByRepo: Record<string, Record<string, number>> = {},
  neighborhoods: NeighborhoodInput = EMPTY_NEIGHBORHOODS
): MenagerieSnapshot {
  const today = dayKey(now)
  const kept = critters.filter((c) => isLive(c.status) || isWithinRetention(c.lastActivityAt, now))

  const byRepo = new Map<string, Critter[]>()
  for (const c of kept) {
    const list = byRepo.get(c.repository) ?? []
    list.push(c)
    byRepo.set(c.repository, list)
  }

  const yards: Yard[] = [...byRepo.entries()]
    .map(([repository, list]) => ({
      repository,
      completedTasks: completedByRepo[repository] ?? 0,
      activity: pruneActivity(activityByRepo[repository] ?? {}, today),
      streak: streakDays(activityByRepo[repository] ?? {}, today),
      neighborhood: neighborhoods.byRepo[repository] ?? null,
      critters: list.sort(
        (a, b) =>
          STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status] ||
          b.lastActivityAt.localeCompare(a.lastActivityAt)
      )
    }))
    .sort((a, b) => {
      const liveA = a.critters.filter((c) => isLive(c.status)).length
      const liveB = b.critters.filter((c) => isLive(c.status)).length
      return (
        liveB - liveA ||
        b.critters.length - a.critters.length ||
        a.repository.localeCompare(b.repository)
      )
    })

  // Keep each neighborhood's yards adjacent, ordering neighborhoods by their
  // busiest member so the sort above still decides who comes first overall.
  const firstIndex = new Map<string, number>()
  yards.forEach((y, i) => {
    if (y.neighborhood && !firstIndex.has(y.neighborhood)) firstIndex.set(y.neighborhood, i)
  })
  const rank = (y: Yard, i: number): number =>
    y.neighborhood ? firstIndex.get(y.neighborhood)! : i
  const grouped = yards
    .map((y, i) => ({ y, i }))
    .sort((a, b) => rank(a.y, a.i) - rank(b.y, b.i) || a.i - b.i)
    .map(({ y }) => y)

  const groups: Neighborhood[] = []
  for (const y of grouped) {
    if (!y.neighborhood) continue
    let g = groups.find((n) => n.name === y.neighborhood)
    if (!g) {
      g = {
        name: y.neighborhood,
        repositories: [],
        source: neighborhoods.sources[y.neighborhood] ?? 'config'
      }
      groups.push(g)
    }
    g.repositories.push(y.repository)
  }

  const counts: Record<CritterStatus, number> = {
    working: 0,
    waiting: 0,
    idle: 0,
    recent: 0,
    done: 0
  }
  for (const c of kept) counts[c.status]++

  return {
    generatedAt: now.toISOString(),
    yards: grouped,
    neighborhoods: groups,
    neighborhoodsConfigPath: neighborhoods.configPath,
    counts,
    warnings
  }
}
