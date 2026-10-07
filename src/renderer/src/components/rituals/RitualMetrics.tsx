import { useEffect, useState } from 'react'
import { localDate } from '@shared/ritualLogic'
import { useRitualStore } from '../../store/ritualStore'
import { RitualHistory } from './RitualHistory'

interface RitualMetricsProps {
  onStartMorning: () => void
  onStartEvening: () => void
  onStartTouchGrass: () => void
}

export function RitualMetrics({
  onStartMorning,
  onStartEvening,
  onStartTouchGrass
}: RitualMetricsProps): React.ReactElement {
  const { todayLog, streaks, weeklyMetrics, isLoading, error, notice, drafts, legacyNotice } =
    useRitualStore()
  const [now, setNow] = useState(new Date())
  const [history, setHistory] = useState(false)
  useEffect(() => {
    let date = localDate()
    const tick = (): void => {
      const next = localDate()
      setNow(new Date())
      if (date !== next) {
        date = next
        void useRitualStore.getState().refreshAll()
      }
    }
    const refresh = (): void => {
      if (document.visibilityState !== 'hidden') {
        tick()
        void useRitualStore.getState().refreshAll()
      }
    }
    const timer = setInterval(tick, 30000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  const today = localDate(now)
  const resumable = [...drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const resume = resumable.find((draft) => draft.date === today) ?? resumable[0]
  const primary = resume
    ? {
        label: `Resume ${resume.type === 'touch_grass' ? 'reset' : resume.type} · ${resume.date}`,
        action: () =>
          void useRitualStore.getState().startRitual(resume.type, resume.date, resume.id)
      }
    : now.getHours() < 15 && !todayLog?.morningRitualCompleted
      ? { label: 'Start your morning', action: onStartMorning }
      : now.getHours() >= 15 && !todayLog?.eveningRitualCompleted
        ? { label: 'Close out your day', action: onStartEvening }
        : { label: 'Take a reset', action: onStartTouchGrass }
  const savedTime = (stamp: string | null | undefined): string =>
    stamp ? new Date(stamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''
  return (
    <>
      <section className="card space-y-4" aria-label="Daily rituals">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-sm">Rituals</h3>
            <p className="text-xs text-text-secondary">{today}</p>
          </div>
          <button onClick={() => setHistory(true)} className="text-xs text-primary">
            History
          </button>
        </header>
        {notice && (
          <p role="status" className="text-xs text-focus">
            {notice}
          </p>
        )}
        {error && (
          <div role="alert" className="text-xs text-urgent">
            {error}{' '}
            <button
              className="underline"
              onClick={() => void useRitualStore.getState().refreshAll()}
            >
              Retry
            </button>
            {todayLog && <p>Showing the last loaded ritual data.</p>}
          </div>
        )}
        {isLoading && !todayLog ? (
          <p role="status" className="text-sm text-text-secondary">
            Loading rituals…
          </p>
        ) : (
          <>
            <button
              disabled={!todayLog}
              onClick={primary.action}
              className="w-full text-left px-3 py-3 rounded-lg bg-focus/15 text-focus text-sm font-medium border border-focus/30 disabled:opacity-40"
            >
              {primary.label} →
            </button>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                disabled={!todayLog}
                onClick={onStartMorning}
                className="rounded-lg p-2 text-left bg-surface-muted/30 disabled:opacity-40"
              >
                <span className="block text-text-primary">
                  {todayLog?.morningRitualCompleted ? 'Morning ✓ · View / Edit' : 'Morning'}
                </span>
                <span className="text-text-secondary">
                  {todayLog?.morningRitualCompleted
                    ? savedTime(todayLog.morningRitualTime)
                    : 'Plan your day, anytime'}
                </span>
              </button>
              <button
                disabled={!todayLog}
                onClick={onStartEvening}
                className="rounded-lg p-2 text-left bg-surface-muted/30 disabled:opacity-40"
              >
                <span className="block text-text-primary">
                  {todayLog?.eveningRitualCompleted ? 'Evening ✓ · View / Edit' : 'Evening'}
                </span>
                <span className="text-text-secondary">
                  {todayLog?.eveningRitualCompleted
                    ? savedTime(todayLog.eveningRitualTime)
                    : 'Reflect when you are ready'}
                </span>
              </button>
            </div>
            {todayLog?.intention && (
              <p className="text-xs text-text-secondary line-clamp-3 break-words">
                <span className="text-text-primary">Intention: </span>
                {todayLog.intention}
              </p>
            )}
            <button
              disabled={!todayLog}
              onClick={onStartTouchGrass}
              className="text-xs text-focus disabled:opacity-40"
            >
              🌿 Touch Grass · {todayLog?.touchGrassCount ?? 0} resets today
            </button>
          </>
        )}
        {resumable.length > 1 && (
          <details className="text-xs text-text-secondary">
            <summary>Other saved drafts ({resumable.length - 1})</summary>
            {resumable
              .filter((draft) => draft.id !== resume?.id)
              .map((draft) => (
                <button
                  key={draft.id}
                  className="block mt-2 text-primary"
                  onClick={() =>
                    void useRitualStore.getState().startRitual(draft.type, draft.date, draft.id)
                  }
                >
                  Resume {draft.type.replace('_', ' ')} · {draft.date}
                </button>
              ))}
          </details>
        )}
        {weeklyMetrics && (
          <div className="space-y-2 border-t border-surface-border pt-3">
            <div className="flex justify-between gap-2" aria-label="This workweek">
              {weeklyMetrics.dailyStatuses.map((day) => {
                const state =
                  day.date > today
                    ? 'Upcoming'
                    : day.morning && day.evening
                      ? 'Both complete'
                      : day.morning
                        ? 'Morning complete'
                        : day.evening
                          ? 'Evening complete'
                          : day.date === today
                            ? 'Not yet completed'
                            : 'Not completed'
                return (
                  <div
                    key={day.date}
                    className="flex-1 text-center"
                    title={`${day.date}: ${state}`}
                    aria-label={`${day.date}: ${state}${day.date === today ? ', today' : ''}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`inline-flex w-6 h-6 justify-center items-center rounded-full border text-xs ${day.date === today ? 'ring-1 ring-primary ring-offset-2 ring-offset-background' : ''} ${day.morning && day.evening ? 'bg-focus/25 border-focus/50 text-focus' : day.morning || day.evening ? 'bg-warning/20 border-warning/40 text-warning' : 'border-surface-border text-text-secondary'}`}
                    >
                      {day.morning && day.evening
                        ? '✓'
                        : day.morning || day.evening
                          ? '½'
                          : day.date > today
                            ? '·'
                            : '—'}
                    </span>
                    <span className="block text-[10px] text-text-secondary mt-1">
                      {
                        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][
                          new Date(`${day.date}T12:00:00`).getDay() - 1
                        ]
                      }
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] text-text-secondary">
              ✓ Both rituals · ½ One ritual · — Not completed · · Upcoming
            </p>
          </div>
        )}
        {streaks && (
          <details className="text-xs text-text-secondary">
            <summary>Workweek streaks · weekends optional</summary>
            <dl className="grid grid-cols-2 gap-2 pt-2">
              {(['morning_ritual', 'evening_ritual', 'full_day', 'focus'] as const).map((type) => (
                <div key={type}>
                  <dt className="capitalize">{type.replaceAll('_', ' ')}</dt>
                  <dd>
                    {streaks[type].currentCount} current · {streaks[type].bestCount} best
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        )}
        {legacyNotice && (
          <details className="text-xs text-text-secondary">
            <summary>About imported records</summary>
            <p className="mt-2">{legacyNotice}</p>
          </details>
        )}
      </section>
      {history && <RitualHistory onClose={() => setHistory(false)} />}
    </>
  )
}
