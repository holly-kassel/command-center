/**
 * Chat Store (Katya) 🐾
 *
 * Zustand store for chat state in the renderer.
 * Manages messages, streaming state, drawer visibility, and nudge indicators.
 */
import { create } from 'zustand'
import type { ChatMessage, NudgeConfig } from '../../../shared/types/chat'

// Track listener cleanup functions at module scope so they survive across
// React strict-mode remounts and are always cleaned up before re-subscribing.
let cleanupChunk: (() => void) | null = null
let cleanupDone: (() => void) | null = null
let cleanupNudge: (() => void) | null = null

interface ChatState {
  // State
  messages: ChatMessage[]
  isStreaming: boolean
  isOpen: boolean
  hasUnreadNudge: boolean
  nudgeConfig: NudgeConfig | null
  isInitialized: boolean
  error: string | null

  // Current streaming message being built
  streamingMessageId: string | null
  streamingContent: string

  // Actions
  initialize: () => Promise<void>
  sendMessage: (text: string) => Promise<void>
  toggleDrawer: () => void
  openDrawer: () => void
  closeDrawer: () => void
  clearConversation: () => Promise<void>
  markNudgesRead: () => void
  loadNudgeConfig: () => Promise<void>
  updateNudgeConfig: (config: Partial<NudgeConfig>) => Promise<void>
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  isOpen: false,
  hasUnreadNudge: false,
  nudgeConfig: null,
  isInitialized: false,
  error: null,
  streamingMessageId: null,
  streamingContent: '',

  initialize: async () => {
    if (get().isInitialized) return

    // Set flag IMMEDIATELY (synchronously) to prevent race from strict mode double-mount
    set({ isInitialized: true })

    try {
      // Clean up any stale listeners from a previous mount
      cleanupChunk?.()
      cleanupDone?.()
      cleanupNudge?.()

      // Load today's conversation
      const conversation = await window.api.chat.getConversation()
      const nudgeConfig = await window.api.chat.getNudgeConfig()

      // Subscribe to stream chunks (single listener)
      cleanupChunk = window.api.chat.onStreamChunk((data) => {
        const state = get()
        if (state.streamingMessageId === data.messageId) {
          const newContent = state.streamingContent + data.chunk
          set({ streamingContent: newContent })
        } else {
          // New message starting
          set({
            streamingMessageId: data.messageId,
            streamingContent: data.chunk,
            isStreaming: true,
          })
        }
      })

      // Subscribe to stream done (single listener)
      cleanupDone = window.api.chat.onStreamDone((data) => {
        const state = get()
        if (state.streamingMessageId === data.messageId) {
          // Add the complete message to the messages array
          const completeMessage: ChatMessage = {
            id: data.messageId,
            role: 'assistant',
            content: state.streamingContent,
            timestamp: Date.now(),
          }

          set((s) => ({
            messages: [...s.messages, completeMessage],
            isStreaming: false,
            streamingMessageId: null,
            streamingContent: '',
          }))
        }
      })

      // Subscribe to nudges (single listener)
      cleanupNudge = window.api.chat.onNudge((message) => {
        set((s) => ({
          messages: [...s.messages, message],
          hasUnreadNudge: !s.isOpen, // Only mark unread if drawer is closed
        }))
      })

      set({
        messages: conversation.messages || [],
        nudgeConfig,
        isInitialized: true,
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to initialize chat'
      set({ error: msg, isInitialized: true })
    }
  },

  sendMessage: async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || get().isStreaming) return

    // Optimistically add user message
    const userMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    }

    set((s) => ({
      messages: [...s.messages, userMessage],
      isStreaming: true,
      error: null,
    }))

    try {
      // The actual response comes via stream events
      // sendMessage returns the final message but we already have it via streaming
      await window.api.chat.sendMessage(trimmed)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to send message'
      set((s) => ({
        error: msg,
        isStreaming: false,
        // Add an error message from Katya
        messages: [
          ...s.messages,
          {
            id: `error-${Date.now()}`,
            role: 'assistant' as const,
            content: `Oh no, something went wrong 🐾 (${msg}). Try again?`,
            timestamp: Date.now(),
          },
        ],
      }))
    }
  },

  toggleDrawer: () => {
    set((s) => {
      const willOpen = !s.isOpen
      return {
        isOpen: willOpen,
        hasUnreadNudge: willOpen ? false : s.hasUnreadNudge,
      }
    })
  },

  openDrawer: () => set({ isOpen: true, hasUnreadNudge: false }),

  closeDrawer: () => set({ isOpen: false }),

  clearConversation: async () => {
    try {
      await window.api.chat.clearConversation()
      set({ messages: [], error: null })
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to clear'
      set({ error: msg })
    }
  },

  markNudgesRead: () => set({ hasUnreadNudge: false }),

  loadNudgeConfig: async () => {
    try {
      const config = await window.api.chat.getNudgeConfig()
      set({ nudgeConfig: config })
    } catch {
      // Silently fail
    }
  },

  updateNudgeConfig: async (config) => {
    try {
      const updated = await window.api.chat.setNudgeConfig(config)
      set({ nudgeConfig: updated })
    } catch {
      // Silently fail
    }
  },
}))
