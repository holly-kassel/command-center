/**
 * QuickCaptureOverlay
 *
 * Minimal floating input that appears via Cmd+Shift+Space.
 * Type a thought, press Enter to save to today's Obsidian note,
 * press Escape to dismiss.
 *
 * Supports slash commands:
 *   /todo buy milk       — adds a checkbox
 *   /transcript [paste]  — expands to textarea, summarizes with AI
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { SamoyedMascot } from '../../components/SamoyedMascot'
import type { SlashCommandInfo } from '../../../../shared/types/obsidian'

export function QuickCaptureOverlay(): React.JSX.Element {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [commands, setCommands] = useState<SlashCommandInfo[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load available slash commands on mount
  useEffect(() => {
    window.api.obsidian.getSlashCommands().then(setCommands).catch(() => {})
  }, [])

  // Auto-focus input whenever the overlay becomes visible
  useEffect(() => {
    const timer = setTimeout(() => {
      ;(textareaRef.current ?? inputRef.current)?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const isSlashCommand = text.trimStart().startsWith('/')

  // Find matching command
  const matchedCommand = (() => {
    if (!isSlashCommand) return null
    const trimmed = text.trimStart()
    const spaceIdx = trimmed.indexOf(' ')
    const typed = (spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx)).toLowerCase()
    return commands.find((c) => c.name === typed) ?? null
  })()

  const isMultiline = matchedCommand?.multiline ?? false

  // Resize the overlay window when switching between single-line and multiline
  useEffect(() => {
    if (isMultiline) {
      window.electron.ipcRenderer.send('overlay:resize', { width: 680, height: 360 })
      // Ensure text ends with a space so cursor is ready for content
      if (!text.endsWith(' ')) {
        setText(text + ' ')
      }
      // Focus textarea and move cursor to end after resize settles
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          const len = textareaRef.current.value.length
          textareaRef.current.setSelectionRange(len, len)
        }
      }, 100)
    } else {
      window.electron.ipcRenderer.send('overlay:resize', { width: 600, height: 160 })
    }
  }, [isMultiline])

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed) return

    setStatus('saving')
    setStatusMessage(isMultiline ? 'Summarizing...' : 'Saving…')
    try {
      if (isSlashCommand) {
        const result = await window.api.obsidian.executeSlashCommand(trimmed)
        if (result.success) {
          setText('')
          setStatusMessage(result.message)
          setStatus('saved')
        } else {
          setStatusMessage(result.message)
          setStatus('error')
          setTimeout(() => setStatus('idle'), 2000)
          return
        }
      } else {
        await window.api.obsidian.appendToToday(trimmed)
        setText('')
        setStatusMessage('Saved')
        setStatus('saved')
      }
      setTimeout(() => {
        setStatus('idle')
        window.electron.ipcRenderer.send('overlay:close')
      }, isMultiline ? 1500 : 600)
    } catch {
      setStatus('idle')
    }
  }, [text, isSlashCommand, isMultiline])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isMultiline) {
        // Cmd/Ctrl+Enter to submit in multiline mode
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          handleSubmit()
        }
      } else {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          handleSubmit()
        }
      }
      if (e.key === 'Escape') {
        window.electron.ipcRenderer.send('overlay:close')
      }
    },
    [handleSubmit, isMultiline]
  )

  return (
    <div className="h-screen w-screen flex items-center justify-center p-4"
         style={{ background: 'transparent', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <div className={`w-full rounded-2xl shadow-2xl border overflow-hidden
                       transition-all duration-300 ease-in-out
                       ${isSlashCommand ? 'border-focus/40' : 'border-surface-border'}`}
           style={{ background: 'var(--color-surface)', backdropFilter: 'blur(24px)' }}>

        {/* Input area */}
        <div className="p-4 transition-all duration-300 ease-in-out">
          <div className={`flex ${isMultiline ? 'flex-col' : 'items-center'} gap-3`}>
            <div className="flex flex-1 min-w-0 items-center gap-3">
              <SamoyedMascot
                size={32}
                bounce={status === 'saved'}
                className={status === 'saved' ? '' : 'mascot-entrance'}
              />
              {!isMultiline && (
                <input
                  ref={inputRef}
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Quick thought... (try /transcript)"
                  className="flex-1 bg-transparent text-text-primary text-lg placeholder-text-muted
                             outline-none border-none caret-focus"
                  autoFocus
                />
              )}
              {isMultiline && (
                <span className="text-text-muted text-sm">
                  /{matchedCommand?.name} — {matchedCommand?.description}
                </span>
              )}
              {status === 'saved' && (
                <span className="text-focus text-sm font-medium animate-pulse ml-auto">✓ {statusMessage}</span>
              )}
              {status === 'error' && (
                <span className="text-urgent text-sm font-medium ml-auto">✗ {statusMessage}</span>
              )}
              {status === 'saving' && (
                <span className="text-text-tertiary text-sm ml-auto">{statusMessage}</span>
              )}
            </div>
            {isMultiline && (
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`/${matchedCommand?.name} paste your transcript here...`}
                className="w-full bg-surface-muted rounded-lg text-text-primary text-sm
                           placeholder-text-muted outline-none border border-border
                           focus:ring-2 focus:ring-focus/50 caret-focus p-3 resize-y min-h-[160px]"
                rows={8}
                autoFocus
              />
            )}
          </div>
        </div>

        {/* Hint bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-surface-border text-[11px] text-text-muted">
          <span>{isMultiline ? '⌘⏎ Summarize & save' : `⏎ ${isSlashCommand ? 'Run command' : 'Save'}`}</span>
          <span>{isSlashCommand ? '/todo · /transcript · /slack' : '/ Commands'}</span>
          <span>⎋ Dismiss</span>
        </div>
      </div>
    </div>
  )
}
