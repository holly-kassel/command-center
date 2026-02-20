/**
 * QuickCaptureBox
 *
 * Text input that appends timestamped entries to today's
 * "Tasks & Notes" section in the weekly note.
 *
 * Supports slash commands:
 *   /todo buy milk       — adds a checkbox
 *   /transcript [paste]  — summarizes and adds to notes (expands to textarea)
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { useObsidianStore } from '../../store/obsidianStore'
import type { SlashCommandInfo } from '../../../../shared/types/obsidian'

export function QuickCaptureBox({ onStartRecording }: { onStartRecording?: () => void }): React.JSX.Element {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [commands, setCommands] = useState<SlashCommandInfo[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const appendToToday = useObsidianStore((s) => s.appendToToday)

  // Load available slash commands on mount
  useEffect(() => {
    window.api.obsidian.getSlashCommands().then(setCommands).catch(() => {})
  }, [])

  const isSlashCommand = text.trimStart().startsWith('/')

  // Find matching command for hint display
  const matchedCommand = (() => {
    if (!isSlashCommand) return null
    const trimmed = text.trimStart()
    const spaceIdx = trimmed.indexOf(' ')
    const typed = (spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx)).toLowerCase()
    return commands.find((c) => c.name === typed) ?? null
  })()

  const isMultiline = matchedCommand?.multiline ?? false

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed) return

    setStatus('saving')
    setStatusMessage(isMultiline ? 'Summarizing transcript with AI...' : 'Saving...')
    try {
      if (isSlashCommand) {
        const result = await window.api.obsidian.executeSlashCommand(trimmed)
        if (result.success) {
          setText('')
          setStatusMessage(result.message)
          setStatus('success')
        } else {
          setStatusMessage(result.message)
          setStatus('error')
        }
      } else {
        await appendToToday(trimmed)
        setText('')
        setStatusMessage("Added to today's Tasks & Notes")
        setStatus('success')
      }
      setTimeout(() => setStatus('idle'), 3000)
      ;(isMultiline ? textareaRef : inputRef).current?.focus()
    } catch {
      setStatusMessage('Failed to save — check vault connection')
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }, [text, isSlashCommand, isMultiline, appendToToday])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    // Multiline: Cmd/Ctrl+Enter to submit, plain Enter for newlines
    // Single-line: Enter to submit
    if (isMultiline) {
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
  }

  const statusColor =
    status === 'success'
      ? 'text-focus'
      : status === 'error'
        ? 'text-urgent'
        : 'text-text-muted'

  const placeholder = isSlashCommand && matchedCommand
    ? `/${matchedCommand.name} ${matchedCommand.argHint}`
    : 'Quick capture — press Enter to save (try /todo, /transcript, or /slack)'

  const inputClasses = `w-full px-4 py-2.5 rounded-lg bg-surface-muted border
                     text-text-primary placeholder:text-text-muted
                     focus:outline-none focus:ring-2 focus:ring-focus/50 focus:border-border-focus
                     disabled:opacity-50 transition-all text-sm
                     ${isSlashCommand ? 'border-focus/40' : 'border-border'}`

  const textareaClasses = `w-full px-4 py-3 rounded-lg bg-transparent border-none
                     text-text-primary placeholder:text-text-muted
                     focus:outline-none focus:ring-0
                     disabled:opacity-50 transition-all text-sm resize-y
                     min-h-[100px] max-h-[400px]`

  return (
    <div className={`card ${isMultiline ? 'border-focus/40' : ''}`}>
      <div className={`flex ${isMultiline ? 'flex-col' : 'items-center'} gap-3`}>
        <div className="flex-1 relative">
          {isMultiline ? (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={status === 'saving'}
              rows={6}
              className={textareaClasses}
            />
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={status === 'saving'}
              className={inputClasses}
            />
          )}
        </div>
        <div className={`flex items-center gap-2 ${isMultiline ? 'justify-between' : ''}`}>
          {isMultiline && (
            <span className="text-[11px] text-text-muted">⌘⏎ to submit</span>
          )}
          {onStartRecording && (
            <button
              onClick={onStartRecording}
              disabled={status === 'saving'}
              className="px-3 py-2.5 rounded-lg bg-red-500/10 text-red-400 text-sm
                       hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors border border-red-500/20"
              title="Record voice → transcribe → summarize"
            >
              🎙️
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || status === 'saving'}
            className="px-4 py-2.5 rounded-lg bg-focus text-text-inverse font-medium text-sm
                     hover:bg-focus/90 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors"
          >
            {status === 'saving'
              ? isMultiline
                ? 'Summarizing...'
                : '...'
              : isSlashCommand
                ? 'Run'
                : 'Capture'}
          </button>
        </div>
      </div>
      {status !== 'idle' && (
        <p className={`text-xs mt-2 ${statusColor}`}>
          {status === 'success' && `✓ ${statusMessage}`}
          {status === 'error' && `✗ ${statusMessage}`}
          {status === 'saving' && `⏳ ${statusMessage}`}
        </p>
      )}
    </div>
  )
}
