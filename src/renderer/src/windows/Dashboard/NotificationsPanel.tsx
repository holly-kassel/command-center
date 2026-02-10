/**
 * NotificationsPanel Component
 *
 * Shows actionable GitHub notifications grouped by reason.
 * Includes PAT setup flow and auto-refresh.
 */
import { useEffect, useState } from 'react'
import { useGitHubStore } from '../../store/githubStore'
import { NotificationItem } from './NotificationItem'
import type { GitHubNotification, NotificationReason } from '@shared/types/github'

const REASON_ORDER: NotificationReason[] = [
  'review_requested',
  'approval_requested',
  'assign',
  'mention',
  'team_mention',
  'comment',
  'ci_activity',
  'state_change',
  'subscribed',
  'other',
]

const REASON_LABELS: Record<NotificationReason, string> = {
  review_requested: 'Review Requests',
  approval_requested: 'Approvals',
  mention: 'Mentions',
  assign: 'Assignments',
  team_mention: 'Team Mentions',
  comment: 'Comments',
  ci_activity: 'CI/CD',
  state_change: 'State Changes',
  subscribed: 'Subscribed',
  other: 'Other',
}

function groupByReason(
  notifications: GitHubNotification[]
): Map<NotificationReason, GitHubNotification[]> {
  const groups = new Map<NotificationReason, GitHubNotification[]>()
  for (const n of notifications) {
    const existing = groups.get(n.reason) || []
    existing.push(n)
    groups.set(n.reason, existing)
  }
  return groups
}

export function NotificationsPanel(): React.ReactElement {
  const {
    notifications,
    actionableCount,
    isConfigured,
    isLoading,
    error,
    initialize,
    fetchNotifications,
    markAsRead,
    setPAT,
  } = useGitHubStore()

  const [patInput, setPATInput] = useState('')
  const [showPATInput, setShowPATInput] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Init on mount
  useEffect(() => {
    initialize()
  }, [initialize])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!isConfigured) return

    const interval = setInterval(() => {
      fetchNotifications()
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [isConfigured, fetchNotifications])

  const handleSavePAT = async (): Promise<void> => {
    if (!patInput.trim()) return
    await setPAT(patInput.trim())
    setPATInput('')
    setShowPATInput(false)
  }

  // ─── Not configured ────────────────────────────────────────────
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

  // ─── Loading ───────────────────────────────────────────────────
  if (isLoading && notifications.length === 0) {
    return (
      <section className="rounded-xl border border-surface-border/60 bg-surface-secondary/30 p-4">
        <h2 className="text-text-primary mb-3 text-sm font-semibold tracking-wide uppercase">
          GitHub Notifications
        </h2>
        <div className="text-text-secondary animate-pulse py-4 text-center text-sm">
          Loading notifications...
        </div>
      </section>
    )
  }

  // ─── Configured ────────────────────────────────────────────────
  const groups = groupByReason(notifications)

  return (
    <section className="rounded-xl border border-surface-border/60 bg-surface-secondary/30 p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-text-primary text-sm font-semibold tracking-wide uppercase">
            GitHub Notifications
          </h2>
          {actionableCount > 0 && (
            <span className="bg-urgent/20 text-urgent rounded-full px-2 py-0.5 text-xs font-semibold">
              {actionableCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-text-tertiary hover:text-text-secondary text-xs transition-colors"
            title="Change token"
          >
            ⚙
          </button>
          <button
            onClick={fetchNotifications}
            className="text-text-tertiary hover:text-text-secondary text-xs transition-colors"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Inline PAT update */}
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
            onClick={() => { setShowSettings(false); setPATInput('') }}
            className="text-text-tertiary hover:text-text-secondary text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {error && <p className="text-urgent mb-2 text-xs">{error}</p>}

      {notifications.length === 0 ? (
        <div className="text-text-tertiary py-3 text-center text-sm">
          All caught up! 🎉
        </div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto space-y-3 pr-1">
          {REASON_ORDER.map((reason) => {
            const items = groups.get(reason)
            if (!items || items.length === 0) return null
            return (
              <div key={reason}>
                <div className="text-text-tertiary mb-1 text-xs font-medium uppercase">
                  {REASON_LABELS[reason]}
                </div>
                <div className="space-y-1">
                  {items.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={markAsRead}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
