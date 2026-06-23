import { useState, useEffect, useCallback } from 'react'
import { useObsidianStore } from '../../store/obsidianStore'
import { useGoalStore } from '../../store/goalStore'
import { NotesSidebar } from './NotesSidebar'
import { NoteEditor } from './NoteEditor'
import { toast } from '../../utils/toast'
import { useTodayStr } from '../../hooks/useTodayStr'
import type { TodaySection, WeeklySectionResult } from '../../../../shared/types/obsidian'

type WeeklySectionName = 'priorities' | 'reflection'

function toDateStr(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Get the most recent weekday — if today is Sat/Sun, fall back to Friday */
function toWeekdayStr(date: Date): string {
  const d = new Date(date)
  const dow = d.getDay()
  if (dow === 0) d.setDate(d.getDate() - 2) // Sunday → Friday
  else if (dow === 6) d.setDate(d.getDate() - 1) // Saturday → Friday
  return toDateStr(d)
}

export function NotesView(): React.JSX.Element {
  const actualToday = useTodayStr()
  const todayStr = toWeekdayStr(new Date(actualToday + 'T12:00:00'))
  const store = useObsidianStore()
  const updateTaskCompletion = useGoalStore((s) => s.updateTaskCompletion)
  const [historicalSection, setHistoricalSection] = useState<TodaySection | null>(null)
  const [selectedSection, setSelectedSection] = useState<WeeklySectionName | null>(null)
  const [weeklySectionContent, setWeeklySectionContent] = useState<WeeklySectionResult | null>(null)
  const [fetchedForDate, setFetchedForDate] = useState<string | null>(null)
  const [fetchedWeeklyKey, setFetchedWeeklyKey] = useState<string | null>(null)

  const selectedDate = store.selectedDate ?? todayStr
  const isActualToday = selectedDate === actualToday
  const selectedWeeklyKey = selectedSection ? `${selectedDate}:${selectedSection}` : null
  const activeContent = selectedSection && weeklySectionContent ? weeklySectionContent : null
  // Only use live store.todaySection when viewing the actual current date (not weekend fallback)
  const activeSection = selectedSection ? null : isActualToday ? store.todaySection : historicalSection
  const navLoading = !selectedSection && !isActualToday && fetchedForDate !== selectedDate
  const weeklyLoading = selectedWeeklyKey !== null && fetchedWeeklyKey !== selectedWeeklyKey

  const handleSelectDate = useCallback(
    (dateStr: string, section?: WeeklySectionName): void => {
      store.selectDate(dateStr)
      setSelectedSection(section ?? null)
      setWeeklySectionContent(null)
      setFetchedWeeklyKey(null)
    },
    [store]
  )

  // Fetch historical day section when navigating away from today
  useEffect(() => {
    if (isActualToday || selectedSection) return
    let cancelled = false
    window.api.obsidian.getDaySection(selectedDate).then((section) => {
      if (!cancelled) {
        setHistoricalSection(section)
        setFetchedForDate(selectedDate)
      }
    }).catch(() => {
      if (!cancelled) {
        setHistoricalSection(null)
        setFetchedForDate(selectedDate)
      }
    })
    return () => { cancelled = true }
  }, [selectedDate, isActualToday, selectedSection])

  useEffect(() => {
    if (!selectedSection) {
      return
    }

    let cancelled = false
    const requestKey = `${selectedDate}:${selectedSection}`

    const loadWeeklySection = async (): Promise<void> => {
      try {
        const result = await window.api.obsidian.getWeeklySection(selectedDate, selectedSection)
        if (!cancelled) {
          setWeeklySectionContent(result)
          setFetchedWeeklyKey(requestKey)
        }
      } catch {
        if (!cancelled) {
          setWeeklySectionContent(null)
          setFetchedWeeklyKey(requestKey)
        }
      }
    }

    void loadWeeklySection()

    return () => {
      cancelled = true
    }
  }, [selectedDate, selectedSection])

  const handleSave = useCallback(
    async (content: string): Promise<void> => {
      const dateStr = store.selectedDate ?? todayStr

      if (selectedSection) {
        await window.api.obsidian.updateWeeklySection(dateStr, selectedSection, content)
        setWeeklySectionContent((prev) => (prev ? { ...prev, content } : prev))
      } else {
        await store.updateDayContent(dateStr, content)
        if (dateStr !== todayStr) {
          setHistoricalSection((current) =>
            current ? { ...current, content, date: dateStr } : current
          )
        }
      }

      toast.saved('Note saved')
    },
    [store, todayStr, selectedSection]
  )

  const handleCheckboxToggle = useCallback(
    async (index: number): Promise<void> => {
      if (!isActualToday) {
        return
      }

      try {
        await store.toggleCheckbox(index)
      } catch {
        toast.error('Failed to toggle checkbox')
      }
    },
    [isActualToday, store]
  )

  const handleTaskCompletion = useCallback(
    (taskText: string, completed: boolean): void => {
      updateTaskCompletion(taskText, completed).catch(() => {})
    },
    [updateTaskCompletion]
  )

  const editorPane = (() => {
    if (store.isLoading || navLoading || weeklyLoading) {
      return (
        <div className="flex-1 animate-pulse p-6">
          <div className="mb-4 h-6 w-40 rounded bg-surface-muted/40" />
          <div className="mb-3 h-4 w-56 rounded bg-surface-muted/30" />
          <div className="space-y-3">
            <div className="h-24 rounded bg-surface-muted/20" />
            <div className="h-24 rounded bg-surface-muted/20" />
            <div className="h-24 rounded bg-surface-muted/20" />
          </div>
        </div>
      )
    }

    if (!store.vaultStatus?.found) {
      return (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h2 className="text-lg font-semibold text-text-primary">No vault found</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Could not find an Obsidian vault. Make sure your vault is at{' '}
              <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs">
                {store.vaultStatus?.path || '~/Documents/obsidian-notes/'}
              </code>
            </p>
          </div>
        </div>
      )
    }

    if (store.error) {
      return (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded-lg border border-urgent/20 bg-urgent-light/30 px-4 py-3 text-sm text-urgent">
            {store.error}
          </div>
        </div>
      )
    }

    if (!activeContent && !activeSection) {
      return (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h2 className="text-lg font-semibold text-text-primary">
              {selectedSection ? 'No weekly section found' : 'No notes for this day'}
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              {selectedSection
                ? `No ${selectedSection} section was found for the week of ${selectedDate}.`
                : `No notes were found for ${selectedDate}.`}
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-0 flex-1 p-4">
        {activeContent ? (
          <NoteEditor
            key={`weekly-${selectedDate}-${selectedSection}`}
            content={activeContent.content}
            dayOfWeek={selectedSection === 'priorities' ? 'Weekly Priorities' : 'Weekly Reflection'}
            dateStr={`Week of ${activeContent.weekStart}`}
            isToday={false}
            currentFocus={null}
            onSave={handleSave}
            onCheckboxToggle={() => undefined}
          />
        ) : activeSection ? (
          <NoteEditor
            key={`day-${activeSection.date}`}
            content={activeSection.content}
            dayOfWeek={activeSection.dayOfWeek}
            dateStr={activeSection.date}
            isToday={isActualToday}
            currentFocus={isActualToday ? store.currentFocus : null}
            onSave={handleSave}
            onCheckboxToggle={(index) => {
              void handleCheckboxToggle(index)
            }}
            onTaskCompletion={handleTaskCompletion}
          />
        ) : null}
      </div>
    )
  })()

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex h-[600px] min-h-[500px] max-h-[700px]">
        <NotesSidebar
          weeklyNotes={store.weeklyNotes}
          selectedDate={selectedDate}
          selectedSection={selectedSection}
          todayStr={todayStr}
          isLoading={store.sidebarLoading}
          onSelectDate={handleSelectDate}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">{editorPane}</div>
      </div>
    </div>
  )
}
