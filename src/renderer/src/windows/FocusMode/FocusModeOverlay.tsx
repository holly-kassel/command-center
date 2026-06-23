/**
 * FocusModeOverlay
 *
 * Full-screen focus mode with Pomodoro timer.
 * Minimal, distraction-free interface showing only current focus
 * and a 25-minute countdown with circular SVG progress ring.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { useObsidianStore } from '../../store/obsidianStore'
import { useCalendarStore } from '../../store/calendarStore'

const POMODORO_SECONDS = 25 * 60 // 25 minutes

type TimerState = 'idle' | 'running' | 'paused' | 'complete'

export function FocusModeOverlay({ onExit }: { onExit: () => void }): React.ReactElement {
  const currentFocus = useObsidianStore((s) => s.currentFocus)
  const nextMeeting = useCalendarStore((s) => s.nextMeeting)

  const [secondsLeft, setSecondsLeft] = useState(POMODORO_SECONDS)
  const [timerState, setTimerState] = useState<TimerState>('idle')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Timer logic ──────────────────────────────────────────────

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    clearTimer()
    setTimerState('running')
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearTimer()
          setTimerState('complete')
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [clearTimer])

  const pauseTimer = useCallback(() => {
    clearTimer()
    setTimerState('paused')
  }, [clearTimer])

  const resumeTimer = useCallback(() => {
    startTimer()
  }, [startTimer])

  const resetTimer = useCallback(() => {
    clearTimer()
    setSecondsLeft(POMODORO_SECONDS)
    setTimerState('idle')
  }, [clearTimer])

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  // ── Escape key ───────────────────────────────────────────────

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onExit()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onExit])

  // ── SVG ring math ────────────────────────────────────────────

  const radius = 120
  const strokeWidth = 6
  const circumference = 2 * Math.PI * radius
  const progress = secondsLeft / POMODORO_SECONDS
  const dashOffset = circumference * (1 - progress)

  // ── Time formatting ──────────────────────────────────────────

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  // ── Next meeting info ────────────────────────────────────────

  const meetingInfo = nextMeeting
    ? `Next: ${nextMeeting.title} at ${new Date(nextMeeting.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
    >
      {/* Escape hint */}
      <div className="absolute top-6 right-6 text-text-muted text-xs opacity-60">
        Press{' '}
        <kbd className="px-1.5 py-0.5 rounded bg-surface-muted text-text-tertiary text-[10px] font-mono">
          Esc
        </kbd>{' '}
        to exit
      </div>

      {/* Center content */}
      <div className="flex flex-col items-center gap-6">
        {/* Focus label + text */}
        <div className="text-center mb-2">
          <span className="text-text-muted text-[10px] font-semibold tracking-[0.2em] uppercase">
            Current Focus
          </span>
          <h1 className="text-text-primary text-4xl font-bold mt-2 max-w-xl text-center leading-tight">
            {currentFocus || 'Deep Work'}
          </h1>
        </div>

        {/* Pomodoro ring */}
        <div className="relative flex items-center justify-center">
          <svg
            width={radius * 2 + strokeWidth * 2}
            height={radius * 2 + strokeWidth * 2}
            className="transform -rotate-90"
          >
            {/* Background ring */}
            <circle
              cx={radius + strokeWidth}
              cy={radius + strokeWidth}
              r={radius}
              fill="none"
              stroke="var(--color-surface-border)"
              strokeWidth={strokeWidth}
            />
            {/* Progress ring */}
            <circle
              cx={radius + strokeWidth}
              cy={radius + strokeWidth}
              r={radius}
              fill="none"
              stroke={timerState === 'complete' ? 'var(--color-warning)' : 'var(--color-focus)'}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>

          {/* Time display in center of ring */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`text-5xl font-mono font-light tracking-wider ${
                timerState === 'complete' ? 'text-warning' : 'text-text-primary'
              }`}
            >
              {timeDisplay}
            </span>
            {timerState === 'complete' && (
              <span className="text-warning text-sm mt-1 animate-pulse">Time&apos;s up!</span>
            )}
            {timerState === 'idle' && (
              <span className="text-text-muted text-xs mt-1">25 min pomodoro</span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mt-2">
          {timerState === 'idle' && (
            <button onClick={startTimer} className="focus-btn-primary">
              ▶ Start
            </button>
          )}
          {timerState === 'running' && (
            <button onClick={pauseTimer} className="focus-btn-secondary">
              ⏸ Pause
            </button>
          )}
          {timerState === 'paused' && (
            <>
              <button onClick={resumeTimer} className="focus-btn-primary">
                ▶ Resume
              </button>
              <button onClick={resetTimer} className="focus-btn-ghost">
                ↺ Reset
              </button>
            </>
          )}
          {timerState === 'complete' && (
            <button onClick={resetTimer} className="focus-btn-primary">
              ↺ Start Another
            </button>
          )}
          {timerState === 'running' && (
            <button onClick={resetTimer} className="focus-btn-ghost">
              ↺ Reset
            </button>
          )}
        </div>
      </div>

      {/* Next meeting info at bottom */}
      {meetingInfo && (
        <div className="absolute bottom-8 text-text-tertiary text-xs flex items-center gap-2">
          <span className="text-sm">📅</span>
          <span>{meetingInfo}</span>
        </div>
      )}
    </motion.div>
  )
}
