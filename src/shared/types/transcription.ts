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

/** A single transcript segment from diarized transcription */
export interface MeetingSegment {
  id: string
  speaker: string
  text: string
  start: number
  end: number
  timestamp: string
}

/** AI-generated meeting notes */
export interface MeetingNotes {
  summary: string
  keyTopics: string[]
  keyPoints: string[]
  actionItems: string[]
  /** Action items specifically assigned to the current user */
  myActionItems: string[]
  decisions: string[]
  openQuestions: string[]
}

/** A saved meeting record */
export interface SavedMeeting {
  id: string
  title: string
  duration: number
  segments: MeetingSegment[]
  transcript: string
  notes: MeetingNotes | null
  speakers: string[]
  manualNotes: string
  language: string
  createdAt: string
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
