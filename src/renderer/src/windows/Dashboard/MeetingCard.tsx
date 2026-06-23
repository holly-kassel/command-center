/**
 * MeetingCard Component
 *
 * Displays a single calendar event with time, title, location, and join button.
 */
import type { CalendarEvent } from '@shared/types/calendar'
import { memo } from 'react'

interface MeetingCardProps {
  event: CalendarEvent
  isNext?: boolean
  onRecord?: (event: CalendarEvent) => void
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export const MeetingCard = memo(function MeetingCard({
  event,
  isNext,
  onRecord
}: MeetingCardProps): React.ReactElement {
  const isPast = new Date(event.end).getTime() < Date.now()
  const isNow =
    new Date(event.start).getTime() <= Date.now() && new Date(event.end).getTime() > Date.now()

  return (
    <div
      className={`rounded-lg border px-3 py-2 transition-colors ${
        isNext
          ? 'border-primary/40 bg-primary/5'
          : isNow
            ? 'border-focus/40 bg-focus/5'
            : isPast
              ? 'border-surface-border/40 opacity-60'
              : 'border-surface-border/60 bg-surface-secondary/30'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Time */}
          <div className="text-text-secondary text-xs">
            {event.isAllDay ? (
              'All day'
            ) : (
              <>
                {formatTime(event.start)} – {formatTime(event.end)}
              </>
            )}
            {isNow && (
              <span className="bg-focus/20 text-focus ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                Now
              </span>
            )}
          </div>

          {/* Title */}
          <div className="text-text-primary mt-0.5 truncate text-sm font-medium">{event.title}</div>

          {/* Location */}
          {event.location && (
            <div className="text-text-tertiary mt-0.5 truncate text-xs">{event.location}</div>
          )}

          {/* Attendees count */}
          {event.attendees && event.attendees.length > 0 && (
            <div className="text-text-tertiary mt-0.5 text-xs">
              {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Actions: Join + Record */}
        <div className="flex flex-shrink-0 flex-col items-end gap-1">
          {event.isOnlineMeeting && event.onlineMeetingUrl && (
            <button
              onClick={() => window.open(event.onlineMeetingUrl, '_blank')}
              className="bg-primary/10 text-primary hover:bg-primary/20 rounded px-2 py-1 text-xs font-medium transition-colors"
            >
              Join
            </button>
          )}
          {onRecord && !event.isAllDay && !isPast && (
            <button
              onClick={() => onRecord(event)}
              title="Record this meeting and save notes"
              className="bg-urgent/10 text-urgent hover:bg-urgent/20 flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors"
            >
              <span className="bg-urgent h-1.5 w-1.5 rounded-full" />
              Record
            </button>
          )}
        </div>
      </div>
    </div>
  )
})
