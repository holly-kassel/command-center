/**
 * Katya Drawer — right-side slide-over chat panel
 *
 * Slides in/out with a smooth transition. Backdrop fades.
 * Always rendered when open, uses CSS transitions for enter/exit.
 */
import { useEffect, useState } from 'react'
import { useChatStore } from '../../store/chatStore'
import { ChatMessageList } from './ChatMessageList'
import { ChatInput } from './ChatInput'

export function KatyaDrawer(): React.ReactElement | null {
  const isOpen = useChatStore((s) => s.isOpen)
  const closeDrawer = useChatStore((s) => s.closeDrawer)
  const clearConversation = useChatStore((s) => s.clearConversation)
  const messageCount = useChatStore((s) => s.messages.length)

  // Two-phase mount: `mounted` keeps the DOM alive, `visible` triggers CSS transition
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      // Trigger enter transition on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
      return undefined
    } else {
      setVisible(false)
      // Wait for exit transition before unmounting
      const timer = setTimeout(() => setMounted(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop — fade in/out */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out will-change-[opacity] ${
          visible ? 'opacity-100 backdrop-blur-sm' : 'opacity-0'
        }`}
        onClick={closeDrawer}
      />

      {/* Panel — slide in from right */}
      <div
        className={`relative w-full max-w-md bg-background border-l border-surface-border/40 shadow-2xl flex flex-col transition-transform duration-300 ease-out will-change-transform ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border/40 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">🐾</span>
            <h2 className="text-base font-semibold text-text-primary">Katya</h2>
            <span className="text-xs text-text-muted">(your very good assistant)</span>
          </div>
          <div className="flex items-center gap-2">
            {messageCount > 0 && (
              <button
                onClick={clearConversation}
                className="text-xs text-text-muted hover:text-red-400 transition-colors duration-150"
                title="Clear conversation"
              >
                Clear
              </button>
            )}
            <button
              onClick={closeDrawer}
              className="text-text-muted hover:text-text-primary transition-colors duration-150 text-lg leading-none"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Message list — takes up all available space */}
        <ChatMessageList />

        {/* Input — pinned to bottom */}
        <ChatInput />
      </div>
    </div>
  )
}
