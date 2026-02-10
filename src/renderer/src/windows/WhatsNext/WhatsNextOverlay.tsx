/**
 * WhatsNextOverlay
 *
 * Floating panel that shows via Cmd+Shift+N.
 * Displays next meeting + current focus at a glance.
 * Press Escape to dismiss.
 */
import { useEffect, useState, useCallback } from 'react'
import type { CalendarEvent } from '../../../../shared/types/calendar'

interface WhatsNextData {
  nextMeeting: CalendarEvent | null
  currentFocus: string | null
}

export function WhatsNextOverlay(): React.JSX.Element {
  const [data, setData] = useState<WhatsNextData>({ nextMeeting: null, currentFocus: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const [nextMeeting, currentFocus] = await Promise.all([
          window.api.calendar.getNextMeeting(),
          window.api.obsidian.getCurrentFocus()
        ])
        setData({ nextMeeting, currentFocus })
      } catch {
        // Silently handle — overlay will show empty state
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      window.electron.ipcRenderer.send('overlay:close')
    }
  }, [])

  // Format the time until a meeting
  const formatTimeUntil = (startTime: string): string => {
    const now = new Date()
    const start = new Date(startTime)
    const diffMs = start.getTime() - now.getTime()

    if (diffMs < 0) return 'Now'
    const mins = Math.round(diffMs / 60000)
    if (mins < 60) return `in ${mins}m`
    const hours = Math.floor(mins / 60)
    const remMins = mins % 60
    return remMins > 0 ? `in ${hours}h ${remMins}m` : `in ${hours}h`
  }

  const formatTime = (iso: string): string => {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="h-screen w-screen flex items-start justify-end p-2"
         onKeyDown={handleKeyDown}
         tabIndex={0}
         style={{ background: 'transparent' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl border border-surface-border overflow-hidden"
           style={{ background: 'var(--color-surface)', backdropFilter: 'blur(24px)' }}>

        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">What's Next</h2>
          <span className="text-[11px] text-text-muted">⎋ close</span>
        </div>

        {loading ? (
          <div className="px-4 pb-4 text-text-muted text-sm">Loading…</div>
        ) : (
          <div className="px-4 pb-4 space-y-3">

            {/* Next Meeting */}
            <div className="rounded-xl p-3 border border-surface-border bg-primary-light">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-primary">📅</span>
                <span className="text-xs font-medium text-primary/80 uppercase tracking-wide">Next Meeting</span>
              </div>
              {data.nextMeeting ? (
                <div>
                  <p className="text-text-primary font-medium text-sm leading-snug">
                    {data.nextMeeting.subject}
                  </p>
                  <p className="text-text-tertiary text-xs mt-1">
                    {formatTime(data.nextMeeting.start)} · {formatTimeUntil(data.nextMeeting.start)}
                  </p>
                </div>
              ) : (
                <p className="text-text-muted text-sm">No more meetings today 🎉</p>
              )}
            </div>

            {/* Current Focus */}
            <div className="rounded-xl p-3 border border-surface-border bg-focus-light">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-focus">🎯</span>
                <span className="text-xs font-medium text-focus/80 uppercase tracking-wide">Current Focus</span>
              </div>
              <p className="text-text-primary text-sm leading-snug">
                {data.currentFocus || 'No focus set'}
              </p>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
