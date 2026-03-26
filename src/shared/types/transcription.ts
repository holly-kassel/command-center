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
