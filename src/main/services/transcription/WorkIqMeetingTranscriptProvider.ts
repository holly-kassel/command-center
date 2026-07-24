import { getWorkIqClient } from '../calendar/WorkIqClient'
import type {
  MeetingParticipant,
  MeetingSegment,
  SpeakerIdentity
} from '../../../shared/types/transcription'
import type {
  MeetingTranscriptProvider,
  MeetingTranscriptResult
} from './MeetingTranscriptProvider'

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [h, m, s].map((value) => String(value).padStart(2, '0')).join(':')
}

function isGenericSpeaker(value: string): boolean {
  return /^(speaker|participant|unknown)(?:[\s_:-]*\d+)?$/i.test(value.trim())
}

export class WorkIqMeetingTranscriptProvider implements MeetingTranscriptProvider {
  async fetch(
    context: Parameters<MeetingTranscriptProvider['fetch']>[0]
  ): Promise<MeetingTranscriptResult> {
    const workIq = getWorkIqClient()
    if (!workIq.isConnected()) {
      return {
        available: false,
        reason: 'WorkIQ is disconnected. Reconnect Microsoft 365 before syncing Teams.',
        participants: []
      }
    }
    const result = await workIq.getMeetingTranscript(context)
    const participants: MeetingParticipant[] = result.participants.map((participant) => ({
      displayName: participant.displayName,
      email: participant.email,
      source: 'teams',
      verified: true
    }))
    if (!result.available) {
      return { available: false, reason: result.reason, participants }
    }

    const capturedAt = new Date().toISOString()
    const segments: MeetingSegment[] = result.segments.map((segment, index) => {
      const verified = result.attributionAvailable && !isGenericSpeaker(segment.speaker)
      const identity: SpeakerIdentity = {
        displayName: segment.speaker,
        source: verified ? 'teams' : 'unknown',
        verified
      }
      return {
        id: `teams-segment-${index}-${Math.round(segment.start * 1000)}`,
        speaker: segment.speaker,
        speakerIdentity: identity,
        text: segment.text,
        start: segment.start,
        end: segment.end,
        timestamp: formatTimestamp(segment.start),
        source: 'teams'
      }
    })
    const speakers = [...new Set(segments.map((segment) => segment.speaker))]
    const attribution =
      result.attributionAvailable && segments.every((segment) => segment.speakerIdentity?.verified)
        ? 'verified'
        : 'unverified'
    return {
      available: true,
      participants,
      artifact: {
        source: 'teams',
        segments,
        transcript: segments.map((segment) => `${segment.speaker}: ${segment.text}`).join('\n'),
        speakers,
        attribution,
        capturedAt
      }
    }
  }
}
