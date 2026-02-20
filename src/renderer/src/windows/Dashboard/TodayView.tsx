/**
 * TodayView
 *
 * Displays today's section from the weekly note with
 * rendered markdown content, interactive checkboxes,
 * and an inline markdown editor toggle.
 *
 * Supports day-by-day navigation with arrow buttons so you
 * can reflect on previous weekdays' notes.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { useObsidianStore } from '../../store/obsidianStore'
import { useGoalStore } from '../../store/goalStore'
import { toast } from '../../utils/toast'
import type { TodaySection } from '../../../../shared/types/obsidian'

/** Format a Date as YYYY-MM-DD (local time) */
function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Shift a YYYY-MM-DD string by `delta` weekdays (skipping Sat/Sun) */
function shiftWeekday(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  let remaining = Math.abs(delta)
  const dir = delta > 0 ? 1 : -1
  while (remaining > 0) {
    d.setDate(d.getDate() + dir)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) remaining--
  }
  return toDateStr(d)
}

const todayStr = toDateStr(new Date())

export function TodayView(): React.JSX.Element {
  const { todaySection, currentFocus, isLoading, error, vaultStatus, updateTodayContent, toggleCheckbox } = useObsidianStore()
  const updateTaskCompletion = useGoalStore((s) => s.updateTaskCompletion)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Day navigation
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [historicalSection, setHistoricalSection] = useState<TodaySection | null>(null)
  const [navLoading, setNavLoading] = useState(false)
  const isToday = selectedDate === todayStr

  // The section to render: live store data for today, fetched data otherwise
  const activeSection = isToday ? todaySection : historicalSection

  // Fetch historical day section when navigating away from today
  useEffect(() => {
    if (isToday) {
      setHistoricalSection(null)
      return
    }
    let cancelled = false
    setNavLoading(true)
    window.api.obsidian.getDaySection(selectedDate).then((section) => {
      if (!cancelled) {
        setHistoricalSection(section)
        setNavLoading(false)
      }
    }).catch(() => {
      if (!cancelled) {
        setHistoricalSection(null)
        setNavLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [selectedDate, isToday])

  const goBack = useCallback(() => {
    setEditing(false)
    setSelectedDate((prev) => shiftWeekday(prev, -1))
  }, [])

  const goForward = useCallback(() => {
    setEditing(false)
    setSelectedDate((prev) => {
      const next = shiftWeekday(prev, 1)
      return next > todayStr ? prev : next
    })
  }, [])

  const goToday = useCallback(() => {
    setEditing(false)
    setSelectedDate(todayStr)
  }, [])

  // When entering edit mode, seed the draft with current content (today only)
  const startEditing = useCallback(() => {
    if (isToday && todaySection) {
      setDraft(todaySection.content)
      setEditing(true)
    }
  }, [todaySection, isToday])

  // Auto-focus and auto-resize textarea
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      autoResize(textareaRef.current)
    }
  }, [editing])

  const autoResize = (el: HTMLTextAreaElement): void => {
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      await updateTodayContent(draft)
      setEditing(false)
      toast.saved('Note saved')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = (): void => {
    setEditing(false)
    setDraft('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      handleCancel()
    }
  }

  // Handle checkbox clicks — determines the index from DOM position at
  // click time, avoiding render-time side effects that break under StrictMode
  const handleCheckboxChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
      const container = contentRef.current
      if (!container) return
      const allCheckboxes = Array.from(container.querySelectorAll('input[type="checkbox"]'))
      const idx = allCheckboxes.indexOf(e.target as HTMLInputElement)
      if (idx === -1) return
      try {
        await toggleCheckbox(idx)

        // Wire task-link: extract task text and notify goal system
        const li = (e.target as HTMLElement).closest('li')
        if (li) {
          const taskText = (li.textContent ?? '').trim()
          const isCompleted = (e.target as HTMLInputElement).checked
          // Fire-and-forget — don't block the toggle
          updateTaskCompletion(taskText, isCompleted).catch(() => {})
        }
      } catch {
        toast.error('Failed to toggle checkbox')
      }
    },
    [toggleCheckbox, updateTaskCompletion]
  )

  // Custom checkbox renderer — no render-time mutation, StrictMode safe
  const CheckboxInput = useCallback(
    (props: React.InputHTMLAttributes<HTMLInputElement>) => {
      if (props.type === 'checkbox') {
        return (
          <input
            type="checkbox"
            checked={props.checked}
            disabled={false}
            className="cursor-pointer accent-primary w-4 h-4 mr-1.5 align-middle rounded"
            onChange={handleCheckboxChange}
          />
        )
      }
      return <input {...props} />
    },
    [handleCheckboxChange]
  )

  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-surface-muted rounded w-1/3 mb-3"></div>
        <div className="h-3 bg-surface-muted rounded w-2/3 mb-2"></div>
        <div className="h-3 bg-surface-muted rounded w-1/2"></div>
      </div>
    )
  }

  if (!vaultStatus?.found) {
    return (
      <div className="card border-2 border-dashed border-border">
        <h3 className="text-lg font-semibold text-text-primary mb-2">No vault found</h3>
        <p className="text-text-secondary text-sm">
          Could not find an Obsidian vault. Make sure your vault is at{' '}
          <code className="text-xs bg-surface-muted px-1.5 py-0.5 rounded font-mono">
            ~/Documents/obsidian-notes/
          </code>
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card border border-urgent/20 bg-urgent-light/30">
        <p className="text-urgent text-sm">{error}</p>
      </div>
    )
  }

  if (!activeSection && !navLoading) {
    return (
      <div className="space-y-4">
        {/* Navigation arrows even when no notes */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={goBack} className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-muted transition-colors" title="Previous day">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <h2 className="text-xl font-bold text-text-primary">{selectedDate}</h2>
            <button onClick={goForward} disabled={isToday} className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Next day">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
            {!isToday && (
              <button onClick={goToday} className="ml-2 px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded-md transition-colors">Today</button>
            )}
          </div>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            {isToday ? 'No notes for today' : 'No notes for this day'}
          </h3>
          <p className="text-text-secondary text-sm">
            No section found in the weekly note.{' '}
            {isToday ? 'It might be the weekend, or the weekly note hasn\u2019t been created yet.' : 'This day may not have been logged.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with navigation arrows, day name, focus, and edit toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={goBack} className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-muted transition-colors" title="Previous day">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          {navLoading ? (
            <h2 className="text-xl font-bold text-text-primary animate-pulse">Loading…</h2>
          ) : (
            <h2 className="text-xl font-bold text-text-primary">
              {activeSection?.dayOfWeek}
              <span className="text-text-muted font-normal text-sm ml-2">{activeSection?.date}</span>
            </h2>
          )}
          <button onClick={goForward} disabled={isToday} className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Next day">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
          {!isToday && (
            <button onClick={goToday} className="ml-2 px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded-md transition-colors">Today</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isToday && currentFocus && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning-light text-warning text-xs font-medium">
              🔔 {currentFocus}
            </span>
          )}
          {isToday && !editing && (
            <button
              onClick={startEditing}
              className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-muted transition-colors"
              title="Edit markdown"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                <path d="m15 5 4 4"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content: edit mode (today only) or rendered view */}
      <div className="card">
        {editing && isToday ? (
          <div className="space-y-3">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                autoResize(e.target)
              }}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-text-primary font-mono text-sm leading-relaxed resize-none outline-none border border-border rounded-lg p-3 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors min-h-[200px]"
              spellCheck={false}
            />
            <div className="flex items-center justify-between">
              <span className="text-text-muted text-xs">
                ⌘S save · Esc cancel
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary rounded-md hover:bg-surface-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs bg-primary/20 text-primary rounded-md hover:bg-primary/30 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div ref={contentRef} className="prose prose-sm max-w-none text-text-primary prose-headings:text-text-primary prose-a:text-primary break-words overflow-hidden [&_li]:marker:text-text-tertiary">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={{ input: CheckboxInput }}>
              {activeSection?.content ?? ''}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
