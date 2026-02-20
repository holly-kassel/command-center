/**
 * Dashboard Component
 *
 * Main layout assembling all sections into a cohesive grid.
 * Time-based greeting, auto-refresh, responsive layout.
 */
import { useCallback, useEffect, useState } from 'react'
import { useObsidianStore } from '../../store/obsidianStore'
import { useCalendarStore } from '../../store/calendarStore'
import { useGitHubStore } from '../../store/githubStore'
import { useRitualStore } from '../../store/ritualStore'
import { useGoalStore } from '../../store/goalStore'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { QuickCaptureBox } from './QuickCaptureBox'
import { CalendarSection } from './CalendarSection'
import { NotificationsPanel } from './NotificationsPanel'
import { PullRequestsPanel } from './PullRequestsPanel'
import { FocusSection } from './FocusSection'
import { TodayView } from './TodayView'
import { SettingsPanel } from '../Settings/SettingsPanel'
import { FocusModeOverlay } from '../FocusMode/FocusModeOverlay'
import { SamoyedMascot } from '../../components/SamoyedMascot'
import { RitualMetrics } from '../../components/rituals/RitualMetrics'
import { MorningRitualFlow } from '../../components/rituals/MorningRitualFlow'
import { EveningRitualFlow } from '../../components/rituals/EveningRitualFlow'
import { TouchGrassFlow } from '../../components/rituals/TouchGrassFlow'
import { VoiceRecorder } from '../../components/VoiceRecorder'
import { ScreamIntoTheVoid } from '../../components/ScreamIntoTheVoid'
import { GoalsPanel } from '../../components/goals/GoalsPanel'

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
  const [showSettings, setShowSettings] = useState(false)
  const [showFocusMode, setShowFocusMode] = useState(false)
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false)
  const [showScreamVoid, setShowScreamVoid] = useState(false)
  const obsidianInit = useObsidianStore((s) => s.initialize)
  const obsidianRefresh = useObsidianStore((s) => s.refreshAll)
  const calendarInit = useCalendarStore((s) => s.initialize)
  const calendarRefresh = useCalendarStore((s) => s.refreshAll)
  const githubInit = useGitHubStore((s) => s.initialize)
  const githubRefresh = useGitHubStore((s) => s.fetchNotifications)
  const ritualInit = useRitualStore((s) => s.initialize)
  const ritualRefresh = useRitualStore((s) => s.refreshAll)
  const activeRitual = useRitualStore((s) => s.activeRitual)
  const startRitual = useRitualStore((s) => s.startRitual)
  const endRitual = useRitualStore((s) => s.endRitual)
  const goalInit = useGoalStore((s) => s.initialize)
  const goalRefresh = useGoalStore((s) => s.refreshAll)

  // Initialize all services once on mount
  const initAll = useCallback(() => {
    obsidianInit()
    calendarInit()
    githubInit()
    ritualInit()
    goalInit()
  }, [obsidianInit, calendarInit, githubInit, ritualInit, goalInit])

  // Refresh data sources every 5 minutes
  const refreshAll = useCallback(() => {
    obsidianRefresh()
    calendarRefresh()
    githubRefresh()
    ritualRefresh()
    goalRefresh()
  }, [obsidianRefresh, calendarRefresh, githubRefresh, ritualRefresh, goalRefresh])

  // Auto-refresh sets up the interval (5 min)
  useAutoRefresh(initAll, 5 * 60 * 1000)

  // Listen for focus mode toggle from main process (Cmd+Shift+F)
  useEffect(() => {
    const handler = (): void => setShowFocusMode((v) => !v)
    const cleanup = window.api.settings.onFocusModeToggle?.(handler)
    return () => cleanup?.()
  }, [])

  // Listen for Settings from app menu (Cmd+,)
  useEffect(() => {
    const handler = (): void => setShowSettings(true)
    const cleanup = window.api.settings.onOpenSettings?.(handler)
    return () => cleanup?.()
  }, [])

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
            <div className="flex items-center gap-3">
              <SamoyedMascot size={44} className="mascot-idle drop-shadow-sm" />
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-focus via-primary to-accent bg-clip-text text-transparent">
                  {getGreeting()}, Holly
                </h1>
                <p className="text-text-tertiary text-xs mt-0.5">
                  {getFormattedDate()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowScreamVoid(true)}
                className="text-text-muted hover:text-red-400 text-sm transition-colors"
                title="Scream Into The Void"
              >
                🗣️
              </button>
              <button
                onClick={() => setShowFocusMode(true)}
                className="text-text-muted hover:text-focus text-sm transition-colors"
                title="Focus Mode (⌘⇧F)"
              >
                🎯
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="text-text-muted hover:text-accent text-sm transition-colors"
                title="Settings"
              >
                ⚙
              </button>
              <button
                onClick={refreshAll}
                className="text-text-muted hover:text-focus text-sm transition-colors"
                title="Refresh all"
              >
                ↻
              </button>
            </div>
          </div>

          {/* Quick Capture — full width */}
          <QuickCaptureBox onStartRecording={() => setShowVoiceRecorder(true)} />

          {/* Main grid: 2 columns on lg */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Today's notes — left, spans 2 cols */}
            <div className="lg:col-span-2 min-w-0">
              <TodayView />
            </div>

            {/* Right column — Rituals + Calendar + Focus + Notifications + PRs stacked */}
            <div className="min-w-0 space-y-4">
              <RitualMetrics
                onStartMorning={() => startRitual('morning')}
                onStartEvening={() => startRitual('evening')}
                onStartTouchGrass={() => startRitual('touch_grass')}
              />
              <CalendarSection />
              <FocusSection />
              <NotificationsPanel />
              <PullRequestsPanel />
            </div>
          </div>

          {/* Goals — full width row below main grid */}
          <GoalsPanel compact />
        </div>
      </div>

      {/* Focus Mode overlay */}
      {showFocusMode && (
        <FocusModeOverlay onExit={() => setShowFocusMode(false)} />
      )}

      {/* Ritual flow overlays */}
      {activeRitual === 'morning' && (
        <MorningRitualFlow onComplete={endRitual} onClose={endRitual} />
      )}
      {activeRitual === 'evening' && (
        <EveningRitualFlow onComplete={endRitual} onClose={endRitual} />
      )}
      {activeRitual === 'touch_grass' && (
        <TouchGrassFlow onComplete={endRitual} onClose={endRitual} />
      )}

      {/* Voice Recorder overlay */}
      {showVoiceRecorder && (
        <VoiceRecorder
          onComplete={() => {
            setShowVoiceRecorder(false)
            obsidianRefresh()
          }}
          onClose={() => setShowVoiceRecorder(false)}
        />
      )}

      {/* Scream Into The Void */}
      {showScreamVoid && (
        <ScreamIntoTheVoid onClose={() => setShowScreamVoid(false)} />
      )}

      {/* Settings slide-over */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowSettings(false)}
          />
          {/* Panel */}
          <div className="relative w-full max-w-md bg-background border-l border-surface-border/40 overflow-y-auto p-6 shadow-2xl">
            <SettingsPanel onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
