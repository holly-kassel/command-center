/**
 * Calendar-specific type definitions
 * Used across main + renderer via preload bridge
 */

/** A calendar event from Microsoft Graph */
export interface CalendarEvent {
  id: string
  title: string
  start: string // ISO datetime
  end: string // ISO datetime
  location?: string
  attendees?: string[]
  isOnlineMeeting: boolean
  onlineMeetingUrl?: string
  isAllDay: boolean
}

/** Auth state exposed to renderer */
export interface AuthStatus {
  microsoft: boolean
}

/** Token data stored encrypted via safeStorage */
export interface MicrosoftTokenData {
  accessToken: string
  refreshToken: string
  expiresAt: number // epoch ms
  account?: string
}
