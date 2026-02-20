/**
 * BreathingExercise Component
 *
 * 4-7-8 breathing pattern: 4s inhale, 7s hold, 8s exhale.
 * Animated circle + phase text + countdown.
 */
import { useState, useEffect, useRef } from 'react'

interface BreathingExerciseProps {
  durationSeconds?: number
  onComplete: () => void
}

type Phase = 'ready' | 'inhale' | 'hold' | 'exhale'

const PHASE_DURATIONS: Record<Exclude<Phase, 'ready'>, number> = {
  inhale: 4,
  hold: 7,
  exhale: 8,
}

const PHASE_LABELS: Record<Phase, string> = {
  ready: 'Ready?',
  inhale: 'Breathe in',
  hold: 'Hold',
  exhale: 'Breathe out',
}

const PHASE_COLORS: Record<Phase, string> = {
  ready: 'text-text-muted',
  inhale: 'text-focus',
  hold: 'text-warning',
  exhale: 'text-accent',
}

const PHASE_ORDER: Exclude<Phase, 'ready'>[] = ['inhale', 'hold', 'exhale']

const CYCLE_DURATION = 4 + 7 + 8 // 19 seconds

export function BreathingExercise({
  durationSeconds = 60,
  onComplete,
}: BreathingExerciseProps): React.ReactElement {
  const [started, setStarted] = useState(false)
  const [phase, setPhase] = useState<Phase>('ready')
  const [phaseTimeLeft, setPhaseTimeLeft] = useState(0)
  const [cycleCount, setCycleCount] = useState(0)
  const [totalElapsed, setTotalElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const phaseIndexRef = useRef(0) // 0=inhale, 1=hold, 2=exhale
  const phaseRemainingRef = useRef(0)
  const cycleRef = useRef(0)
  const elapsedRef = useRef(0)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const totalCycles = Math.ceil(durationSeconds / CYCLE_DURATION)

  useEffect(() => {
    if (!started) return

    // Initialize: start at inhale
    phaseIndexRef.current = 0
    phaseRemainingRef.current = PHASE_DURATIONS.inhale
    cycleRef.current = 1
    elapsedRef.current = 0

    setPhase('inhale')
    setPhaseTimeLeft(PHASE_DURATIONS.inhale)
    setCycleCount(1)
    setTotalElapsed(0)

    intervalRef.current = setInterval(() => {
      elapsedRef.current += 1
      phaseRemainingRef.current -= 1

      // Check if overall exercise is done
      if (elapsedRef.current >= durationSeconds) {
        clearInterval(intervalRef.current!)
        onCompleteRef.current()
        return
      }

      if (phaseRemainingRef.current <= 0) {
        // Move to next phase
        phaseIndexRef.current = (phaseIndexRef.current + 1) % 3

        // If we wrapped back to inhale, that's a new cycle
        if (phaseIndexRef.current === 0) {
          cycleRef.current += 1
          setCycleCount(cycleRef.current)
        }

        const nextPhaseName = PHASE_ORDER[phaseIndexRef.current]
        phaseRemainingRef.current = PHASE_DURATIONS[nextPhaseName]
        setPhase(nextPhaseName)
        setPhaseTimeLeft(PHASE_DURATIONS[nextPhaseName])
      } else {
        setPhaseTimeLeft(phaseRemainingRef.current)
      }

      setTotalElapsed(elapsedRef.current)
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [started, durationSeconds])

  // Circle scale based on phase
  const getScale = (): number => {
    if (!started || phase === 'ready') return 0.6
    if (phase === 'inhale') {
      const progress = 1 - phaseTimeLeft / PHASE_DURATIONS.inhale
      return 0.6 + 0.4 * progress
    }
    if (phase === 'hold') return 1.0
    // exhale
    const progress = 1 - phaseTimeLeft / PHASE_DURATIONS.exhale
    return 1.0 - 0.4 * progress
  }

  const progressPercent = (totalElapsed / durationSeconds) * 100

  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-8">
        <div className="w-32 h-32 rounded-full bg-surface-muted/30 border-2 border-surface-border/40 flex items-center justify-center">
          <span className="text-4xl">🫁</span>
        </div>
        <div className="text-center space-y-2">
          <p className="text-text-secondary text-sm">4-7-8 Breathing Pattern</p>
          <p className="text-text-muted text-xs">
            {totalCycles} cycles · ~{durationSeconds}s
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setStarted(true)}
            className="px-5 py-2 rounded-lg bg-focus/20 text-focus font-medium text-sm hover:bg-focus/30 transition-colors"
          >
            Begin
          </button>
          <button
            onClick={onComplete}
            className="px-5 py-2 rounded-lg bg-surface-muted/50 text-text-muted text-sm hover:text-text-secondary transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-8">
      {/* Animated breathing circle */}
      <div className="relative w-40 h-40 flex items-center justify-center">
        <div
          className={`absolute inset-0 rounded-full border-2 transition-all duration-1000 ease-in-out ${
            phase === 'inhale'
              ? 'border-focus/60 bg-focus/10'
              : phase === 'hold'
                ? 'border-warning/60 bg-warning/10'
                : 'border-accent/60 bg-accent/10'
          }`}
          style={{
            transform: `scale(${getScale()})`,
            transition: 'transform 1s ease-in-out, border-color 0.5s, background-color 0.5s',
          }}
        />
        <div className="relative z-10 text-center">
          <span className={`text-lg font-semibold ${PHASE_COLORS[phase]}`}>
            {PHASE_LABELS[phase]}
          </span>
          <div className="text-2xl font-mono text-text-secondary mt-1">
            {phaseTimeLeft}
          </div>
        </div>
      </div>

      {/* Cycle count */}
      <p className="text-text-muted text-xs">
        Cycle {cycleCount} of {totalCycles}
      </p>

      {/* Progress bar */}
      <div className="w-48 h-1.5 bg-surface-muted/40 rounded-full overflow-hidden">
        <div
          className="h-full bg-focus/60 rounded-full transition-all duration-1000"
          style={{ width: `${Math.min(progressPercent, 100)}%` }}
        />
      </div>
    </div>
  )
}
