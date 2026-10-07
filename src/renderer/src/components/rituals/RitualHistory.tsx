import { useEffect, useState } from 'react'
import { addDays, localDate } from '@shared/ritualLogic'
import type { DailyLog, RitualType } from '@shared/types/ritual'
import { useRitualStore } from '../../store/ritualStore'
import { RitualDialog } from './RitualDialog'

export function RitualHistory({ onClose }: { onClose: () => void }): React.ReactElement {
  const [end, setEnd] = useState(localDate())
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [selected, setSelected] = useState<DailyLog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let cancelled = false
    window.api.ritual
      .getLogsInRange(addDays(end, -29), end)
      .then((data) => {
        if (!cancelled) {
          setLogs(
            data
              .filter(
                (log) =>
                  log.morningRitualCompleted || log.eveningRitualCompleted || log.touchGrassCount
              )
              .reverse()
          )
          setLoading(false)
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Could not load ritual history.')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [end, retry])
  const edit = async (type: RitualType, date: string): Promise<void> => {
    await useRitualStore.getState().startRitual(type, date)
    if (useRitualStore.getState().activeRitual) onClose()
    else setError(useRitualStore.getState().error)
  }
  const navigate = (date: string): void => {
    setSelected(null)
    setLoading(true)
    setError(null)
    setEnd(date)
  }
  return (
    <RitualDialog title="Ritual history" onClose={onClose}>
      <div className="flex justify-between items-center text-xs">
        <button
          onClick={() => {
            navigate(addDays(end, -30))
          }}
        >
          ← Earlier
        </button>
        <span>
          {addDays(end, -29)} to {end}
        </span>
        <button
          disabled={end >= localDate()}
          onClick={() => {
            navigate(addDays(end, 30) > localDate() ? localDate() : addDays(end, 30))
          }}
          className="disabled:opacity-40"
        >
          Later →
        </button>
      </div>
      {error && (
        <div role="alert" className="text-urgent text-sm">
          {error}{' '}
          <button
            onClick={() => {
              setError(null)
              setLoading(true)
              setRetry((value) => value + 1)
            }}
          >
            Retry
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">Loading history…</p>
      ) : (
        <div className="space-y-2">
          {logs.length ? (
            logs.map((log) => (
              <button
                key={log.date}
                onClick={() => setSelected(log)}
                aria-pressed={selected?.date === log.date}
                className="w-full text-left text-sm p-2 rounded-lg bg-surface-muted/30"
              >
                {log.date} · {log.morningRitualCompleted ? 'Morning ✓' : 'Morning —'} ·{' '}
                {log.eveningRitualCompleted ? 'Evening ✓' : 'Evening —'} · {log.touchGrassCount}{' '}
                resets
              </button>
            ))
          ) : (
            <p className="text-sm text-text-secondary">No saved rituals in this range.</p>
          )}
        </div>
      )}
      {selected && (
        <section className="space-y-3 border-t border-surface-border pt-3 text-sm">
          <h3 className="font-medium">{selected.date}</h3>
          {selected.legacyData && (
            <p className="text-warning text-xs">
              Imported legacy record. Some dates and focus outcomes are uncertain.
            </p>
          )}
          <p className="whitespace-pre-wrap break-words">
            Intention: {selected.intention || 'Not recorded'}
          </p>
          <p className="whitespace-pre-wrap break-words">
            Wins: {selected.untrackedWins || 'Not recorded'}
          </p>
          <p className="whitespace-pre-wrap break-words">
            Went well: {selected.reflection?.wentWell || 'Not recorded'}
          </p>
          <p className="whitespace-pre-wrap break-words">
            Could improve: {selected.reflection?.couldImprove || 'Not recorded'}
          </p>
          <p className="whitespace-pre-wrap break-words">
            Gratitude: {selected.gratitude || 'Not recorded'}
          </p>
          <p>
            Energy: {selected.energyLevel ?? 'Unanswered'} · Focus outcome:{' '}
            {selected.focusAchieved === null
              ? 'Unknown'
              : selected.focusAchieved
                ? 'Achieved'
                : 'Not achieved'}
          </p>
          <div className="flex gap-3">
            {selected.morningRitualCompleted && (
              <button className="text-focus" onClick={() => void edit('morning', selected.date)}>
                Edit morning
              </button>
            )}
            {selected.eveningRitualCompleted && (
              <button className="text-accent" onClick={() => void edit('evening', selected.date)}>
                Edit evening
              </button>
            )}
          </div>
        </section>
      )}
    </RitualDialog>
  )
}
