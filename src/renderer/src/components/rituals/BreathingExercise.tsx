/**
 * BreathingExercise Component
 *
 * 4-7-8 breathing pattern: 4s inhale, 7s hold, 8s exhale.
 * Smooth CSS-transition-driven concentric rings with ambient glow.
 * Always completes full cycles — never cuts off mid-breath.
 */
import { useState, useEffect, useRef } from 'react'

interface BreathingExerciseProps {
  durationSeconds?: number
  onComplete: () => void
}

type Phase = 'ready' | 'inhale' | 'hold' | 'exhale' | 'complete'

const INHALE = 4
const HOLD = 7
const EXHALE = 8
const CYCLE_DURATION = INHALE + HOLD + EXHALE

const PHASE_LABELS: Record<Phase, string> = {
  ready: '',
  inhale: 'Breathe in slowly\u2026',
  hold: 'Gently hold\u2026',
  exhale: 'Slowly let go\u2026',
  complete: 'You\u2019re centered',
}

type ActivePhase = 'inhale' | 'hold' | 'exhale'
const PHASE_ORDER: ActivePhase[] = ['inhale', 'hold', 'exhale']
const PHASE_SECONDS: Record<ActivePhase, number> = {
  inhale: INHALE,
  hold: HOLD,
  exhale: EXHALE,
}

export function BreathingExercise({
  durationSeconds = 60,
  onComplete,
}: BreathingExerciseProps): React.ReactElement {
  const [started, setStarted] = useState(false)
  const [phase, setPhase] = useState<Phase>('ready')
  const [cyclesCompleted, setCyclesCompleted] = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const phaseIdxRef = useRef(0)
  const remainingRef = useRef(0)
  const cycleRef = useRef(0)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const totalCycles = Math.max(1, Math.round(durationSeconds / CYCLE_DURATION))

  // Completion wind-down → auto-advance after 3s
  useEffect(() => {
    if (phase !== 'complete') return
    const t = setTimeout(() => onCompleteRef.current(), 3000)
    return () => clearTimeout(t)
  }, [phase])

  // Core breathing loop — cycle-count based, never truncates mid-breath
  useEffect(() => {
    if (!started) return

    phaseIdxRef.current = 0
    remainingRef.current = INHALE
    cycleRef.current = 0

    setPhase('inhale')
    setCyclesCompleted(0)

    intervalRef.current = setInterval(() => {
      remainingRef.current -= 1

      if (remainingRef.current <= 0) {
        const prevIdx = phaseIdxRef.current

        // Exhale just ended → cycle complete
        if (prevIdx === 2) {
          cycleRef.current += 1
          setCyclesCompleted(cycleRef.current)

          if (cycleRef.current >= totalCycles) {
            clearInterval(intervalRef.current!)
            setPhase('complete')
            return
          }
        }

        // Advance to next phase
        phaseIdxRef.current = (prevIdx + 1) % 3
        const next = PHASE_ORDER[phaseIdxRef.current]
        remainingRef.current = PHASE_SECONDS[next]
        setPhase(next)
      }
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [started, totalCycles])

  // ─── Transition-driven scale (synced to phase duration) ───
  const isExpanded = phase === 'inhale' || phase === 'hold'
  const targetScale = isExpanded ? 1 : 0.55

  const transDuration =
    phase === 'inhale'
      ? `${INHALE}s`
      : phase === 'exhale'
        ? `${EXHALE}s`
        : '0.5s'

  const transEasing =
    phase === 'inhale'
      ? 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      : phase === 'exhale'
        ? 'cubic-bezier(0.55, 0.06, 0.68, 0.19)'
        : 'ease'

  const ringStyle = (delayMs: number = 0): React.CSSProperties => {
    const delay = delayMs > 0 ? ` ${delayMs / 1000}s` : ''
    return {
      transform: `scale(${targetScale})`,
      transition: [
        `transform ${transDuration} ${transEasing}${delay}`,
        'border-color 1.2s ease',
        'background-color 1.2s ease',
        'box-shadow 1.2s ease',
      ].join(', '),
    }
  }

  const colorClass =
    phase === 'inhale'
      ? 'breathing-phase-inhale'
      : phase === 'hold'
        ? 'breathing-phase-hold'
        : phase === 'exhale'
          ? 'breathing-phase-exhale'
          : 'breathing-phase-rest'

  // ─── Ready state ──────────────────────────────────────
  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-8">
        <div className="breathing-ready-orb">
          <span className="text-3xl">🫁</span>
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-text-secondary text-sm font-medium">4-7-8 Breathing</p>
          <p className="text-text-muted text-xs">{totalCycles} gentle cycles</p>
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

  // ─── Active breathing + completion ────────────────────
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-8">
      {/* Ring container */}
      <div className="relative w-48 h-48 flex items-center justify-center">
        {phase !== 'complete' ? (
          <>
            <div
              className={`breathing-ring breathing-outer ${colorClass}`}
              style={ringStyle(300)}
            />
            <div
              className={`breathing-ring breathing-middle ${colorClass}`}
              style={ringStyle(150)}
            />
            <div
              className={`breathing-ring breathing-inner ${colorClass}`}
              style={ringStyle(0)}
            />
          </>
        ) : (
          <div className="breathing-done-orb">
            <span className="text-2xl text-focus/80">✓</span>
          </div>
        )}

        {/* Phase label — crossfades on change via key remount */}
        <div className="relative z-10 text-center px-6" role="status" aria-live="polite">
          <span
            key={phase}
            className="block text-sm font-medium text-text-secondary breathing-text-in"
          >
            {PHASE_LABELS[phase]}
          </span>
        </div>
      </div>

      {/* Progress: cycle dots during breathing, summary at completion */}
      {phase !== 'complete' ? (
        <div className="flex gap-2 items-center">
          {Array.from({ length: totalCycles }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-700 ${
                i < cyclesCompleted
                  ? 'w-1.5 h-1.5 bg-focus/60'
                  : i === cyclesCompleted
                    ? 'w-2 h-2 bg-focus/30'
                    : 'w-1.5 h-1.5 bg-surface-muted/40'
              }`}
            />
          ))}
        </div>
      ) : (
        <p
          className="text-text-muted text-xs breathing-text-in"
          style={{ animationDelay: '0.5s', opacity: 0, animationFillMode: 'forwards' }}
        >
          {totalCycles} breaths complete
        </p>
      )}
    </div>
  )
}
