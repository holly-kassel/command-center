/**
 * Dashboard Component
 *
 * Main layout assembling all sections into a cohesive grid.
 * Time-based greeting, auto-refresh, responsive layout.
 */
import { useCallback } from 'react'
import { useObsidianStore } from '../../store/obsidianStore'
import { useCalendarStore } from '../../store/calendarStore'
import { useGitHubStore } from '../../store/githubStore'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { QuickCaptureBox } from './QuickCaptureBox'
import { CalendarSection } from './CalendarSection'
import { NotificationsPanel } from './NotificationsPanel'
import { FocusSection } from './FocusSection'
import { TodayView } from './TodayView'
import { SlackParserPanel } from './SlackParserPanel'

// ─── Helpers ──────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ─── Component ────────────────────────────────────────────────

export function Dashboard(): React.ReactElement {
  const obsidianInit = useObsidianStore((s) => s.initialize)
  const obsidianRefresh = useObsidianStore((s) => s.refreshAll)
  const calendarInit = useCalendarStore((s) => s.initialize)
  const calendarRefresh = useCalendarStore((s) => s.refreshAll)
  const githubInit = useGitHubStore((s) => s.initialize)
  const githubRefresh = useGitHubStore((s) => s.fetchNotifications)

  // Initialize all services once on mount
  const initAll = useCallback(() => {
    obsidianInit()
    calendarInit()
    githubInit()
  }, [obsidianInit, calendarInit, githubInit])

  // Refresh data sources every 5 minutes
  const refreshAll = useCallback(() => {
    obsidianRefresh()
    calendarRefresh()
    githubRefresh()
  }, [obsidianRefresh, calendarRefresh, githubRefresh])

  // Auto-refresh sets up the interval (5 min)
  useAutoRefresh(initAll, 5 * 60 * 1000)

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Titlebar drag region */}
      <div
        className="h-10 flex-shrink-0 draggable"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Header — greeting + date + refresh */}
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-focus via-primary to-accent bg-clip-text text-transparent">
                {getGreeting()}, Holly
              </h1>
              <p className="text-text-tertiary text-xs mt-0.5">
                {getFormattedDate()}
              </p>
            </div>
            <button
              onClick={refreshAll}
              className="text-text-muted hover:text-focus text-sm transition-colors"
              title="Refresh all"
            >
              ↻
            </button>
          </div>

          {/* Quick Capture — full width */}
          <QuickCaptureBox />

          {/* Main grid: 3 columns on lg, 1 on small */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Calendar — spans 2 cols */}
            <div className="lg:col-span-2">
              <CalendarSection />
            </div>

            {/* Focus — right column */}
            <div>
              <FocusSection />
            </div>

            {/* Today's notes — spans 2 cols */}
            <div className="lg:col-span-2">
              <TodayView />
            </div>

            {/* Notifications — right column */}
            <div>
              <NotificationsPanel />
            </div>

            {/* Slack Parser — spans 2 cols */}
            <div className="lg:col-span-2">
              <SlackParserPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
