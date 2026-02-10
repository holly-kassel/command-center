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
      <div className="w-full max-w-sm rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
           style={{ background: 'rgba(15, 17, 23, 0.92)', backdropFilter: 'blur(24px)' }}>

        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">What's Next</h2>
          <span className="text-[11px] text-white/20">⎋ close</span>
        </div>

        {loading ? (
          <div className="px-4 pb-4 text-white/30 text-sm">Loading…</div>
        ) : (
          <div className="px-4 pb-4 space-y-3">

            {/* Next Meeting */}
            <div className="rounded-xl p-3 border border-white/5"
                 style={{ background: 'rgba(96, 165, 250, 0.08)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-blue-400">📅</span>
                <span className="text-xs font-medium text-blue-400/80 uppercase tracking-wide">Next Meeting</span>
              </div>
              {data.nextMeeting ? (
                <div>
                  <p className="text-white font-medium text-sm leading-snug">
                    {data.nextMeeting.subject}
                  </p>
                  <p className="text-white/40 text-xs mt-1">
                    {formatTime(data.nextMeeting.start)} · {formatTimeUntil(data.nextMeeting.start)}
                  </p>
                </div>
              ) : (
                <p className="text-white/30 text-sm">No more meetings today 🎉</p>
              )}
            </div>

            {/* Current Focus */}
            <div className="rounded-xl p-3 border border-white/5"
                 style={{ background: 'rgba(52, 211, 153, 0.08)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-emerald-400">🎯</span>
                <span className="text-xs font-medium text-emerald-400/80 uppercase tracking-wide">Current Focus</span>
              </div>
              <p className="text-white text-sm leading-snug">
                {data.currentFocus || 'No focus set'}
              </p>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
