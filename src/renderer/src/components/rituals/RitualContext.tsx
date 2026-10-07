import { useEffect, useState } from 'react'
import { addDays, localDate } from '@shared/ritualLogic'
import type { CalendarEvent } from '@shared/types/calendar'
import { useObsidianStore } from '../../store/obsidianStore'
import { useKanbanStore } from '../../store/kanbanStore'

export function RitualCalendar({
  date,
  upcomingOnly = false,
  pastOnly = false
}: {
  date: string
  upcomingOnly?: boolean
  pastOnly?: boolean
}): React.ReactElement {
  const [result, setResult] = useState<{
    date: string
    attempt: number
    events: CalendarEvent[]
    status: string
    loaded: boolean
    fetchedAt: Date | null
  } | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      try {
        if (!(await window.api.auth.isAuthenticated())) {
          if (!cancelled)
            setResult({
              date,
              attempt: retry,
              events: [],
              loaded: false,
              fetchedAt: null,
              status:
                'Calendar is disconnected. Connect it in Settings when you want schedule context.'
            })
          return
        }
        const start = new Date(`${date}T00:00:00`)
        const end = new Date(`${addDays(date, 1)}T00:00:00`)
        const events = await window.api.calendar.getEvents(start.toISOString(), end.toISOString())
        if (!cancelled) {
          setResult({
            date,
            attempt: retry,
            events,
            status: '',
            loaded: true,
            fetchedAt: new Date()
          })
        }
      } catch (error) {
        if (!cancelled)
          setResult({
            date,
            attempt: retry,
            events: [],
            loaded: false,
            fetchedAt: null,
            status: error instanceof Error ? error.message : 'Could not load calendar.'
          })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [date, retry])
  const current = result?.date === date && result.attempt === retry ? result : null
  const loaded = current?.loaded ?? false
  const status = current?.status ?? 'Loading calendar…'
  const rows = [...new Map((current?.events ?? []).map((event) => [event.id, event])).values()]
    .filter((event) => !event.isAllDay)
    .filter(
      (event) =>
        !upcomingOnly || date !== localDate(now) || new Date(event.start).getTime() > now.getTime()
    )
    .filter((event) => !pastOnly || new Date(event.end).getTime() < now.getTime())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  return (
    <section
      className="rounded-lg bg-surface-muted/20 p-3 space-y-2 text-sm"
      aria-label={`Calendar for ${date}`}
    >
      <h3 className="font-medium">
        {pastOnly ? 'Past scheduled meetings' : upcomingOnly ? 'Upcoming schedule' : 'Schedule'} ·{' '}
        {date}
      </h3>
      {loaded ? (
        <>
          {rows.length ? (
            <ul className="space-y-2 max-h-40 overflow-y-auto">
              {rows.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <time dateTime={event.start} className="text-text-secondary shrink-0">
                    {new Date(event.start).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </time>
                  <span>{event.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-secondary">
              No {pastOnly ? 'past scheduled' : upcomingOnly ? 'upcoming' : 'timed'} meetings in
              this range.
            </p>
          )}
          <p className="text-xs text-text-secondary">
            Calendar fetched at{' '}
            {current?.fetchedAt?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.
            Scheduled events do not confirm attendance.
          </p>
        </>
      ) : (
        <p role="status" className="text-text-secondary">
          {status}
        </p>
      )}
      <button onClick={() => setRetry((count) => count + 1)} className="text-xs text-primary">
        Refresh calendar
      </button>
      {!loaded && (
        <p className="text-xs text-text-secondary">You can continue without calendar context.</p>
      )}
    </section>
  )
}

export function RitualTasks({
  date,
  pending = false
}: {
  date: string
  pending?: boolean
}): React.ReactElement {
  const tasks = useKanbanStore((s) => s.tasks)
  const taskError = useKanbanStore((s) => s.error)
  const taskLoading = useKanbanStore((s) => s.isLoading)
  const section = useObsidianStore((s) => s.todaySection)
  const vault = useObsidianStore((s) => s.vaultStatus)
  const obsidianError = useObsidianStore((s) => s.error)
  const rows = tasks.filter((task) =>
    pending ? task.status !== 'done' : task.status === 'done' && task.completedDate === date
  )
  const checked =
    !pending && section?.date === date
      ? section.content.split('\n').flatMap((line) => {
          const match = line.match(/^\s*[-*]\s+\[x\]\s+(.+)$/i)
          return match ? [match[1]] : []
        })
      : []
  useEffect(() => {
    void useKanbanStore.getState().refreshTasks()
  }, [])
  return (
    <section className="text-sm space-y-2">
      <h3 className="font-medium">
        {pending ? 'Pending tasks · not a due-date list' : `Completed tasks · ${date}`}
      </h3>
      {taskError ? (
        <p role="status" className="text-warning">
          Kanban: {taskError}
        </p>
      ) : taskLoading ? (
        <p>Loading Kanban…</p>
      ) : rows.length ? (
        <ul className="space-y-1 max-h-40 overflow-y-auto">
          {rows.map((task) => (
            <li key={task.id}>
              <span className="text-text-secondary text-xs">Kanban · </span>
              {task.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-text-secondary">
          No {pending ? 'pending' : 'completed'} Kanban tasks in this range.
        </p>
      )}
      {!pending && (
        <>
          {obsidianError ? (
            <p className="text-warning">Obsidian: {obsidianError}</p>
          ) : !vault?.found ? (
            <p className="text-text-secondary">Obsidian is not connected.</p>
          ) : section?.date !== date ? (
            <p className="text-text-secondary">
              Obsidian context is only available for the loaded note date.
            </p>
          ) : checked.length ? (
            <ul className="space-y-1 max-h-32 overflow-y-auto">
              {checked.map((text, index) => (
                <li key={`${index}:${text}`}>
                  <span className="text-text-secondary text-xs">Obsidian checkbox · </span>
                  {text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-secondary">No checked tasks in this Obsidian section.</p>
          )}
          {checked.length > 0 && (
            <p className="text-xs text-text-secondary">
              Checkboxes belong to this note, but do not confirm when a task was completed.
            </p>
          )}
        </>
      )}
    </section>
  )
}
