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

export interface MeetingSummaryResult {
  /** Whether the summary was generated and saved */
  success: boolean
  /** Human-readable status message */
  message: string
}
