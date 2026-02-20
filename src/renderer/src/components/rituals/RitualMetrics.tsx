/**
 * RitualMetrics Component
 *
 * Dashboard card showing today's ritual status, streak counts,
 * and weekly completion visualization.
 */
import { useRitualStore } from '../../store/ritualStore'
import type { StreakType } from '@shared/types/ritual'

interface RitualMetricsProps {
  onStartMorning: () => void
  onStartEvening: () => void
  onStartTouchGrass: () => void
}

const STREAK_LABELS: Record<StreakType, { label: string; icon: string }> = {
  morning_ritual: { label: 'Morning', icon: '🌅' },
  evening_ritual: { label: 'Evening', icon: '🌙' },
  full_day: { label: 'Full Day', icon: '⭐' },
  focus: { label: 'Focus', icon: '🎯' },
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F']

export function RitualMetrics({ onStartMorning, onStartEvening, onStartTouchGrass }: RitualMetricsProps): React.ReactElement {
  const todayLog = useRitualStore((s) => s.todayLog)
  const streaks = useRitualStore((s) => s.streaks)
  const weeklyMetrics = useRitualStore((s) => s.weeklyMetrics)
  const isLoading = useRitualStore((s) => s.isLoading)

  const hour = new Date().getHours()
  const isMorningTime = hour >= 5 && hour < 12
  const isEveningTime = hour >= 15 && hour < 24

  if (isLoading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-24 bg-surface-muted/40 rounded" />
          <div className="h-8 bg-surface-muted/30 rounded" />
          <div className="h-8 bg-surface-muted/30 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="card space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary tracking-wide flex items-center gap-1.5">
          <span>✨</span>
          Rituals
        </h3>
      </div>

      {/* Today's status + action buttons */}
      <div className="flex gap-2">
        {/* Morning */}
        <div className="flex-1">
          {todayLog?.morningRitualCompleted ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-focus/10 border border-focus/20">
              <span className="text-xs">🌅</span>
              <span className="text-xs text-focus font-medium">Morning ✓</span>
            </div>
          ) : (
            <button
              onClick={onStartMorning}
              disabled={!isMorningTime}
              className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isMorningTime
                  ? 'bg-focus/15 text-focus hover:bg-focus/25 border border-focus/30'
                  : 'bg-surface-muted/30 text-text-muted border border-transparent cursor-not-allowed'
              }`}
              title={isMorningTime ? 'Start morning ritual' : 'Available 5am-12pm'}
            >
              <span>🌅</span>
              Morning
            </button>
          )}
        </div>

        {/* Evening */}
        <div className="flex-1">
          {todayLog?.eveningRitualCompleted ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent/10 border border-accent/20">
              <span className="text-xs">🌙</span>
              <span className="text-xs text-accent font-medium">Evening ✓</span>
            </div>
          ) : (
            <button
              onClick={onStartEvening}
              disabled={!isEveningTime}
              className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isEveningTime
                  ? 'bg-accent/15 text-accent hover:bg-accent/25 border border-accent/30'
                  : 'bg-surface-muted/30 text-text-muted border border-transparent cursor-not-allowed'
              }`}
              title={isEveningTime ? 'Start evening ritual' : 'Available 3pm-12am'}
            >
              <span>🌙</span>
              Evening
            </button>
          )}
        </div>
      </div>

      {/* Intention (if set) */}
      {todayLog?.intention && (
        <div className="text-xs text-text-secondary bg-surface-muted/20 rounded-lg px-2.5 py-1.5 border border-surface-border/20">
          <span className="text-text-muted">Intention:</span>{' '}
          {todayLog.intention}
        </div>
      )}

      {/* Touch Grass — always available */}
      <button
        onClick={onStartTouchGrass}
        className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-all"
        title="Stop. Breathe. Drink water."
      >
        <span>🌿</span>
        Touch Grass
        {todayLog?.touchGrassCount ? (
          <span className="text-[10px] text-green-400/60 ml-1">× {todayLog.touchGrassCount}</span>
        ) : null}
      </button>

      {/* Streaks */}
      {streaks && (
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.entries(STREAK_LABELS) as [StreakType, { label: string; icon: string }][]).map(
            ([type, { label, icon }]) => {
              const streak = streaks[type]
              const isActive = streak && streak.currentCount > 0
              return (
                <div
                  key={type}
                  className={`text-center py-1.5 rounded-lg ${
                    isActive ? 'bg-surface-muted/40' : 'bg-surface-muted/15'
                  }`}
                >
                  <div className="text-xs">
                    {isActive && streak.currentCount >= 3 ? '🔥' : icon}
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      isActive ? 'text-text-primary' : 'text-text-muted'
                    }`}
                  >
                    {streak?.currentCount || 0}
                  </div>
                  <div className="text-[10px] text-text-muted">{label}</div>
                </div>
              )
            }
          )}
        </div>
      )}

      {/* Weekly dots */}
      {weeklyMetrics && (
        <div className="flex items-center justify-center gap-2">
          {weeklyMetrics.dailyStatuses.map((day, i) => {
            const both = day.morning && day.evening
            const one = day.morning || day.evening
            return (
              <div key={day.date} className="flex flex-col items-center gap-0.5">
                <div
                  className={`w-5 h-5 rounded-full border transition-colors ${
                    both
                      ? 'bg-focus/40 border-focus/60'
                      : one
                        ? 'bg-warning/30 border-warning/50'
                        : 'bg-surface-muted/20 border-surface-border/30'
                  }`}
                />
                <span className="text-[9px] text-text-muted">{DAY_LABELS[i]}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
