/**
 * Dashboard Component
 *
 * Main layout assembling all sections into a cohesive grid.
 * Time-based greeting, auto-refresh, responsive layout.
 */
import { useCallback, useEffect, useState } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { DEFAULT_DASHBOARD_LAYOUT, type DashboardPanelId } from '@shared/types/settings'
import { AnimatePresence } from 'framer-motion'
import { useObsidianStore } from '../../store/obsidianStore'
import { useCalendarStore } from '../../store/calendarStore'
import { useGitHubStore } from '../../store/githubStore'
import { useRitualStore } from '../../store/ritualStore'
import { useAutoRefresh } from '../../hooks/useAutoRefresh'
import { SortablePanel } from '../../components/ui/SortablePanel'
import { AnimatedOverlay } from '../../components/ui/motion'
import { QuickCaptureBox } from './QuickCaptureBox'
import { CalendarSection } from './CalendarSection'
import { NotificationsPanel } from './NotificationsPanel'
import { PullRequestsPanel } from './PullRequestsPanel'
import { TranscriptsPanel } from './TranscriptsPanel'
import { FocusSection } from './FocusSection'
import { NotesView } from '../../components/Notes/NotesView'
import { SettingsPanel } from '../Settings/SettingsPanel'
import { FocusModeOverlay } from '../FocusMode/FocusModeOverlay'
import { SamoyedMascot } from '../../components/SamoyedMascot'
import { RitualMetrics } from '../../components/rituals/RitualMetrics'
import { MorningRitualFlow } from '../../components/rituals/MorningRitualFlow'
import { EveningRitualFlow } from '../../components/rituals/EveningRitualFlow'
import { TouchGrassFlow } from '../../components/rituals/TouchGrassFlow'
import { ScreamIntoTheVoid } from '../../components/ScreamIntoTheVoid'
import { MeetingNotesOverlay } from '../../components/meeting'
import { KanbanBoard } from '../../components/kanban/KanbanBoard'
import { KatyaDrawer, KatyaToggleButton } from '../../components/chat'
import { useChatStore } from '../../store/chatStore'
import { useKanbanStore } from '../../store/kanbanStore'

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
    day: 'numeric'
  })
}

type RightColumnPanelId = Exclude<DashboardPanelId, 'notes' | 'goals'>

const RIGHT_COLUMN_PANEL_IDS = [...DEFAULT_DASHBOARD_LAYOUT.rightColumn] as RightColumnPanelId[]

function isRightColumnPanelId(panelId: DashboardPanelId): panelId is RightColumnPanelId {
  return RIGHT_COLUMN_PANEL_IDS.includes(panelId as RightColumnPanelId)
}

function reconcileRightColumnOrder(savedOrder?: DashboardPanelId[]): RightColumnPanelId[] {
  const nextOrder: RightColumnPanelId[] = []
  const seen = new Set<RightColumnPanelId>()

  for (const panelId of savedOrder ?? []) {
    if (!isRightColumnPanelId(panelId) || seen.has(panelId)) continue
    seen.add(panelId)
    nextOrder.push(panelId)
  }

  for (const panelId of RIGHT_COLUMN_PANEL_IDS) {
    if (!seen.has(panelId)) {
      nextOrder.push(panelId)
    }
  }

  return nextOrder
}

// ─── Component ────────────────────────────────────────────────

export function Dashboard(): React.ReactElement {
  const [showSettings, setShowSettings] = useState(false)
  const [showFocusMode, setShowFocusMode] = useState(false)
  const [showScreamVoid, setShowScreamVoid] = useState(false)
  const [showMeetingNotes, setShowMeetingNotes] = useState(false)
  const [rightColumnOrder, setRightColumnOrder] = useState<RightColumnPanelId[]>(() =>
    reconcileRightColumnOrder(DEFAULT_DASHBOARD_LAYOUT.rightColumn)
  )
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
  const panelComponents: Record<RightColumnPanelId, React.ReactNode> = {
    rituals: (
      <RitualMetrics
        onStartMorning={() => startRitual('morning')}
        onStartEvening={() => startRitual('evening')}
        onStartTouchGrass={() => startRitual('touch_grass')}
      />
    ),
    calendar: <CalendarSection />,
    focus: <FocusSection />,
    triage: <NotificationsPanel />,
    pullRequests: <PullRequestsPanel />,
    transcripts: <TranscriptsPanel />,
  }
  const kanbanInit = useKanbanStore((s) => s.initialize)
  const kanbanRefresh = useKanbanStore((s) => s.refreshTasks)
  const chatInit = useChatStore((s) => s.initialize)

  // Initialize all services once on mount
  const initAll = useCallback(() => {
    obsidianInit()
    calendarInit()
    githubInit()
    ritualInit()
    kanbanInit()
    chatInit()
  }, [obsidianInit, calendarInit, githubInit, ritualInit, kanbanInit, chatInit])

  // Refresh data sources every 5 minutes
  const refreshAll = useCallback(() => {
    obsidianRefresh()
    calendarRefresh()
    githubRefresh()
    ritualRefresh()
    kanbanRefresh()
  }, [obsidianRefresh, calendarRefresh, githubRefresh, ritualRefresh, kanbanRefresh])

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

  const persistRightColumnOrder = useCallback((nextOrder: RightColumnPanelId[]): void => {
    void window.api.settings.update({ dashboardLayout: { rightColumn: nextOrder } }).catch(() => {})
  }, [])

  useEffect(() => {
    let isMounted = true

    void window.api.settings
      .get('dashboardLayout')
      .then((layout) => {
        if (!isMounted) return

        const nextOrder = reconcileRightColumnOrder(layout?.rightColumn)
        setRightColumnOrder(nextOrder)

        const savedOrder = layout?.rightColumn
        const hasChanged =
          !savedOrder ||
          savedOrder.length !== nextOrder.length ||
          nextOrder.some((panelId, index) => panelId !== savedOrder[index])

        if (hasChanged) {
          persistRightColumnOrder(nextOrder)
        }
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [persistRightColumnOrder])

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return

      setRightColumnOrder((previousOrder) => {
        const oldIndex = previousOrder.indexOf(active.id as RightColumnPanelId)
        const newIndex = previousOrder.indexOf(over.id as RightColumnPanelId)

        if (oldIndex === -1 || newIndex === -1) {
          return previousOrder
        }

        const nextOrder = arrayMove(previousOrder, oldIndex, newIndex)
        persistRightColumnOrder(nextOrder)
        return nextOrder
      })
    },
    [persistRightColumnOrder]
  )

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Titlebar drag region */}
      <div
        className="h-10 flex-shrink-0 draggable"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="mx-auto max-w-7xl space-y-4">
          <div>
            {/* Header — greeting + date + refresh */}
            <div className="flex items-end justify-between">
              <div className="flex items-center gap-3">
                <SamoyedMascot size={44} className="mascot-idle drop-shadow-sm" />
                <div>
                  <h1 className="bg-gradient-to-r from-focus via-primary to-accent bg-clip-text text-xl font-bold text-transparent">
                    {getGreeting()}, Holly
                  </h1>
                  <p className="mt-0.5 text-xs text-text-tertiary">{getFormattedDate()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMeetingNotes(true)}
                  className="text-sm text-text-muted transition-colors hover:text-blue-400"
                  title="Start Meeting Notes"
                >
                  🎙️
                </button>
                <button
                  onClick={() => setShowScreamVoid(true)}
                  className="text-sm text-text-muted transition-colors hover:text-red-400"
                  title="Scream Into The Void"
                >
                  🗣️
                </button>
                <KatyaToggleButton />
                <button
                  onClick={() => setShowFocusMode(true)}
                  className="text-sm text-text-muted transition-colors hover:text-focus"
                  title="Focus Mode (⌘⇧F)"
                >
                  🎯
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="text-sm text-text-muted transition-colors hover:text-accent"
                  title="Settings"
                >
                  ⚙
                </button>
                <button
                  onClick={refreshAll}
                  className="text-sm text-text-muted transition-colors hover:text-focus"
                  title="Refresh all"
                >
                  ↻
                </button>
              </div>
            </div>
          </div>

          <div>
            {/* Quick Capture — full width */}
            <QuickCaptureBox />
          </div>

          {/* Main grid: 2 columns on lg */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Today's notes — left, spans 2 cols */}
            <div className="min-w-0 lg:col-span-2">
              <NotesView />
            </div>

            {/* Right column — draggable */}
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={rightColumnOrder} strategy={verticalListSortingStrategy}>
                <div className="min-w-0 space-y-4 lg:max-h-[600px] lg:overflow-y-auto lg:pr-1">
                  {rightColumnOrder.map((panelId) => {
                    const panel = panelComponents[panelId]
                    if (!panel) return null

                    return (
                      <SortablePanel key={panelId} id={panelId}>
                        {panel}
                      </SortablePanel>
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <div>
            <KanbanBoard />
          </div>
        </div>
      </div>

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

      <AnimatePresence>
        {showFocusMode && <FocusModeOverlay key="focus" onExit={() => setShowFocusMode(false)} />}
        {showScreamVoid && (
          <ScreamIntoTheVoid key="scream" onClose={() => setShowScreamVoid(false)} />
        )}
        {showMeetingNotes && (
          <MeetingNotesOverlay
            key="meeting"
            onClose={() => setShowMeetingNotes(false)}
          />
        )}

        {showSettings && (
          <AnimatedOverlay
            key="settings"
            onClose={() => setShowSettings(false)}
            animation="slide-right"
            maxWidth="max-w-md"
            closeOnBackdrop
          >
            <div className="h-full bg-background border-l border-surface-border/40 overflow-y-auto p-6 shadow-2xl">
              <SettingsPanel onClose={() => setShowSettings(false)} />
            </div>
          </AnimatedOverlay>
        )}
      </AnimatePresence>

      {/* Katya chat drawer */}
      <KatyaDrawer />
    </div>
  )
}
