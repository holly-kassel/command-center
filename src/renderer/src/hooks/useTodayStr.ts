import { useState, useEffect } from 'react'

function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Returns today's date as YYYY-MM-DD, updating automatically at midnight.
 * Checks every 30 seconds so the "Today" badge stays accurate without restart.
 */
export function useTodayStr(): string {
  const [today, setToday] = useState(() => toDateStr(new Date()))

  useEffect(() => {
    const interval = setInterval(() => {
      const now = toDateStr(new Date())
      setToday((prev) => (prev !== now ? now : prev))
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  return today
}
