/**
 * SlackParserPanel
 *
 * Paste a Slack thread, parse it, preview the formatted markdown,
 * optionally edit the title, and save to Obsidian.
 */
import { useState, useCallback } from 'react'
import type { ParsedSlackThread } from '../../../../shared/types/slack'

type PanelState = 'input' | 'preview' | 'saved'

export function SlackParserPanel(): React.JSX.Element {
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState<ParsedSlackThread | null>(null)
  const [title, setTitle] = useState('')
  const [state, setState] = useState<PanelState>('input')
  const [savedPath, setSavedPath] = useState('')
  const [error, setError] = useState('')

  const handleParse = useCallback(async () => {
    if (!rawText.trim()) return
    setError('')
    try {
      const result = await window.api.slack.parseThread(rawText)
      setParsed(result)
      setTitle(result.title)
      setState('preview')
    } catch (err) {
      setError('Failed to parse thread. Make sure you copied it from Slack.')
    }
  }, [rawText])

  const handleSave = useCallback(async () => {
    if (!parsed) return
    setError('')
    try {
      const result = await window.api.slack.saveToObsidian(parsed, title)
      setSavedPath(result.path)
      setState('saved')
    } catch (err) {
      setError('Failed to save to Obsidian.')
    }
  }, [parsed, title])

  const handleReset = useCallback(() => {
    setRawText('')
    setParsed(null)
    setTitle('')
    setState('input')
    setSavedPath('')
    setError('')
  }, [])

  return (
    <div className="rounded-2xl border border-surface-border p-4"
         style={{ background: 'var(--color-surface)' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">💬</span>
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Slack Thread
          </h2>
        </div>
        {state !== 'input' && (
          <button
            onClick={handleReset}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            ← New Thread
          </button>
        )}
      </div>

      {error && (
        <div className="text-urgent text-xs mb-3 px-2 py-1 rounded bg-urgent/10">
          {error}
        </div>
      )}

      {/* Input State */}
      {state === 'input' && (
        <div className="space-y-3">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste a Slack thread here..."
            className="w-full h-32 bg-surface-muted border border-surface-border rounded-xl p-3
                       text-text-primary text-sm placeholder-text-muted resize-none
                       outline-none focus:border-primary/40 transition-colors"
          />
          <button
            onClick={handleParse}
            disabled={!rawText.trim()}
            className="w-full py-2 rounded-xl text-sm font-medium transition-all
                       bg-primary/20 text-primary hover:bg-primary/30
                       disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Parse Thread
          </button>
        </div>
      )}

      {/* Preview State */}
      {state === 'preview' && parsed && (
        <div className="space-y-3">
          {/* Editable title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2
                       text-text-primary text-sm outline-none focus:border-primary/40 transition-colors"
            placeholder="Thread title..."
          />

          {/* Stats */}
          <div className="flex gap-3 text-xs text-text-muted">
            <span>{parsed.messages.length} messages</span>
            <span>·</span>
            <span>{parsed.participants.length} participants</span>
          </div>

          {/* Message preview */}
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {parsed.messages.map((msg, i) => (
              <div key={i} className="rounded-lg p-2 bg-surface-secondary border border-surface-border">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-accent">{msg.author}</span>
                  <span className="text-[10px] text-text-muted">{msg.timestamp}</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                  {msg.content.length > 200 ? msg.content.slice(0, 200) + '…' : msg.content}
                </p>
              </div>
            ))}
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            className="w-full py-2 rounded-xl text-sm font-medium transition-all
                       bg-focus/20 text-focus hover:bg-focus/30"
          >
            Save to Obsidian
          </button>
        </div>
      )}

      {/* Saved State */}
      {state === 'saved' && (
        <div className="text-center py-4 space-y-2">
          <div className="text-2xl">✅</div>
          <p className="text-sm text-text-secondary">Thread saved to Obsidian</p>
          <p className="text-[10px] text-text-muted break-all">{savedPath}</p>
          <button
            onClick={handleReset}
            className="mt-2 px-4 py-1.5 rounded-lg text-xs text-text-tertiary
                       hover:text-text-secondary bg-surface-muted hover:bg-surface-hover transition-all"
          >
            Parse Another
          </button>
        </div>
      )}
    </div>
  )
}
