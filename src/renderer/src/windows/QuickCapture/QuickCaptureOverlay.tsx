/**
 * QuickCaptureOverlay
 *
 * Minimal floating input that appears via Cmd+Shift+Space.
 * Type a thought, press Enter to save to today's Obsidian note,
 * press Escape to dismiss.
 */
import { useState, useRef, useEffect, useCallback } from 'react'

export function QuickCaptureOverlay(): React.JSX.Element {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input whenever the overlay becomes visible
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed) return

    setStatus('saving')
    try {
      await window.api.obsidian.appendToToday(trimmed)
      setText('')
      setStatus('saved')
      setTimeout(() => {
        setStatus('idle')
        // Close overlay after save
        window.electron.ipcRenderer.send('overlay:close')
      }, 600)
    } catch {
      setStatus('idle')
    }
  }, [text])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
      if (e.key === 'Escape') {
        window.electron.ipcRenderer.send('overlay:close')
      }
    },
    [handleSubmit]
  )

  return (
    <div className="h-screen w-screen flex items-center justify-center p-4"
         style={{ background: 'transparent', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <div className="w-full max-w-xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
           style={{ background: 'rgba(15, 17, 23, 0.92)', backdropFilter: 'blur(24px)' }}>

        {/* Input area */}
        <div className="p-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚡</span>
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Quick thought..."
              className="flex-1 bg-transparent text-white text-lg placeholder-white/30
                         outline-none border-none caret-emerald-400"
              autoFocus
            />
            {status === 'saved' && (
              <span className="text-emerald-400 text-sm font-medium animate-pulse">✓ Saved</span>
            )}
            {status === 'saving' && (
              <span className="text-white/40 text-sm">Saving…</span>
            )}
          </div>
        </div>

        {/* Hint bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/5 text-[11px] text-white/25">
          <span>⏎ Save</span>
          <span>⎋ Dismiss</span>
        </div>
      </div>
    </div>
  )
}
