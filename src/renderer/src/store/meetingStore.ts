import { create } from 'zustand'
import type {
  EvaluatedDecision,
  MeetingActionItem,
  MeetingDraft,
  MeetingNotes,
  MeetingParticipant,
  MeetingSegment,
  MeetingTranscriptionSettings,
  SavedMeeting,
  SpeakerMap
} from '@shared/types/transcription'

export interface RecordingContext {
  title: string
  participants: MeetingParticipant[]
  calendarEventId?: string
  onlineMeetingUrl?: string
  startTime?: string
  endTime?: string
}

interface MeetingState {
  sessionId: string | null
  startedAt: string | null
  meetingTitle: string
  isRecording: boolean
  isPaused: boolean
  isDockCollapsed: boolean
  segments: MeetingSegment[]
  notes: MeetingNotes | null
  isGeneratingNotes: boolean
  manualNotes: string
  elapsedTime: number
  audioLevel: number
  activeView: 'transcript' | 'notes'
  error: string | null
  draftStatus: 'idle' | 'saving' | 'saved' | 'error'
  recoverableDraft: MeetingDraft | null
  evaluatedDecisions: EvaluatedDecision[]
  isEvaluatingDecisions: boolean
  speakerMap: SpeakerMap
  settings: MeetingTranscriptionSettings
  savedMeetings: SavedMeeting[]
  speakerFilter: string | null
  searchQuery: string
  isRecorderOpen: boolean
  recordingContext: RecordingContext | null

  addSegments: (segments: MeetingSegment[]) => void
  setAudioLevel: (level: number) => void
  setElapsedTime: (time: number) => void
  setIsPaused: (paused: boolean) => void
  setIsRecording: (recording: boolean) => void
  setDockCollapsed: (collapsed: boolean) => void
  setMeetingTitle: (title: string) => void
  setManualNotes: (notes: string) => void
  setActiveView: (view: 'transcript' | 'notes') => void
  setSpeakerFilter: (speaker: string | null) => void
  setSearchQuery: (query: string) => void
  setError: (error: string | null) => void
  updateSettings: (settings: Partial<MeetingTranscriptionSettings>) => void
  renameSpeaker: (originalLabel: string, displayName: string, chunkId?: string) => void
  updateActionItem: (id: string, updates: Partial<MeetingActionItem>) => void

  transcribeChunk: (
    audioBuffer: ArrayBuffer,
    offsetSeconds: number,
    chunkId: string,
    expectedSessionId: string
  ) => Promise<boolean>
  generateNotes: () => Promise<boolean>
  saveMeeting: (title?: string) => Promise<SavedMeeting | null>
  saveDraft: () => Promise<void>
  loadDraft: () => Promise<void>
  resumeDraft: () => void
  discardDraft: () => Promise<void>
  loadMeetings: () => Promise<void>
  deleteMeeting: (id: string) => Promise<void>
  syncTeamsTranscript: (id: string) => Promise<void>
  openRecorder: (context?: RecordingContext | null) => void
  closeRecorder: () => void
  cancelMeeting: () => Promise<boolean>
  resetMeeting: () => void
}

const DEFAULT_SETTINGS: MeetingTranscriptionSettings = {
  language: 'en',
  autoTranslate: false,
  speakerDiarization: true,
  chunkInterval: 60000,
  participants: []
}

function buildMeetingRecord(state: MeetingState, title?: string): SavedMeeting {
  const updatedAt = new Date().toISOString()
  const createdAt = state.startedAt ?? updatedAt
  const localSegments = state.segments.map((segment) => ({ ...segment, source: 'local' as const }))
  const transcript = localSegments
    .map((segment) => `${segment.speaker}: ${segment.text}`)
    .join('\n')
  const speakers = [...new Set(localSegments.map((segment) => segment.speaker))]
  const participants =
    state.recordingContext?.participants ??
    state.settings.participants.map((displayName) => ({
      displayName,
      source: 'manual' as const,
      verified: true
    }))
  return {
    schemaVersion: 2,
    id: state.sessionId ?? crypto.randomUUID(),
    title: title?.trim() || state.meetingTitle.trim() || 'Meeting Notes',
    duration: state.elapsedTime,
    segments: localSegments,
    transcript,
    notes: state.notes,
    speakers,
    manualNotes: state.manualNotes,
    participants,
    transcriptArtifacts: {
      local: {
        source: 'local',
        segments: localSegments,
        transcript,
        speakers,
        attribution:
          localSegments.length > 0 &&
          localSegments.every((segment) => segment.speakerIdentity?.verified)
            ? 'verified'
            : 'unverified',
        capturedAt: updatedAt
      }
    },
    activeTranscriptSource: 'local',
    teamsSync: {
      status: state.recordingContext?.onlineMeetingUrl ? 'pending' : 'not-requested',
      attempts: 0,
      summaryStatus: 'not-requested',
      summaryAttempts: 0
    },
    calendarContext: state.recordingContext
      ? {
          eventId: state.recordingContext.calendarEventId,
          title: state.recordingContext.title,
          startTime: state.recordingContext.startTime,
          endTime: state.recordingContext.endTime,
          onlineMeetingUrl: state.recordingContext.onlineMeetingUrl,
          attendees: state.recordingContext.participants
        }
      : undefined,
    language: state.settings.language,
    createdAt,
    updatedAt
  }
}

function resetLiveState(): Partial<MeetingState> {
  return {
    sessionId: null,
    startedAt: null,
    meetingTitle: 'Meeting Notes',
    isRecording: false,
    isPaused: false,
    isDockCollapsed: false,
    segments: [],
    notes: null,
    isGeneratingNotes: false,
    manualNotes: '',
    elapsedTime: 0,
    audioLevel: 0,
    activeView: 'transcript',
    error: null,
    draftStatus: 'idle',
    evaluatedDecisions: [],
    isEvaluatingDecisions: false,
    speakerMap: {},
    speakerFilter: null,
    searchQuery: '',
    isRecorderOpen: false,
    recordingContext: null
  }
}

export const useMeetingStore = create<MeetingState>((set, get) => ({
  sessionId: null,
  startedAt: null,
  meetingTitle: 'Meeting Notes',
  isRecording: false,
  isPaused: false,
  isDockCollapsed: false,
  segments: [],
  notes: null,
  isGeneratingNotes: false,
  manualNotes: '',
  elapsedTime: 0,
  audioLevel: 0,
  activeView: 'transcript',
  error: null,
  draftStatus: 'idle',
  recoverableDraft: null,
  evaluatedDecisions: [],
  isEvaluatingDecisions: false,
  speakerMap: {},
  settings: DEFAULT_SETTINGS,
  savedMeetings: [],
  speakerFilter: null,
  searchQuery: '',
  isRecorderOpen: false,
  recordingContext: null,

  addSegments: (newSegments) =>
    set((state) => {
      const merged = [...state.segments]
      for (const segment of newSegments) {
        const mappingKey = segment.chunkId
          ? `${segment.chunkId}:${segment.speaker}`
          : segment.speaker
        const mappedName = state.speakerMap[mappingKey] ?? state.speakerMap[segment.speaker]
        const mapped = mappedName
          ? {
              ...segment,
              speaker: mappedName,
              speakerIdentity: {
                displayName: mappedName,
                source: 'manual' as const,
                verified: true
              }
            }
          : segment
        const last = merged[merged.length - 1]
        if (
          last &&
          last.speaker === mapped.speaker &&
          last.chunkId === mapped.chunkId &&
          last.speakerIdentity?.verified === mapped.speakerIdentity?.verified
        ) {
          merged[merged.length - 1] = {
            ...last,
            text: `${last.text} ${mapped.text}`,
            end: mapped.end
          }
        } else {
          merged.push(mapped)
        }
      }
      return { segments: merged, draftStatus: 'idle' }
    }),

  setAudioLevel: (audioLevel) => set({ audioLevel }),
  setElapsedTime: (elapsedTime) => set({ elapsedTime }),
  setIsPaused: (isPaused) => set({ isPaused }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setDockCollapsed: (isDockCollapsed) => set({ isDockCollapsed }),
  setMeetingTitle: (meetingTitle) => set({ meetingTitle, draftStatus: 'idle' }),
  setManualNotes: (manualNotes) => set({ manualNotes, draftStatus: 'idle' }),
  setActiveView: (activeView) => set({ activeView }),
  setSpeakerFilter: (speakerFilter) => set({ speakerFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setError: (error) => set({ error }),
  updateSettings: (partial) => set((state) => ({ settings: { ...state.settings, ...partial } })),

  renameSpeaker: (originalLabel, displayName, chunkId) =>
    set((state) => {
      const mappingKey = chunkId ? `${chunkId}:${originalLabel}` : originalLabel
      return {
        speakerMap: { ...state.speakerMap, [mappingKey]: displayName },
        segments: state.segments.map((segment) =>
          segment.speaker === originalLabel && (!chunkId || segment.chunkId === chunkId)
            ? {
                ...segment,
                speaker: displayName,
                speakerIdentity: { displayName, source: 'manual', verified: true }
              }
            : segment
        ),
        draftStatus: 'idle'
      }
    }),

  updateActionItem: (id, updates) =>
    set((state) => {
      if (!state.notes) return state
      const updateList = (items: MeetingActionItem[]): MeetingActionItem[] =>
        items.map((item) => (item.id === id ? { ...item, ...updates } : item))
      const actionItems = updateList(state.notes.actionItems)
      return {
        notes: {
          ...state.notes,
          actionItems,
          myActionItems: actionItems.filter(
            (item) => item.isCurrentUser && item.reviewStatus === 'accepted'
          ),
          suggestedFollowUps: updateList(state.notes.suggestedFollowUps)
        },
        draftStatus: 'idle'
      }
    }),

  transcribeChunk: async (audioBuffer, offsetSeconds, chunkId, expectedSessionId) => {
    try {
      const state = get()
      if (state.sessionId !== expectedSessionId) return true
      const segments = await window.api.transcription.transcribeChunk(audioBuffer, {
        language: state.settings.language,
        speakerDiarization: state.settings.speakerDiarization,
        offsetSeconds,
        chunkId
      })
      if (get().sessionId !== expectedSessionId) return true
      if (segments.length > 0) get().addSegments(segments)
      return true
    } catch (error) {
      if (get().sessionId !== expectedSessionId) return true
      set({ error: error instanceof Error ? error.message : String(error) })
      return false
    }
  },

  generateNotes: async () => {
    const { segments, settings, recordingContext } = get()
    if (segments.length === 0) return false
    set({ isGeneratingNotes: true, error: null })
    try {
      const mappedParticipants: MeetingParticipant[] = Object.values(get().speakerMap).map(
        (displayName) => ({ displayName, source: 'manual', verified: true })
      )
      const configuredParticipants: MeetingParticipant[] = settings.participants.map(
        (displayName) => ({
          displayName,
          source: 'manual',
          verified: true
        })
      )
      const participantMap = new Map(
        [
          ...(recordingContext?.participants ?? []),
          ...configuredParticipants,
          ...mappedParticipants
        ].map((participant) => [participant.displayName.toLowerCase(), participant])
      )
      const notes = await window.api.transcription.summarizeMeeting({
        segments,
        participants: [...participantMap.values()],
        transcriptSource: 'local'
      })
      set({ notes, isGeneratingNotes: false, draftStatus: 'idle' })
      if (notes.decisions.length > 0) {
        set({ isEvaluatingDecisions: true })
        try {
          const evaluatedDecisions = await window.api.decisionEval.evaluate(notes.decisions)
          set({ evaluatedDecisions, isEvaluatingDecisions: false })
        } catch (error) {
          console.warn('Decision evaluation failed:', error)
          set({ isEvaluatingDecisions: false })
        }
      }
      return true
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isGeneratingNotes: false
      })
      return false
    }
  },

  saveMeeting: async (title) => {
    const state = get()
    if (state.segments.length === 0 && !state.manualNotes.trim()) {
      set({ error: 'Nothing to save. No transcript segments or manual notes were captured.' })
      return null
    }
    let saved: SavedMeeting
    try {
      saved = await window.api.transcription.saveMeeting(buildMeetingRecord(state, title))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
      return null
    }
    try {
      await window.api.transcription.deleteDraft()
      set({ recoverableDraft: null, draftStatus: 'saved' })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      set({
        draftStatus: 'error',
        error: 'Meeting saved, but its recovery draft could not be removed: ' + detail
      })
    }
    await get().loadMeetings()
    return saved
  },

  saveDraft: async () => {
    const state = get()
    const sessionId = state.sessionId
    if (!sessionId || (state.segments.length === 0 && !state.manualNotes.trim())) return
    set({ draftStatus: 'saving' })
    try {
      await window.api.transcription.saveDraft(buildMeetingRecord(state))
      if (get().sessionId === sessionId) set({ draftStatus: 'saved' })
    } catch (error) {
      if (get().sessionId !== sessionId) return
      set({
        draftStatus: 'error',
        error: error instanceof Error ? error.message : String(error)
      })
    }
  },

  loadDraft: async () => {
    try {
      set({ recoverableDraft: await window.api.transcription.getDraft() })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  resumeDraft: () => {
    const draft = get().recoverableDraft
    if (!draft) return
    const meeting = draft.meeting
    set({
      sessionId: meeting.id,
      startedAt: meeting.createdAt,
      meetingTitle: meeting.title,
      isRecorderOpen: true,
      isDockCollapsed: false,
      segments: meeting.transcriptArtifacts.local?.segments ?? meeting.segments,
      notes: meeting.notes,
      manualNotes: meeting.manualNotes,
      elapsedTime: meeting.duration,
      recordingContext: meeting.calendarContext
        ? {
            title: meeting.calendarContext.title,
            participants: meeting.calendarContext.attendees,
            calendarEventId: meeting.calendarContext.eventId,
            onlineMeetingUrl: meeting.calendarContext.onlineMeetingUrl,
            startTime: meeting.calendarContext.startTime,
            endTime: meeting.calendarContext.endTime
          }
        : null,
      recoverableDraft: null,
      draftStatus: 'saved',
      error: null
    })
  },

  discardDraft: async () => {
    try {
      await window.api.transcription.deleteDraft()
      set({ recoverableDraft: null })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  loadMeetings: async () => {
    try {
      set({ savedMeetings: await window.api.transcription.getMeetings() })
    } catch (error) {
      console.error('Failed to load meetings:', error)
    }
  },

  syncTeamsTranscript: async (id) => {
    try {
      const meeting = await window.api.transcription.syncTeamsTranscript(id)
      set((state) => ({
        savedMeetings: state.savedMeetings.map((item) => (item.id === id ? meeting : item))
      }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  deleteMeeting: async (id) => {
    try {
      await window.api.transcription.deleteMeeting(id)
      await get().loadMeetings()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
    }
  },

  openRecorder: (context = null) =>
    set((state) => {
      if (state.isRecorderOpen) {
        return { error: 'Finish the current recording before starting another one.' }
      }
      return {
        ...resetLiveState(),
        sessionId: crypto.randomUUID(),
        startedAt: new Date().toISOString(),
        meetingTitle: context?.title?.trim() || 'Meeting Notes',
        isRecorderOpen: true,
        recordingContext: context,
        recoverableDraft: state.recoverableDraft
      }
    }),

  closeRecorder: () =>
    set((state) => ({ ...resetLiveState(), recoverableDraft: state.recoverableDraft })),

  cancelMeeting: async () => {
    const sessionId = get().sessionId
    if (!sessionId) {
      set({ error: 'No active meeting recording to cancel.' })
      return false
    }

    try {
      await window.api.transcription.deleteDraft(sessionId)
      set((state) => ({
        ...resetLiveState(),
        recoverableDraft:
          state.recoverableDraft?.meeting.id === sessionId ? null : state.recoverableDraft
      }))
      return true
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error) })
      return false
    }
  },

  resetMeeting: () =>
    set((state) => ({ ...resetLiveState(), recoverableDraft: state.recoverableDraft }))
}))

window.api.transcription.onMeetingUpdate((meeting) => {
  useMeetingStore.setState((state) => ({
    savedMeetings: state.savedMeetings.map((item) => (item.id === meeting.id ? meeting : item))
  }))
})
