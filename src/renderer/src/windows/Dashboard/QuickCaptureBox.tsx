/**
 * QuickCaptureBox
 *
 * Text input that appends timestamped entries to today's
 * "Tasks & Notes" section in the weekly note.
 */
import { useState, useRef, useCallback } from 'react'
import { useObsidianStore } from '../../store/obsidianStore'

export function QuickCaptureBox(): React.JSX.Element {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)
  const appendToToday = useObsidianStore((s) => s.appendToToday)

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed) return

    setStatus('saving')
    try {
      await appendToToday(trimmed)
      setText('')
      setStatus('success')
      // Reset success status after 2 seconds
      setTimeout(() => setStatus('idle'), 2000)
      inputRef.current?.focus()
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }, [text, appendToToday])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const statusColor =
    status === 'success'
      ? 'text-focus'
      : status === 'error'
        ? 'text-urgent'
        : 'text-text-muted'

  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Quick capture — press Enter to save to today's notes"
            disabled={status === 'saving'}
            className="w-full px-4 py-2.5 rounded-lg bg-surface-muted border border-border
                     text-text-primary placeholder:text-text-muted
                     focus:outline-none focus:ring-2 focus:ring-focus/50 focus:border-border-focus
                     disabled:opacity-50 transition-all text-sm"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || status === 'saving'}
          className="px-4 py-2.5 rounded-lg bg-focus text-text-inverse font-medium text-sm
                   hover:bg-focus/90 disabled:opacity-40 disabled:cursor-not-allowed
                   transition-colors"
        >
          {status === 'saving' ? '...' : 'Capture'}
        </button>
      </div>
      {status !== 'idle' && (
        <p className={`text-xs mt-2 ${statusColor}`}>
          {status === 'success' && '✓ Added to today\'s Tasks & Notes'}
          {status === 'error' && '✗ Failed to save — check vault connection'}
          {status === 'saving' && 'Saving...'}
        </p>
      )}
    </div>
  )
}
