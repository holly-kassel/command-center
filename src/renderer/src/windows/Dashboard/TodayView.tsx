/**
 * TodayView
 *
 * Displays today's section from the weekly note with
 * rendered markdown content and current focus indicator.
 */
import ReactMarkdown from 'react-markdown'
import { useObsidianStore } from '../../store/obsidianStore'

export function TodayView(): React.JSX.Element {
  const { todaySection, currentFocus, isLoading, error, vaultStatus } = useObsidianStore()

  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-surface-muted rounded w-1/3 mb-3"></div>
        <div className="h-3 bg-surface-muted rounded w-2/3 mb-2"></div>
        <div className="h-3 bg-surface-muted rounded w-1/2"></div>
      </div>
    )
  }

  if (!vaultStatus?.found) {
    return (
      <div className="card border-2 border-dashed border-border">
        <h3 className="text-lg font-semibold text-text-primary mb-2">No vault found</h3>
        <p className="text-text-secondary text-sm">
          Could not find an Obsidian vault. Make sure your vault is at{' '}
          <code className="text-xs bg-surface-muted px-1.5 py-0.5 rounded font-mono">
            ~/Documents/obsidian-notes/
          </code>
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card border border-urgent/20 bg-urgent-light/30">
        <p className="text-urgent text-sm">{error}</p>
      </div>
    )
  }

  if (!todaySection) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-text-primary mb-2">No notes for today</h3>
        <p className="text-text-secondary text-sm">
          No section found for today in the current weekly note. It might be the weekend, or the
          weekly note hasn&apos;t been created yet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with day name and focus */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-primary">
          {todaySection.dayOfWeek}
          <span className="text-text-muted font-normal text-sm ml-2">{todaySection.date}</span>
        </h2>
        {currentFocus && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning-light text-warning text-xs font-medium">
            🔔 {currentFocus}
          </span>
        )}
      </div>

      {/* Today's content rendered as markdown */}
      <div className="card">
        <div className="prose prose-sm max-w-none text-text-primary prose-headings:text-text-primary prose-a:text-primary">
          <ReactMarkdown>{todaySection.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
