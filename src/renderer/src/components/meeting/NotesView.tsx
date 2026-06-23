import { useState } from 'react'
import { useMeetingStore } from '../../store/meetingStore'
import type { DecisionConfidence } from '@shared/types/transcription'

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
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-10 h-10 border-2 border-focus/60 border-t-transparent rounded-full animate-spin" />
        <p className="text-text-secondary text-sm">Generating meeting notes…</p>
      </div>
    )
  }

  if (!notes) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <p className="text-text-muted text-xs">No notes generated yet.</p>
        <button
          onClick={() => generateNotes()}
          disabled={segments.length === 0}
          className="px-5 py-2 rounded-lg bg-focus/20 text-focus font-medium text-sm hover:bg-focus/30 border border-focus/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Generate Notes
        </button>
      </div>
    )
  }

  const hasEvals = evaluatedDecisions.length > 0

  return (
    <div className="space-y-4 overflow-y-auto pr-1">
      {/* Summary */}
      <div>
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
          Summary
        </h4>
        <p className="text-xs text-text-secondary leading-relaxed">{notes.summary}</p>
      </div>

      {/* Key Topics */}
      {notes.keyTopics.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
            Key Topics
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {notes.keyTopics.map((topic, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[11px] font-medium"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Key Points */}
      {notes.keyPoints.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
            Key Points
          </h4>
          <ul className="space-y-1">
            {notes.keyPoints.map((point, i) => (
              <li key={i} className="flex gap-2 items-start text-xs text-text-secondary">
                <span className="text-text-muted mt-0.5">•</span>
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* My Action Items — shown first when available */}
      {notes.myActionItems && notes.myActionItems.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-focus uppercase tracking-wider mb-1.5">
            My Action Items
          </h4>
          <ul className="space-y-1">
            {notes.myActionItems.map((item, i) => (
              <li key={i} className="flex gap-2 items-start text-xs text-text-primary">
                <span className="text-focus">☐</span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Items */}
      {notes.actionItems.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
            {notes.myActionItems && notes.myActionItems.length > 0 ? 'All Action Items' : 'Action Items'}
          </h4>
          <ul className="space-y-1">
            {notes.actionItems.map((item, i) => (
              <li key={i} className="flex gap-2 items-start text-xs text-text-secondary">
                <span className="text-text-muted">☐</span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Decisions — with inline eval annotations */}
      {notes.decisions && notes.decisions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5 flex items-center gap-2">
            Decisions
            {isEvaluatingDecisions && (
              <span className="inline-flex items-center gap-1 text-[10px] text-text-muted font-normal normal-case tracking-normal">
                <span className="w-3 h-3 border border-focus/50 border-t-transparent rounded-full animate-spin" />
                verifying…
              </span>
            )}
          </h4>
          <ul className="space-y-2">
            {notes.decisions.map((decision, i) => {
              const evalData = hasEvals ? evaluatedDecisions[i] : null
              const config = evalData ? CONFIDENCE_CONFIG[evalData.confidence] : null
              const isExpanded = expandedDecision === i

              return (
                <li key={i} className="text-xs text-text-secondary">
                  <div className="flex gap-2 items-start">
                    {config ? (
                      <button
                        onClick={() => setExpandedDecision(isExpanded ? null : i)}
                        className="flex-shrink-0 mt-0.5 cursor-pointer"
                        title={`${config.label} — click for details`}
                      >
                        <span className="text-sm">{config.icon}</span>
                      </button>
                    ) : (
                      <span className="text-text-muted flex-shrink-0">✓</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="leading-relaxed">{decision}</span>
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
                  {/* Expanded annotation */}
                  {isExpanded && evalData && (
                    <div
                      className={`mt-1.5 ml-6 p-2 rounded-lg border text-[11px] ${config!.color}`}
                    >
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

      {/* Open Questions */}
      {notes.openQuestions && notes.openQuestions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
            Open Questions
          </h4>
          <ul className="space-y-1">
            {notes.openQuestions.map((question, i) => (
              <li key={i} className="flex gap-2 items-start text-xs text-text-secondary">
                <span className="text-text-muted">?</span>
                <span className="leading-relaxed">{question}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Regenerate */}
      <div className="pt-2">
        <button
          onClick={() => generateNotes()}
          disabled={segments.length === 0}
          className="px-4 py-1.5 rounded-lg bg-focus/20 text-focus font-medium text-xs hover:bg-focus/30 border border-focus/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Regenerate Notes
        </button>
      </div>
    </div>
  )
}
