/**
 * MenagerieService
 *
 * Discovers Copilot CLI sessions on this machine and turns them into a
 * MenagerieSnapshot for the pixel village. Everything is read-only and
 * local: ~/.copilot/session-store.db (via the sqlite3 CLI), plus
 * session-state/<id>/{workspace.yaml,inuse.<pid>.lock,events.jsonl}.
 *
 * Polling cadence:
 *  - every 5s: re-stat lock files and re-tail events for live sessions
 *  - every 30s: full re-read of the session DB / workspace.yaml scan
 * Emits to subscribers only when the snapshot actually changes.
 */
import { app, Notification, shell } from 'electron'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promises as fs } from 'node:fs'
import logger from '../../utils/logger'
import type { Critter, MenagerieSnapshot } from '../../../shared/types/menagerie'
import { allCritters, dayKey, pruneActivity } from '../../../shared/types/menagerie'
import {
  assembleSnapshot,
  buildCritter,
  countNewCompletions,
  isWithinRetention,
  parseEventsTail,
  parseWorkspaceYaml,
  type AutomationInput,
  type AutomationRow,
  type AutomationRunRow,
  type NeighborhoodInput,
  type SessionEvent,
  type SessionRow,
  type WorkspaceMeta
} from './sessionSources'

const FAST_POLL_MS = 5_000
const FULL_POLL_MS = 30_000
const EVENTS_TAIL_BYTES = 64 * 1024

type Listener = (snapshot: MenagerieSnapshot) => void

/** Persisted across launches so cottages keep their upgrades */
interface Progress {
  /** repository → lifetime completed turns */
  repos: Record<string, number>
  /** session id → ISO timestamp of the newest turn_end already counted */
  cursors: Record<string, string>
  /** repository → local day (YYYY-MM-DD) → completed turns; drives streaks */
  days: Record<string, Record<string, number>>
  /** Desktop notifications when a critter starts waiting on you */
  notifications: boolean
}

interface SessionDirInfo {
  pid: number | null
  alive: boolean
  meta: WorkspaceMeta | null
  events: SessionEvent[]
}

export class MenagerieService {
  private readonly copilotDir: string
  private listeners = new Set<Listener>()
  private fastTimer: NodeJS.Timeout | null = null
  private fullTimer: NodeJS.Timeout | null = null
  private rows = new Map<string, SessionRow>()
  /** Session ids archived in the GitHub Copilot app (~/.copilot/data.db) */
  private archived = new Set<string>()
  private lastHash = ''
  private lastSnapshot: MenagerieSnapshot | null = null
  private warnings: string[] = []
  private refreshing = false
  private readonly progressPath: string | null
  private progress: Progress | null = null
  private progressDirty = false
  /** Optional user-editable repo groupings; sits next to the progress file */
  private readonly neighborhoodsPath: string | null
  private neighborhoods: NeighborhoodInput = { byRepo: {}, sources: {}, configPath: null }
  /** Automations and their recent runs from the Copilot app (~/.copilot/data.db) */
  private automations: AutomationInput = { workflows: [], runs: [] }

  constructor(
    copilotDir = join(homedir(), '.copilot'),
    progressPath: string | null = null,
    neighborhoodsPath: string | null = null
  ) {
    this.copilotDir = copilotDir
    this.progressPath = progressPath
    this.neighborhoodsPath = neighborhoodsPath
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    if (this.listeners.size === 1) this.start()
    if (this.lastSnapshot) listener(this.lastSnapshot)
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) this.stop()
    }
  }

  async getSnapshot(): Promise<MenagerieSnapshot> {
    if (this.lastSnapshot) return this.lastSnapshot
    await this.refresh(true)
    return this.lastSnapshot ?? assembleSnapshot([], new Date(), this.warnings)
  }

  async forceRefresh(): Promise<MenagerieSnapshot> {
    await this.refresh(true)
    return this.lastSnapshot ?? assembleSnapshot([], new Date(), this.warnings)
  }

  async getNotifications(): Promise<boolean> {
    return (await this.loadProgress()).notifications
  }

  async setNotifications(enabled: boolean): Promise<boolean> {
    const progress = await this.loadProgress()
    if (progress.notifications !== enabled) {
      progress.notifications = enabled
      this.progressDirty = true
      await this.saveProgress()
    }
    if (!enabled) this.setBadge(0)
    return enabled
  }

  private start(): void {
    if (this.fastTimer) return
    void this.refresh(true)
    this.fastTimer = setInterval(() => void this.refresh(false), FAST_POLL_MS)
    this.fullTimer = setInterval(() => void this.refresh(true), FULL_POLL_MS)
  }

  stop(): void {
    if (this.fastTimer) clearInterval(this.fastTimer)
    if (this.fullTimer) clearInterval(this.fullTimer)
    this.fastTimer = null
    this.fullTimer = null
  }

  // ── Refresh pipeline ──────────────────────────────────────────

  private async refresh(full: boolean): Promise<void> {
    if (this.refreshing) return
    this.refreshing = true
    try {
      if (full || this.rows.size === 0)
        await Promise.all([
          this.loadRows(),
          this.loadArchived(),
          this.loadNeighborhoods(),
          this.loadAutomations()
        ])
      const progress = await this.loadProgress()

      const now = new Date()
      const stateDir = join(this.copilotDir, 'session-state')
      const candidateIds = (await this.candidateSessionIds(stateDir, now)).filter(
        (id) => !this.archived.has(id)
      )

      const critters: Critter[] = []
      await Promise.all(
        candidateIds.map(async (id) => {
          const info = await this.readSessionDir(join(stateDir, id))
          const critter = buildCritter({
            row: this.rows.get(id) ?? null,
            meta: info.meta,
            events: info.events,
            pid: info.pid,
            alive: info.alive
          })
          if (!critter) return
          critters.push(critter)
          this.recordCompletions(progress, critter, info.events)
        })
      )
      await this.saveProgress()

      const snapshot = assembleSnapshot(
        critters,
        now,
        [...this.warnings],
        progress.repos,
        progress.days,
        this.neighborhoods,
        this.automations
      )
      const hash = createHash('sha1')
        .update(
          JSON.stringify({ y: snapshot.yards, a: snapshot.automations, w: snapshot.warnings })
        )
        .digest('hex')
      if (hash !== this.lastHash) {
        if (progress.notifications) this.nudge(this.lastSnapshot, snapshot)
        this.lastHash = hash
        this.lastSnapshot = snapshot
        for (const l of this.listeners) l(snapshot)
      } else if (this.lastSnapshot) {
        this.lastSnapshot = { ...this.lastSnapshot, generatedAt: snapshot.generatedAt }
      }
    } catch (error) {
      logger.error('[Menagerie] refresh failed:', error)
    } finally {
      this.refreshing = false
    }
  }

  /**
   * Which session dirs are worth reading? Anything with a lock file (may be
   * live), plus anything the DB says was updated inside the retention window.
   * Falls back to stat-ing every dir's workspace.yaml when the DB is unavailable.
   */
  private async candidateSessionIds(stateDir: string, now: Date): Promise<string[]> {
    const ids = new Set<string>()
    for (const [id, row] of this.rows) {
      if (isWithinRetention(row.updated_at, now)) ids.add(id)
    }

    let entries: string[] = []
    try {
      entries = await fs.readdir(stateDir)
    } catch {
      return [...ids]
    }

    await Promise.all(
      entries.map(async (id) => {
        if (ids.has(id)) return
        const dir = join(stateDir, id)
        try {
          const files = await fs.readdir(dir)
          if (files.some((f) => f.startsWith('inuse.') && f.endsWith('.lock'))) {
            ids.add(id)
            return
          }
          if (this.rows.size === 0 && files.includes('workspace.yaml')) {
            const st = await fs.stat(join(dir, 'workspace.yaml'))
            if (isWithinRetention(st.mtime.toISOString(), now)) ids.add(id)
          }
        } catch {
          // not a session dir
        }
      })
    )
    return [...ids]
  }

  private async readSessionDir(dir: string): Promise<SessionDirInfo> {
    let files: string[] = []
    try {
      files = await fs.readdir(dir)
    } catch {
      return { pid: null, alive: false, meta: null, events: [] }
    }

    let pid: number | null = null
    let alive = false
    for (const f of files) {
      const m = /^inuse\.(\d+)\.lock$/.exec(f)
      if (!m) continue
      const candidate = Number(m[1])
      if (processAlive(candidate)) {
        pid = candidate
        alive = true
        break
      }
      pid ??= candidate
    }

    const [meta, events] = await Promise.all([
      files.includes('workspace.yaml')
        ? fs
            .readFile(join(dir, 'workspace.yaml'), 'utf8')
            .then(parseWorkspaceYaml)
            .catch(() => null)
        : Promise.resolve(null),
      files.includes('events.jsonl') ? tailEvents(join(dir, 'events.jsonl')) : Promise.resolve([])
    ])

    return { pid, alive, meta, events }
  }

  private async loadRows(): Promise<void> {
    const dbPath = join(this.copilotDir, 'session-store.db')
    try {
      await fs.access(dbPath)
    } catch {
      this.rows.clear()
      this.setWarning('db', 'session-store.db not found; using workspace.yaml only')
      return
    }

    try {
      const json = await runSqlite(dbPath)
      const parsed = JSON.parse(json || '[]') as SessionRow[]
      this.rows = new Map(parsed.map((r) => [r.id, r]))
      this.clearWarning('db')
    } catch (error) {
      logger.warn('[Menagerie] sqlite3 read failed, falling back to yaml scan:', error)
      this.rows.clear()
      this.setWarning('db', 'Could not read session-store.db (is sqlite3 installed?)')
    }
  }

  /**
   * Archived chats/sessions should vanish from the village. The archive flag
   * lives in the GitHub Copilot app's own store (data.db), not in the CLI's
   * session-store.db, so read it separately and treat it as best-effort.
   */
  private async loadArchived(): Promise<void> {
    const dbPath = join(this.copilotDir, 'data.db')
    try {
      await fs.access(dbPath)
    } catch {
      this.archived.clear()
      return
    }
    try {
      const json = await runSqlite(dbPath, ARCHIVED_SQL)
      const parsed = JSON.parse(json || '[]') as { id: string }[]
      this.archived = new Set(parsed.map((r) => r.id).filter(Boolean))
    } catch (error) {
      logger.warn('[Menagerie] could not read archived sessions from data.db:', error)
    }
  }

  /**
   * Multi-repo projects. Two sources, merged with the user's file winning:
   *  - Collection projects in the GitHub Copilot app (data.db), each member
   *    repo tagged with the collection's name;
   *  - `menagerie-neighborhoods.json` next to the progress file, shaped
   *    `{ "Billing": ["github/billing-product", "github/billing-platform"] }`.
   * The file is seeded with an empty object on first run so it's easy to find.
   */
  private async loadNeighborhoods(): Promise<void> {
    const byRepo: Record<string, string> = {}
    const sources: Record<string, 'collection' | 'config'> = {}

    const dbPath = join(this.copilotDir, 'data.db')
    try {
      await fs.access(dbPath)
      const json = await runSqlite(dbPath, COLLECTIONS_SQL)
      const rows = JSON.parse(json || '[]') as { name: string; repo: string | null; path: string }[]
      for (const r of rows) {
        const repo = r.repo || r.path.split('/').pop()
        if (!repo || !r.name) continue
        byRepo[repo] = r.name
        sources[r.name] = 'collection'
      }
    } catch (error) {
      logger.warn('[Menagerie] could not read collection projects from data.db:', error)
    }

    if (this.neighborhoodsPath) {
      try {
        const raw = JSON.parse(await fs.readFile(this.neighborhoodsPath, 'utf8')) as unknown
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          for (const [name, repos] of Object.entries(raw as Record<string, unknown>)) {
            if (!Array.isArray(repos)) continue
            for (const repo of repos) {
              if (typeof repo !== 'string' || !repo.trim()) continue
              byRepo[repo.trim()] = name
            }
            sources[name] = 'config'
          }
        }
      } catch (error) {
        const code = (error as NodeJS.ErrnoException)?.code
        if (code === 'ENOENT') {
          await fs.writeFile(this.neighborhoodsPath, '{}\n', 'utf8').catch(() => {})
        } else {
          logger.warn('[Menagerie] could not read neighborhoods config:', error)
          this.setWarning('neighborhoods', 'menagerie-neighborhoods.json is not valid JSON')
        }
      }
    }

    this.neighborhoods = { byRepo, sources, configPath: this.neighborhoodsPath }
  }

  /** Reveal the neighborhoods config so the user can edit groupings by hand */
  async openNeighborhoodsConfig(): Promise<void> {
    if (!this.neighborhoodsPath) return
    try {
      await fs.access(this.neighborhoodsPath)
    } catch {
      await fs.writeFile(this.neighborhoodsPath, '{}\n', 'utf8')
    }
    await shell.openPath(this.neighborhoodsPath)
  }

  /**
   * Automations from the Copilot app's Automations view, plus their recent
   * runs, so run sessions can decorate the town square instead of a yard.
   * Best-effort: older app builds have no such tables, and a transient read
   * failure keeps the last good copy so decorations don't flicker away.
   */
  private async loadAutomations(): Promise<void> {
    const dbPath = join(this.copilotDir, 'data.db')
    try {
      await fs.access(dbPath)
    } catch {
      this.automations = { workflows: [], runs: [] }
      return
    }
    try {
      const [workflows, runs] = await Promise.all([
        runSqlite(dbPath, AUTOMATIONS_SQL),
        runSqlite(dbPath, AUTOMATION_RUNS_SQL)
      ])
      this.automations = {
        workflows: JSON.parse(workflows || '[]') as AutomationRow[],
        runs: JSON.parse(runs || '[]') as AutomationRunRow[]
      }
    } catch (error) {
      logger.warn('[Menagerie] could not read automations from data.db:', error)
    }
  }

  // ── House-upgrade progress ────────────────────────────────────

  /**
   * The first time we see a session we only record a cursor at its newest
   * event — history before the Menagerie started watching doesn't count, so a
   * fresh village starts with plain cottages instead of fully upgraded ones.
   */
  private recordCompletions(progress: Progress, critter: Critter, events: SessionEvent[]): void {
    const cursor = progress.cursors[critter.id]
    if (cursor === undefined) {
      const { latest } = countNewCompletions(events, null)
      progress.cursors[critter.id] = latest ?? new Date().toISOString()
      this.progressDirty = true
      return
    }
    const { count, latest, timestamps } = countNewCompletions(events, cursor)
    if (count === 0) return
    progress.repos[critter.repository] = (progress.repos[critter.repository] ?? 0) + count
    const days = progress.days[critter.repository] ?? {}
    for (const ts of timestamps) {
      const key = dayKey(new Date(ts))
      days[key] = (days[key] ?? 0) + 1
    }
    progress.days[critter.repository] = pruneActivity(days, dayKey(new Date()))
    if (latest) progress.cursors[critter.id] = latest
    this.progressDirty = true
  }

  // ── Needs-you nudges ──────────────────────────────────────────

  /**
   * Notify once per critter when it transitions into `waiting`, and keep the
   * dock badge equal to how many critters are waiting on you right now.
   * Automation runs count too, even though they live in the town square.
   */
  private nudge(prev: MenagerieSnapshot | null, next: MenagerieSnapshot): void {
    const was = new Map<string, Critter>()
    if (prev) for (const c of allCritters(prev)) was.set(c.id, c)
    for (const c of allCritters(next)) {
      if (c.status !== 'waiting' || was.get(c.id)?.status === 'waiting') continue
      this.notifyWaiting(c)
    }
    this.setBadge(next.counts.waiting)
  }

  private notifyWaiting(critter: Critter): void {
    if (!Notification.isSupported()) return
    try {
      const repo = critter.repository.split('/').pop() ?? critter.repository
      const p = critter.pendingPermission
      const what = p?.detail ? `${p.kind}: ${p.detail.slice(0, 120)}` : null
      const n = new Notification({
        title: `${critter.name} needs you`,
        body: what
          ? `${repo} — ${what}`
          : `${critter.species === 'puppy' ? 'Puppy' : 'Kitten'} in ${repo} is waiting for your permission`,
        silent: true
      })
      n.on('click', () => void shell.openExternal(`ghapp://sessions/${critter.id}`))
      n.show()
    } catch (error) {
      logger.warn('[Menagerie] notification failed:', error)
    }
  }

  private setBadge(count: number): void {
    try {
      app.dock?.setBadge(count > 0 ? String(count) : '')
    } catch {
      // dock badge is macOS-only and best-effort
    }
  }

  private async loadProgress(): Promise<Progress> {
    if (this.progress) return this.progress
    let loaded: Progress = { repos: {}, cursors: {}, days: {}, notifications: true }
    if (this.progressPath) {
      try {
        const raw = JSON.parse(await fs.readFile(this.progressPath, 'utf8')) as Partial<Progress>
        loaded = {
          repos: raw.repos ?? {},
          cursors: raw.cursors ?? {},
          days: raw.days ?? {},
          notifications: raw.notifications ?? true
        }
      } catch {
        // first run or unreadable file — start fresh
      }
    }
    this.progress = loaded
    return loaded
  }

  private async saveProgress(): Promise<void> {
    if (!this.progressDirty || !this.progress || !this.progressPath) return
    this.progressDirty = false
    try {
      await fs.writeFile(this.progressPath, JSON.stringify(this.progress), 'utf8')
    } catch (error) {
      logger.warn('[Menagerie] could not persist progress:', error)
    }
  }

  private setWarning(key: string, message: string): void {
    const tagged = `${key}: ${message}`
    if (!this.warnings.includes(tagged)) this.warnings.push(tagged)
  }

  private clearWarning(key: string): void {
    this.warnings = this.warnings.filter((w) => !w.startsWith(`${key}: `))
  }
}

// ── helpers ──────────────────────────────────────────────────────

function processAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    // EPERM means it exists but we can't signal it — still alive.
    return (err as NodeJS.ErrnoException).code === 'EPERM'
  }
}

async function tailEvents(path: string): Promise<SessionEvent[]> {
  let handle: fs.FileHandle | null = null
  try {
    handle = await fs.open(path, 'r')
    const { size } = await handle.stat()
    const length = Math.min(size, EVENTS_TAIL_BYTES)
    const buf = Buffer.alloc(length)
    await handle.read(buf, 0, length, size - length)
    return parseEventsTail(buf.toString('utf8'))
  } catch {
    return []
  } finally {
    await handle?.close().catch(() => {})
  }
}

const ROWS_SQL =
  "SELECT id, cwd, repository, branch, summary, created_at, updated_at FROM sessions WHERE updated_at >= datetime('now', '-8 days');"

// Archived flag can sit on the session row, the workspace row, or a workspace alias.
const ARCHIVED_SQL = `
  SELECT id FROM sessions WHERE archived_at IS NOT NULL
  UNION SELECT id FROM workspaces WHERE archived_at IS NOT NULL
  UNION SELECT session_id AS id FROM workspaces WHERE archived_at IS NOT NULL AND session_id IS NOT NULL
  UNION SELECT a.session_id AS id FROM workspace_session_aliases a
    JOIN workspaces w ON w.id = a.workspace_id WHERE w.archived_at IS NOT NULL;`

// Collection projects group several repos under one name in the Copilot app.
const COLLECTIONS_SQL = `
  SELECT p.name AS name, m.repo_full_name AS repo, m.repo_path AS path
  FROM collection_members m JOIN projects p ON p.id = m.project_id
  WHERE p.container_kind = 'collection';`

// Automations (the Copilot app calls them workflows) and the project they run in.
const AUTOMATIONS_SQL = `
  SELECT w.id, w.name, w.enabled, w.interval, w.schedule_hour, w.schedule_minute,
         w.schedule_day, w.cron_expression, w.created_at, w.next_run_at, p.name AS project
  FROM workflows w LEFT JOIN projects p ON p.id = w.project_id;`

// Runs from the last 8 days, plus each automation's newest run however old.
const AUTOMATION_RUNS_SQL = `
  SELECT r.task_id, r.status, r.session_id, r.started_at, r.error_message, r.taken_over_at
  FROM workflow_runs r
  WHERE r.started_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-8 days')
     OR r.started_at = (SELECT MAX(x.started_at) FROM workflow_runs x WHERE x.task_id = r.task_id);`

function runSqlite(dbPath: string, sql = ROWS_SQL): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'sqlite3',
      ['-readonly', '-json', dbPath, sql],
      { timeout: 10_000, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) reject(new Error(stderr || error.message))
        else resolve(stdout)
      }
    )
  })
}

let instance: MenagerieService | null = null
export function getMenagerieService(): MenagerieService {
  if (!instance) {
    instance = new MenagerieService(
      undefined,
      join(app.getPath('userData'), 'menagerie-progress.json'),
      join(app.getPath('userData'), 'menagerie-neighborhoods.json')
    )
  }
  return instance
}
