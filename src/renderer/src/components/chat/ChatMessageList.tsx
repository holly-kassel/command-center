/**
 * Chat Message List — renders the conversation with Katya
 *
 * User messages right-aligned, assistant left-aligned, nudges centered.
 * Assistant messages rendered as markdown. Smooth auto-scroll.
 * Bubbles animate in with a soft fade + slide.
 */
import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useChatStore } from '../../store/chatStore'
import type { ChatMessage } from '../../../../shared/types/chat'

function MessageBubble({ message, isNew }: { message: ChatMessage; isNew: boolean }): React.ReactElement {
  // Shared animation class for new messages
  const animClass = isNew
    ? 'animate-[chatBubbleIn_0.3s_ease-out_both]'
    : ''

  if (message.role === 'nudge') {
    return (
      <div className={`flex justify-center my-3 ${animClass}`}>
        <div className="max-w-[85%] rounded-xl bg-accent/10 border border-accent/20 px-4 py-2.5 text-sm text-text-secondary shadow-sm">
          <span className="mr-1.5">🐾</span>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <span>{children}</span>,
              strong: ({ children }) => <strong className="text-text-primary">{children}</strong>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    )
  }

  if (message.role === 'user') {
    return (
      <div className={`flex justify-end my-2 ${animClass}`}>
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-focus/20 text-text-primary px-4 py-2.5 text-sm shadow-sm">
          {message.content}
        </div>
      </div>
    )
  }

  // Assistant message
  return (
    <div className={`flex justify-start my-2 ${animClass}`}>
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface-muted border border-surface-border/30 px-4 py-2.5 text-sm text-text-primary shadow-sm">
        <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:my-2 prose-pre:my-2 prose-code:text-focus prose-strong:text-text-primary">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

function StreamingBubble(): React.ReactElement {
  const content = useChatStore((s) => s.streamingContent)

  return (
    <div className="flex justify-start my-2">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface-muted border border-surface-border/30 px-4 py-2.5 text-sm text-text-primary shadow-sm">
        <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-code:text-focus prose-strong:text-text-primary">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content || '...'}
          </ReactMarkdown>
          <span className="inline-block w-1.5 h-4 bg-focus/60 animate-pulse ml-0.5 -mb-0.5 rounded-sm" />
        </div>
      </div>
    </div>
  )
}

export function ChatMessageList(): React.ReactElement {
  const messages = useChatStore((s) => s.messages)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)

  // Track which messages are "new" for animation purposes
  const newStartIndex = prevCountRef.current
  useEffect(() => {
    prevCountRef.current = messages.length
  }, [messages.length])

  // Scroll: smooth on new messages, instant during streaming (avoids jitter from rapid updates)
  const streamingContent = useChatStore((s) => s.streamingContent)
  const isStreamingRef = useRef(false)
  isStreamingRef.current = isStreaming

  useEffect(() => {
    if (isStreamingRef.current) {
      // Instant scroll during streaming — no competing smooth animations
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages.length, streamingContent])

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center animate-[fadeIn_0.4s_ease-out_both]">
        <div className="text-4xl mb-3 animate-[gentleBounce_2s_ease-in-out_infinite]">🐾</div>
        <h3 className="text-base font-semibold text-text-primary mb-1">HI MAMA!!</h3>
        <p className="text-sm text-text-muted max-w-[260px]">
          I&apos;m Katya! Ask me about your schedule, tasks, PRs, or anything work-related. I&apos;ll keep you on track! 🎾
        </p>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
      {messages.map((msg, i) => (
        <MessageBubble key={msg.id} message={msg} isNew={i >= newStartIndex} />
      ))}
      {isStreaming && <StreamingBubble />}
      <div ref={bottomRef} className="h-1" />
    </div>
  )
}
