/**
 * MorningRitualFlow Component
 *
 * Guided 4-step morning ritual:
 * 1. Breathe — 4-7-8 breathing exercise
 * 2. Review — Current focus + upcoming meetings
 * 3. Intention — Set daily intention
 * 4. Commit — Focus commitment
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { BreathingExercise } from './BreathingExercise'
import { useObsidianStore } from '../../store/obsidianStore'
import { useCalendarStore } from '../../store/calendarStore'
import { useRitualStore } from '../../store/ritualStore'
import { MORNING_RITUAL_STEPS } from '@shared/types/ritual'

interface MorningRitualFlowProps {
  onComplete: () => void
  onClose: () => void
}

export function MorningRitualFlow({ onComplete, onClose }: MorningRitualFlowProps): React.ReactElement {
  const [currentStep, setCurrentStep] = useState(0)
  const [intention, setIntention] = useState('')
  const [focusCommitted, setFocusCommitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const intentionRef = useRef<HTMLTextAreaElement>(null)

  const currentFocus = useObsidianStore((s) => s.currentFocus)
  const nextMeeting = useCalendarStore((s) => s.nextMeeting)
  const events = useCalendarStore((s) => s.events)
  const saveMorningRitual = useRitualStore((s) => s.saveMorningRitual)
  const streaks = useRitualStore((s) => s.streaks)

  const steps = MORNING_RITUAL_STEPS
  const step = steps[currentStep]
  const isLast = currentStep === steps.length - 1

  const morningStreak = streaks?.morning_ritual

  // Ensure the intention textarea receives focus when its step activates
  useEffect(() => {
    if (step.id === 'intention') {
      requestAnimationFrame(() => intentionRef.current?.focus())
    }
  }, [step.id])

  const handleNext = useCallback(() => {
    if (isLast) return
    setCurrentStep((prev) => prev + 1)
  }, [isLast])

  const handleComplete = useCallback(async () => {
    setSaving(true)
    try {
      await saveMorningRitual({ intention, focusCommitted })
      onComplete()
    } catch (err) {
      console.error('Failed to save morning ritual:', err)
    } finally {
      setSaving(false)
    }
  }, [intention, focusCommitted, saveMorningRitual, onComplete])

  // Upcoming events (non-all-day, future)
  const upcomingEvents = events.filter(
    (e) => !e.isAllDay && new Date(e.start).getTime() > Date.now()
  ).slice(0, 3)

  const renderStepContent = (): React.ReactNode => {
    switch (step.id) {
      case 'breathe':
        return <BreathingExercise durationSeconds={60} onComplete={handleNext} />

      case 'review':
        return (
          <div className="space-y-4 py-4">
            {/* Current focus */}
            <div className="space-y-1">
              <h4 className="text-xs uppercase tracking-wider text-text-muted font-medium">
                Current Focus
              </h4>
              {currentFocus ? (
                <p className="text-text-primary text-sm bg-focus/10 border border-focus/20 rounded-lg px-3 py-2">
                  🎯 {currentFocus}
                </p>
              ) : (
                <p className="text-text-muted text-sm italic">No focus set yet</p>
              )}
            </div>

            {/* Next meeting */}
            {nextMeeting && (
              <div className="space-y-1">
                <h4 className="text-xs uppercase tracking-wider text-text-muted font-medium">
                  Next Meeting
                </h4>
                <div className="text-sm text-text-secondary bg-surface-muted/30 rounded-lg px-3 py-2">
                  <span className="text-text-primary">{nextMeeting.title}</span>
                  <span className="text-text-muted ml-2">
                    {new Date(nextMeeting.start).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            )}

            {/* Upcoming schedule */}
            {upcomingEvents.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs uppercase tracking-wider text-text-muted font-medium">
                  Today's Schedule
                </h4>
                <div className="space-y-1">
                  {upcomingEvents.map((event) => (
                    <div key={event.id} className="flex items-center gap-2 text-xs text-text-muted">
                      <span className="text-text-secondary font-mono">
                        {new Date(event.start).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="text-text-secondary">{event.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )

      case 'intention':
        return (
          <div className="space-y-3 py-4">
            <p className="text-text-muted text-sm">
              What do you want to accomplish or how do you want to show up today?
            </p>
            <textarea
              ref={intentionRef}
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              placeholder="Today I will..."
              rows={3}
              className="w-full bg-surface-muted/30 border border-surface-border/40 rounded-lg px-3 py-2 text-text-primary text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-focus/50 resize-none"
            />
          </div>
        )

      case 'focus':
        return (
          <div className="space-y-4 py-4">
            {/* Focus commitment */}
            <button
              onClick={() => setFocusCommitted(!focusCommitted)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
                focusCommitted
                  ? 'bg-focus/15 border-focus/40 text-focus'
                  : 'bg-surface-muted/30 border-surface-border/40 text-text-secondary hover:border-focus/30'
              }`}
            >
              <span className="text-lg">{focusCommitted ? '✅' : '⬜'}</span>
              <span className="text-sm font-medium">
                I commit to focused, intentional work today
              </span>
            </button>

            {/* Streak display */}
            {morningStreak && morningStreak.currentCount > 0 && (
              <div className="text-center text-text-muted text-xs">
                {morningStreak.currentCount >= 3 && '🔥 '}
                {morningStreak.currentCount} day streak
                {morningStreak.bestCount > morningStreak.currentCount && (
                  <span className="ml-1">(best: {morningStreak.bestCount})</span>
                )}
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  const canProceed =
    step.id === 'breathe' ? false : // handled by BreathingExercise
    step.id === 'intention' ? intention.trim().length > 0 :
    true

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
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
          <h2 className="text-lg font-semibold text-text-primary">Morning Ritual</h2>
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
                i <= currentStep ? 'bg-focus' : 'bg-surface-muted/40'
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

        {/* Navigation — not shown for breathe step (auto-advances) */}
        {step.id !== 'breathe' && (
          <div className="flex justify-end mt-4">
            {isLast ? (
              <button
                onClick={handleComplete}
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-focus/20 text-focus font-medium text-sm hover:bg-focus/30 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Complete Ritual ✨'}
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
        )}
      </div>
    </div>
  )
}
