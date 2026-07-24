import { useState } from 'react'
import type { DecisionConfidence, MeetingActionItem } from '@shared/types/transcription'
import { useMeetingStore } from '../../store/meetingStore'

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
    label: 'Potentially outdated'
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

function ActionItemRow({
  item,
  personal = false
}: {
  item: MeetingActionItem
  personal?: boolean
}): React.ReactElement {
  const updateActionItem = useMeetingStore((state) => state.updateActionItem)
  const [showEvidence, setShowEvidence] = useState(false)
  const needsReview = item.reviewStatus === 'needs-review'
  return (
    <li
      className={`rounded-lg border p-2 text-xs ${needsReview ? 'border-yellow-500/20 bg-yellow-500/5' : 'border-surface-border bg-surface-muted/20'}`}
    >
      <div className="flex items-start gap-2">
        <span className={personal ? 'text-focus' : 'text-text-muted'}>☐</span>
        <div className="min-w-0 flex-1">
          <p className="leading-relaxed text-text-primary">{item.description}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-text-muted">
            {item.owner && <span>{item.owner.displayName}</span>}
            {item.dueDate && <span>Due {item.dueDate}</span>}
            <span className="rounded bg-surface-muted px-1 py-0.5">
              {item.confidence} confidence
            </span>
            <button
              onClick={() => setShowEvidence((shown) => !shown)}
              className="text-focus hover:underline"
            >
              {showEvidence ? 'Hide evidence' : 'Show evidence'}
            </button>
          </div>
          {showEvidence && (
            <blockquote className="mt-1.5 border-l-2 border-focus/30 pl-2 text-[11px] italic text-text-muted">
              “{item.evidence.quote}” ({item.evidence.timestamp})
            </blockquote>
          )}
        </div>
      </div>
      {needsReview && (
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={() => updateActionItem(item.id, { reviewStatus: 'dismissed' })}
            className="rounded px-2 py-1 text-[11px] text-text-muted hover:text-red-400"
          >
            Dismiss
          </button>
          <button
            onClick={() => updateActionItem(item.id, { reviewStatus: 'accepted' })}
            className="rounded bg-focus/20 px-2 py-1 text-[11px] font-medium text-focus hover:bg-focus/30"
          >
            Accept
          </button>
        </div>
      )}
    </li>
  )
}

export function NotesView(): React.ReactElement {
  const {
    notes,
    isGeneratingNotes,
    generateNotes,
    segments,
    evaluatedDecisions,
    isEvaluatingDecisions
  } = useMeetingStore()
  const [expandedDecision, setExpandedDecision] = useState<number | null>(null)

  if (isGeneratingNotes) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-focus/60 border-t-transparent" />
        <p className="text-sm text-text-secondary">Generating an evidence-backed summary…</p>
      </div>
    )
  }

  if (!notes) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <p className="text-xs text-text-muted">Generate a summary when you need it.</p>
        <button
          onClick={() => void generateNotes()}
          disabled={segments.length === 0}
          className="rounded-lg border border-focus/30 bg-focus/20 px-5 py-2 text-sm font-medium text-focus transition-colors hover:bg-focus/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Generate summary
        </button>
      </div>
    )
  }

  const hasEvals = evaluatedDecisions.length > 0
  const personalActionIds = new Set(notes.myActionItems.map((item) => item.id))
  const visibleActions = notes.actionItems.filter(
    (item) => item.reviewStatus !== 'dismissed' && !personalActionIds.has(item.id)
  )
  const visibleSuggestions = notes.suggestedFollowUps.filter(
    (item) => item.reviewStatus !== 'dismissed'
  )

  return (
    <div className="space-y-4 overflow-y-auto pr-1">
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        <span className="rounded-full border border-surface-border bg-surface-muted/50 px-2 py-0.5 text-text-muted">
          {notes.metadata.model}
        </span>
        <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-blue-400">
          {notes.metadata.transcriptSource === 'teams' ? 'Teams transcript' : 'Local transcript'}
        </span>
      </div>

      <div>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
          Summary
        </h4>
        <p className="text-xs leading-relaxed text-text-secondary">{notes.summary}</p>
      </div>

      {notes.keyTopics.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Key topics
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {notes.keyTopics.map((topic) => (
              <span
                key={topic}
                className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {notes.keyPoints.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Key points
          </h4>
          <ul className="space-y-1">
            {notes.keyPoints.map((point) => (
              <li key={point} className="flex items-start gap-2 text-xs text-text-secondary">
                <span>•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {notes.myActionItems.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-focus">
            My action items
          </h4>
          <ul className="space-y-1.5">
            {notes.myActionItems
              .filter((item) => item.reviewStatus !== 'dismissed')
              .map((item) => (
                <ActionItemRow key={item.id} item={item} personal />
              ))}
          </ul>
        </div>
      )}

      {visibleActions.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Other action items
          </h4>
          <ul className="space-y-1.5">
            {visibleActions.map((item) => (
              <ActionItemRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
      )}

      {visibleSuggestions.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-yellow-400">
            Suggested follow-ups
          </h4>
          <p className="mb-2 text-[11px] text-text-muted">
            These were implied, not explicitly accepted. Review them before export.
          </p>
          <ul className="space-y-1.5">
            {visibleSuggestions.map((item) => (
              <ActionItemRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
      )}

      {notes.decisions.length > 0 && (
        <div>
          <h4 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Decisions
            {isEvaluatingDecisions && (
              <span className="text-[10px] font-normal normal-case tracking-normal">
                Checking sources…
              </span>
            )}
          </h4>
          <ul className="space-y-2">
            {notes.decisions.map((decision, index) => {
              const evaluation = hasEvals ? evaluatedDecisions[index] : null
              const config = evaluation ? CONFIDENCE_CONFIG[evaluation.confidence] : null
              const isExpanded = expandedDecision === index
              return (
                <li key={decision} className="text-xs text-text-secondary">
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => evaluation && setExpandedDecision(isExpanded ? null : index)}
                      className="flex-shrink-0"
                      disabled={!evaluation}
                    >
                      {config?.icon ?? '✓'}
                    </button>
                    <div className="min-w-0 flex-1">
                      <span>{decision}</span>
                      {config && (
                        <span
                          className={`ml-1.5 inline-flex rounded border px-1.5 py-0.5 text-[10px] ${config.color}`}
                        >
                          {config.label}
                        </span>
                      )}
                    </div>
                  </div>
                  {isExpanded && evaluation && (
                    <div
                      className={`ml-6 mt-1.5 rounded-lg border p-2 text-[11px] ${config!.color}`}
                    >
                      <p>{evaluation.annotation}</p>
                      {evaluation.sources.length > 0 && (
                        <p className="mt-1">Sources: {evaluation.sources.join(', ')}</p>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {notes.openQuestions.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Open questions
          </h4>
          <ul className="space-y-1">
            {notes.openQuestions.map((question) => (
              <li key={question} className="text-xs text-text-secondary">
                ? {question}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={() => void generateNotes()}
        disabled={segments.length === 0}
        className="rounded-lg border border-focus/30 bg-focus/20 px-4 py-1.5 text-xs font-medium text-focus hover:bg-focus/30 disabled:opacity-40"
      >
        Regenerate summary
      </button>
    </div>
  )
}
