/**
 * FocusSection Component
 *
 * Shows the current focus from the Obsidian weekly note.
 * Allows manually setting a new focus via quick capture.
 */
import { useState } from 'react'
import { useObsidianStore } from '../../store/obsidianStore'

export function FocusSection(): React.ReactElement {
  const { currentFocus, appendToToday } = useObsidianStore()
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSetFocus = async (): Promise<void> => {
    const trimmed = input.trim()
    if (!trimmed) return

    setSaving(true)
    try {
      await appendToToday(`🎯 Focus: ${trimmed}`)
      setInput('')
      setEditing(false)
    } catch {
      // error handled by store
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border border-surface-border/60 bg-surface-secondary/30 p-4">
      <h2 className="text-text-primary mb-3 text-sm font-semibold tracking-wide uppercase">
        Current Focus
      </h2>

      {currentFocus ? (
        <div className="flex items-start gap-2">
          <span className="text-lg">🎯</span>
          <div className="flex-1">
            <p className="text-text-primary text-sm font-medium leading-snug">
              {currentFocus}
            </p>
            <button
              onClick={() => setEditing(!editing)}
              className="text-text-tertiary hover:text-text-secondary mt-1 text-xs transition-colors"
            >
              Change focus
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-2">
          <p className="text-text-tertiary text-sm mb-2">No focus set for today</p>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="bg-focus/10 text-focus hover:bg-focus/20 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            >
              Set Focus
            </button>
          )}
        </div>
      )}

      {editing && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSetFocus()}
            placeholder="What's your main focus?"
            className="flex-1 rounded-lg border border-surface-border bg-background px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-focus focus:outline-none"
            autoFocus
          />
          <button
            onClick={handleSetFocus}
            disabled={!input.trim() || saving}
            className="bg-focus hover:bg-focus/90 disabled:bg-focus/50 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white transition-colors"
          >
            {saving ? '...' : 'Set'}
          </button>
          <button
            onClick={() => { setEditing(false); setInput('') }}
            className="text-text-tertiary hover:text-text-secondary text-xs"
          >
            ✕
          </button>
        </div>
      )}
    </section>
  )
}
