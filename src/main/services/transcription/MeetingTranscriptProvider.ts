import type {
  MeetingCalendarContext,
  MeetingParticipant,
  TranscriptArtifact
} from '../../../shared/types/transcription'

export interface MeetingTranscriptResult {
  available: boolean
  reason?: string
  artifact?: TranscriptArtifact
  participants: MeetingParticipant[]
}

export interface MeetingTranscriptProvider {
  fetch(context: MeetingCalendarContext): Promise<MeetingTranscriptResult>
}
