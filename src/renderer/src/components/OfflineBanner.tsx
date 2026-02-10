/**
 * OfflineBanner
 *
 * Shows a subtle banner when the app is offline.
 * Auto-hides when connectivity is restored.
 */
import { useState, useEffect } from 'react'

export function OfflineBanner(): React.ReactElement | null {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOffline = (): void => setOffline(true)
    const goOnline = (): void => setOffline(false)

    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)

    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="bg-warning/10 border-b border-warning/30 px-4 py-1.5 flex items-center justify-center gap-2 text-xs text-warning">
      <span>📡</span>
      <span>You&apos;re offline — using cached data</span>
    </div>
  )
}
