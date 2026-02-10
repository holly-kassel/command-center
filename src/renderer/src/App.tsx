import { useEffect } from 'react'
import { useObsidianStore } from './store/obsidianStore'
import { QuickCaptureBox } from './windows/Dashboard/QuickCaptureBox'
import { TodayView } from './windows/Dashboard/TodayView'
import { CalendarSection } from './windows/Dashboard/CalendarSection'

function App(): React.JSX.Element {
  const initialize = useObsidianStore((s) => s.initialize)
  const refreshAll = useObsidianStore((s) => s.refreshAll)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <div className="min-h-screen bg-background">
      {/* Titlebar drag region */}
      <div className="h-10 draggable" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />

      {/* Main content */}
      <div className="max-w-3xl mx-auto px-6 pb-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Command Center</h1>
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

        {/* Calendar - next meeting + today's events */}
        <CalendarSection />

        {/* Today's Section */}
        <TodayView />
      </div>
    </div>
  )
}

export default App
