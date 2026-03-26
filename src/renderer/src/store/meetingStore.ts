import { create } from 'zustand'
import type {
  MeetingSegment,
  MeetingNotes,
  SavedMeeting,
  MeetingTranscriptionSettings,
} from '@shared/types/transcription'

interface MeetingState {
  // Live meeting state
  isRecording: boolean
  isPaused: boolean
  segments: MeetingSegment[]
  notes: MeetingNotes | null
  isGeneratingNotes: boolean
  manualNotes: string
  elapsedTime: number
  audioLevel: number
  activeView: 'transcript' | 'notes'
  error: string | null

  // Settings
  settings: MeetingTranscriptionSettings

  // Saved meetings
  savedMeetings: SavedMeeting[]

  // Search/filter
  speakerFilter: string | null
  searchQuery: string

  // Actions
  addSegments: (segments: MeetingSegment[]) => void
  setAudioLevel: (level: number) => void
  setElapsedTime: (time: number) => void
  setIsPaused: (paused: boolean) => void
  setIsRecording: (recording: boolean) => void
  setManualNotes: (notes: string) => void
  setActiveView: (view: 'transcript' | 'notes') => void
  setSpeakerFilter: (speaker: string | null) => void
  setSearchQuery: (query: string) => void
  setError: (error: string | null) => void
  updateSettings: (settings: Partial<MeetingTranscriptionSettings>) => void

  // Async actions
  transcribeChunk: (audioBuffer: ArrayBuffer) => Promise<void>
  generateNotes: () => Promise<void>
  saveMeeting: () => Promise<void>
  loadMeetings: () => Promise<void>
  deleteMeeting: (id: string) => Promise<void>

  // Reset
  resetMeeting: () => void
}

const DEFAULT_SETTINGS: MeetingTranscriptionSettings = {
  language: 'en',
  autoTranslate: false,
  speakerDiarization: true,
  chunkInterval: 30000,
  participants: [],
}

export const useMeetingStore = create<MeetingState>((set, get) => ({
  isRecording: false,
  isPaused: false,
  segments: [],
  notes: null,
  isGeneratingNotes: false,
  manualNotes: '',
  elapsedTime: 0,
  audioLevel: 0,
  activeView: 'transcript',
  error: null,
  settings: DEFAULT_SETTINGS,
  savedMeetings: [],
  speakerFilter: null,
  searchQuery: '',

  addSegments: (newSegments) =>
    set((state) => {
      const merged = [...state.segments]

      for (const seg of newSegments) {
        const last = merged[merged.length - 1]
        if (last && last.speaker === seg.speaker) {
          // Merge consecutive same-speaker segments
          merged[merged.length - 1] = {
            ...last,
            text: last.text + ' ' + seg.text,
            end: seg.end,
          }
        } else {
          merged.push(seg)
        }
      }

      return { segments: merged }
    }),

  setAudioLevel: (level) => set({ audioLevel: level }),
  setElapsedTime: (time) => set({ elapsedTime: time }),
  setIsPaused: (paused) => set({ isPaused: paused }),
  setIsRecording: (recording) => set({ isRecording: recording }),
  setManualNotes: (notes) => set({ manualNotes: notes }),
  setActiveView: (view) => set({ activeView: view }),
  setSpeakerFilter: (speaker) => set({ speakerFilter: speaker }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setError: (error) => set({ error }),
  updateSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
    })),

  transcribeChunk: async (audioBuffer) => {
    try {
      const { settings } = get()
      const segments = await window.api.transcription.transcribeChunk(audioBuffer, {
        language: settings.language,
        speakerDiarization: settings.speakerDiarization,
      })
      if (segments.length > 0) {
        get().addSegments(segments)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      set({ error: msg })
    }
  },

  generateNotes: async () => {
    const { segments, settings } = get()
    if (segments.length === 0) return

    set({ isGeneratingNotes: true, error: null })
    try {
      // Format transcript with timestamps and clear speaker turns
      const fullTranscript = segments
        .map((s) => `[${s.timestamp}] ${s.speaker}: ${s.text}`)
        .join('\n')
      const notes = await window.api.transcription.summarizeMeeting(
        fullTranscript,
        settings.participants
      )
      set({ notes, isGeneratingNotes: false })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      set({ error: msg, isGeneratingNotes: false })
    }
  },

  saveMeeting: async () => {
    const { segments, notes, manualNotes, elapsedTime, settings } = get()

    // Save if there are segments OR manual notes — don't silently discard
    if (segments.length === 0 && !manualNotes.trim()) {
      set({ error: 'Nothing to save — no transcript segments or manual notes.' })
      return
    }

    const speakers = [...new Set(segments.map((s) => s.speaker))]
    const meeting: SavedMeeting = {
      id: Date.now().toString(),
      title: 'Meeting Notes',
      duration: elapsedTime,
      segments,
      transcript: segments.map((s) => `${s.speaker}: ${s.text}`).join('\n'),
      notes,
      speakers,
      manualNotes,
      language: settings.language,
      createdAt: new Date().toISOString(),
    }

    try {
      await window.api.transcription.saveMeeting(meeting)
      await get().loadMeetings()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      set({ error: msg })
    }
  },

  loadMeetings: async () => {
    try {
      const meetings = await window.api.transcription.getMeetings()
      set({ savedMeetings: meetings })
    } catch (error) {
      console.error('Failed to load meetings:', error)
    }
  },

  deleteMeeting: async (id) => {
    try {
      await window.api.transcription.deleteMeeting(id)
      await get().loadMeetings()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      set({ error: msg })
    }
  },

  resetMeeting: () =>
    set({
      isRecording: false,
      isPaused: false,
      segments: [],
      notes: null,
      isGeneratingNotes: false,
      manualNotes: '',
      elapsedTime: 0,
      audioLevel: 0,
      activeView: 'transcript',
      error: null,
      speakerFilter: null,
      searchQuery: '',
    }),
}))
