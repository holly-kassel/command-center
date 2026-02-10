/**
 * NotificationItem Component
 *
 * A single GitHub notification with reason-based styling,
 * click-to-open, and mark-as-read button.
 */
import type { GitHubNotification, NotificationReason } from '@shared/types/github'
import { memo } from 'react'

interface NotificationItemProps {
  notification: GitHubNotification
  onMarkAsRead: (id: string) => void
}

const REASON_CONFIG: Record<
  NotificationReason,
  { label: string; icon: string; colorClass: string }
> = {
  review_requested: {
    label: 'Review',
    icon: '👀',
    colorClass: 'text-warning bg-warning/10 border-warning/30',
  },
  mention: {
    label: 'Mention',
    icon: '@',
    colorClass: 'text-primary bg-primary/10 border-primary/30',
  },
  assign: {
    label: 'Assigned',
    icon: '✓',
    colorClass: 'text-focus bg-focus/10 border-focus/30',
  },
  team_mention: {
    label: 'Team',
    icon: '👥',
    colorClass: 'text-accent bg-accent/10 border-accent/30',
  },
  subscribed: {
    label: 'Subscribed',
    icon: '🔔',
    colorClass: 'text-text-secondary bg-surface-secondary/50 border-surface-border',
  },
  comment: {
    label: 'Comment',
    icon: '💬',
    colorClass: 'text-primary bg-primary/10 border-primary/30',
  },
  ci_activity: {
    label: 'CI',
    icon: '⚙️',
    colorClass: 'text-text-secondary bg-surface-secondary/50 border-surface-border',
  },
  approval_requested: {
    label: 'Approval',
    icon: '✅',
    colorClass: 'text-warning bg-warning/10 border-warning/30',
  },
  state_change: {
    label: 'Changed',
    icon: '🔄',
    colorClass: 'text-focus bg-focus/10 border-focus/30',
  },
  other: {
    label: 'Other',
    icon: '•',
    colorClass: 'text-text-secondary bg-surface-secondary border-surface-border',
  },
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export const NotificationItem = memo(function NotificationItem({
  notification,
  onMarkAsRead,
}: NotificationItemProps): React.ReactElement {
  const config = REASON_CONFIG[notification.reason] || REASON_CONFIG.other

  return (
    <div
      className={`group flex items-start gap-2 rounded-lg border px-2.5 py-1.5 transition-colors hover:bg-surface-secondary/50 cursor-pointer ${
        notification.unread
          ? 'border-surface-border/60 bg-surface-secondary/20'
          : 'border-surface-border/30 opacity-60'
      }`}
      onClick={() => window.open(notification.url, '_blank')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') window.open(notification.url, '_blank')
      }}
    >
      {/* Reason badge */}
      <span
        className={`mt-0.5 flex-shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${config.colorClass}`}
      >
        {config.icon} {config.label}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="text-text-tertiary text-xs">{notification.repository}</div>
        <div className="text-text-primary mt-0.5 truncate text-sm">{notification.title}</div>
        <div className="text-text-tertiary mt-0.5 text-xs">{timeAgo(notification.updatedAt)}</div>
      </div>

      {/* Mark as read */}
      {notification.unread && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMarkAsRead(notification.id)
          }}
          className="text-text-tertiary hover:text-focus flex-shrink-0 opacity-0 transition-all group-hover:opacity-100"
          title="Mark as read"
        >
          ✓
        </button>
      )}
    </div>
  )
})