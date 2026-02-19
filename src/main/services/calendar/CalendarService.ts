/**
 * Calendar Service
 *
 * Fetches calendar events from Microsoft Graph API.
 * Caches results for 5 minutes to avoid excessive API calls.
 */
import log from 'electron-log'
import { getGraphAuthService } from '../auth/OAuthFlow'
import { settings } from '../../config/settings'
import type { CalendarEvent } from '../../../shared/types/calendar'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
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

    const auth = getGraphAuthService()
    const accessToken = await auth.getAccessToken()

    const url = `${GRAPH_BASE}/me/calendarView?startDateTime=${rangeStart}&endDateTime=${rangeEnd}&$orderby=start/dateTime&$top=50&$select=id,subject,start,end,location,attendees,isOnlineMeeting,onlineMeeting,isAllDay`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'outlook.timezone="UTC"',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      log.error(`[Calendar] Graph API error ${response.status}: ${errorText}`)
      throw new Error(`Calendar API error: ${response.status}`)
    }

    const data = await response.json()
    const events = this.parseGraphEvents(data.value || [])

    this.cache = { events, fetchedAt: Date.now(), rangeStart, rangeEnd }
    log.info(`[Calendar] Fetched ${events.length} events`)
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

    return (
      events.find((e) => !e.isAllDay && new Date(e.start).getTime() > now) ??
      null
    )
  }

  /**
   * Force-refresh the cache on next fetch.
   */
  invalidateCache(): void {
    this.cache = null
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

  private parseGraphEvents(
    items: Record<string, unknown>[]
  ): CalendarEvent[] {
    return items.map((item) => {
      const start = item.start as { dateTime: string; timeZone: string } | undefined
      const end = item.end as { dateTime: string; timeZone: string } | undefined
      const location = item.location as { displayName?: string } | undefined
      const attendees = item.attendees as Array<{
        emailAddress?: { name?: string; address?: string }
      }> | undefined
      const onlineMeeting = item.onlineMeeting as { joinUrl?: string } | undefined

      return {
        id: String(item.id ?? ''),
        title: String(item.subject ?? 'No title'),
        start: start?.dateTime ? new Date(start.dateTime + 'Z').toISOString() : new Date().toISOString(),
        end: end?.dateTime ? new Date(end.dateTime + 'Z').toISOString() : new Date().toISOString(),
        location: location?.displayName || undefined,
        attendees: attendees?.map((a) => a.emailAddress?.name || a.emailAddress?.address || 'Unknown') || [],
        isOnlineMeeting: Boolean(item.isOnlineMeeting),
        onlineMeetingUrl: onlineMeeting?.joinUrl || undefined,
        isAllDay: Boolean(item.isAllDay),
      }
    })
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
