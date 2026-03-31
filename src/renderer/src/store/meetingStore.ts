import { create } from 'zustand'
import type {
  MeetingSegment,
  MeetingNotes,
  SavedMeeting,
  MeetingTranscriptionSettings,
  EvaluatedDecision,
  SpeakerMap
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

  // Decision evaluation
  evaluatedDecisions: EvaluatedDecision[]
  isEvaluatingDecisions: boolean

  // Speaker mapping
  speakerMap: SpeakerMap

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
  renameSpeaker: (originalLabel: string, displayName: string) => void

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
  chunkInterval: 60000,
  participants: []
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
  evaluatedDecisions: [],
  isEvaluatingDecisions: false,
  speakerMap: {},
  settings: DEFAULT_SETTINGS,
  savedMeetings: [],
  speakerFilter: null,
  searchQuery: '',

  addSegments: (newSegments) =>
    set((state) => {
      const merged = [...state.segments]
      const map = state.speakerMap

      for (const seg of newSegments) {
        const mappedSpeaker = map[seg.speaker] || seg.speaker
        const mappedSeg = mappedSpeaker !== seg.speaker ? { ...seg, speaker: mappedSpeaker } : seg

        const last = merged[merged.length - 1]
        if (last && last.speaker === mappedSeg.speaker) {
          // Merge consecutive same-speaker segments
          merged[merged.length - 1] = {
            ...last,
            text: last.text + ' ' + mappedSeg.text,
            end: mappedSeg.end
          }
        } else {
          merged.push(mappedSeg)
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
      settings: { ...state.settings, ...partial }
    })),

  renameSpeaker: (originalLabel, displayName) =>
    set((state) => {
      const newMap = { ...state.speakerMap, [originalLabel]: displayName }

      // Apply the rename to all existing segments with this original label
      const updatedSegments = state.segments.map((seg) =>
        seg.speaker === originalLabel ? { ...seg, speaker: displayName } : seg
      )

      return { speakerMap: newMap, segments: updatedSegments }
    }),

  transcribeChunk: async (audioBuffer) => {
    try {
      const { settings } = get()
      const segments = await window.api.transcription.transcribeChunk(audioBuffer, {
        language: settings.language,
        speakerDiarization: settings.speakerDiarization
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
      // Build transcript using the already-mapped speaker names from segments
      const fullTranscript = segments
        .map((s) => `[${s.timestamp}] ${s.speaker}: ${s.text}`)
        .join('\n')

      // Include mapped speaker names as participants for better attribution
      const mappedNames = Object.values(get().speakerMap)
      const allParticipants = [...new Set([...settings.participants, ...mappedNames])]

      const notes = await window.api.transcription.summarizeMeeting(fullTranscript, allParticipants)
      set({ notes, isGeneratingNotes: false })

      // Automatically evaluate decisions in the background
      if (notes.decisions && notes.decisions.length > 0) {
        set({ isEvaluatingDecisions: true })
        try {
          const evaluated = await window.api.decisionEval.evaluate(notes.decisions)
          set({ evaluatedDecisions: evaluated, isEvaluatingDecisions: false })
        } catch {
          set({ isEvaluatingDecisions: false })
        }
      }
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
      createdAt: new Date().toISOString()
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
      evaluatedDecisions: [],
      isEvaluatingDecisions: false,
      speakerMap: {},
      speakerFilter: null,
      searchQuery: ''
    })
}))
