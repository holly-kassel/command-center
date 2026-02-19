/**
 * EveningRitualFlow Component
 *
 * Guided 4-step evening ritual:
 * 1. Wins — Celebrate accomplishments
 * 2. Reflect — What went well / could improve
 * 3. Gratitude — What are you grateful for
 * 4. Tomorrow — Preview tomorrow's schedule
 */
import { useState, useCallback } from 'react'
import { useObsidianStore } from '../../store/obsidianStore'
import { useCalendarStore } from '../../store/calendarStore'
import { useRitualStore } from '../../store/ritualStore'
import { EVENING_RITUAL_STEPS } from '@shared/types/ritual'

interface EveningRitualFlowProps {
  onComplete: () => void
  onClose: () => void
}

export function EveningRitualFlow({ onComplete, onClose }: EveningRitualFlowProps): React.ReactElement {
  const [currentStep, setCurrentStep] = useState(0)
  const [untrackedWins, setUntrackedWins] = useState('')
  const [wentWell, setWentWell] = useState('')
  const [couldImprove, setCouldImprove] = useState('')
  const [gratitude, setGratitude] = useState('')
  const [energyLevel, setEnergyLevel] = useState(3)
  const [saving, setSaving] = useState(false)

  const todaySection = useObsidianStore((s) => s.todaySection)
  const events = useCalendarStore((s) => s.events)
  const saveEveningRitual = useRitualStore((s) => s.saveEveningRitual)
  const streaks = useRitualStore((s) => s.streaks)

  const steps = EVENING_RITUAL_STEPS
  const step = steps[currentStep]
  const isLast = currentStep === steps.length - 1

  const eveningStreak = streaks?.evening_ritual

  // Extract completed checkboxes from today's section
  const completedTasks = todaySection?.content
    ?.split('\n')
    .filter((line) => line.match(/^- \[x\]/i))
    .map((line) => line.replace(/^- \[x\]\s*/i, '').trim()) || []

  const handleNext = useCallback(() => {
    if (isLast) return
    setCurrentStep((prev) => prev + 1)
  }, [isLast])

  const handleComplete = useCallback(async () => {
    setSaving(true)
    try {
      await saveEveningRitual({
        untrackedWins,
        wentWell,
        couldImprove,
        gratitude,
        energyLevel,
      })
      onComplete()
    } catch (err) {
      console.error('Failed to save evening ritual:', err)
    } finally {
      setSaving(false)
    }
  }, [untrackedWins, wentWell, couldImprove, gratitude, energyLevel, saveEveningRitual, onComplete])

  // Past events today (for "what happened" context)
  const pastEvents = events.filter(
    (e) => !e.isAllDay && new Date(e.end).getTime() < Date.now()
  )

  const renderStepContent = (): React.ReactNode => {
    switch (step.id) {
      case 'wins':
        return (
          <div className="space-y-4 py-4">
            {/* Completed tasks */}
            {completedTasks.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs uppercase tracking-wider text-text-muted font-medium">
                  Completed Today ({completedTasks.length})
                </h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {completedTasks.map((task, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-text-secondary">
                      <span className="text-focus">✓</span>
                      <span>{task}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Meetings attended */}
            {pastEvents.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs uppercase tracking-wider text-text-muted font-medium">
                  Meetings Attended ({pastEvents.length})
                </h4>
                <div className="space-y-1">
                  {pastEvents.slice(0, 5).map((event) => (
                    <div key={event.id} className="text-xs text-text-muted">
                      {event.title}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Untracked wins */}
            <div className="space-y-1">
              <h4 className="text-xs uppercase tracking-wider text-text-muted font-medium">
                Anything else you're proud of?
              </h4>
              <textarea
                value={untrackedWins}
                onChange={(e) => setUntrackedWins(e.target.value)}
                placeholder="Wins that didn't make it onto the list..."
                rows={2}
                className="w-full bg-surface-muted/30 border border-surface-border/40 rounded-lg px-3 py-2 text-text-primary text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-focus/50 resize-none"
              />
            </div>
          </div>
        )

      case 'reflect':
        return (
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <h4 className="text-xs uppercase tracking-wider text-text-muted font-medium">
                What went well?
              </h4>
              <textarea
                value={wentWell}
                onChange={(e) => setWentWell(e.target.value)}
                placeholder="I'm glad that..."
                rows={2}
                className="w-full bg-surface-muted/30 border border-surface-border/40 rounded-lg px-3 py-2 text-text-primary text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-focus/50 resize-none"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs uppercase tracking-wider text-text-muted font-medium">
                What could improve?
              </h4>
              <textarea
                value={couldImprove}
                onChange={(e) => setCouldImprove(e.target.value)}
                placeholder="Next time I'd..."
                rows={2}
                className="w-full bg-surface-muted/30 border border-surface-border/40 rounded-lg px-3 py-2 text-text-primary text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-focus/50 resize-none"
              />
            </div>
          </div>
        )

      case 'gratitude':
        return (
          <div className="space-y-4 py-4">
            <textarea
              value={gratitude}
              onChange={(e) => setGratitude(e.target.value)}
              placeholder="I'm grateful for..."
              rows={3}
              className="w-full bg-surface-muted/30 border border-surface-border/40 rounded-lg px-3 py-2 text-text-primary text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-focus/50 resize-none"
              autoFocus
            />

            {/* Energy level */}
            <div className="space-y-2">
              <h4 className="text-xs uppercase tracking-wider text-text-muted font-medium">
                Energy Level Today
              </h4>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    onClick={() => setEnergyLevel(level)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                      energyLevel === level
                        ? 'bg-focus/20 text-focus border border-focus/40'
                        : 'bg-surface-muted/30 text-text-muted border border-transparent hover:text-text-secondary'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-text-muted px-1">
                <span>Drained</span>
                <span>Energized</span>
              </div>
            </div>
          </div>
        )

      case 'tomorrow':
        return (
          <div className="space-y-3 py-4">
            <p className="text-text-muted text-sm">
              Take a moment to glance at what's ahead.
            </p>

            {/* Streak celebration */}
            {eveningStreak && eveningStreak.currentCount > 0 && (
              <div className="text-center py-3 bg-focus/10 rounded-lg border border-focus/20">
                <span className="text-focus text-sm font-medium">
                  {eveningStreak.currentCount >= 3 && '🔥 '}
                  {eveningStreak.currentCount + 1} day evening streak!
                </span>
                {eveningStreak.bestCount > 0 && (
                  <p className="text-text-muted text-xs mt-0.5">
                    Best: {eveningStreak.bestCount} days
                  </p>
                )}
              </div>
            )}

            <div className="text-center text-text-muted text-sm py-4">
              <p>You did good work today.</p>
              <p className="mt-1">Time to rest. 🌙</p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const canProceed =
    step.id === 'reflect' ? wentWell.trim().length > 0 :
    step.id === 'gratitude' ? gratitude.trim().length > 0 :
    true

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-auto p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-muted hover:text-text-primary text-lg transition-colors"
        >
          ✕
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-lg font-semibold text-text-primary">Evening Ritual</h2>
          <p className="text-text-muted text-xs mt-1">
            Step {currentStep + 1} of {steps.length}
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 mb-6">
          {steps.map((s, i) => (
            <div
              key={s.id}
              className={`flex-1 h-1 rounded-full transition-colors ${
                i <= currentStep ? 'bg-accent' : 'bg-surface-muted/40'
              }`}
            />
          ))}
        </div>

        {/* Step card */}
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary">{step.title}</h3>
          <p className="text-text-muted text-xs mt-0.5">{step.description}</p>
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex justify-end mt-4">
          {isLast ? (
            <button
              onClick={handleComplete}
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-accent/20 text-accent font-medium text-sm hover:bg-accent/30 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Good Night 🌙'}
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={!canProceed}
              className="px-5 py-2 rounded-lg bg-primary/20 text-primary font-medium text-sm hover:bg-primary/30 transition-colors disabled:opacity-50"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
