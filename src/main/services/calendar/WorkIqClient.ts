/**
 * WorkIQ Calendar Client
 *
 * Fetches Microsoft 365 calendar events through the WorkIQ MCP server
 * (`npx -y @microsoft/workiq mcp`). WorkIQ handles Microsoft authentication
 * itself (device-code sign-in + EULA), so the app needs no Azure app
 * registration, client id, or MSAL flow.
 *
 * IMPORTANT — how the WorkIQ MCP server actually works:
 * The server exposes exactly two tools, `accept_eula` and `ask_work_iq`. There
 * is NO structured `ListCalendarView`/Graph tool. `ask_work_iq` is a natural-
 * language interface to Microsoft 365 Copilot. So we:
 *   1. Spawn the server (PATH-augmented so it works inside a packaged Electron
 *      app that doesn't inherit the shell PATH).
 *   2. Call `accept_eula` once per process — the MCP server requires the EULA to
 *      be accepted in-session; a prior CLI `accept-eula` does NOT carry over.
 *   3. Call `ask_work_iq` with a precise question that asks for the events as a
 *      strict JSON array, then robustly extract that JSON (the model may wrap it
 *      in prose or ```json fences).
 *
 * Timezone note: `ask_work_iq` returns start/end as ISO 8601 strings that
 * already include the UTC offset (e.g. "2026-06-22T10:00:00-05:00"), so each
 * value is a fully-resolved absolute instant. The downstream parser simply
 * passes them through `new Date(...)` — it must NOT append "Z".
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import log from 'electron-log'
import { McpClient } from '../mcp/McpClient'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ElectronStore = require('electron-store')

const store = new (ElectronStore.default || ElectronStore)({
  name: 'workiq',
  defaults: {
    connected: false
  }
})

const CONNECT_TIMEOUT = 90_000 // cold `npx` download can be slow
const CALL_TIMEOUT = 90_000 // natural-language calendar queries can take ~30s

const EULA_URL = 'https://github.com/microsoft/work-iq-mcp'
const ASK_TOOL = 'ask_work_iq'
const EULA_TOOL = 'accept_eula'

export class WorkIqClient {
  private mcp = new McpClient()
  private eulaAccepted = false

  // ─── Public API ────────────────────────────────────────────────

  /** Whether the user has successfully connected WorkIQ at least once. */
  isConnected(): boolean {
    return Boolean(store.get('connected'))
  }

  /** Whether the MCP subprocess is currently live. */
  isLive(): boolean {
    return this.mcp.isConnected()
  }

  /**
   * Verify WorkIQ works by spawning the server and pulling today's calendar.
   * On success, persists the connected flag. Throws on failure (caller should
   * map to a friendly message via {@link friendlyWorkIqError}).
   */
  async connect(): Promise<void> {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)

    // Proves spawn + EULA + auth + ask + parsing all work end-to-end.
    await this.getCalendarView(start.toISOString(), end.toISOString())

    store.set('connected', true)
    log.info('[WorkIqClient] Connected and verified calendar access')
  }

  /**
   * Fetch calendar events for a date range as flat records:
   *   { subject, start, end, location, isOnlineMeeting, onlineMeetingUrl,
   *     isAllDay, attendees }
   * start/end are ISO 8601 strings that already include a UTC offset.
   */
  async getCalendarView(startISO: string, endISO: string): Promise<Record<string, unknown>[]> {
    await this.ensureConnected()

    const question = this.buildCalendarQuestion(startISO, endISO)
    const raw = await this.withTimeout(
      this.mcp.callTool(ASK_TOOL, { question }),
      CALL_TIMEOUT,
      'WORKIQ_CALL_TIMEOUT'
    )

    return this.extractEvents(raw)
  }

  /** Kill the subprocess but keep the connected flag (used on app quit). */
  async shutdown(): Promise<void> {
    this.eulaAccepted = false
    try {
      await this.mcp.disconnect()
    } catch (error) {
      log.warn('[WorkIqClient] Error during shutdown:', error)
    }
  }

  /** Sign out: kill the subprocess and clear the connected flag. */
  async disconnect(): Promise<void> {
    store.set('connected', false)
    await this.shutdown()
  }

  // ─── Connection / EULA ─────────────────────────────────────────

  private async ensureConnected(): Promise<void> {
    if (!this.mcp.isConnected()) {
      this.eulaAccepted = false
      const { command, args } = this.resolveSpawn()
      log.info(`[WorkIqClient] Spawning WorkIQ MCP server: ${command} ${args.join(' ')}`)
      await this.withTimeout(
        this.mcp.connect({ command, args, env: this.buildEnv() }),
        CONNECT_TIMEOUT,
        'WORKIQ_CONNECT_TIMEOUT'
      )
    }

    // The MCP server requires the EULA to be accepted in-session before
    // ask_work_iq returns data. The user initiates this by clicking "Connect
    // Calendar", so acceptance is an explicit, user-driven action.
    if (!this.eulaAccepted) {
      await this.withTimeout(
        this.mcp.callTool(EULA_TOOL, { eulaUrl: EULA_URL }),
        CALL_TIMEOUT,
        'WORKIQ_CALL_TIMEOUT'
      )
      this.eulaAccepted = true
      log.info('[WorkIqClient] Accepted WorkIQ EULA for this session')
    }
  }

  private buildCalendarQuestion(startISO: string, endISO: string): string {
    const dateLabel = new Date(startISO).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    return [
      `List all of my Microsoft Outlook calendar events between ${startISO} and ${endISO}`,
      `(my local date is ${dateLabel}).`,
      'Return ONLY a raw JSON array with no markdown code fences and no explanatory text.',
      'Each element must have exactly these keys:',
      '"subject" (string),',
      '"start" (ISO 8601 datetime including the UTC offset),',
      '"end" (ISO 8601 datetime including the UTC offset),',
      '"location" (string, may be empty),',
      '"isOnlineMeeting" (boolean),',
      '"onlineMeetingUrl" (string Teams/online join URL, or empty string),',
      '"isAllDay" (boolean),',
      '"attendees" (array of attendee display-name strings).',
      'Exclude cancelled events. If there are no events, return exactly [].'
    ].join(' ')
  }

  private resolveSpawn(): { command: string; args: string[] } {
    const tid = process.env.MICROSOFT_TENANT_ID
    const tenantArgs = tid && tid.toLowerCase() !== 'common' ? ['--tenant-id', tid] : []

    const cmdOverride = process.env.WORKIQ_COMMAND
    if (cmdOverride) {
      const argsOverride = process.env.WORKIQ_ARGS
      const args = argsOverride ? argsOverride.split(' ').filter(Boolean) : ['mcp']
      if (tenantArgs.length && !args.includes('--tenant-id')) args.push(...tenantArgs)
      return { command: cmdOverride, args }
    }

    const pkg = process.env.WORKIQ_PACKAGE || '@microsoft/workiq'
    return {
      command: this.resolveNpx(),
      args: ['-y', pkg, 'mcp', ...tenantArgs]
    }
  }

  private resolveNpx(): string {
    if (process.platform === 'win32') return 'npx.cmd'
    const candidates = [
      '/opt/homebrew/bin/npx',
      '/usr/local/bin/npx',
      join(homedir(), '.nvm', 'current', 'bin', 'npx')
    ]
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
    return 'npx'
  }

  private buildEnv(): Record<string, string> {
    const sep = process.platform === 'win32' ? ';' : ':'
    const extraPaths = [
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      join(homedir(), '.nvm', 'current', 'bin')
    ]
    const env: Record<string, string> = {
      PATH: [process.env.PATH, ...extraPaths].filter(Boolean).join(sep)
    }
    const tid = process.env.MICROSOFT_TENANT_ID
    if (tid) env.MICROSOFT_TENANT_ID = tid
    return env
  }

  // ─── Result parsing ────────────────────────────────────────────

  /**
   * Extract the event array from an `ask_work_iq` result. The answer is natural
   * language that should contain a JSON array, but may be wrapped in prose or
   * ```json fences, so a naive JSON.parse can fail — we scan for the first
   * balanced JSON value.
   */
  private extractEvents(raw: unknown): Record<string, unknown>[] {
    let payload: unknown = raw

    if (typeof raw === 'string') {
      const parsed = this.parseLooseJson(raw)
      if (parsed === null) {
        // Not JSON — treat the text as an error message (auth/EULA/sign-in/etc.).
        throw new Error(raw.trim().slice(0, 400) || 'Empty WorkIQ response')
      }
      payload = parsed
    }

    if (Array.isArray(payload)) {
      return payload as Record<string, unknown>[]
    }
    if (payload && typeof payload === 'object') {
      const rec = payload as Record<string, unknown>
      if (Array.isArray(rec.value)) return rec.value as Record<string, unknown>[]
      if (Array.isArray(rec.events)) return rec.events as Record<string, unknown>[]
      // A single event object — wrap it.
      if (typeof rec.subject === 'string') return [rec]
    }
    return []
  }

  /** Find and parse the first balanced JSON object/array within a string. */
  private parseLooseJson(text: string): unknown {
    const startObj = text.indexOf('{')
    const startArr = text.indexOf('[')
    const candidates = [startObj, startArr].filter((i) => i >= 0)
    if (candidates.length === 0) return null
    const start = Math.min(...candidates)
    const open = text[start]
    const close = open === '{' ? '}' : ']'

    let depth = 0
    let inStr = false
    let esc = false
    for (let i = start; i < text.length; i++) {
      const c = text[i]
      if (esc) {
        esc = false
        continue
      }
      if (c === '\\') {
        esc = true
        continue
      }
      if (c === '"') {
        inStr = !inStr
        continue
      }
      if (inStr) continue
      if (c === open) depth++
      else if (c === close) {
        depth--
        if (depth === 0) {
          const slice = text.slice(start, i + 1)
          try {
            return JSON.parse(slice)
          } catch {
            return null
          }
        }
      }
    }
    return null
  }

  // ─── Utilities ─────────────────────────────────────────────────

  private withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(label)), ms)
      p.then(
        (v) => {
          clearTimeout(timer)
          resolve(v)
        },
        (e) => {
          clearTimeout(timer)
          reject(e)
        }
      )
    })
  }
}

/** Translate a raw WorkIQ/MCP error into a user-actionable message. */
export function friendlyWorkIqError(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err)) || ''
  const low = msg.toLowerCase()

  if (low.includes('workiq_connect_timeout') || low.includes('workiq_call_timeout')) {
    return 'WorkIQ timed out. The first run downloads the package and queries can take a moment — please try again.'
  }
  if (
    low.includes('enoent') ||
    low.includes('command not found') ||
    (low.includes('not found') && low.includes('npx'))
  ) {
    return 'Could not start WorkIQ. Make sure Node.js (npx) is installed and on your PATH.'
  }
  if (low.includes('eula')) {
    return 'WorkIQ needs its license accepted. Reconnect to accept it, or run `npx -y @microsoft/workiq accept-eula` in a terminal, then try again.'
  }
  if (low.includes('consent') || low.includes('admin')) {
    return 'WorkIQ needs admin consent for your Microsoft 365 tenant. Ask your admin to approve WorkIQ, then try again.'
  }
  if (
    low.includes('login') ||
    low.includes('sign in') ||
    low.includes('signin') ||
    low.includes('unauthor') ||
    low.includes('401') ||
    low.includes('credential') ||
    low.includes('token')
  ) {
    return 'Sign in to WorkIQ first: run `npx -y @microsoft/workiq ask -q "test"` in a terminal and complete the Microsoft sign-in, then try again.'
  }
  return msg || 'WorkIQ connection failed.'
}

// Singleton
let instance: WorkIqClient | null = null

export function getWorkIqClient(): WorkIqClient {
  if (!instance) {
    instance = new WorkIqClient()
  }
  return instance
}
