/**
 * Katya's Menagerie — types shared between main (session discovery) and
 * renderer (pixel village). Each Copilot CLI session becomes one critter;
 * sessions are grouped into "yards" by repository.
 */

/** Derived from a session's lock file + the tail of its events.jsonl */
export type CritterStatus =
  | 'working' // live, mid-turn or running a tool
  | 'waiting' // live, has a pending permission request (needs you!)
  | 'idle' // live process, but between turns
  | 'recent' // no live process, updated within the retention window
  | 'done' // last event was session.shutdown, still inside retention window

/**
 * Critters that aren't working or waiting on you nap in their yard's dog
 * house (puppies) or cat tree (kittens) instead of roaming the yard.
 */
export function isNapping(status: CritterStatus): boolean {
  return status === 'idle' || status === 'recent' || status === 'done'
}

export type CritterSpecies = 'puppy' | 'kitten'

export type CritterClient = 'cli' | 'autopilot' | 'unknown'

export interface Critter {
  /** Copilot session id */
  id: string
  /** User-given or auto-generated session name */
  name: string
  /** `owner/repo` or a folder name when not a git repo */
  repository: string
  branch: string | null
  cwd: string | null
  status: CritterStatus
  client: CritterClient
  species: CritterSpecies
  /** Index into the species' coat palette list */
  coat: number
  /** ISO timestamp of the most recent activity we know about */
  lastActivityAt: string
  /** Short human-readable description of the last thing the agent did */
  lastActivity: string | null
  /** Live process id when the session is alive */
  pid: number | null
  /** Human title of the tool currently running (e.g. "Running command"), while working */
  currentTool: string | null
  /** Number of sub-agents currently running under this session */
  subagents: number
  /** The unanswered permission request, while `status === 'waiting'` */
  pendingPermission: PendingPermission | null
}

export type PermissionKind =
  | 'shell'
  | 'write'
  | 'read'
  | 'path'
  | 'url'
  | 'mcp'
  | 'custom-tool'
  | 'extension'
  | 'memory'
  | 'other'

/**
 * Human-readable summary of a `permission.requested` event. Copilot CLI has no
 * control channel for other processes, so the Menagerie can only *show* the
 * request and deep-link into the session to answer it.
 */
export interface PendingPermission {
  requestId: string
  kind: PermissionKind
  /** What the agent said it was trying to do, when it told us */
  intention: string | null
  /** The command, file, url or tool being asked about */
  detail: string | null
  /** True when every shell segment is read-only (safe to glance-approve) */
  readOnly: boolean
  /** ISO timestamp of the request */
  requestedAt: string
}

export interface Yard {
  repository: string
  critters: Critter[]
  /** Lifetime count of completed agent turns in this repo; drives house upgrades */
  completedTasks: number
  /** Completed turns per local calendar day (YYYY-MM-DD), recent days only */
  activity: Record<string, number>
  /** Consecutive days (ending today or yesterday) with at least one completed turn */
  streak: number
  /**
   * Project this repo belongs to, when it spans several repos. Sourced from
   * the GitHub Copilot app's Collection projects or the user's
   * `menagerie-neighborhoods.json`; null for repos that stand alone.
   */
  neighborhood: string | null
}

/** A multi-repo project: several yards that share a banner in the village */
export interface Neighborhood {
  name: string
  /** `owner/repo` (or folder) names of the yards it contains */
  repositories: string[]
  source: 'collection' | 'config'
}

/** Run status as the GitHub Copilot app records it in `workflow_runs` */
export type AutomationRunStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface AutomationRun {
  status: AutomationRunStatus
  /** Session the run started, when it got that far */
  sessionId: string | null
  startedAt: string
  /** First line of the failure message, for failed runs */
  error: string | null
}

/**
 * An automation from the GitHub Copilot app's Automations view. Each run is an
 * ordinary session, but runs live in the town square as one decoration per
 * automation instead of piling up in a yard.
 */
export interface Automation {
  id: string
  name: string
  enabled: boolean
  /** Human-readable cadence, e.g. "Daily at 9:30 AM & 4:30 PM" */
  schedule: string
  /** Project the runs start in, when the automation has one */
  project: string | null
  /** Next scheduled run; null when paused or manual */
  nextRunAt: string | null
  /** Newest run, even when it's older than the retention window */
  lastRun: AutomationRun | null
  /** Sessions its runs started that are still inside the retention window, newest first */
  runs: Critter[]
}

/** What an automation's town-square decoration shows */
export type AutomationState = 'waiting' | 'running' | 'failed' | 'paused' | 'idle'

export function automationState(a: Automation): AutomationState {
  if (a.runs.some((c) => c.status === 'waiting')) return 'waiting'
  if (a.runs.some((c) => c.status === 'working')) return 'running'
  const last = a.lastRun
  // The app marks a run started before its session shows up on disk
  const starting =
    last !== null &&
    (last.status === 'pending' || last.status === 'running') &&
    !a.runs.some((c) => c.id === last.sessionId)
  if (starting) return 'running'
  if (last?.status === 'failed') return 'failed'
  return a.enabled ? 'idle' : 'paused'
}

/** Completed-task thresholds at which the cottage gains its next upgrade */
export const HOUSE_UPGRADE_THRESHOLDS = [5, 15, 30, 50, 80, 120] as const

export function houseLevel(completedTasks: number): number {
  let level = 0
  for (const t of HOUSE_UPGRADE_THRESHOLDS) if (completedTasks >= t) level++
  return level
}

/** Days of per-day activity we keep and draw in the heatmap */
export const ACTIVITY_DAYS = 56
/** Streak length at which a cottage shows its flame */
export const STREAK_FLAME_DAYS = 3

/** Local calendar day key for a timestamp */
export function dayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d + days))
}

/**
 * Consecutive active days ending today — or ending yesterday, so a streak
 * isn't lost before today's first turn.
 */
export function streakDays(activity: Record<string, number>, today: string): number {
  let day = (activity[today] ?? 0) > 0 ? today : shiftDay(today, -1)
  let streak = 0
  while ((activity[day] ?? 0) > 0) {
    streak++
    day = shiftDay(day, -1)
  }
  return streak
}

/** Drop days older than the heatmap window */
export function pruneActivity(
  activity: Record<string, number>,
  today: string
): Record<string, number> {
  const oldest = shiftDay(today, -(ACTIVITY_DAYS - 1))
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(activity)) if (k >= oldest && v > 0) out[k] = v
  return out
}

export interface MenagerieSnapshot {
  generatedAt: string
  yards: Yard[]
  /** Multi-repo project groupings, in display order */
  neighborhoods: Neighborhood[]
  /** Where the user can edit their own groupings */
  neighborhoodsConfigPath: string | null
  /** Automations decorating the town square, in a stable order */
  automations: Automation[]
  /** Convenience counters for the window header; automation runs included */
  counts: Record<CritterStatus, number>
  /** Non-fatal issues (e.g. sqlite3 missing, falling back to yaml scan) */
  warnings: string[]
}

/** Every critter in the snapshot: yard residents plus automation runs */
export function allCritters(snapshot: Pick<MenagerieSnapshot, 'yards' | 'automations'>): Critter[] {
  return [
    ...snapshot.yards.flatMap((y) => y.critters),
    ...snapshot.automations.flatMap((a) => a.runs)
  ]
}

export const MENAGERIE_RETENTION_HOURS = 24
