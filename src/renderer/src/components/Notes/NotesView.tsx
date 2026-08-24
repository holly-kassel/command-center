import { useEffect, useState } from 'react'
import { useObsidianStore } from '../../store/obsidianStore'
import { NotesSidebar } from './NotesSidebar'
import { NoteEditor } from './NoteEditor'
import { useTodayStr } from '../../hooks/useTodayStr'
import type { TodaySection, WeeklySectionResult } from '../../../../shared/types/obsidian'

type WeeklySectionName = 'priorities' | 'reflection'

export function NotesView(): React.JSX.Element {
  const todayStr = useTodayStr()
  const store = useObsidianStore()
  const [historicalSection, setHistoricalSection] = useState<TodaySection | null>(null)
  const [selectedSection, setSelectedSection] = useState<WeeklySectionName | null>(null)
  const [weeklySection, setWeeklySection] = useState<WeeklySectionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const selectedDate = store.selectedDate ?? todayStr
  const isToday = selectedDate === todayStr

  useEffect(() => {
    let cancelled = false
    const request = selectedSection
      ? window.api.obsidian.getWeeklySection(selectedDate, selectedSection)
      : isToday
        ? Promise.resolve(store.todaySection)
        : window.api.obsidian.getDaySection(selectedDate)
    request
      .then((result) => {
        if (cancelled) return
        if (selectedSection) setWeeklySection(result as WeeklySectionResult | null)
        else setHistoricalSection(result as TodaySection | null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isToday, selectedDate, selectedSection, store.todaySection])

  const activeSection = isToday ? store.todaySection : historicalSection
  const content = selectedSection ? weeklySection?.content : activeSection?.content
  const title = selectedSection
    ? selectedSection === 'priorities'
      ? 'Weekly priorities'
      : 'Weekly reflection'
    : activeSection?.dayOfWeek
  const dateLabel = selectedSection
    ? (weeklySection?.weekStart ?? selectedDate)
    : activeSection?.date

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex h-[600px] min-h-[500px] max-h-[700px]">
        <NotesSidebar
          weeklyNotes={store.weeklyNotes}
          selectedDate={selectedDate}
          selectedSection={selectedSection}
          todayStr={todayStr}
          isLoading={store.sidebarLoading}
          onSelectDate={(dateStr, section) => {
            store.selectDate(dateStr)
            setSelectedSection(section ?? null)
            setWeeklySection(null)
          }}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
          {store.isLoading || loading ? (
            <div className="flex-1 animate-pulse p-6">
              <div className="mb-4 h-6 w-40 rounded bg-surface-muted/40" />
              <div className="h-48 rounded bg-surface-muted/20" />
            </div>
          ) : !store.vaultStatus?.found ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-text-secondary">
              Configure your Obsidian vault in Settings.
            </div>
          ) : content && title && dateLabel ? (
            <div className="min-h-0 flex-1 p-4">
              <NoteEditor
                content={content}
                dayOfWeek={title}
                dateStr={dateLabel}
                currentFocus={!selectedSection && isToday ? store.currentFocus : null}
              />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-text-secondary">
              No notes were found for this selection.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
