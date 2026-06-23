/**
 * TouchGrassFlow Component
 *
 * Mid-day interrupt ritual: breathing exercise + confirm hydration.
 * No time gates — available whenever you need a reset.
 */
import { useState } from 'react'
import { BreathingExercise } from './BreathingExercise'
import { useRitualStore } from '../../store/ritualStore'
import { TOUCH_GRASS_STEPS } from '@shared/types/ritual'

interface TouchGrassFlowProps {
  onComplete: () => void
  onClose: () => void
}

export function TouchGrassFlow({ onComplete, onClose }: TouchGrassFlowProps): React.ReactElement {
  const [step, setStep] = useState(0)
  const [waterConfirmed, setWaterConfirmed] = useState(false)
  const saveTouchGrass = useRitualStore((s) => s.saveTouchGrass)
  const todayLog = useRitualStore((s) => s.todayLog)

  const currentStep = TOUCH_GRASS_STEPS[step]
  const progress = ((step + 1) / TOUCH_GRASS_STEPS.length) * 100

  const handleComplete = async (): Promise<void> => {
    await saveTouchGrass()
    onComplete()
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-background/95 backdrop-blur-md flex items-center justify-center"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <div className="w-full max-w-md mx-auto px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <span>🌿</span> Touch Grass
            </h2>
            <p className="text-xs text-text-muted mt-0.5">Step away. Breathe. Hydrate.</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-secondary text-sm">
            ✕
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-surface-muted/30 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-green-500/60 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step indicator */}
        <p className="text-xs text-text-muted text-center mb-4">
          {currentStep.title} — {currentStep.description}
        </p>

        {/* Step content */}
        {step === 0 && (
          <BreathingExercise
            durationSeconds={60}
            onComplete={() => setStep(1)}
          />
        )}

        {step === 1 && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="w-32 h-32 rounded-full bg-blue-500/10 border-2 border-blue-500/30 flex items-center justify-center">
              <span className="text-5xl">💧</span>
            </div>

            <div className="text-center space-y-2">
              <p className="text-text-primary font-medium">Did you drink water?</p>
              <p className="text-xs text-text-muted">Go get some. I&apos;ll wait.</p>
            </div>

            {!waterConfirmed ? (
              <button
                onClick={() => setWaterConfirmed(true)}
                className="px-6 py-2.5 rounded-lg bg-blue-500/20 text-blue-400 font-medium text-sm hover:bg-blue-500/30 border border-blue-500/30 transition-colors"
              >
                Yes, I drank water 💧
              </button>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 text-green-400">
                  <span className="text-lg">✓</span>
                  <span className="text-sm font-medium">Hydrated</span>
                </div>

                {todayLog && (
                  <p className="text-xs text-text-muted">
                    🌿 × {(todayLog.touchGrassCount ?? 0) + 1} today
                  </p>
                )}

                <button
                  onClick={handleComplete}
                  className="px-6 py-2.5 rounded-lg bg-green-500/20 text-green-400 font-medium text-sm hover:bg-green-500/30 border border-green-500/30 transition-colors"
                >
                  Back to work, refreshed
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
