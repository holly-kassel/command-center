/**
 * PullRequestsPanel Component
 *
 * Shows open PRs involving the user, grouped by involvement type.
 * Click to open in browser, auto-refreshes with notifications.
 */
import { useEffect, useMemo } from 'react'
import { useGitHubStore } from '../../store/githubStore'
import { Skeleton } from '../../components/ui/Skeleton'
import type { GitHubPullRequest, PRInvolvement } from '@shared/types/github'
import { memo } from 'react'

const INVOLVEMENT_ORDER: PRInvolvement[] = [
  'review_requested',
  'assigned',
  'mentioned',
  'author',
]

const INVOLVEMENT_LABELS: Record<PRInvolvement, string> = {
  review_requested: 'Review Requested',
  assigned: 'Assigned',
  mentioned: 'Mentioned',
  author: 'Authored',
}

const INVOLVEMENT_ICONS: Record<PRInvolvement, string> = {
  review_requested: '👀',
  assigned: '✓',
  mentioned: '@',
  author: '✍️',
}

function groupByInvolvement(
  prs: GitHubPullRequest[]
): Map<PRInvolvement, GitHubPullRequest[]> {
  const groups = new Map<PRInvolvement, GitHubPullRequest[]>()
  for (const pr of prs) {
    const existing = groups.get(pr.involvement) || []
    existing.push(pr)
    groups.set(pr.involvement, existing)
  }
  return groups
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

function repoShortName(fullName: string): string {
  // "github/billing-platform" → "billing-platform"
  const parts = fullName.split('/')
  return parts.length > 1 ? parts[parts.length - 1] : fullName
}

const PRItem = memo(function PRItem({
  pr,
}: {
  pr: GitHubPullRequest
}): React.ReactElement {
  return (
    <div
      className="group flex items-start gap-2 rounded-lg border border-surface-border/60 bg-surface-secondary/20
                 px-2.5 py-1.5 transition-colors hover:bg-surface-secondary/50 cursor-pointer"
      onClick={() => window.open(pr.url, '_blank')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') window.open(pr.url, '_blank')
      }}
    >
      {/* State indicator */}
      <span
        className={`mt-1 flex-shrink-0 h-2 w-2 rounded-full ${
          pr.draft
            ? 'bg-text-muted'
            : pr.state === 'merged'
              ? 'bg-accent'
              : pr.state === 'closed'
                ? 'bg-urgent'
                : 'bg-focus'
        }`}
        title={pr.draft ? 'Draft' : pr.state}
      />

      {/* Content */}
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-text-tertiary">{repoShortName(pr.repository)}</span>
          <span className="text-text-muted">#{pr.number}</span>
          {pr.draft && (
            <span className="text-text-muted italic">draft</span>
          )}
        </div>
        <div className="text-text-primary mt-0.5 text-sm truncate break-all">
          {pr.title}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-tertiary">
          <span>{pr.author}</span>
          <span>·</span>
          <span>{timeAgo(pr.updatedAt)}</span>
        </div>
      </div>
    </div>
  )
})

export function PullRequestsPanel(): React.ReactElement {
  const {
    pullRequests,
    isPRsLoading,
    isConfigured,
    fetchPullRequests,
  } = useGitHubStore()

  // Refresh PRs on mount and every 5 minutes
  useEffect(() => {
    if (!isConfigured) return

    fetchPullRequests()
    const interval = setInterval(fetchPullRequests, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [isConfigured, fetchPullRequests])

  const groups = useMemo(() => groupByInvolvement(pullRequests), [pullRequests])

  if (!isConfigured) {
    return (
      <section className="rounded-xl border border-surface-border/60 bg-surface-secondary/30 p-4">
        <h2 className="text-text-primary mb-3 text-sm font-semibold tracking-wide uppercase">
          Pull Requests
        </h2>
        <p className="text-text-tertiary text-center text-sm py-3">
          Connect GitHub to see your pull requests.
        </p>
      </section>
    )
  }

  if (isPRsLoading && pullRequests.length === 0) {
    return (
      <section className="rounded-xl border border-surface-border/60 bg-surface-secondary/30 p-4">
        <h2 className="text-text-primary mb-3 text-sm font-semibold tracking-wide uppercase">
          Pull Requests
        </h2>
        <Skeleton lines={4} />
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-surface-border/60 bg-surface-secondary/30 p-4 overflow-hidden">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-text-primary text-sm font-semibold tracking-wide uppercase">
            Pull Requests
          </h2>
          {pullRequests.length > 0 && (
            <span className="bg-focus/20 text-focus rounded-full px-2 py-0.5 text-xs font-semibold">
              {pullRequests.length}
            </span>
          )}
        </div>
        <button
          onClick={fetchPullRequests}
          className="text-text-tertiary hover:text-text-secondary text-xs transition-colors"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {pullRequests.length === 0 ? (
        <div className="text-text-tertiary py-3 text-center text-sm">
          No open PRs — nice! 🎉
        </div>
      ) : (
        <div className="max-h-[600px] overflow-y-auto space-y-3 pr-1">
          {INVOLVEMENT_ORDER.map((involvement) => {
            const items = groups.get(involvement)
            if (!items || items.length === 0) return null
            return (
              <div key={involvement}>
                <div className="text-text-tertiary mb-1 text-xs font-medium uppercase">
                  {INVOLVEMENT_ICONS[involvement]} {INVOLVEMENT_LABELS[involvement]}
                </div>
                <div className="space-y-1">
                  {items.map((pr) => (
                    <PRItem key={pr.id} pr={pr} />
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
