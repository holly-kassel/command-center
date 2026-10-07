/**
 * Paste Triage Service
 *
 * Runs billing-projects/scripts/triage.sh in the background for /triage and
 * keeps a short in-memory job history. Electron-free so it runs under plain
 * Node for tests; TriageNotifier and ipc/triage.ts own the Electron side.
 *
 * Contract: triage.sh "<item>" [image ...]. Exit 64 is a usage error and 66 a
 * missing attachment. The script reads OBSIDIAN_VAULT_PATH and COPILOT_COMMAND
 * from the environment.
 *
 * Privacy: log lines carry job IDs, sizes, verdicts, and exit codes only,
 * never paste text or agent output.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { constants as fsConstants, rmSync } from 'node:fs'
import { access, lstat, mkdtemp, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { SlashCommandAttachment } from '../../../shared/types/obsidian'
import type { TriageDraft, TriageJob, TriageJobStatus } from '../../../shared/types/triage'
import { parseTriageOutput } from './parseTriageOutput'

export const MAX_ITEM_BYTES = 256 * 1024
export const MAX_IMAGES = 5
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024
export const TRIAGE_USAGE =
  'Paste a Slack message or link, an issue URL, or a screenshot after /triage.'

const MAX_DRAFTS = 5
const STREAM_HEAD_BYTES = 128 * 1024
const STREAM_TAIL_BYTES = 896 * 1024
const OUTPUT_EDGE_CHARS = 8 * 1024
const TEMP_PREFIX = 'cc-triage-'
/** mkdtemp adds six characters from [A-Za-z0-9] */
const TEMP_DIR_RE = /^cc-triage-[A-Za-z0-9]{6}$/
const STALE_TEMP_MS = 60 * 60 * 1000
const MAX_PATH_SUFFIX_TRIES = 16

export interface TriageLogger {
  info: (message: string) => void
  warn: (message: string) => void
  error: (message: string) => void
}

export interface PasteTriageServiceOptions {
  /** Defaults to ~/.copilot/repos/billing-projects */
  billingProjectsPath?: string
  /** Command Center's vault, passed to triage.sh when OBSIDIAN_VAULT_PATH is unset */
  resolveVaultPath?: () => string | undefined
  maxConcurrent?: number
  timeoutMs?: number
  killGraceMs?: number
  historyLimit?: number
  tmpRoot?: string
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  logger?: TriageLogger
}

export type TriageSubmitResult =
  | { ok: true; job: TriageJob; queued: boolean }
  | { ok: false; message: string }

export interface TriageDraftTarget {
  vaultName: string
  /** Vault-relative, forward slashes */
  relativePath: string
}

interface JobRecord {
  job: TriageJob
  /** Cleared once the process starts */
  item: string
  imagePaths: string[]
  tempDir?: string
  /** The vault triage.sh ran against, for draft checks */
  vaultPath?: string
}

interface RunState {
  record: JobRecord
  child: ChildProcess | null
  stdout: StreamCapture
  stderr: StreamCapture
  finalized: boolean
  cancelled: boolean
  timedOut: boolean
  spawnError?: NodeJS.ErrnoException
  timeoutTimer?: NodeJS.Timeout
  killTimer?: NodeJS.Timeout
}

interface CheckedImage {
  data: Uint8Array
  ext: string
}

type TriageOutcome = Pick<TriageJob, 'status' | 'drafts'> &
  Partial<Pick<TriageJob, 'verdict' | 'verdictLabel' | 'reason' | 'output' | 'error'>>

/** Keeps the start and end of a stream so a chatty run can't exhaust memory */
class StreamCapture {
  private head: Buffer[] = []
  private headBytes = 0
  private tail: Buffer[] = []
  private tailBytes = 0
  private dropped = 0

  push(chunk: Buffer): void {
    let rest = chunk
    if (this.headBytes < STREAM_HEAD_BYTES) {
      const take = Math.min(rest.length, STREAM_HEAD_BYTES - this.headBytes)
      this.head.push(rest.subarray(0, take))
      this.headBytes += take
      rest = rest.subarray(take)
    }
    if (rest.length === 0) return
    this.tail.push(rest)
    this.tailBytes += rest.length
    while (this.tailBytes > STREAM_TAIL_BYTES) {
      const first = this.tail[0]
      const excess = this.tailBytes - STREAM_TAIL_BYTES
      if (first.length <= excess) {
        this.tail.shift()
        this.tailBytes -= first.length
        this.dropped += first.length
      } else {
        this.tail[0] = first.subarray(excess)
        this.tailBytes -= excess
        this.dropped += excess
      }
    }
  }

  text(): string {
    if (this.dropped === 0) return Buffer.concat([...this.head, ...this.tail]).toString('utf8')
    const head = Buffer.concat(this.head).toString('utf8')
    const tail = Buffer.concat(this.tail).toString('utf8')
    return `${head}\n[… ${this.dropped} bytes omitted …]\n${tail}`
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

function errorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string') {
    return err.code
  }
  return 'unknown'
}

function expandHome(path: string): string {
  if (path === '~') return homedir()
  if (path.startsWith('~/')) return join(homedir(), path.slice(2))
  return path
}

function tildify(path: string): string {
  const home = homedir()
  return path === home || path.startsWith(home + sep) ? `~${path.slice(home.length)}` : path
}

async function safeRealpath(path: string): Promise<string | null> {
  try {
    return await realpath(path)
  } catch {
    return null
  }
}

function isFinished(status: TriageJobStatus): boolean {
  return status !== 'queued' && status !== 'running'
}

function snapshot(job: TriageJob): TriageJob {
  return { ...job, drafts: job.drafts.map((draft) => ({ ...draft })) }
}

function toBytes(data: unknown): Uint8Array | null {
  if (!ArrayBuffer.isView(data)) return null
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
}

/** Magic-byte check, so a renamed file or a bogus MIME type can't slip through */
export function sniffImageType(data: Uint8Array): 'png' | 'jpg' | 'gif' | 'webp' | null {
  const startsWith = (signature: number[], offset = 0): boolean =>
    data.length >= offset + signature.length &&
    signature.every((byte, i) => data[offset + i] === byte)
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (startsWith([0xff, 0xd8, 0xff])) return 'jpg'
  if (startsWith([0x47, 0x49, 0x46, 0x38, 0x37, 0x61])) return 'gif'
  if (startsWith([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return 'gif'
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return 'webp'
  }
  return null
}

function makePreview(item: string, imageCount: number): string {
  const firstLine = item
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
  const preview = firstLine ?? (imageCount === 1 ? 'Screenshot' : `${imageCount} screenshots`)
  // Count code points so an emoji isn't cut in half
  const chars = Array.from(preview)
  return chars.length > 100 ? `${chars.slice(0, 99).join('').trimEnd()}…` : preview
}

function trimOutput(text: string): string | undefined {
  if (!text) return undefined
  if (text.length <= OUTPUT_EDGE_CHARS * 2) return text
  return `${text.slice(0, OUTPUT_EDGE_CHARS)}\n\n[… trimmed …]\n\n${text.slice(-OUTPUT_EDGE_CHARS)}`
}

function lastLine(text: string): string | undefined {
  const line = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .pop()
  if (!line) return undefined
  return line.length > 200 ? `${line.slice(0, 199)}…` : line
}

function formatDuration(ms: number): string {
  if (ms >= 60_000) {
    const minutes = Math.round(ms / 60_000)
    return `${minutes} minute${minutes === 1 ? '' : 's'}`
  }
  const seconds = Math.max(1, Math.round(ms / 1000))
  return `${seconds} second${seconds === 1 ? '' : 's'}`
}

function describeExit(code: number | null, signal: NodeJS.Signals | null, stderr: string): string {
  let message: string
  if (code === 64) message = 'triage.sh rejected the input (exit 64).'
  else if (code === 66) message = "triage.sh couldn't read an attached image (exit 66)."
  else if (signal) message = `triage.sh stopped on ${signal}.`
  else message = `triage.sh exited with code ${code}.`
  const detail = lastLine(stderr)
  return detail ? `${message} ${detail}` : message
}

function describeSpawnError(err: NodeJS.ErrnoException): string {
  switch (err.code) {
    case 'ENOENT':
      return "Couldn't start triage.sh. Check that billing-projects and bash are installed."
    case 'EACCES':
      return "Couldn't start triage.sh: permission denied. Make it executable with chmod +x."
    case 'E2BIG':
      return 'The paste is too long to pass to triage.sh. Save it to a file and triage the file path instead.'
    default:
      return `Couldn't start triage.sh (${err.code ?? 'unknown error'}).`
  }
}

/**
 * Accepts a path only if it resolves, through any symlinks, to a Markdown
 * file inside the vault. Relative paths are tried against the vault and its
 * parent, so "obsidian-notes/AI drafts/x.md" works too.
 */
async function validateDraftPath(
  raw: string,
  vaultPath: string,
  vaultReal: string
): Promise<TriageDraft | null> {
  const value = expandHome(raw.trim())
  if (!/\.md$/i.test(value)) return null
  const attempts = isAbsolute(value)
    ? [value]
    : [resolve(vaultPath, value), resolve(dirname(vaultPath), value)]
  for (const attempt of attempts) {
    const real = await safeRealpath(attempt)
    if (!real || !real.startsWith(vaultReal + sep) || !/\.md$/i.test(real)) continue
    try {
      if (!(await stat(real)).isFile()) continue
    } catch {
      continue
    }
    return {
      relativePath: relative(vaultReal, real).split(sep).join('/'),
      fileName: basename(real)
    }
  }
  return null
}

// ─── Service ─────────────────────────────────────────────────────

export class PasteTriageService {
  private readonly billingProjectsPath: string
  private readonly scriptPath: string
  private readonly resolveVaultPath?: () => string | undefined
  private readonly maxConcurrent: number
  private readonly timeoutMs: number
  private readonly killGraceMs: number
  private readonly historyLimit: number
  private readonly tmpRoot: string
  private readonly platform: NodeJS.Platform
  private readonly env: NodeJS.ProcessEnv
  private readonly log: TriageLogger
  private readonly emitter = new EventEmitter()

  /** Oldest first */
  private records: JobRecord[] = []
  private queue: JobRecord[] = []
  private running = new Map<string, RunState>()
  private tempDirs = new Set<string>()

  constructor(options: PasteTriageServiceOptions = {}) {
    this.env = options.env ?? process.env
    this.billingProjectsPath = resolve(
      expandHome(
        options.billingProjectsPath || join(homedir(), '.copilot', 'repos', 'billing-projects')
      )
    )
    this.scriptPath = join(this.billingProjectsPath, 'scripts', 'triage.sh')
    this.resolveVaultPath = options.resolveVaultPath
    this.maxConcurrent = Math.max(1, options.maxConcurrent ?? 3)
    this.timeoutMs = options.timeoutMs ?? 10 * 60 * 1000
    this.killGraceMs = options.killGraceMs ?? 5000
    this.historyLimit = Math.max(1, options.historyLimit ?? 20)
    this.tmpRoot = options.tmpRoot ?? tmpdir()
    this.platform = options.platform ?? process.platform
    this.log = options.logger ?? {
      info: (message) => console.info(message),
      warn: (message) => console.warn(message),
      error: (message) => console.error(message)
    }
  }

  // ─── Public API ────────────────────────────────────────────────

  /** Validates the input, then queues the job and returns without waiting for it */
  async submit(
    rawItem: string,
    attachments: SlashCommandAttachment[] = []
  ): Promise<TriageSubmitResult> {
    if (this.platform === 'win32') {
      return {
        ok: false,
        message: '/triage needs macOS or Linux, since triage.sh is a bash script.'
      }
    }
    const item = (typeof rawItem === 'string' ? rawItem : '').replace(/\0/g, '').trim()
    if (Buffer.byteLength(item, 'utf8') > MAX_ITEM_BYTES) {
      return {
        ok: false,
        message: 'That paste is over 256 KB. Save it to a file and triage the file path instead.'
      }
    }
    const checked = this.checkImages(attachments)
    if ('message' in checked) return { ok: false, message: checked.message }
    const { images } = checked
    if (!item && images.length === 0) return { ok: false, message: TRIAGE_USAGE }

    const scriptProblem = await this.checkScript()
    if (scriptProblem) return { ok: false, message: scriptProblem }

    const job: TriageJob = {
      id: randomUUID(),
      status: 'queued',
      preview: makePreview(item, images.length),
      imageCount: images.length,
      queuedAt: Date.now(),
      drafts: [],
      unseen: false
    }
    const defaultPrompt =
      images.length === 1 ? 'Triage the attached screenshot.' : 'Triage the attached screenshots.'
    const record: JobRecord = { job, item: item || defaultPrompt, imagePaths: [] }

    if (images.length > 0) {
      try {
        record.tempDir = await mkdtemp(join(this.tmpRoot, TEMP_PREFIX))
        this.tempDirs.add(record.tempDir)
        for (const [index, image] of images.entries()) {
          const imagePath = join(record.tempDir, `image-${index + 1}.${image.ext}`)
          await writeFile(imagePath, image.data, { mode: 0o600 })
          record.imagePaths.push(imagePath)
        }
      } catch (err) {
        if (record.tempDir) await this.removeTempDir(record.tempDir)
        this.log.error(`[Triage] Couldn't save images for job ${job.id} (${errorCode(err)})`)
        return { ok: false, message: "Couldn't save the pasted images to a temp folder." }
      }
    }

    this.records.push(record)
    this.queue.push(record)
    this.log.info(
      `[Triage] Job ${job.id} submitted (${item.length} chars, ${images.length} images)`
    )
    this.pump()
    this.evictHistory()
    this.emitChanged()
    return { ok: true, job: snapshot(job), queued: job.status === 'queued' }
  }

  /** Newest first */
  list(): TriageJob[] {
    return this.records
      .slice()
      .reverse()
      .map((record) => snapshot(record.job))
  }

  getJob(id: string): TriageJob | undefined {
    const record = this.records.find((r) => r.job.id === id)
    return record ? snapshot(record.job) : undefined
  }

  unseenCount(): number {
    return this.records.filter((r) => r.job.unseen).length
  }

  /** Removes a queued job, or stops a running one (SIGTERM, then SIGKILL) */
  cancel(id: string): boolean {
    const queuedIndex = this.queue.findIndex((r) => r.job.id === id)
    if (queuedIndex !== -1) {
      const [record] = this.queue.splice(queuedIndex, 1)
      record.job.status = 'cancelled'
      record.job.finishedAt = Date.now()
      record.item = ''
      if (record.tempDir) void this.removeTempDir(record.tempDir)
      this.log.info(`[Triage] Job ${id} cancelled before it started`)
      this.evictHistory()
      this.emitChanged()
      return true
    }
    const run = this.running.get(id)
    if (!run || run.finalized) return false
    run.cancelled = true
    this.log.info(`[Triage] Cancelling job ${id}`)
    this.terminate(run)
    return true
  }

  clearFinished(): void {
    const before = this.records.length
    this.records = this.records.filter((r) => !isFinished(r.job.status))
    if (this.records.length !== before) this.emitChanged()
  }

  markAllSeen(): void {
    let changed = false
    for (const record of this.records) {
      if (record.job.unseen) {
        record.job.unseen = false
        changed = true
      }
    }
    if (changed) this.emitChanged()
  }

  /** Re-checks a draft right before it's opened; it may have moved since the run */
  async resolveDraftForOpen(jobId: string, index: number): Promise<TriageDraftTarget | null> {
    const record = this.records.find((r) => r.job.id === jobId)
    const draft = record?.job.drafts[index]
    if (!record?.vaultPath || !draft) return null
    const vaultReal = await safeRealpath(record.vaultPath)
    if (!vaultReal) return null
    const checked = await validateDraftPath(
      join(vaultReal, draft.relativePath),
      record.vaultPath,
      vaultReal
    )
    if (!checked) return null
    return { vaultName: basename(record.vaultPath), relativePath: checked.relativePath }
  }

  /** Deletes image folders left behind by a crash. Only touches our own, older than an hour. */
  async sweepStaleTempDirs(now = Date.now()): Promise<number> {
    let names: string[]
    try {
      names = await readdir(this.tmpRoot)
    } catch {
      return 0
    }
    const uid = typeof process.getuid === 'function' ? process.getuid() : undefined
    let removed = 0
    for (const name of names) {
      if (!TEMP_DIR_RE.test(name)) continue
      const dir = join(this.tmpRoot, name)
      if (this.tempDirs.has(dir)) continue
      try {
        const info = await lstat(dir)
        if (!info.isDirectory() || (uid !== undefined && info.uid !== uid)) continue
        if (now - info.mtimeMs < STALE_TEMP_MS) continue
        await rm(dir, { recursive: true, force: true })
        removed++
      } catch {
        // Gone already or not ours to remove
      }
    }
    if (removed > 0) this.log.info(`[Triage] Removed ${removed} stale temp folders`)
    return removed
  }

  /** Stops running jobs and deletes temp images. Synchronous so it can run in will-quit. */
  shutdown(): void {
    for (const record of this.queue) record.job.status = 'cancelled'
    this.queue = []
    for (const run of this.running.values()) {
      run.cancelled = true
      clearTimeout(run.timeoutTimer)
      clearTimeout(run.killTimer)
      this.signalGroup(run, 'SIGTERM')
    }
    for (const dir of this.tempDirs) {
      try {
        rmSync(dir, { recursive: true, force: true })
      } catch {
        // Best effort; the startup sweep catches leftovers
      }
    }
    this.tempDirs.clear()
  }

  onChanged(listener: () => void): () => void {
    return this.subscribe('changed', listener)
  }

  onFinished(listener: (job: TriageJob) => void): () => void {
    return this.subscribe('finished', listener)
  }

  // ─── Validation ────────────────────────────────────────────────

  private checkImages(
    attachments: SlashCommandAttachment[]
  ): { images: CheckedImage[] } | { message: string } {
    if (!Array.isArray(attachments)) {
      return { message: "The pasted images didn't come through. Paste them again." }
    }
    if (attachments.length > MAX_IMAGES) {
      return { message: `Attach up to ${MAX_IMAGES} images at a time.` }
    }
    const images: CheckedImage[] = []
    for (const attachment of attachments) {
      const data = toBytes(attachment?.data)
      if (!data || data.byteLength === 0) {
        return { message: "One of the pasted images didn't come through. Paste it again." }
      }
      if (data.byteLength > MAX_IMAGE_BYTES) {
        return { message: 'Each image must be 20 MB or smaller.' }
      }
      const ext = sniffImageType(data)
      if (!ext) return { message: 'Only PNG, JPEG, GIF, and WebP images work with /triage.' }
      images.push({ data, ext })
    }
    return { images }
  }

  private async checkScript(): Promise<string | null> {
    const shown = tildify(this.scriptPath)
    const notFound = `Couldn't find ${shown}. Set BILLING_PROJECTS_PATH if billing-projects lives somewhere else.`
    try {
      if (!(await stat(this.scriptPath)).isFile()) return notFound
    } catch {
      return notFound
    }
    try {
      await access(this.scriptPath, fsConstants.X_OK)
    } catch {
      return `${shown} isn't executable. Make it executable with chmod +x.`
    }
    return null
  }

  // ─── Running ───────────────────────────────────────────────────

  private pump(): void {
    while (this.running.size < this.maxConcurrent) {
      const record = this.queue.shift()
      if (!record) return
      this.start(record)
    }
  }

  private start(record: JobRecord): void {
    const { job } = record
    job.status = 'running'
    job.startedAt = Date.now()
    record.vaultPath = this.effectiveVaultPath()

    const run: RunState = {
      record,
      child: null,
      stdout: new StreamCapture(),
      stderr: new StreamCapture(),
      finalized: false,
      cancelled: false,
      timedOut: false
    }
    this.running.set(job.id, run)
    const args = [record.item, ...record.imagePaths]
    record.item = ''

    let child: ChildProcess
    try {
      // detached puts the script in its own process group, so a timeout or
      // cancel can stop copilot and anything it started along with it
      child = spawn(this.scriptPath, args, {
        cwd: this.billingProjectsPath,
        env: this.buildEnv(record.vaultPath),
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false
      })
    } catch (err) {
      // spawn throws synchronously for some errors, E2BIG among them
      run.spawnError = err as NodeJS.ErrnoException
      setImmediate(() => void this.finalize(run, null, null))
      return
    }
    run.child = child

    child.stdout?.on('data', (chunk: Buffer) => run.stdout.push(chunk))
    child.stderr?.on('data', (chunk: Buffer) => run.stderr.push(chunk))
    child.on('error', (err) => {
      if (child.pid === undefined) {
        run.spawnError = err
        void this.finalize(run, null, null)
      } else {
        this.log.warn(`[Triage] Job ${job.id} process error (${errorCode(err)})`)
      }
    })
    child.on('close', (code, signal) => {
      void this.finalize(run, code, signal)
    })
    run.timeoutTimer = setTimeout(() => {
      run.timedOut = true
      this.log.warn(`[Triage] Job ${job.id} timed out after ${formatDuration(this.timeoutMs)}`)
      this.terminate(run)
    }, this.timeoutMs)
    this.log.info(`[Triage] Job ${job.id} started`)
  }

  private terminate(run: RunState): void {
    if (run.finalized) return
    this.signalGroup(run, 'SIGTERM')
    if (!run.killTimer) {
      run.killTimer = setTimeout(() => {
        if (!run.finalized) this.signalGroup(run, 'SIGKILL')
      }, this.killGraceMs)
    }
  }

  private signalGroup(run: RunState, signal: NodeJS.Signals): void {
    const pid = run.child?.pid
    if (!pid) return
    try {
      process.kill(-pid, signal)
    } catch {
      try {
        run.child?.kill(signal)
      } catch {
        // Already exited
      }
    }
  }

  private async finalize(
    run: RunState,
    code: number | null,
    signal: NodeJS.Signals | null
  ): Promise<void> {
    if (run.finalized) return
    run.finalized = true
    clearTimeout(run.timeoutTimer)
    clearTimeout(run.killTimer)
    const { record } = run
    const { job } = record
    this.running.delete(job.id)
    this.pump()

    // The job stays "running" until the outcome is final, so no other
    // broadcast can catch it half-updated
    const outcome = await this.resolveOutcome(run, code, signal)
    if (record.tempDir) await this.removeTempDir(record.tempDir)
    record.imagePaths = []
    const finishedAt = Date.now()
    Object.assign(job, outcome, {
      finishedAt,
      exitCode: code,
      unseen: outcome.status !== 'cancelled'
    })

    const seconds = Math.round((finishedAt - (job.startedAt ?? finishedAt)) / 1000)
    this.log.info(
      `[Triage] Job ${job.id} ${job.status}${job.verdict ? ` (${job.verdict})` : ''}, ` +
        `exit ${code ?? signal ?? 'none'}, ${seconds}s, ${job.drafts.length} drafts`
    )
    this.evictHistory()
    // Before "changed", so the notifier can mark the job seen without the badge flashing
    this.emitter.emit('finished', snapshot(job))
    this.emitChanged()
  }

  private async resolveOutcome(
    run: RunState,
    code: number | null,
    signal: NodeJS.Signals | null
  ): Promise<TriageOutcome> {
    const stderr = run.stderr.text()
    // Same input run_case parses in the triage evals
    const combined = (run.stdout.text() + stderr).trim()
    const output = trimOutput(combined)

    if (run.cancelled) return { status: 'cancelled', drafts: [], output }
    if (run.timedOut) {
      return {
        status: 'timed_out',
        drafts: [],
        output,
        error: `Stopped after ${formatDuration(this.timeoutMs)}.`
      }
    }
    if (run.spawnError) {
      return { status: 'failed', drafts: [], error: describeSpawnError(run.spawnError) }
    }
    if (code !== 0 && !combined) {
      return { status: 'failed', drafts: [], error: describeExit(code, signal, '') }
    }

    const parsed = parseTriageOutput(combined)
    if (parsed.verdict) {
      // A verdict counts even on a nonzero exit, as in run_case
      return {
        status: 'done',
        verdict: parsed.verdict,
        verdictLabel: parsed.verdictLabel,
        reason: parsed.reason,
        drafts: await this.resolveDrafts(parsed.draftCandidates, run.record.vaultPath),
        output
      }
    }
    if (code === 0) return { status: 'no_verdict', drafts: [], output }
    return { status: 'failed', drafts: [], output, error: describeExit(code, signal, stderr) }
  }

  private async resolveDrafts(
    candidates: string[],
    vaultPath: string | undefined
  ): Promise<TriageDraft[]> {
    if (!vaultPath || candidates.length === 0) return []
    const vaultReal = await safeRealpath(vaultPath)
    if (!vaultReal) return []
    const drafts: TriageDraft[] = []
    for (const candidate of candidates) {
      const draft = await this.findDraft(candidate, vaultPath, vaultReal)
      if (draft && !drafts.some((d) => d.relativePath === draft.relativePath)) drafts.push(draft)
      if (drafts.length >= MAX_DRAFTS) break
    }
    return drafts
  }

  /** Tries the whole string, then drops leading words ("saved to …") one at a time */
  private async findDraft(
    candidate: string,
    vaultPath: string,
    vaultReal: string
  ): Promise<TriageDraft | null> {
    let rest = candidate
    for (let tries = 0; tries < MAX_PATH_SUFFIX_TRIES && rest; tries++) {
      const draft = await validateDraftPath(rest, vaultPath, vaultReal)
      if (draft) return draft
      const space = rest.indexOf(' ')
      if (space === -1) break
      rest = rest.slice(space + 1)
    }
    return null
  }

  // ─── Environment ───────────────────────────────────────────────

  /** Matches what triage.sh resolves: OBSIDIAN_VAULT_PATH, else the app's vault, else ~/obsidian-notes */
  private effectiveVaultPath(): string {
    const fromEnv = this.env.OBSIDIAN_VAULT_PATH
    // triage.sh runs from billing-projects, so a relative value resolves there
    if (fromEnv) return resolve(this.billingProjectsPath, expandHome(fromEnv))
    const fromApp = this.resolveVaultPath?.()
    if (fromApp) return resolve(expandHome(fromApp))
    return join(homedir(), 'obsidian-notes')
  }

  /** A packaged app doesn't inherit the shell PATH, so add the usual install dirs (as WorkIqClient does) */
  private buildEnv(vaultPath: string): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...this.env }
    const extraPaths = [
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      join(homedir(), '.nvm', 'current', 'bin')
    ]
    const entries = [...(env.PATH ?? '').split(delimiter), ...extraPaths].filter(Boolean)
    env.PATH = [...new Set(entries)].join(delimiter)
    if (!env.OBSIDIAN_VAULT_PATH) env.OBSIDIAN_VAULT_PATH = vaultPath
    return env
  }

  // ─── Bookkeeping ───────────────────────────────────────────────

  private async removeTempDir(dir: string): Promise<void> {
    this.tempDirs.delete(dir)
    try {
      await rm(dir, { recursive: true, force: true })
    } catch (err) {
      this.log.warn(`[Triage] Couldn't remove a temp folder (${errorCode(err)})`)
    }
  }

  /** Drops the oldest finished jobs past the history limit; never queued or running ones */
  private evictHistory(): void {
    while (this.records.length > this.historyLimit) {
      const index = this.records.findIndex((r) => isFinished(r.job.status))
      if (index === -1) return
      this.records.splice(index, 1)
    }
  }

  private emitChanged(): void {
    this.emitter.emit('changed')
  }

  /** Wraps each listener, since one that throws would otherwise stop emit() for the rest */
  private subscribe<Args extends unknown[]>(
    event: 'changed' | 'finished',
    listener: (...args: Args) => void
  ): () => void {
    const isolated = (...args: Args): void => {
      try {
        listener(...args)
      } catch (err) {
        const name = err instanceof Error ? err.name : 'unknown'
        this.log.error(`[Triage] A ${event} listener threw (${name}, ${errorCode(err)})`)
      }
    }
    this.emitter.on(event, isolated)
    return () => this.emitter.off(event, isolated)
  }
}
