/**
 * CountdownTimer Component
 *
 * Shows a live countdown to the next meeting with color-coded urgency.
 * Updates every second while mounted.
 */
import { useEffect, useState } from 'react'
import type { CalendarEvent } from '@shared/types/calendar'

interface CountdownTimerProps {
  meeting: CalendarEvent
}

function getTimeUntil(targetISO: string): {
  minutes: number
  seconds: number
  total: number
  label: string
} {
  const diff = new Date(targetISO).getTime() - Date.now()
  if (diff <= 0) return { minutes: 0, seconds: 0, total: 0, label: 'Now' }

  const totalMinutes = Math.floor(diff / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const seconds = Math.floor((diff % 60_000) / 1000)

  if (hours > 0) {
    return { minutes: totalMinutes, seconds, total: diff, label: `${hours}h ${minutes}m` }
  }
  if (totalMinutes > 0) {
    return { minutes: totalMinutes, seconds, total: diff, label: `${totalMinutes}m ${seconds}s` }
  }
  return { minutes: 0, seconds, total: diff, label: `${seconds}s` }
}

function getUrgencyClass(totalMs: number): string {
  if (totalMs <= 0) return 'text-focus'
  if (totalMs <= 5 * 60_000) return 'text-urgent' // ≤5min
  if (totalMs <= 15 * 60_000) return 'text-warning' // ≤15min
  return 'text-primary'
}

export function CountdownTimer({ meeting }: CountdownTimerProps): React.ReactElement {
  const [timeUntil, setTimeUntil] = useState(() => getTimeUntil(meeting.start))

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUntil(getTimeUntil(meeting.start))
    }, 1000)
    return () => clearInterval(interval)
  }, [meeting.start])

  const urgencyClass = getUrgencyClass(timeUntil.total)

  return (
    <div className="bg-surface-secondary/50 flex items-center gap-3 rounded-lg border border-surface-border/60 px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-text-secondary text-xs">Next meeting</div>
        <div className="text-text-primary truncate text-sm font-medium">{meeting.title}</div>
      </div>
      <div className={`text-right font-mono text-lg font-bold tabular-nums ${urgencyClass}`}>
        {timeUntil.label}
      </div>
    </div>
  )
}
