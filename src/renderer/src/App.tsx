import { useEffect } from 'react'
import { useObsidianStore } from './store/obsidianStore'
import { QuickCaptureBox } from './windows/Dashboard/QuickCaptureBox'
import { TodayView } from './windows/Dashboard/TodayView'
import { CalendarSection } from './windows/Dashboard/CalendarSection'
import { NotificationsPanel } from './windows/Dashboard/NotificationsPanel'

function App(): React.JSX.Element {
  const initialize = useObsidianStore((s) => s.initialize)
  const refreshAll = useObsidianStore((s) => s.refreshAll)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Titlebar drag region */}
      <div className="h-10 flex-shrink-0 draggable" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

      {/* Main content — scrollable */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-5xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-text-primary">Command Center</h1>
            <button
              onClick={refreshAll}
              className="text-text-muted hover:text-text-secondary text-sm transition-colors"
              title="Refresh"
            >
              ↻ Refresh
            </button>
          </div>

          {/* Quick Capture */}
          <QuickCaptureBox />

          {/* Calendar + Notifications side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CalendarSection />
            <NotificationsPanel />
          </div>

          {/* Today's Section */}
          <TodayView />
        </div>
      </div>
    </div>
  )
}

export default App
