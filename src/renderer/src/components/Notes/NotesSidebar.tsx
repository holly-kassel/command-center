import { useMemo, useState, type Dispatch, type ReactElement, type SetStateAction } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { WeeklyNoteSummary } from '../../../../shared/types/obsidian'

type WeeklySectionName = 'priorities' | 'reflection'

interface NotesSidebarProps {
  weeklyNotes: WeeklyNoteSummary[]
  selectedDate: string | null
  selectedSection: WeeklySectionName | null
  todayStr: string
  isLoading: boolean
  onSelectDate: (dateStr: string, section?: WeeklySectionName) => void
}

const WEEKLY_SECTION_ITEMS = [
  { section: 'priorities', icon: '📋', label: 'Priorities' },
  { section: 'reflection', icon: '📝', label: 'Reflection' }
] as const

interface MonthGroup {
  key: string
  label: string
  notes: WeeklyNoteSummary[]
}

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMonthKeyFromDate(dateStr: string): string {
  const date = parseDate(dateStr)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getWeekStart(dateStr: string): string {
  const date = parseDate(dateStr)
  const day = date.getDay()
  const daysSinceMonday = day === 0 ? 6 : day - 1
  date.setDate(date.getDate() - daysSinceMonday)
  return toDateKey(date)
}

function formatMonthLabel(dateStr: string): string {
  return parseDate(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatShortDate(dateStr: string): string {
  return parseDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatWeekLabel(dateStr: string): string {
  return `Week of ${formatShortDate(dateStr)}`
}

function abbreviateDay(dayOfWeek: string): string {
  return dayOfWeek.slice(0, 3)
}

function toggleSetValue(value: string, setter: Dispatch<SetStateAction<Set<string>>>): void {
  setter((prev) => {
    const next = new Set(prev)

    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }

    return next
  })
}

export function NotesSidebar({
  weeklyNotes,
  selectedDate,
  selectedSection,
  todayStr,
  isLoading,
  onSelectDate
}: NotesSidebarProps): ReactElement {
  const currentWeekStart = useMemo(() => getWeekStart(todayStr), [todayStr])

  const monthGroups = useMemo<MonthGroup[]>(() => {
    const grouped = new Map<string, MonthGroup>()

    for (const note of weeklyNotes) {
      const monthKey = `${note.year}-${note.startDate.slice(5, 7)}`
      const existing = grouped.get(monthKey)

      if (existing) {
        existing.notes.push(note)
        continue
      }

      grouped.set(monthKey, {
        key: monthKey,
        label: formatMonthLabel(note.startDate),
        notes: [note]
      })
    }

    return Array.from(grouped.values())
  }, [weeklyNotes])

  const currentWeekNote = useMemo(
    () => weeklyNotes.find((note) => note.startDate === currentWeekStart) ?? null,
    [currentWeekStart, weeklyNotes]
  )

  const currentMonthKey = currentWeekNote
    ? `${currentWeekNote.year}-${currentWeekNote.startDate.slice(5, 7)}`
    : getMonthKeyFromDate(todayStr)

  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    () => new Set([currentMonthKey])
  )
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(() => new Set([currentWeekStart]))

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-surface-muted/20">
      <div className="border-b border-border/60 px-3 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Notes</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {isLoading ? (
          <div className="animate-pulse space-y-4 px-2 py-1">
            <div className="space-y-2">
              <div className="h-3 w-24 rounded bg-surface-muted/40" />
              <div className="space-y-2 pl-4">
                <div className="h-3 w-28 rounded bg-surface-muted/30" />
                <div className="space-y-2 pl-4">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="h-7 rounded-md bg-surface-muted/20" />
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-20 rounded bg-surface-muted/30" />
              <div className="h-3 w-24 rounded bg-surface-muted/20" />
            </div>
          </div>
        ) : weeklyNotes.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center">
            <p className="text-xs text-text-muted">No weekly notes found</p>
          </div>
        ) : (
          <div className="space-y-1">
            {monthGroups.map((month) => {
              const monthExpanded = expandedMonths.has(month.key)

              return (
                <div key={month.key} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleSetValue(month.key, setExpandedMonths)}
                    className="flex w-full items-center gap-1 rounded-md py-1 pl-2 pr-2 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary transition-colors hover:bg-surface-muted/30 hover:text-text-primary"
                    aria-expanded={monthExpanded}
                  >
                    <span className="w-3 text-[10px] text-text-muted">
                      {monthExpanded ? '▾' : '▸'}
                    </span>
                    <span>{month.label}</span>
                  </button>

                  <AnimatePresence initial={false}>
                    {monthExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-1">
                          {month.notes.map((note) => {
                            const weekKey = note.startDate
                            const weekExpanded = expandedWeeks.has(weekKey)

                            return (
                              <div key={weekKey} className="space-y-1">
                                <button
                                  type="button"
                                  onClick={() => toggleSetValue(weekKey, setExpandedWeeks)}
                                  className="flex w-full items-center gap-1 rounded-md py-1 pl-4 pr-2 text-left text-sm text-text-secondary transition-colors hover:bg-surface-muted/30 hover:text-text-primary"
                                  aria-expanded={weekExpanded}
                                >
                                  <span className="w-3 text-[10px] text-text-muted">
                                    {weekExpanded ? '▾' : '▸'}
                                  </span>
                                  <span>{formatWeekLabel(note.startDate)}</span>
                                </button>

                                <AnimatePresence initial={false}>
                                  {weekExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="space-y-1">
                                        <div className="space-y-0.5 border-b border-border/40 pb-1">
                                          {WEEKLY_SECTION_ITEMS.map(({ section, icon, label }) => {
                                            const isSelected =
                                              selectedDate === note.startDate &&
                                              selectedSection === section

                                            return (
                                              <button
                                                key={section}
                                                type="button"
                                                onClick={() =>
                                                  onSelectDate(note.startDate, section)
                                                }
                                                className={[
                                                  'relative flex w-full items-center gap-2 overflow-hidden rounded-md py-1 pl-6 pr-2 text-left text-xs italic transition-colors',
                                                  isSelected
                                                    ? 'text-primary'
                                                    : 'text-text-secondary hover:bg-surface-muted/25 hover:text-text-primary'
                                                ].join(' ')}
                                              >
                                                {isSelected && (
                                                  <motion.div
                                                    layoutId="sidebar-active"
                                                    className="absolute inset-0 rounded-md bg-primary/10"
                                                    transition={{
                                                      type: 'spring',
                                                      stiffness: 500,
                                                      damping: 35
                                                    }}
                                                  />
                                                )}
                                                <span className="relative z-10" aria-hidden="true">
                                                  {icon}
                                                </span>
                                                <span className="relative z-10">{label}</span>
                                              </button>
                                            )
                                          })}
                                        </div>

                                        <div className="space-y-0.5">
                                          {note.days.map((day) => {
                                            const isSelected =
                                              selectedDate === day.date && selectedSection === null
                                            const isToday = day.date === todayStr
                                            const baseTextColor = isSelected
                                              ? 'text-primary'
                                              : day.hasContent || isToday
                                                ? 'text-text-secondary'
                                                : 'text-text-muted'

                                            return (
                                              <button
                                                key={day.date}
                                                type="button"
                                                onClick={() => onSelectDate(day.date)}
                                                className={[
                                                  'relative flex w-full items-center gap-2 overflow-hidden rounded-md py-1 pl-6 pr-2 text-sm transition-colors',
                                                  baseTextColor,
                                                  isSelected
                                                    ? 'text-primary'
                                                    : 'hover:bg-surface-muted/25 hover:text-text-primary'
                                                ].join(' ')}
                                                aria-current={isToday ? 'date' : undefined}
                                              >
                                                {isSelected && (
                                                  <motion.div
                                                    layoutId="sidebar-active"
                                                    className="absolute inset-0 rounded-md bg-primary/10"
                                                    transition={{
                                                      type: 'spring',
                                                      stiffness: 500,
                                                      damping: 35
                                                    }}
                                                  />
                                                )}
                                                <span className="relative z-10 w-8 shrink-0 text-left">
                                                  {abbreviateDay(day.dayOfWeek)}
                                                </span>
                                                <span className="relative z-10 w-12 shrink-0 text-left">
                                                  {formatShortDate(day.date)}
                                                </span>
                                                <span className="relative z-10 ml-auto flex items-center gap-1.5">
                                                  {day.hasContent && (
                                                    <span
                                                      className="text-xs leading-none text-primary"
                                                      aria-hidden="true"
                                                    >
                                                      ●
                                                    </span>
                                                  )}
                                                  {isToday && (
                                                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                                      Today
                                                    </span>
                                                  )}
                                                </span>
                                              </button>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}
