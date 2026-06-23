/**
 * Chat Input — message input for talking to Katya
 *
 * Enter to send, Shift+Enter for newline. Disabled while streaming.
 */
import { useState, useRef, useCallback } from 'react'
import { useChatStore } from '../../store/chatStore'

export function ChatInput(): React.ReactElement {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const isStreaming = useChatStore((s) => s.isStreaming)

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return
    sendMessage(trimmed)
    setText('')
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, isStreaming, sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    // Auto-resize textarea
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [])

  return (
    <div className="flex items-end gap-2 p-3 border-t border-surface-border/40 bg-background/80 backdrop-blur-sm">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        disabled={isStreaming}
        placeholder="Ask Katya anything... 🎾"
        rows={1}
        className="flex-1 resize-none rounded-lg bg-surface-muted px-3 py-2 text-sm text-text-primary placeholder:text-text-muted border border-surface-border/40 focus:outline-none focus:ring-2 focus:ring-focus/40 focus:border-focus/30 disabled:opacity-50 transition-[box-shadow,border-color] duration-200 shadow-sm"
      />
      <button
        onClick={handleSend}
        disabled={isStreaming || !text.trim()}
        className="flex-shrink-0 rounded-lg bg-focus/20 hover:bg-focus/30 active:scale-95 text-focus px-3 py-2 text-sm font-medium transition-[background-color,transform,opacity] duration-150 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
        title="Send message"
      >
        {isStreaming ? (
          <span className="inline-flex items-center gap-1">
            <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
          </span>
        ) : (
          '↑'
        )}
      </button>
    </div>
  )
}
