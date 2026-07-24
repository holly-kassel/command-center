/**
 * TranscriptsPanel Component
 *
 * Dashboard card listing saved meeting transcripts.
 * Click to view full transcript, search within it, view summary,
 * and add the summary to today's weekly notes.
 */
import { useEffect, useState, useMemo, useCallback, memo } from 'react'
import { formatMeetingForWeekly } from '@shared/formatMeetingMarkdown'
import { useMeetingStore } from '../../store/meetingStore'
import type {
  SavedMeeting,
  MeetingNotes,
  EvaluatedDecision,
  DecisionConfidence,
  MeetingActionItem
} from '@shared/types/transcription'

const CONFIDENCE_CONFIG: Record<
  DecisionConfidence,
  { icon: string; color: string; label: string }
> = {
  confirmed: {
    icon: '✅',
    color: 'text-green-400 bg-green-500/10 border-green-500/20',
    label: 'Confirmed'
  },
  'potentially-outdated': {
    icon: '⚠️',
    color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    label: 'Potentially Outdated'
  },
  contradicted: {
    icon: '❌',
    color: 'text-red-400 bg-red-500/10 border-red-500/20',
    label: 'Contradicted'
  },
  unverifiable: {
    icon: '❓',
    color: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
    label: 'Unverifiable'
  }
}

// ─── Helpers ──────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s > 0 ? `${s}s` : ''}`
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatTime(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })
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

/** Highlight search matches in text */
function highlightText(text: string, query: string): React.ReactNode[] {
  if (!query.trim()) return [text]

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-amber-400/30 text-amber-200 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

// ─── Sub-components ───────────────────────────────────────────

const TranscriptListItem = memo(function TranscriptListItem({
  meeting,
  isSelected,
  onClick
}: {
  meeting: SavedMeeting
  isSelected: boolean
  onClick: () => void
}): React.ReactElement {
  const activeArtifact = meeting.transcriptArtifacts[meeting.activeTranscriptSource]
  return (
    <div
      className={`group flex items-start gap-2 rounded-lg border px-2.5 py-1.5 transition-colors cursor-pointer
        ${
          isSelected
            ? 'border-focus/40 bg-focus/10'
            : 'border-surface-border/60 bg-surface-secondary/20 hover:bg-surface-secondary/50'
        }`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick()
      }}
    >
      <span className="mt-1 flex-shrink-0 text-xs">📝</span>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="text-text-primary text-sm truncate break-all">{meeting.title}</div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-tertiary">
          <span>{formatDate(meeting.createdAt)}</span>
          <span>·</span>
          <span>{formatDuration(meeting.duration)}</span>
          {meeting.speakers.length > 0 && (
            <>
              <span>·</span>
              <span>
                {meeting.speakers.length} speaker{meeting.speakers.length !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-1 text-[9px]">
          <span
            className={
              meeting.activeTranscriptSource === 'teams'
                ? 'rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-400'
                : 'rounded bg-surface-muted px-1.5 py-0.5 text-text-muted'
            }
          >
            {meeting.activeTranscriptSource === 'teams' ? 'Teams' : 'Local mic'}
          </span>
          <span
            className={
              activeArtifact?.attribution === 'verified'
                ? 'rounded bg-green-500/10 px-1.5 py-0.5 text-green-400'
                : 'rounded bg-yellow-500/10 px-1.5 py-0.5 text-yellow-400'
            }
          >
            {activeArtifact?.attribution === 'verified' ? 'Names verified' : 'Names unverified'}
          </span>
          {meeting.teamsSync.status === 'pending' && (
            <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-400">
              Teams sync pending
            </span>
          )}
          {meeting.teamsSync.status === 'error' && (
            <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-400">
              Teams sync failed
            </span>
          )}
          {meeting.teamsSync.status === 'available' &&
            meeting.teamsSync.summaryStatus !== 'available' && (
              <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-purple-400">
                Final summary {meeting.teamsSync.summaryStatus}
              </span>
            )}
        </div>
      </div>
      <span className="text-[10px] text-text-muted mt-0.5 flex-shrink-0">
        {timeAgo(meeting.updatedAt)}
      </span>
    </div>
  )
})

function SavedActionItemRow({
  item,
  onReview
}: {
  item: MeetingActionItem
  onReview?: (id: string, status: 'accepted' | 'dismissed') => void
}): React.ReactElement {
  const [showEvidence, setShowEvidence] = useState(false)
  return (
    <li className="rounded-md border border-surface-border bg-surface-muted/20 p-2 text-xs text-text-primary">
      <div className="flex gap-1.5">
        <span className={item.reviewStatus === 'accepted' ? 'text-focus' : 'text-yellow-400'}>
          ☐
        </span>
        <div className="min-w-0 flex-1">
          <p>{item.description}</p>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-text-muted">
            {item.owner && <span>{item.owner.displayName}</span>}
            {item.dueDate && <span>Due {item.dueDate}</span>}
            <button
              onClick={() => setShowEvidence((shown) => !shown)}
              className="text-focus hover:underline"
            >
              {showEvidence ? 'Hide evidence' : 'Show evidence'}
            </button>
          </div>
          {showEvidence && (
            <blockquote className="mt-1 border-l-2 border-focus/30 pl-2 italic text-text-muted">
              “{item.evidence.quote}”
            </blockquote>
          )}
        </div>
      </div>
      {item.reviewStatus === 'needs-review' && onReview && (
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={() => onReview(item.id, 'dismissed')}
            className="text-[11px] text-text-muted hover:text-red-400"
          >
            Dismiss
          </button>
          <button
            onClick={() => onReview(item.id, 'accepted')}
            className="rounded bg-focus/20 px-2 py-1 text-[11px] text-focus"
          >
            Accept
          </button>
        </div>
      )}
    </li>
  )
}

function MeetingNotesView({
  notes,
  evaluatedDecisions,
  isEvaluating,
  onReviewAction
}: {
  notes: MeetingNotes
  evaluatedDecisions?: EvaluatedDecision[]
  isEvaluating?: boolean
  onReviewAction?: (id: string, status: 'accepted' | 'dismissed') => void
}): React.ReactElement {
  const [expandedDecision, setExpandedDecision] = useState<number | null>(null)
  const hasEvals = (evaluatedDecisions?.length ?? 0) > 0
  const personalActionIds = new Set(notes.myActionItems.map((item) => item.id))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 text-[10px]">
        <span className="rounded bg-surface-muted px-1.5 py-0.5 text-text-muted">
          {notes.metadata.model}
        </span>
        <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-400">
          {notes.metadata.transcriptSource === 'teams' ? 'Teams transcript' : 'Local transcript'}
        </span>
      </div>
      {notes.summary && (
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1">
            Summary
          </h4>
          <p className="text-sm text-text-primary leading-relaxed">{notes.summary}</p>
        </div>
      )}
      {notes.keyTopics.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1">
            Key Topics
          </h4>
          <div className="flex flex-wrap gap-1">
            {notes.keyTopics.map((topic, i) => (
              <span
                key={i}
                className="inline-block rounded-full bg-accent/15 text-accent px-2 py-0.5 text-xs"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}
      {notes.keyPoints.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1">
            Key Points
          </h4>
          <ul className="space-y-1">
            {notes.keyPoints.map((point, i) => (
              <li key={i} className="text-sm text-text-primary flex gap-1.5">
                <span className="text-focus flex-shrink-0">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {notes.myActionItems && notes.myActionItems.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-focus uppercase tracking-wide mb-1">
            My Action Items
          </h4>
          <ul className="space-y-1">
            {notes.myActionItems
              .filter((item) => item.reviewStatus !== 'dismissed')
              .map((item) => (
                <SavedActionItemRow key={item.id} item={item} onReview={onReviewAction} />
              ))}
          </ul>
        </div>
      )}
      {notes.actionItems.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1">
            {notes.myActionItems && notes.myActionItems.length > 0
              ? 'Other Action Items'
              : 'Action Items'}
          </h4>
          <ul className="space-y-1">
            {notes.actionItems
              .filter(
                (item) => item.reviewStatus !== 'dismissed' && !personalActionIds.has(item.id)
              )
              .map((item) => (
                <SavedActionItemRow key={item.id} item={item} onReview={onReviewAction} />
              ))}
          </ul>
        </div>
      )}
      {notes.suggestedFollowUps.some((item) => item.reviewStatus !== 'dismissed') && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-yellow-400">
            Suggested follow-ups
          </h4>
          <p className="mb-1.5 text-[11px] text-text-muted">
            Review these implied follow-ups before they are exported.
          </p>
          <ul className="space-y-1">
            {notes.suggestedFollowUps
              .filter((item) => item.reviewStatus !== 'dismissed')
              .map((item) => (
                <SavedActionItemRow key={item.id} item={item} onReview={onReviewAction} />
              ))}
          </ul>
        </div>
      )}
      {notes.decisions && notes.decisions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1 flex items-center gap-2">
            Decisions
            {isEvaluating && (
              <span className="inline-flex items-center gap-1 text-[10px] text-text-muted font-normal normal-case tracking-normal">
                <span className="w-3 h-3 border border-focus/50 border-t-transparent rounded-full animate-spin" />
                verifying…
              </span>
            )}
          </h4>
          <ul className="space-y-2">
            {notes.decisions.map((decision, i) => {
              const evalData = hasEvals ? evaluatedDecisions![i] : null
              const config = evalData ? CONFIDENCE_CONFIG[evalData.confidence] : null
              const isExpanded = expandedDecision === i

              return (
                <li key={i} className="text-sm text-text-primary">
                  <div className="flex gap-1.5">
                    {config ? (
                      <button
                        onClick={() => setExpandedDecision(isExpanded ? null : i)}
                        className="flex-shrink-0 mt-0.5 cursor-pointer"
                        title={`${config.label} — click for details`}
                      >
                        <span>{config.icon}</span>
                      </button>
                    ) : (
                      <span className="text-green-400 flex-shrink-0">✓</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <span>{decision}</span>
                      {config && (
                        <button
                          onClick={() => setExpandedDecision(isExpanded ? null : i)}
                          className={`ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-pointer ${config.color}`}
                        >
                          {config.label}
                        </button>
                      )}
                    </div>
                  </div>
                  {isExpanded && evalData && (
                    <div className={`mt-1.5 ml-6 p-2 rounded-lg border text-xs ${config!.color}`}>
                      <p className="leading-relaxed">{evalData.annotation}</p>
                      {evalData.sources.length > 0 && (
                        <div className="mt-1 pt-1 border-t border-current/10">
                          <span className="font-medium">Sources: </span>
                          {evalData.sources.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {notes.openQuestions && notes.openQuestions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1">
            Open Questions
          </h4>
          <ul className="space-y-1">
            {notes.openQuestions.map((question, i) => (
              <li key={i} className="text-sm text-text-primary flex gap-1.5">
                <span className="text-blue-400 flex-shrink-0">?</span>
                <span>{question}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function TranscriptDetailView({
  meeting,
  onBack
}: {
  meeting: SavedMeeting
  onBack: () => void
}): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary'>('transcript')
  const [addStatus, setAddStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [regenStatus, setRegenStatus] = useState<
    'idle' | 'summarizing' | 'evaluating' | 'done' | 'error'
  >('idle')
  const [currentNotes, setCurrentNotes] = useState<MeetingNotes | null>(meeting.notes)
  const [evalResults, setEvalResults] = useState<EvaluatedDecision[]>([])
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle')
  const [reviewError, setReviewError] = useState<string | null>(null)
  const syncTeamsTranscript = useMeetingStore((state) => state.syncTeamsTranscript)
  const loadMeetings = useMeetingStore((state) => state.loadMeetings)

  const transcriptLines = useMemo(() => {
    if (!meeting.transcript) return []
    return meeting.transcript.split('\n').filter((l) => l.trim())
  }, [meeting.transcript])

  const filteredLines = useMemo(() => {
    if (!searchQuery.trim()) return transcriptLines
    const q = searchQuery.toLowerCase()
    return transcriptLines.filter((line) => line.toLowerCase().includes(q))
  }, [transcriptLines, searchQuery])

  const matchCount = useMemo(() => {
    if (!searchQuery.trim()) return 0
    const q = searchQuery.toLowerCase()
    return transcriptLines.filter((line) => line.toLowerCase().includes(q)).length
  }, [transcriptLines, searchQuery])

  const handleReviewAction = useCallback(
    async (id: string, status: 'accepted' | 'dismissed'): Promise<void> => {
      if (!currentNotes) return
      const update = (items: MeetingActionItem[]): MeetingActionItem[] =>
        items.map((item) => (item.id === id ? { ...item, reviewStatus: status } : item))
      const actionItems = update(currentNotes.actionItems)
      const nextNotes: MeetingNotes = {
        ...currentNotes,
        actionItems,
        myActionItems: actionItems.filter(
          (item) => item.isCurrentUser && item.reviewStatus === 'accepted'
        ),
        suggestedFollowUps: update(currentNotes.suggestedFollowUps)
      }
      setCurrentNotes(nextNotes)
      setReviewError(null)
      try {
        const updated = await window.api.transcription.reviewAction(meeting.id, id, status)
        setCurrentNotes(updated.notes)
        await loadMeetings()
      } catch (error) {
        setCurrentNotes(currentNotes)
        setReviewError(error instanceof Error ? error.message : String(error))
      }
    },
    [currentNotes, loadMeetings, meeting]
  )

  const handleTeamsSync = useCallback(async (): Promise<void> => {
    setSyncStatus('syncing')
    try {
      await syncTeamsTranscript(meeting.id)
      setSyncStatus('idle')
    } catch {
      setSyncStatus('error')
    }
  }, [meeting.id, syncTeamsTranscript])

  const handleAddToWeeklyNotes = useCallback(async () => {
    if (!currentNotes) return
    setAddStatus('saving')
    try {
      const block = formatMeetingForWeekly({ ...meeting, notes: currentNotes })
      await window.api.obsidian.appendBlockToToday(block)
      setAddStatus('success')
      setTimeout(() => setAddStatus('idle'), 3000)
    } catch {
      setAddStatus('error')
      setTimeout(() => setAddStatus('idle'), 3000)
    }
  }, [meeting, currentNotes])

  const handleRegenerateAndEval = useCallback(async () => {
    if (!meeting.transcript) return
    const transcriptArtifact = meeting.transcriptArtifacts[meeting.activeTranscriptSource]
    if (!transcriptArtifact) {
      setRegenStatus('error')
      return
    }
    const updateContext = {
      transcriptSource: meeting.activeTranscriptSource,
      transcriptCapturedAt: transcriptArtifact.capturedAt,
      baseNotesGeneratedAt: currentNotes?.metadata.generatedAt ?? null
    }
    setRegenStatus('summarizing')
    try {
      const notes = await window.api.transcription.summarizeMeeting({
        segments: meeting.segments,
        participants: meeting.participants,
        transcriptSource: meeting.activeTranscriptSource
      })
      const updated = await window.api.transcription.updateNotes(meeting.id, notes, updateContext)
      setCurrentNotes(updated.notes)
      await loadMeetings()
      setActiveTab('summary')

      if (notes.decisions && notes.decisions.length > 0) {
        setRegenStatus('evaluating')
        setIsEvaluating(true)
        try {
          const evaluated = await window.api.decisionEval.evaluate(notes.decisions)
          setEvalResults(evaluated)
        } catch {
          // Eval failure is non-fatal
        }
        setIsEvaluating(false)
      }
      setRegenStatus('done')
      setTimeout(() => setRegenStatus('idle'), 3000)
    } catch {
      setRegenStatus('error')
      setTimeout(() => setRegenStatus('idle'), 3000)
    }
  }, [currentNotes?.metadata.generatedAt, loadMeetings, meeting])

  const activeArtifact = meeting.transcriptArtifacts[meeting.activeTranscriptSource]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onBack}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          ← Back
        </button>
        <div className="text-[11px] text-text-tertiary">
          {formatDate(meeting.createdAt)} at {formatTime(meeting.createdAt)}
        </div>
      </div>

      {/* Title + meta */}
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-text-primary">{meeting.title}</h3>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-tertiary">
          <span>{formatDuration(meeting.duration)}</span>
          {meeting.speakers.length > 0 && (
            <>
              <span>·</span>
              <span>{meeting.speakers.join(', ')}</span>
            </>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px]">
          <span
            className={
              meeting.activeTranscriptSource === 'teams'
                ? 'rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-400'
                : 'rounded bg-surface-muted px-1.5 py-0.5 text-text-muted'
            }
          >
            {meeting.activeTranscriptSource === 'teams' ? 'Teams transcript' : 'Local microphone'}
          </span>
          <span
            className={
              activeArtifact?.attribution === 'verified'
                ? 'rounded bg-green-500/10 px-1.5 py-0.5 text-green-400'
                : 'rounded bg-yellow-500/10 px-1.5 py-0.5 text-yellow-400'
            }
          >
            {activeArtifact?.attribution === 'verified'
              ? 'Speaker names verified'
              : 'Speaker names unverified'}
          </span>
          {meeting.notes && (
            <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-purple-400">
              {meeting.notes.metadata.model}
            </span>
          )}
          {meeting.calendarContext?.onlineMeetingUrl &&
            (meeting.activeTranscriptSource !== 'teams' ||
              meeting.teamsSync.summaryStatus !== 'available') && (
              <button
                onClick={() => void handleTeamsSync()}
                disabled={syncStatus === 'syncing'}
                className="rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50"
              >
                {syncStatus === 'syncing'
                  ? meeting.activeTranscriptSource === 'teams'
                    ? 'Finalizing summary…'
                    : 'Checking Teams…'
                  : syncStatus === 'error'
                    ? 'Retry Teams sync'
                    : meeting.activeTranscriptSource === 'teams'
                      ? 'Retry final summary'
                      : 'Check Teams transcript'}
              </button>
            )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setActiveTab('transcript')}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors
            ${
              activeTab === 'transcript'
                ? 'bg-focus/20 text-focus'
                : 'text-text-muted hover:text-text-secondary'
            }`}
        >
          Transcript
        </button>
        <button
          onClick={() => setActiveTab('summary')}
          disabled={!currentNotes}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors
            ${
              activeTab === 'summary'
                ? 'bg-focus/20 text-focus'
                : 'text-text-muted hover:text-text-secondary'
            }
            ${!currentNotes ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          Summary
        </button>
      </div>

      {/* Content */}
      {activeTab === 'transcript' && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Search bar */}
          <div className="relative mb-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transcript…"
              className="w-full px-3 py-1.5 rounded-md bg-surface-muted border border-surface-border
                       text-text-primary placeholder:text-text-muted text-xs
                       focus:outline-none focus:ring-1 focus:ring-focus/50"
            />
            {searchQuery && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <span className="text-[10px] text-text-muted">
                  {matchCount} match{matchCount !== 1 ? 'es' : ''}
                </span>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-text-muted hover:text-text-secondary text-xs"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Transcript lines */}
          <div className="flex-1 overflow-y-auto max-h-[300px] space-y-1 pr-1">
            {filteredLines.length === 0 ? (
              <p className="text-text-muted text-xs text-center py-4">
                {searchQuery ? 'No matches found' : 'No transcript available'}
              </p>
            ) : (
              filteredLines.map((line, i) => {
                const colonIdx = line.indexOf(':')
                const hasSpeaker = colonIdx > 0 && colonIdx < 30
                const speaker = hasSpeaker ? line.slice(0, colonIdx) : null
                const text = hasSpeaker ? line.slice(colonIdx + 1).trim() : line

                return (
                  <div
                    key={i}
                    className="text-xs leading-relaxed rounded px-1.5 py-0.5 hover:bg-surface-muted/30"
                  >
                    {speaker && <span className="font-medium text-accent mr-1">{speaker}:</span>}
                    <span className="text-text-primary">{highlightText(text, searchQuery)}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'summary' && currentNotes && (
        <div className="flex-1 overflow-y-auto max-h-[300px] pr-1">
          <MeetingNotesView
            notes={currentNotes}
            evaluatedDecisions={evalResults.length > 0 ? evalResults : undefined}
            isEvaluating={isEvaluating}
            onReviewAction={(id, status) => void handleReviewAction(id, status)}
          />
        </div>
      )}

      {reviewError && (
        <p className="mt-2 text-[11px] text-red-400">Could not save action review: {reviewError}</p>
      )}

      {/* Bottom actions */}
      <div className="mt-3 pt-2 border-t border-surface-border/30 space-y-1.5">
        {/* Regenerate & Evaluate button */}
        <button
          onClick={handleRegenerateAndEval}
          disabled={regenStatus === 'summarizing' || regenStatus === 'evaluating'}
          className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors
            ${
              regenStatus === 'done'
                ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                : regenStatus === 'error'
                  ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                  : 'bg-purple-500/15 text-purple-400 border border-purple-500/20 hover:bg-purple-500/25'
            }
            disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {regenStatus === 'summarizing'
            ? '⏳ Regenerating notes…'
            : regenStatus === 'evaluating'
              ? '⏳ Verifying decisions…'
              : regenStatus === 'done'
                ? '✓ Notes regenerated & decisions evaluated'
                : regenStatus === 'error'
                  ? '✗ Failed — check API keys'
                  : '🔄 Regenerate Notes & Evaluate Decisions'}
        </button>

        {/* Add to Weekly Notes button */}
        {currentNotes && (
          <button
            onClick={handleAddToWeeklyNotes}
            disabled={addStatus === 'saving'}
            className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors
              ${
                addStatus === 'success'
                  ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                  : addStatus === 'error'
                    ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                    : 'bg-focus/15 text-focus border border-focus/20 hover:bg-focus/25'
              }
              disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {addStatus === 'saving'
              ? '⏳ Adding…'
              : addStatus === 'success'
                ? '✓ Added to weekly notes'
                : addStatus === 'error'
                  ? '✗ Failed — check vault connection'
                  : '📋 Add summary to weekly notes'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────

export function TranscriptsPanel(): React.ReactElement {
  const { savedMeetings, loadMeetings, deleteMeeting } = useMeetingStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    loadMeetings()
  }, [loadMeetings])

  const selectedMeeting = useMemo(
    () => savedMeetings.find((m) => m.id === selectedId) ?? null,
    [savedMeetings, selectedId]
  )

  // Sort newest first
  const sortedMeetings = useMemo(
    () =>
      [...savedMeetings].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [savedMeetings]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteMeeting(id)
      if (selectedId === id) setSelectedId(null)
      setConfirmDeleteId(null)
    },
    [deleteMeeting, selectedId]
  )

  // Detail view
  if (selectedMeeting) {
    return (
      <section className="rounded-xl border border-surface-border/60 bg-surface-secondary/30 p-4 overflow-hidden">
        <TranscriptDetailView
          key={`${selectedMeeting.id}:${selectedMeeting.updatedAt}`}
          meeting={selectedMeeting}
          onBack={() => setSelectedId(null)}
        />
      </section>
    )
  }

  // List view
  return (
    <section className="rounded-xl border border-surface-border/60 bg-surface-secondary/30 p-4 overflow-hidden">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-text-primary text-sm font-semibold tracking-wide uppercase">
            Transcripts
          </h2>
          {sortedMeetings.length > 0 && (
            <span className="bg-focus/20 text-focus rounded-full px-2 py-0.5 text-xs font-semibold">
              {sortedMeetings.length}
            </span>
          )}
        </div>
        <button
          onClick={() => loadMeetings()}
          className="text-text-tertiary hover:text-text-secondary text-xs transition-colors"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {sortedMeetings.length === 0 ? (
        <div className="text-text-tertiary py-3 text-center text-sm">
          No transcripts yet — record a meeting to get started 🎙️
        </div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto space-y-1 pr-1">
          {sortedMeetings.map((meeting) => (
            <div key={meeting.id} className="relative group/item">
              <TranscriptListItem
                meeting={meeting}
                isSelected={false}
                onClick={() => setSelectedId(meeting.id)}
              />
              {/* Delete button */}
              {confirmDeleteId === meeting.id ? (
                <div className="absolute right-1 top-1 flex items-center gap-1 bg-surface-secondary rounded-md border border-surface-border px-1.5 py-0.5">
                  <span className="text-[10px] text-text-muted">Delete?</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(meeting.id)
                    }}
                    className="text-[10px] text-red-400 hover:text-red-300 font-medium"
                  >
                    Yes
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDeleteId(null)
                    }}
                    className="text-[10px] text-text-muted hover:text-text-secondary"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDeleteId(meeting.id)
                  }}
                  className="absolute right-1 top-1 opacity-0 group-hover/item:opacity-100 text-[10px]
                           text-text-muted hover:text-red-400 transition-all p-0.5 rounded"
                  title="Delete transcript"
                >
                  🗑
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
