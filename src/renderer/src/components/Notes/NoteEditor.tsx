import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import { toast } from '../../utils/toast'
import { MarkdownPreview } from './MarkdownPreview'
import { MarkdownToolbar } from './MarkdownToolbar'
import { insertLink, toggleBold, toggleItalic, type EditorActionResult } from './editorActions'

interface NoteEditorProps {
  /** The content to edit */
  content: string
  /** Day of week, e.g. "Monday" */
  dayOfWeek: string
  /** Date string, e.g. "2026-03-16" */
  dateStr: string
  /** Whether this is today's note */
  isToday: boolean
  /** Current focus text (shown as badge, only for today) */
  currentFocus: string | null
  /** Called when content should be saved */
  onSave: (content: string) => Promise<void>
  /** Called when a checkbox is toggled in preview mode */
  onCheckboxToggle: (checkboxIndex: number) => void
  /** Called when goal task completion changes */
  onTaskCompletion?: (taskText: string, completed: boolean) => void
}

type EditorInput = {
  text: string
  selectionStart: number
  selectionEnd: number
}

type EditorShortcut = (input: EditorInput) => EditorActionResult

type CheckboxInteraction = {
  checked: boolean
  taskText: string | null
}

function SaveStatus({ isDirty, saving }: { isDirty: boolean; saving: boolean }): React.JSX.Element {
  if (saving) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
        <span
          className="h-3.5 w-3.5 rounded-full border border-text-muted/40 border-t-transparent animate-spin"
          aria-hidden="true"
        />
        Saving...
      </span>
    )
  }

  if (isDirty) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warning">
        <span className="text-[10px] leading-none" aria-hidden="true">
          ●
        </span>
        Unsaved changes
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
      <span aria-hidden="true">✓</span>
      Saved
    </span>
  )
}

export function NoteEditor({
  content,
  dayOfWeek,
  dateStr,
  isToday,
  currentFocus,
  onSave,
  // onCheckboxToggle — now handled locally in handlePreviewCheckboxToggle
  onTaskCompletion
}: NoteEditorProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('preview')
  const [draft, setDraft] = useState(content)
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const draftRef = useRef(content)
  const lastPropContentRef = useRef(content)
  const lastSavedContentRef = useRef(content)
  const lastCheckboxInteractionRef = useRef<CheckboxInteraction | null>(null)

  const formattedDate = useMemo(() => {
    const date = new Date(`${dateStr}T12:00:00`)

    if (Number.isNaN(date.getTime())) {
      return `${dayOfWeek} — ${dateStr}`
    }

    return `${dayOfWeek} — ${date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })}`
  }, [dateStr, dayOfWeek])

  const autoResize = useCallback((textarea: HTMLTextAreaElement | null): void => {
    if (!textarea) {
      return
    }

    textarea.style.height = '0px'
    textarea.style.height = `${Math.max(textarea.scrollHeight, 300)}px`
  }, [])

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    if (content === lastPropContentRef.current) {
      return
    }

    lastPropContentRef.current = content

    // If the incoming content matches what we last saved, it's our own save echoing back
    if (content === lastSavedContentRef.current) {
      return
    }

    // External change — update the saved baseline
    lastSavedContentRef.current = content

    // Only overwrite draft if user hasn't made unsaved edits
    if (!isDirty) {
      draftRef.current = content
      setDraft(content)
      setIsDirty(false)
    }
  }, [content, isDirty])

  useEffect(() => {
    if (activeTab === 'write') {
      autoResize(textareaRef.current)
    }
  }, [activeTab, autoResize, draft])

  const applyEditorAction = useCallback(
    ({ text, selectionStart, selectionEnd }: EditorActionResult): void => {
      draftRef.current = text
      setDraft(text)
      setIsDirty(text !== lastSavedContentRef.current)

      requestAnimationFrame(() => {
        const textarea = textareaRef.current
        if (!textarea) {
          return
        }

        textarea.focus()
        textarea.setSelectionRange(selectionStart, selectionEnd)
        autoResize(textarea)
      })
    },
    [autoResize]
  )

  const runShortcut = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>, action: EditorShortcut): void => {
      const textarea = event.currentTarget
      applyEditorAction(
        action({
          text: textarea.value,
          selectionStart: textarea.selectionStart,
          selectionEnd: textarea.selectionEnd
        })
      )
    },
    [applyEditorAction]
  )

  const savingRef = useRef(false)
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Core save logic — used by both manual save and auto-save
  const saveNow = useCallback(async (): Promise<void> => {
    const contentToSave = draftRef.current
    if (savingRef.current || contentToSave === lastSavedContentRef.current) return

    savingRef.current = true
    setSaving(true)
    try {
      await onSave(contentToSave)
      lastSavedContentRef.current = contentToSave
      setIsDirty(draftRef.current !== contentToSave)
    } catch {
      toast.error('Failed to save')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [onSave])

  const handleSave = useCallback(async (): Promise<void> => {
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    await saveNow()
  }, [saveNow])

  // Debounced auto-save: saves 1.5s after user stops typing
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    autoSaveTimeoutRef.current = setTimeout(() => { void saveNow() }, 1500)
  }, [saveNow])

  // Auto-save on unmount (navigating away)
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
      if (draftRef.current !== lastSavedContentRef.current) {
        void onSave(draftRef.current).catch(() => {})
      }
    }
  }, [onSave])

  const handleTextareaChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>): void => {
      const nextDraft = event.target.value
      draftRef.current = nextDraft
      setDraft(nextDraft)
      setIsDirty(nextDraft !== lastSavedContentRef.current)
      autoResize(event.target)
      scheduleAutoSave()
    },
    [autoResize, scheduleAutoSave]
  )

  const handleTextareaKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>): void => {
      const key = event.key.toLowerCase()
      const hasModifier = event.metaKey || event.ctrlKey

      if (hasModifier && key === 's') {
        event.preventDefault()
        void handleSave()
        return
      }

      if (hasModifier && key === 'b') {
        event.preventDefault()
        runShortcut(event, toggleBold)
        return
      }

      if (hasModifier && key === 'i') {
        event.preventDefault()
        runShortcut(event, toggleItalic)
        return
      }

      if (hasModifier && key === 'k') {
        event.preventDefault()
        runShortcut(event, insertLink)
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        void handleSave()
        setActiveTab('preview')
      }
    },
    [handleSave, runShortcut]
  )

  const handlePreviewCheckboxCapture = useCallback((event: FormEvent<HTMLDivElement>): void => {
    const target = event.target

    if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') {
      return
    }

    lastCheckboxInteractionRef.current = {
      checked: target.checked,
      taskText: target.closest('li')?.textContent?.trim() ?? null
    }
  }, [])

  const handlePreviewCheckboxToggle = useCallback(
    (checkboxIndex: number): void => {
      // Toggle the checkbox directly in the draft text instead of going through
      // the file-level toggle, which would conflict with the editor's local draft.
      const lines = draftRef.current.split('\n')
      let checkboxCount = 0
      let toggledLine = -1

      for (let i = 0; i < lines.length; i++) {
        if (/^\s*[-*]\s\[[ xX]\]/.test(lines[i])) {
          if (checkboxCount === checkboxIndex) {
            toggledLine = i
            break
          }
          checkboxCount++
        }
      }

      if (toggledLine === -1) return

      const line = lines[toggledLine]
      if (/^\s*[-*]\s\[ \]/.test(line)) {
        lines[toggledLine] = line.replace(/^(\s*[-*]\s)\[ \]/, '$1[x]')
      } else {
        lines[toggledLine] = line.replace(/^(\s*[-*]\s)\[x\]/i, '$1[ ]')
      }

      const newDraft = lines.join('\n')
      draftRef.current = newDraft
      setDraft(newDraft)
      setIsDirty(true)
      scheduleAutoSave()

      // Also notify the parent for goal task linking
      const interaction = lastCheckboxInteractionRef.current
      if (interaction?.taskText) {
        onTaskCompletion?.(interaction.taskText, interaction.checked)
      }
    },
    [onTaskCompletion, scheduleAutoSave]
  )

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background">
      <div className="border-b border-border px-4 pt-4">
        <div className="flex items-start justify-between gap-3 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{formattedDate}</h2>
          </div>

          {isToday && currentFocus ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning-light text-warning text-xs font-medium">
              🔔 {currentFocus}
            </span>
          ) : null}
        </div>

        <div className="flex items-end justify-between gap-4">
          <div role="tablist" aria-label="Editor mode" className="flex items-center gap-5">
            {(['write', 'preview'] as const).map((tab) => {
              const isActive = activeTab === tab

              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={[
                    'border-b-2 pb-3 text-sm font-medium capitalize transition-colors',
                    isActive
                      ? 'text-text-primary border-primary'
                      : 'border-transparent text-text-muted hover:text-text-secondary'
                  ].join(' ')}
                  onClick={() => {
                    if (tab === 'preview' && activeTab === 'write') void handleSave()
                    setActiveTab(tab)
                  }}
                >
                  {tab}
                </button>
              )
            })}
          </div>

          <SaveStatus isDirty={isDirty} saving={saving} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {activeTab === 'write' ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <MarkdownToolbar textareaRef={textareaRef} onApplyAction={applyEditorAction} />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={handleTextareaChange}
                onKeyDown={handleTextareaKeyDown}
                className="min-h-[300px] w-full resize-none bg-transparent p-4 font-mono text-sm leading-relaxed text-text-primary outline-none"
                spellCheck={false}
              />
            </div>
            <div className="border-t border-border px-4 py-2 text-xs text-text-muted">
              Auto-saves · ⌘S force save · ⌘B bold · ⌘I italic · ⌘K link
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div
              className="min-h-0 flex-1 overflow-y-auto p-4"
              onChangeCapture={handlePreviewCheckboxCapture}
            >
              <MarkdownPreview content={draft} onCheckboxToggle={handlePreviewCheckboxToggle} />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
