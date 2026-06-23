/**
 * Katya Toggle Button — opens/closes the chat drawer
 *
 * Shows in the Dashboard header. Red badge when there are unread nudges.
 */
import { useChatStore } from '../../store/chatStore'

export function KatyaToggleButton(): React.ReactElement {
  const toggleDrawer = useChatStore((s) => s.toggleDrawer)
  const hasUnreadNudge = useChatStore((s) => s.hasUnreadNudge)
  const isOpen = useChatStore((s) => s.isOpen)

  return (
    <button
      onClick={toggleDrawer}
      className={`relative text-sm transition-all duration-200 hover:scale-125 active:scale-95 ${
        isOpen
          ? 'text-focus'
          : 'text-text-muted hover:text-focus'
      }`}
      title="Chat with Katya"
    >
      🐾
      {hasUnreadNudge && (
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-400 animate-pulse" />
      )}
    </button>
  )
}
