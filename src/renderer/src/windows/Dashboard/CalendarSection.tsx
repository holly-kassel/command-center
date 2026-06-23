/**
 * CalendarSection Component
 *
 * Shows today's calendar events, next meeting countdown, and auth state.
 * Auto-refreshes every 5 minutes.
 */
import { useEffect, useState, useCallback } from 'react'
import { useCalendarStore } from '../../store/calendarStore'
import { MeetingCard } from './MeetingCard'
import { CountdownTimer } from './CountdownTimer'
import { Skeleton } from '../../components/ui/Skeleton'
import { VoiceRecorder } from '../../components/VoiceRecorder'
import type { CalendarEvent } from '@shared/types/calendar'

export function CalendarSection(): React.ReactElement {
  const { events, nextMeeting, isAuthenticated, isLoading, error, initialize, refreshAll, login } =
    useCalendarStore()

  // Init on mount
  useEffect(() => {
    initialize()
  }, [initialize])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!isAuthenticated) return

    const interval = setInterval(
      () => {
        refreshAll()
      },
      5 * 60 * 1000
    )

    return () => clearInterval(interval)
  }, [isAuthenticated, refreshAll])

  // Meeting bound to the live recorder (null = recorder closed)
  const [recordingMeeting, setRecordingMeeting] = useState<CalendarEvent | null>(null)
  const handleRecord = useCallback((event: CalendarEvent) => setRecordingMeeting(event), [])
  const stopRecording = useCallback(() => setRecordingMeeting(null), [])

  // ─── Not authenticated ─────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <section className="rounded-xl border border-surface-border/60 bg-surface-secondary/30 p-4">
        <h2 className="text-text-primary mb-3 text-sm font-semibold tracking-wide uppercase">
          Calendar
        </h2>
        <div className="flex flex-col items-center gap-3 py-4">
          <p className="text-text-secondary text-center text-sm">
            Connect your Microsoft 365 calendar (via WorkIQ) to see today&apos;s meetings.
          </p>
          <button
            onClick={login}
            disabled={isLoading}
            className="bg-primary hover:bg-primary/90 disabled:bg-primary/50 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            {isLoading ? 'Connecting…' : 'Connect Calendar'}
          </button>
          <p className="text-text-tertiary text-center text-xs">
            The first connect can take a few seconds while WorkIQ starts.
          </p>
          {error && <p className="text-urgent text-xs">{error}</p>}
        </div>
      </section>
    )
  }

  // ─── Loading ───────────────────────────────────────────────────
  if (isLoading && events.length === 0) {
    return (
      <section className="rounded-xl border border-surface-border/60 bg-surface-secondary/30 p-4">
        <h2 className="text-text-primary mb-3 text-sm font-semibold tracking-wide uppercase">
          Calendar
        </h2>
        <Skeleton lines={4} />
      </section>
    )
  }

  // ─── Authenticated ─────────────────────────────────────────────
  const timeEvents = events.filter((e) => !e.isAllDay)
  const allDayEvents = events.filter((e) => e.isAllDay)

  return (
    <section className="rounded-xl border border-surface-border/60 bg-surface-secondary/30 p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-text-primary text-sm font-semibold tracking-wide uppercase">
          Calendar
        </h2>
        <button
          onClick={refreshAll}
          className="text-text-tertiary hover:text-text-secondary text-xs transition-colors"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {error && <p className="text-urgent mb-2 text-xs">{error}</p>}

      {/* Countdown to next meeting */}
      {nextMeeting && (
        <div className="mb-3">
          <CountdownTimer meeting={nextMeeting} />
        </div>
      )}

      {/* All-day events */}
      {allDayEvents.length > 0 && (
        <div className="mb-2">
          <div className="text-text-tertiary mb-1 text-xs font-medium uppercase">All Day</div>
          <div className="space-y-1">
            {allDayEvents.map((event) => (
              <MeetingCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}

      {/* Time-based events */}
      {timeEvents.length > 0 ? (
        <div className="space-y-1.5">
          {timeEvents.map((event) => (
            <MeetingCard
              key={event.id}
              event={event}
              isNext={nextMeeting?.id === event.id}
              onRecord={handleRecord}
            />
          ))}
        </div>
      ) : (
        <div className="text-text-tertiary py-3 text-center text-sm">
          No meetings today — focus time! 🎯
        </div>
      )}

      {/* Meeting-bound recorder overlay (fixed inset-0; nesting here is fine) */}
      {recordingMeeting && (
        <VoiceRecorder
          meeting={recordingMeeting}
          onComplete={stopRecording}
          onClose={stopRecording}
        />
      )}
    </section>
  )
}
