/**
 * MeetingCard Component
 *
 * Displays a single calendar event with time, title, location, and join button.
 */
import type { CalendarEvent } from '@shared/types/calendar'
import { memo, useState } from 'react'
import { useMeetingStore } from '../../store/meetingStore'
import { useObsidianStore } from '../../store/obsidianStore'

interface MeetingCardProps {
  event: CalendarEvent
  isNext?: boolean
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export const MeetingCard = memo(function MeetingCard({ event, isNext }: MeetingCardProps): React.ReactElement {
  const isPast = new Date(event.end).getTime() < Date.now()
  const isNow =
    new Date(event.start).getTime() <= Date.now() &&
    new Date(event.end).getTime() > Date.now()

  const openRecorder = useMeetingStore((s) => s.openRecorder)
  const appendMeetingNote = useObsidianStore((s) => s.appendMeetingNote)

  const [notesOpen, setNotesOpen] = useState(false)
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  const timeLabel = event.isAllDay ? 'All day' : formatTime(event.start)
  const meetingHeading = `**🗓️ ${event.title} · ${timeLabel}**`

  const handleRecord = (): void => {
    openRecorder({
      title: event.title,
      participants: event.attendees ?? [],
      calendarEventId: event.id,
      startTime: event.start,
      endTime: event.end
    })
  }

  const handleSaveNote = async (): Promise<void> => {
    const trimmed = note.trim()
    if (!trimmed) return
    setStatus('saving')
    try {
      await appendMeetingNote(meetingHeading, trimmed)
      setNote('')
      setStatus('success')
      setTimeout(() => setStatus('idle'), 2500)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2500)
    }
  }

  const handleNoteKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void handleSaveNote()
    }
  }

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
          <div className="text-text-primary mt-0.5 truncate text-sm font-medium">
            {event.title}
          </div>

          {/* Location */}
          {event.location && (
            <div className="text-text-tertiary mt-0.5 truncate text-xs">
              {event.location}
            </div>
          )}

          {/* Attendees count */}
          {event.attendees && event.attendees.length > 0 && (
            <div className="text-text-tertiary mt-0.5 text-xs">
              {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {/* Join button for online meetings */}
          {event.isOnlineMeeting && event.onlineMeetingUrl && (
            <button
              onClick={() => window.open(event.onlineMeetingUrl, '_blank')}
              className="bg-primary/10 text-primary hover:bg-primary/20 rounded px-2 py-1 text-xs font-medium transition-colors"
            >
              Join
            </button>
          )}

          {/* Record button — captures this meeting with its calendar info */}
          <button
            onClick={handleRecord}
            title={`Record "${event.title}"`}
            aria-label={`Record ${event.title}`}
            className="group flex items-center gap-1 rounded bg-red-500/10 px-2 py-1 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/20"
          >
            <span className="h-2 w-2 rounded-full bg-red-500 transition-transform group-hover:scale-110" />
            Rec
          </button>

          {/* Notes button — jot a note saved under this meeting in today's notes */}
          <button
            onClick={() => setNotesOpen((v) => !v)}
            title={`Notes for "${event.title}"`}
            aria-label={`Notes for ${event.title}`}
            aria-expanded={notesOpen}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              notesOpen
                ? 'bg-focus/20 text-focus'
                : 'bg-surface-secondary/60 text-text-secondary hover:bg-surface-secondary'
            }`}
          >
            Notes
          </button>
        </div>
      </div>

      {notesOpen && (
        <div className="border-surface-border/40 mt-2 border-t pt-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={handleNoteKeyDown}
            placeholder="Jot a note — saved under this meeting in today's notes"
            rows={2}
            autoFocus
            disabled={status === 'saving'}
            className="bg-surface-muted border-surface-border/60 text-text-primary placeholder:text-text-tertiary focus:ring-focus/50 w-full resize-y rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2"
          />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span
              className={`text-[11px] ${
                status === 'success'
                  ? 'text-focus'
                  : status === 'error'
                    ? 'text-red-500'
                    : 'text-text-tertiary'
              }`}
            >
              {status === 'success'
                ? "✓ Added to today's notes"
                : status === 'error'
                  ? '✗ Failed — check vault'
                  : '⌘⏎ to save'}
            </span>
            <button
              onClick={() => void handleSaveNote()}
              disabled={!note.trim() || status === 'saving'}
              className="bg-focus text-text-inverse hover:bg-focus/90 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === 'saving' ? 'Saving…' : 'Save note'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
})
