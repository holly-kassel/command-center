/**
 * Calendar Service
 *
 * Fetches calendar events from Microsoft 365 via the WorkIQ MCP server
 * (see WorkIqClient). Caches results for 5 minutes to avoid re-running the
 * comparatively slow natural-language query on every render.
 */
import log from 'electron-log'
import { getWorkIqClient, friendlyWorkIqError } from './WorkIqClient'
import { settings } from '../../config/settings'
import type { CalendarAttendee, CalendarEvent } from '../../../shared/types/calendar'

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface CachedEvents {
  events: CalendarEvent[]
  fetchedAt: number
  rangeStart: string
  rangeEnd: string
}

export class CalendarService {
  private cache: CachedEvents | null = null

  /**
   * Get events in a date range. Uses cache if available and fresh.
   */
  async getEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
    const rangeStart = start.toISOString()
    const rangeEnd = end.toISOString()

    // Return cached if still fresh and covers same range
    if (
      this.cache &&
      this.cache.rangeStart === rangeStart &&
      this.cache.rangeEnd === rangeEnd &&
      Date.now() - this.cache.fetchedAt < CACHE_TTL
    ) {
      return this.cache.events
    }

    const workiq = getWorkIqClient()

    // Don't spawn WorkIQ until the user has connected it at least once.
    if (!workiq.isConnected()) {
      return []
    }

    let events: CalendarEvent[]
    try {
      const items = await workiq.getCalendarView(rangeStart, rangeEnd)
      events = this.parseWorkIqEvents(items)
    } catch (error) {
      log.error('[Calendar] WorkIQ fetch error:', error)
      throw new Error(friendlyWorkIqError(error))
    }

    this.cache = { events, fetchedAt: Date.now(), rangeStart, rangeEnd }
    log.info(`[Calendar] Fetched ${events.length} events via WorkIQ`)
    return events
  }

  /**
   * Get today's events.
   */
  async getTodayEvents(): Promise<CalendarEvent[]> {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
    const events = await this.getEvents(start, end)
    return this.filterEvents(events)
  }

  /**
   * Get the next upcoming meeting (not all-day, starts in the future).
   */
  async getNextMeeting(): Promise<CalendarEvent | null> {
    const events = await this.getTodayEvents()
    const now = Date.now()

    return events.find((e) => !e.isAllDay && new Date(e.start).getTime() > now) ?? null
  }

  /**
   * Force-refresh the cache on next fetch.
   */
  invalidateCache(): void {
    this.cache = null
  }

  // ─── WorkIQ connection (used by auth IPC) ─────────────────────

  /**
   * Connect WorkIQ and verify calendar access. Throws a friendly error on
   * failure. On success, future fetches are enabled.
   */
  async connect(): Promise<void> {
    this.invalidateCache()
    try {
      await getWorkIqClient().connect()
    } catch (error) {
      log.error('[Calendar] WorkIQ connect error:', error)
      throw new Error(friendlyWorkIqError(error))
    }
  }

  isConnected(): boolean {
    return getWorkIqClient().isConnected()
  }

  /** Sign out of WorkIQ and clear cached events. */
  async disconnect(): Promise<void> {
    this.invalidateCache()
    await getWorkIqClient().disconnect()
  }

  /** Kill the WorkIQ subprocess on app quit (keeps the connected flag). */
  async shutdown(): Promise<void> {
    await getWorkIqClient().shutdown()
  }

  // ─── Internal ─────────────────────────────────────────────────

  /**
   * Filter events by meeting filter patterns from settings.
   * Case-insensitive substring match against event title.
   */
  private filterEvents(events: CalendarEvent[]): CalendarEvent[] {
    const patterns = settings.get('meetingFilterPatterns') || []
    if (patterns.length === 0) return events

    const lowerPatterns = patterns.map((p) => p.toLowerCase())
    return events.filter((event) => {
      const title = event.title.toLowerCase()
      return !lowerPatterns.some((pattern) => title.includes(pattern))
    })
  }

  /**
   * Map WorkIQ's flat event records onto the {@link CalendarEvent} shape.
   *
   * WorkIQ returns each event as:
   *   { subject, start, end, location, isOnlineMeeting, onlineMeetingUrl,
   *     isAllDay, attendees: string[] }
   * where `start`/`end` are ISO 8601 strings that ALREADY include the UTC
   * offset (e.g. "2026-06-22T10:00:00-05:00"). We therefore pass them straight
   * through `new Date(...)` — we must NOT append "Z", which would corrupt the
   * absolute instant. WorkIQ supplies no event id, so we synthesise a stable
   * one from the subject + start (used as the React key and for next-meeting
   * identity).
   */
  private parseWorkIqEvents(items: Record<string, unknown>[]): CalendarEvent[] {
    return items.map((item) => {
      const title = String(item.subject ?? 'No title')
      const startISO = this.toIso(item.start)
      const endISO = this.toIso(item.end)

      const rawLocation = this.toLocation(item.location)
      const rawJoinUrl =
        typeof item.onlineMeetingUrl === 'string' ? item.onlineMeetingUrl.trim() : ''
      const attendees = this.toAttendees(item.attendees)

      return {
        id: this.makeId(title, startISO),
        title,
        start: startISO,
        end: endISO,
        location: rawLocation || undefined,
        attendees,
        isOnlineMeeting: Boolean(item.isOnlineMeeting),
        onlineMeetingUrl: rawJoinUrl || undefined,
        isAllDay: Boolean(item.isAllDay)
      }
    })
  }

  /**
   * Normalise a WorkIQ datetime to an ISO string. Accepts either a plain ISO
   * string (the expected case, offset already included) or a Graph-style
   * `{ dateTime }` object as a defensive fallback. Never appends "Z".
   */
  private toIso(value: unknown): string {
    let raw: string | undefined
    if (typeof value === 'string') {
      raw = value
    } else if (value && typeof value === 'object') {
      const dt = (value as { dateTime?: unknown }).dateTime
      if (typeof dt === 'string') raw = dt
    }
    if (!raw) return new Date().toISOString()
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
  }

  private toAttendees(value: unknown): CalendarAttendee[] {
    if (!Array.isArray(value)) return []
    return value.flatMap((attendee) => {
      if (typeof attendee === 'string' && attendee.trim()) {
        return [{ displayName: attendee.trim() }]
      }
      if (!attendee || typeof attendee !== 'object') return []
      const record = attendee as Record<string, unknown>
      const displayName =
        typeof record.displayName === 'string'
          ? record.displayName.trim()
          : typeof record.name === 'string'
            ? record.name.trim()
            : ''
      if (!displayName) return []
      const email = typeof record.email === 'string' ? record.email.trim() : ''
      return [{ displayName, ...(email ? { email } : {}) }]
    })
  }

  /** Accept a string location or a Graph-style `{ displayName }` object. */
  private toLocation(value: unknown): string {
    if (typeof value === 'string') return value.trim()
    if (value && typeof value === 'object') {
      const name = (value as { displayName?: unknown }).displayName
      if (typeof name === 'string') return name.trim()
    }
    return ''
  }

  /** Deterministic id from subject + start, so the React key is stable. */
  private makeId(title: string, startISO: string): string {
    const seed = `${title}|${startISO}`
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) | 0
    }
    return `wi_${(hash >>> 0).toString(36)}`
  }
}

// Singleton
let instance: CalendarService | null = null

export function getCalendarService(): CalendarService {
  if (!instance) {
    instance = new CalendarService()
  }
  return instance
}
