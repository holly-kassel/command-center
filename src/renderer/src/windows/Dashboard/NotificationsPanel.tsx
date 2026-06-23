/**
 * NotificationsPanel Component
 *
 * Shows GitHub notifications in a triage-first workflow with inline notes.
 * Includes PAT setup flow and auto-refresh.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGitHubStore } from '../../store/githubStore'
import { useKanbanStore } from '../../store/kanbanStore'
import { Skeleton } from '../../components/ui/Skeleton'
import type {
  GitHubNotification,
  NotificationTriageData,
  NotificationSubjectType,
  TriagePriority,
  TriageStatus
} from '@shared/types/github'
import { TRIAGE_STATUS_LABELS, TRIAGE_STATUS_ORDER } from '@shared/types/github'

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'needs_triage', label: 'Needs Triage' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' }
] as const

type TriageFilter = (typeof FILTER_OPTIONS)[number]['value']

type NotificationWithTriage = {
  notification: GitHubNotification
  triage: NotificationTriageData
}

type PriorityOption = {
  value: TriagePriority
  shortLabel: string
  label: string
  groupLabel: string
  className: string
}

type PriorityGroup = {
  priority: TriagePriority
  option: PriorityOption
  items: NotificationWithTriage[]
}

const TYPE_ICONS: Record<NotificationSubjectType, string> = {
  PullRequest: '🔵',
  Issue: '🟢',
  Discussion: '💬',
  other: '⚪'
}

const STATUS_COLOR_CLASSES: Record<TriageStatus, string> = {
  needs_triage: 'text-blue-400',
  in_progress: 'text-yellow-400',
  blocked: 'text-red-400',
  done: 'text-green-400',
  dismissed: 'text-text-muted'
}

const PRIORITY_OPTIONS: PriorityOption[] = [
  {
    value: 1,
    shortLabel: 'P1',
    label: 'P1 Critical',
    groupLabel: 'P1 — Critical',
    className: 'bg-red-500/20 text-red-400'
  },
  {
    value: 2,
    shortLabel: 'P2',
    label: 'P2 High',
    groupLabel: 'P2 — High',
    className: 'bg-orange-500/20 text-orange-400'
  },
  {
    value: 3,
    shortLabel: 'P3',
    label: 'P3 Medium',
    groupLabel: 'P3 — Medium',
    className: 'bg-yellow-500/20 text-yellow-400'
  },
  {
    value: 4,
    shortLabel: 'P4',
    label: 'P4 Low',
    groupLabel: 'P4 — Low',
    className: 'bg-blue-500/20 text-blue-400'
  },
  {
    value: 5,
    shortLabel: 'P5',
    label: 'P5 Backlog',
    groupLabel: 'P5 — Backlog',
    className: 'bg-text-muted/20 text-text-muted'
  },
  {
    value: 0,
    shortLabel: '—',
    label: '—',
    groupLabel: 'Needs Triage',
    className: 'bg-text-muted/20 text-text-muted'
  }
]

const PRIORITY_GROUP_ORDER: TriagePriority[] = [1, 2, 3, 4, 5, 0]

const STATUS_OPTIONS: Array<{ value: TriageStatus; icon: string }> = [
  { value: 'needs_triage', icon: '🔵' },
  { value: 'in_progress', icon: '🟡' },
  { value: 'blocked', icon: '🔴' },
  { value: 'done', icon: '✅' },
  { value: 'dismissed', icon: '⊘' }
]

function getDefaultTriage(notification: GitHubNotification): NotificationTriageData {
  return {
    notificationId: notification.id,
    status: 'needs_triage',
    priority: 0,
    notes: '',
    updatedAt: notification.updatedAt
  }
}

function compareNotifications(a: NotificationWithTriage, b: NotificationWithTriage): number {
  const statusDelta = TRIAGE_STATUS_ORDER[a.triage.status] - TRIAGE_STATUS_ORDER[b.triage.status]
  if (statusDelta !== 0) return statusDelta

  const aPriority = a.triage.priority === 0 ? Number.MAX_SAFE_INTEGER : a.triage.priority
  const bPriority = b.triage.priority === 0 ? Number.MAX_SAFE_INTEGER : b.triage.priority
  if (aPriority !== bPriority) return aPriority - bPriority

  return new Date(b.notification.updatedAt).getTime() - new Date(a.notification.updatedAt).getTime()
}

function formatRelativeTime(isoDate: string, now: number): string {
  const diff = now - new Date(isoDate).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function truncateNotes(notes: string): string {
  if (notes.length <= 40) return notes
  return `${notes.slice(0, 40)}…`
}

function getPriorityOption(priority: TriagePriority): PriorityOption {
  return PRIORITY_OPTIONS.find((option) => option.value === priority) ?? PRIORITY_OPTIONS[5]
}

function groupByPriority(items: NotificationWithTriage[]): PriorityGroup[] {
  return PRIORITY_GROUP_ORDER.map((priority) => ({
    priority,
    option: getPriorityOption(priority),
    items: items
      .filter((item) => item.triage.priority === priority)
      .sort((a, b) => compareNotifications(a, b))
  })).filter((group) => group.items.length > 0)
}

function TriageNotificationRow({
  item,
  now,
  onMarkAsRead,
  onStatusChange,
  onPriorityChange,
  onNotesSave,
  onAddToTodo
}: {
  item: NotificationWithTriage
  now: number
  onMarkAsRead: (id: string) => Promise<void>
  onStatusChange: (notificationId: string, status: TriageStatus) => Promise<void>
  onPriorityChange: (notificationId: string, priority: TriagePriority) => Promise<void>
  onNotesSave: (notificationId: string, notes: string) => Promise<void>
  onAddToTodo: (notification: GitHubNotification) => Promise<void>
}): React.ReactElement {
  const { notification, triage } = item
  const [notesExpanded, setNotesExpanded] = useState(false)
  const [draftNotes, setDraftNotes] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current)
      if (savedIndicatorTimeoutRef.current) clearTimeout(savedIndicatorTimeoutRef.current)
    }
  }, [])

  const priorityOption = getPriorityOption(triage.priority)
  const notesValue = draftNotes ?? triage.notes
  const notesPreview = notesValue.trim() ? truncateNotes(notesValue.trim()) : null

  const scheduleNotesSave = (nextNotes: string): void => {
    setDraftNotes(nextNotes)
    setSaveState('saving')

    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current)
    if (savedIndicatorTimeoutRef.current) clearTimeout(savedIndicatorTimeoutRef.current)

    debounceTimeoutRef.current = setTimeout(() => {
      void onNotesSave(notification.id, nextNotes)
        .then(() => {
          setDraftNotes(null)
          setSaveState('saved')
          savedIndicatorTimeoutRef.current = setTimeout(() => {
            setSaveState('idle')
          }, 1200)
        })
        .catch(() => {
          setSaveState('error')
        })
    }, 500)
  }

  return (
    <div className="rounded-lg border border-transparent p-2 transition-colors hover:border-surface-border/30 hover:bg-surface-muted/30">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span>{TYPE_ICONS[notification.type] ?? TYPE_ICONS.other}</span>
            <span className="min-w-0 truncate text-text-secondary">{notification.repository}</span>
            <span>·</span>
            <span>{formatRelativeTime(notification.updatedAt, now)}</span>
            {notification.unread && (
              <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary uppercase">
                unread
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => window.open(notification.url, '_blank')}
            className="text-text-primary mt-1 block text-left text-sm font-medium transition-colors hover:text-primary"
          >
            {notification.title}
          </button>
          {!notesExpanded && notesPreview && (
            <div className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
              <span>📝</span>
              <span className="truncate">{notesPreview}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <label className="flex items-center gap-1 rounded-md border border-surface-border/40 bg-background/20 px-2 py-1 text-xs text-text-secondary">
            <span className={STATUS_COLOR_CLASSES[triage.status]}>●</span>
            <select
              value={triage.status}
              onChange={(e) => void onStatusChange(notification.id, e.target.value as TriageStatus)}
              className="bg-transparent text-xs text-text-secondary outline-none"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.icon} {TRIAGE_STATUS_LABELS[option.value]}
                </option>
              ))}
            </select>
          </label>

          <select
            value={triage.priority}
            onChange={(e) =>
              void onPriorityChange(notification.id, Number(e.target.value) as TriagePriority)
            }
            className={`rounded-md border border-transparent px-1.5 py-1 text-xs font-medium outline-none ${priorityOption.className}`}
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setNotesExpanded((current) => !current)}
            className="text-text-secondary hover:text-text-primary rounded-md border border-surface-border/40 px-2 py-1 text-xs transition-colors"
            title={notesExpanded ? 'Hide notes' : 'Edit notes'}
          >
            📝
          </button>

          <button
            type="button"
            onClick={() => void onAddToTodo(notification)}
            className="text-text-secondary hover:text-primary rounded-md border border-surface-border/40 px-2 py-1 text-xs transition-colors"
            title="Add to To Do board"
          >
            ☐ To Do
          </button>

          {notification.unread && (
            <button
              type="button"
              onClick={() => void onMarkAsRead(notification.id)}
              className="text-text-secondary hover:text-text-primary rounded-md border border-surface-border/40 px-2 py-1 text-xs transition-colors"
              title="Mark as read"
            >
              ✓ Read
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {notesExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex items-start gap-2">
              <span className="pt-1 text-xs">📝</span>
              <div className="min-w-0 flex-1">
                <textarea
                  value={notesValue}
                  onChange={(e) => scheduleNotesSave(e.target.value)}
                  rows={2}
                  placeholder="Add triage notes..."
                  className="text-xs bg-transparent border-b border-dashed border-border text-text-secondary placeholder:text-text-muted w-full resize-none outline-none"
                />
                <div className="mt-1 text-[11px] text-text-muted">
                  {saveState === 'saving' && 'saving...'}
                  {saveState === 'saved' && 'saved ✓'}
                  {saveState === 'error' && 'save failed'}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function NotificationsPanel(): React.ReactElement {
  const {
    notifications,
    triageData,
    actionableCount,
    isConfigured,
    isLoading,
    triageLoading,
    error,
    initialize,
    fetchNotifications,
    markAsRead,
    setPAT,
    setTriageNotes,
    setTriagePriority,
    setTriageStatus
  } = useGitHubStore()

  const [patInput, setPATInput] = useState('')
  const [showPATInput, setShowPATInput] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [activeFilter, setActiveFilter] = useState<TriageFilter>('all')
  const [showDoneDismissed, setShowDoneDismissed] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [isExpanded, setIsExpanded] = useState(false)
  const addKanbanTask = useKanbanStore((s) => s.addTask)

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (!isConfigured) return

    const interval = setInterval(
      () => {
        void fetchNotifications()
        setNow(Date.now())
      },
      5 * 60 * 1000
    )

    return () => clearInterval(interval)
  }, [isConfigured, fetchNotifications])

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  const handleSavePAT = async (): Promise<void> => {
    if (!patInput.trim()) return
    await setPAT(patInput.trim())
    setPATInput('')
    setShowPATInput(false)
  }

  const handleAddToTodo = useCallback(
    async (notification: GitHubNotification) => {
      await addKanbanTask(notification.title, 'triage', notification.id, notification.url)
    },
    [addKanbanTask]
  )

  const notificationItems = useMemo<NotificationWithTriage[]>(() => {
    return notifications.map((notification) => ({
      notification,
      triage: triageData[notification.id] ?? getDefaultTriage(notification)
    }))
  }, [notifications, triageData])

  const activeItems = useMemo(() => {
    return notificationItems.filter(
      (item) => item.triage.status !== 'done' && item.triage.status !== 'dismissed'
    )
  }, [notificationItems])

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') {
      return [...activeItems].sort((a, b) => compareNotifications(a, b))
    }

    return activeItems
      .filter((item) => item.triage.status === activeFilter)
      .sort((a, b) => compareNotifications(a, b))
  }, [activeFilter, activeItems])

  const activeGroups = useMemo(() => groupByPriority(filteredItems), [filteredItems])

  const doneDismissedGroups = useMemo(() => {
    const items = notificationItems.filter(
      (item) => item.triage.status === 'done' || item.triage.status === 'dismissed'
    )
    return groupByPriority(items)
  }, [notificationItems])

  if (!isConfigured) {
    return (
      <section className="rounded-xl border border-surface-border/60 bg-surface-secondary/30 p-4">
        <h2 className="text-text-primary mb-3 text-sm font-semibold tracking-wide uppercase">
          GitHub Notifications
        </h2>
        <div className="flex flex-col items-center gap-3 py-4">
          <p className="text-text-secondary text-center text-sm">
            Connect GitHub to see review requests, mentions, and assignments.
          </p>
          {showPATInput ? (
            <div className="flex w-full max-w-sm flex-col gap-2">
              <input
                type="password"
                value={patInput}
                onChange={(e) => setPATInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSavePAT()}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSavePAT}
                  disabled={isLoading || !patInput.trim()}
                  className="bg-primary hover:bg-primary/90 disabled:bg-primary/50 flex-1 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors"
                >
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setShowPATInput(false)}
                  className="text-text-secondary hover:text-text-primary rounded-lg px-3 py-1.5 text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
              <p className="text-text-tertiary text-xs">
                Create a PAT at github.com/settings/tokens with{' '}
                <code className="text-text-secondary">notifications</code> and{' '}
                <code className="text-text-secondary">repo</code> scopes.
              </p>
            </div>
          ) : (
            <button
              onClick={() => setShowPATInput(true)}
              className="bg-primary hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              Connect GitHub
            </button>
          )}
          {error && <p className="text-urgent text-xs">{error}</p>}
        </div>
      </section>
    )
  }

  if ((isLoading || triageLoading) && notifications.length === 0) {
    return (
      <section className="rounded-xl border border-surface-border/60 bg-surface-secondary/30 p-4">
        <h2 className="text-text-primary mb-3 text-sm font-semibold tracking-wide uppercase">
          GitHub Triage
        </h2>
        <Skeleton lines={5} />
      </section>
    )
  }

  const panelContent = (
    <section
      className={`overflow-hidden rounded-xl border border-surface-border/60 bg-surface-secondary/30 p-4 ${isExpanded ? 'h-full flex flex-col' : ''}`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-text-primary text-sm font-semibold tracking-wide uppercase">
            GitHub Triage
          </h2>
          {actionableCount > 0 && (
            <span className="rounded-full bg-urgent/20 px-2 py-0.5 text-xs font-semibold text-urgent">
              {actionableCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-text-tertiary hover:text-text-secondary text-xs transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '⊟' : '⊞'}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-text-tertiary hover:text-text-secondary text-xs transition-colors"
            title="Change token"
          >
            ⚙
          </button>
          <button
            onClick={() => {
              void fetchNotifications()
              setNow(Date.now())
            }}
            className="text-text-tertiary hover:text-text-secondary text-xs transition-colors"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="mb-3 flex items-center gap-2">
          <input
            type="password"
            value={patInput}
            onChange={(e) => setPATInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSavePAT()}
            placeholder="New classic PAT (notifications scope)"
            className="flex-1 rounded-lg border border-surface-border bg-background px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
            autoFocus
          />
          <button
            onClick={handleSavePAT}
            disabled={!patInput.trim()}
            className="bg-primary hover:bg-primary/90 disabled:bg-primary/50 rounded-lg px-2 py-1 text-xs font-medium text-white transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => {
              setShowSettings(false)
              setPATInput('')
            }}
            className="text-text-tertiary hover:text-text-secondary text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {isExpanded && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-text-tertiary text-xs font-medium uppercase">Filter:</span>
          {FILTER_OPTIONS.map((filter) => {
            const isActive = activeFilter === filter.value
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                className={`relative overflow-hidden rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-primary/40 text-primary'
                    : 'border-surface-border/40 text-text-secondary hover:bg-surface-muted/30'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="filter-active"
                    className="absolute inset-0 rounded-full border border-primary/40 bg-primary/20"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">{filter.label}</span>
              </button>
            )
          })}
          {triageLoading && <span className="text-text-muted text-[11px]">syncing triage...</span>}
        </div>
      )}

      {error && <p className="text-urgent mb-2 text-xs">{error}</p>}

      {notifications.length === 0 ? (
        <div className="text-text-tertiary py-3 text-center text-sm">All caught up! 🎉</div>
      ) : !isExpanded ? (
        /* ─── Compact view: simple list for the sidebar ─── */
        <div className="max-h-[300px] space-y-1 overflow-y-auto pr-1">
          {(() => {
            const active = notificationItems
              .filter((item) => item.triage.status !== 'done' && item.triage.status !== 'dismissed')
              .sort((a, b) => compareNotifications(a, b))
            const doneCount = notificationItems.length - active.length
            return (
              <>
                {active.slice(0, 15).map((item) => (
                  <button
                    key={item.notification.id}
                    type="button"
                    onClick={() => setIsExpanded(true)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-muted/30"
                  >
                    <span className={`text-[10px] ${STATUS_COLOR_CLASSES[item.triage.status]}`}>
                      ●
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-text-primary">
                      {item.notification.title}
                    </span>
                    {item.triage.priority > 0 && (
                      <span
                        className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-medium ${getPriorityOption(item.triage.priority).className}`}
                      >
                        P{item.triage.priority}
                      </span>
                    )}
                  </button>
                ))}
                {active.length > 15 && (
                  <button
                    type="button"
                    onClick={() => setIsExpanded(true)}
                    className="w-full py-1 text-center text-xs text-text-muted hover:text-primary"
                  >
                    +{active.length - 15} more
                  </button>
                )}
                {doneCount > 0 && (
                  <div className="mt-1 border-t border-surface-border/30 pt-1 text-center text-[11px] text-text-muted">
                    {doneCount} done/dismissed
                  </div>
                )}
              </>
            )
          })()}
        </div>
      ) : (
        <div className={`overflow-y-auto pr-1 ${isExpanded ? 'flex-1' : 'max-h-[600px]'}`}>
          <div className="space-y-4">
            {activeGroups.length === 0 ? (
              <div className="text-text-tertiary rounded-lg border border-dashed border-surface-border/40 py-4 text-center text-sm">
                No active items for this filter.
              </div>
            ) : (
              activeGroups.map((group) => (
                <div key={group.priority}>
                  <div className="text-text-primary mb-2 flex items-center justify-between text-sm font-semibold">
                    <span>{group.option.groupLabel}</span>
                    <span className="text-text-muted text-xs">({group.items.length})</span>
                  </div>
                  <div className="space-y-1">
                    <AnimatePresence>
                      {group.items.map((item) => (
                        <motion.div
                          key={item.notification.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          className="overflow-hidden"
                        >
                          <TriageNotificationRow
                            item={item}
                            now={now}
                            onMarkAsRead={markAsRead}
                            onStatusChange={setTriageStatus}
                            onPriorityChange={setTriagePriority}
                            onNotesSave={setTriageNotes}
                            onAddToTodo={handleAddToTodo}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              ))
            )}

            {doneDismissedGroups.length > 0 && (
              <div className="border-t border-surface-border/40 pt-3">
                <button
                  type="button"
                  onClick={() => setShowDoneDismissed((current) => !current)}
                  className="text-text-primary flex w-full items-center justify-between text-sm font-semibold"
                >
                  <span>{showDoneDismissed ? '▼' : '▸'} Done / Dismissed</span>
                  <span className="text-text-muted text-xs">
                    ({doneDismissedGroups.reduce((count, group) => count + group.items.length, 0)})
                  </span>
                </button>

                <AnimatePresence>
                  {showDoneDismissed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 space-y-4">
                        {doneDismissedGroups.map((group) => (
                          <div key={`done-${group.priority}`}>
                            <div className="text-text-tertiary mb-2 text-xs font-medium uppercase">
                              {group.option.groupLabel}
                            </div>
                            <div className="space-y-1">
                              <AnimatePresence>
                                {group.items.map((item) => (
                                  <motion.div
                                    key={item.notification.id}
                                    layout
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                    className="overflow-hidden"
                                  >
                                    <TriageNotificationRow
                                      item={item}
                                      now={now}
                                      onMarkAsRead={markAsRead}
                                      onStatusChange={setTriageStatus}
                                      onPriorityChange={setTriagePriority}
                                      onNotesSave={setTriageNotes}
                                      onAddToTodo={handleAddToTodo}
                                    />
                                  </motion.div>
                                ))}
                              </AnimatePresence>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )

  return (
    <>
      {!isExpanded && panelContent}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            key="triage-expanded"
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsExpanded(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="relative mx-6 my-6 flex h-[calc(100vh-48px)] w-full max-w-4xl flex-col"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            >
              {panelContent}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
