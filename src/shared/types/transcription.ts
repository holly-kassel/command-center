/**
 * Voice Transcription Types
 *
 * Used by TranscriptionService (main) and VoiceRecorder (renderer).
 */

export interface TranscriptionResult {
  /** Raw transcribed text from Whisper */
  text: string
  /** Duration of the audio in seconds */
  durationSeconds: number
  /** Model used for transcription */
  model: string
}

export interface TranscriptionAndSummaryResult {
  /** Raw transcribed text from Whisper */
  transcript: string
  /** AI-generated summary from /transcript slash command */
  summary: string
  /** Duration of the audio in seconds */
  durationSeconds: number
}

export type TranscriptSource = 'local' | 'teams'
export type AttributionStatus = 'verified' | 'unverified'
export type SpeakerIdentitySource = 'teams' | 'manual' | 'calendar' | 'diarization' | 'unknown'

export interface MeetingParticipant {
  displayName: string
  email?: string
  source: 'calendar' | 'teams' | 'manual'
  verified: boolean
}

export interface SpeakerIdentity {
  displayName: string
  email?: string
  source: SpeakerIdentitySource
  verified: boolean
}

/** A single transcript segment from diarized transcription */
export interface MeetingSegment {
  id: string
  speaker: string
  speakerIdentity?: SpeakerIdentity
  text: string
  start: number
  end: number
  timestamp: string
  source?: TranscriptSource
  chunkId?: string
}

export interface MeetingTranscriptionChunkOptions {
  language?: string
  speakerDiarization?: boolean
  offsetSeconds?: number
  chunkId?: string
}

export interface MeetingSummaryInput {
  segments: MeetingSegment[]
  participants: MeetingParticipant[]
  transcriptSource: TranscriptSource
}

export interface ActionEvidence {
  segmentId: string
  timestamp: string
  quote: string
}

export interface MeetingActionItem {
  id: string
  description: string
  owner: SpeakerIdentity | null
  isCurrentUser: boolean
  dueDate: string | null
  evidence: ActionEvidence
  confidence: 'high' | 'medium' | 'low'
  commitmentType: 'commitment' | 'accepted-request' | 'suggestion'
  reviewStatus: 'accepted' | 'needs-review' | 'dismissed'
}

/** AI-generated meeting notes */
export interface MeetingNotes {
  summary: string
  keyTopics: string[]
  keyPoints: string[]
  actionItems: MeetingActionItem[]
  /** Action items specifically assigned to the current user */
  myActionItems: MeetingActionItem[]
  suggestedFollowUps: MeetingActionItem[]
  decisions: string[]
  openQuestions: string[]
  metadata: {
    model: string
    generatedAt: string
    transcriptSource: TranscriptSource
    schemaVersion: 2
  }
}

export interface MeetingNotesUpdateContext {
  transcriptSource: TranscriptSource
  transcriptCapturedAt: string
  baseNotesGeneratedAt: string | null
}

export interface TranscriptArtifact {
  source: TranscriptSource
  segments: MeetingSegment[]
  transcript: string
  speakers: string[]
  attribution: AttributionStatus
  capturedAt: string
}

export interface TeamsTranscriptSync {
  status: 'not-requested' | 'pending' | 'syncing' | 'available' | 'unavailable' | 'error'
  attempts: number
  lastAttemptAt?: string
  operationId?: string
  error?: string
  summaryStatus: 'not-requested' | 'pending' | 'generating' | 'available' | 'error'
  summaryAttempts: number
  summaryLastAttemptAt?: string
  summaryOperationId?: string
  summaryError?: string
}

export interface MeetingCalendarContext {
  eventId?: string
  title: string
  startTime?: string
  endTime?: string
  onlineMeetingUrl?: string
  attendees: MeetingParticipant[]
}

/** A saved meeting record */
export interface SavedMeeting {
  schemaVersion: 2
  id: string
  title: string
  duration: number
  segments: MeetingSegment[]
  transcript: string
  notes: MeetingNotes | null
  speakers: string[]
  manualNotes: string
  participants: MeetingParticipant[]
  transcriptArtifacts: Partial<Record<TranscriptSource, TranscriptArtifact>>
  activeTranscriptSource: TranscriptSource
  teamsSync: TeamsTranscriptSync
  calendarContext?: MeetingCalendarContext
  language: string
  createdAt: string
  updatedAt: string
}

export interface MeetingDraft {
  meeting: SavedMeeting
  updatedAt: string
}

/** Meeting transcription settings */
export interface MeetingTranscriptionSettings {
  language: string
  autoTranslate: boolean
  speakerDiarization: boolean
  chunkInterval: number
  /** Known participant names for speaker attribution in summaries */
  participants: string[]
}

/** Confidence level for an evaluated decision */
export type DecisionConfidence =
  | 'confirmed'
  | 'potentially-outdated'
  | 'contradicted'
  | 'unverifiable'

/** A decision that has been cross-referenced against ground-truth sources */
export interface EvaluatedDecision {
  /** Original decision text from the meeting summary */
  text: string
  /** How confident we are that this decision is still accurate */
  confidence: DecisionConfidence
  /** Brief explanation of the evaluation reasoning */
  annotation: string
  /** Source references that informed the evaluation */
  sources: string[]
}

/** Maps diarized speaker labels (e.g. "Speaker 0") to real names */
export type SpeakerMap = Record<string, string>
