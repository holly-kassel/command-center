/**
 * TodayView
 *
 * Displays today's section from the weekly note with
 * rendered markdown content, interactive checkboxes,
 * and an inline markdown editor toggle.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useObsidianStore } from '../../store/obsidianStore'
import { toast } from '../../utils/toast'

export function TodayView(): React.JSX.Element {
  const { todaySection, currentFocus, isLoading, error, vaultStatus, updateTodayContent, toggleCheckbox } = useObsidianStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const checkboxIndexRef = useRef(0)

  // Reset the checkbox counter before each render
  checkboxIndexRef.current = 0

  // When entering edit mode, seed the draft with current content
  const startEditing = useCallback(() => {
    if (todaySection) {
      setDraft(todaySection.content)
      setEditing(true)
    }
  }, [todaySection])

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

  // Handle checkbox clicks — passes the Nth checkbox index directly
  const handleCheckboxToggle = useCallback(
    async (index: number): Promise<void> => {
      try {
        await toggleCheckbox(index)
      } catch {
        toast.error('Failed to toggle checkbox')
      }
    },
    [toggleCheckbox]
  )

  // Custom checkbox renderer — uses a render-time counter so each
  // checkbox gets its sequential index (0, 1, 2, ...) which maps
  // directly to the Nth checkbox in the file's day section
  const CheckboxInput = useCallback(
    (props: React.InputHTMLAttributes<HTMLInputElement>) => {
      if (props.type === 'checkbox') {
        const idx = checkboxIndexRef.current++

        return (
          <input
            type="checkbox"
            checked={props.checked}
            disabled={false}
            className="cursor-pointer accent-primary w-4 h-4 mr-1.5 align-middle rounded"
            onChange={() => handleCheckboxToggle(idx)}
          />
        )
      }
      return <input {...props} />
    },
    [handleCheckboxToggle]
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

  if (!todaySection) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-text-primary mb-2">No notes for today</h3>
        <p className="text-text-secondary text-sm">
          No section found for today in the current weekly note. It might be the weekend, or the
          weekly note hasn&apos;t been created yet.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with day name, focus, and edit toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-primary">
          {todaySection.dayOfWeek}
          <span className="text-text-muted font-normal text-sm ml-2">{todaySection.date}</span>
        </h2>
        <div className="flex items-center gap-2">
          {currentFocus && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning-light text-warning text-xs font-medium">
              🔔 {currentFocus}
            </span>
          )}
          {!editing && (
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

      {/* Content: edit mode or rendered view */}
      <div className="card">
        {editing ? (
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
          <div className="prose prose-sm max-w-none text-text-primary prose-headings:text-text-primary prose-a:text-primary break-words overflow-hidden [&_li]:marker:text-text-tertiary">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ input: CheckboxInput }}>
              {todaySection.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
