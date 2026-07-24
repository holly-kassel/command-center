import log from 'electron-log'
import { settings } from '../../config/settings'
import type { MeetingParticipant, SavedMeeting } from '../../../shared/types/transcription'
import { credentialManager } from '../auth/CredentialManager'
import { preserveActionReviews } from './ActionReviewMerge'
import { getMeetingRepository } from './MeetingRepository'
import type { MeetingTranscriptProvider } from './MeetingTranscriptProvider'
import { summarizeMeeting } from './MeetingSummaryService'
import { WorkIqMeetingTranscriptProvider } from './WorkIqMeetingTranscriptProvider'

const MAX_TRANSCRIPT_ATTEMPTS = 6
const MAX_SUMMARY_ATTEMPTS = 3
const STALE_OPERATION_MS = 10 * 60 * 1000
const TRANSCRIPT_BACKOFF_MS = [0, 5, 15, 30, 60, 120].map((minutes) => minutes * 60 * 1000)
const SUMMARY_BACKOFF_MS = [0, 5, 20].map((minutes) => minutes * 60 * 1000)

function participantKey(participant: MeetingParticipant): string {
  return (participant.email || participant.displayName).trim().toLowerCase()
}

function mergeParticipants(
  current: MeetingParticipant[],
  incoming: MeetingParticipant[]
): MeetingParticipant[] {
  const merged = new Map(current.map((participant) => [participantKey(participant), participant]))
  for (const participant of incoming) merged.set(participantKey(participant), participant)
  return [...merged.values()]
}

function isOlderThan(value: string | undefined, durationMs: number, now: number): boolean {
  if (!value) return true
  const timestamp = new Date(value).getTime()
  return !Number.isFinite(timestamp) || now - timestamp >= durationMs
}

function isRetryDue(
  lastAttemptAt: string | undefined,
  attempts: number,
  schedule: number[],
  now: number
): boolean {
  const delay = schedule[Math.min(attempts, schedule.length - 1)] ?? 0
  return isOlderThan(lastAttemptAt, delay, now)
}

export class TeamsTranscriptSyncService {
  constructor(
    private readonly provider: MeetingTranscriptProvider = new WorkIqMeetingTranscriptProvider()
  ) {}

  async syncPending(): Promise<SavedMeeting[]> {
    const repository = getMeetingRepository()
    const now = Date.now()
    const canSummarize = Boolean(credentialManager.getGitHubPAT())
    const pending = repository.getAll().filter((meeting) => {
      const end = meeting.calendarContext?.endTime
      const ended = end ? new Date(end).getTime() <= now : false
      if (!ended) return false

      const transcriptRetry =
        ((meeting.teamsSync.status === 'pending' || meeting.teamsSync.status === 'error') &&
          meeting.teamsSync.attempts < MAX_TRANSCRIPT_ATTEMPTS &&
          isRetryDue(
            meeting.teamsSync.lastAttemptAt,
            meeting.teamsSync.attempts,
            TRANSCRIPT_BACKOFF_MS,
            now
          )) ||
        (meeting.teamsSync.status === 'syncing' &&
          meeting.teamsSync.attempts <= MAX_TRANSCRIPT_ATTEMPTS &&
          isOlderThan(meeting.teamsSync.lastAttemptAt, STALE_OPERATION_MS, now))

      const summaryRetry =
        canSummarize &&
        meeting.teamsSync.status === 'available' &&
        Boolean(meeting.transcriptArtifacts.teams) &&
        (((meeting.teamsSync.summaryStatus === 'pending' ||
          meeting.teamsSync.summaryStatus === 'error') &&
          meeting.teamsSync.summaryAttempts < MAX_SUMMARY_ATTEMPTS &&
          isRetryDue(
            meeting.teamsSync.summaryLastAttemptAt,
            meeting.teamsSync.summaryAttempts,
            SUMMARY_BACKOFF_MS,
            now
          )) ||
          (meeting.teamsSync.summaryStatus === 'generating' &&
            meeting.teamsSync.summaryAttempts <= MAX_SUMMARY_ATTEMPTS &&
            isOlderThan(meeting.teamsSync.summaryLastAttemptAt, STALE_OPERATION_MS, now)))

      return transcriptRetry || summaryRetry
    })

    const updated: SavedMeeting[] = []
    for (const meeting of pending) {
      try {
        updated.push(await this.syncMeeting(meeting.id))
      } catch (error) {
        log.warn(`[TeamsTranscriptSync] Could not resume meeting ${meeting.id}:`, error)
      }
    }
    return updated
  }

  async syncMeeting(meetingId: string, force = false): Promise<SavedMeeting> {
    const repository = getMeetingRepository()
    const meeting = repository.getById(meetingId)
    if (!meeting) throw new Error('Meeting not found.')

    if (meeting.teamsSync.status === 'available' && meeting.transcriptArtifacts.teams) {
      return this.finalizeSummary(meetingId, force)
    }

    const context = meeting.calendarContext
    if (!context?.onlineMeetingUrl) {
      const unavailable = repository.update(meetingId, (latest) => ({
        ...latest,
        teamsSync: {
          ...latest.teamsSync,
          status: 'unavailable',
          error: 'This recording is not linked to a Teams meeting.'
        }
      }))
      if (!unavailable) throw new Error('Meeting was deleted during Teams sync.')
      return unavailable
    }
    if (!force && context.endTime && new Date(context.endTime).getTime() > Date.now()) {
      const pending = repository.update(meetingId, (latest) => ({
        ...latest,
        teamsSync: { ...latest.teamsSync, status: 'pending' }
      }))
      if (!pending) throw new Error('Meeting was deleted during Teams sync.')
      return pending
    }
    if (
      !force &&
      meeting.teamsSync.status !== 'syncing' &&
      meeting.teamsSync.attempts >= MAX_TRANSCRIPT_ATTEMPTS
    ) {
      return meeting
    }

    const attempts =
      meeting.teamsSync.status === 'syncing'
        ? meeting.teamsSync.attempts
        : meeting.teamsSync.attempts + 1
    const lastAttemptAt = new Date().toISOString()
    const operationId = crypto.randomUUID()
    const syncing = repository.update(meetingId, (latest) => ({
      ...latest,
      teamsSync: {
        ...latest.teamsSync,
        status: 'syncing',
        attempts,
        lastAttemptAt,
        operationId
      }
    }))
    if (!syncing) throw new Error('Meeting was deleted during Teams sync.')

    try {
      const result = await this.provider.fetch(context)
      const current = repository.getById(meetingId)
      if (!current) throw new Error('Meeting was deleted during Teams sync.')
      if (current.teamsSync.operationId !== operationId) return current
      if (!result.available || !result.artifact) {
        const pending = repository.update(meetingId, (latest) => {
          if (latest.teamsSync.status === 'available') return latest
          return {
            ...latest,
            teamsSync: {
              ...latest.teamsSync,
              status: attempts >= MAX_TRANSCRIPT_ATTEMPTS ? 'unavailable' : 'pending',
              attempts,
              lastAttemptAt,
              operationId: undefined,
              error: result.reason || 'The Teams transcript is not available yet.'
            }
          }
        })
        if (!pending) throw new Error('Meeting was deleted during Teams sync.')
        return pending
      }

      const artifact = result.artifact
      const synced = repository.update(meetingId, (latest) => ({
        ...latest,
        segments: artifact.segments,
        transcript: artifact.transcript,
        speakers: artifact.speakers,
        participants: mergeParticipants(latest.participants, result.participants),
        transcriptArtifacts: { ...latest.transcriptArtifacts, teams: artifact },
        activeTranscriptSource: 'teams',
        teamsSync: {
          ...latest.teamsSync,
          status: 'available',
          attempts,
          lastAttemptAt,
          operationId: undefined,
          error: undefined,
          summaryStatus: 'pending',
          summaryAttempts: 0,
          summaryLastAttemptAt: undefined,
          summaryOperationId: undefined,
          summaryError: undefined
        }
      }))
      if (!synced) throw new Error('Meeting was deleted during Teams sync.')
      return this.finalizeSummary(meetingId, force)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const latest = repository.getById(meetingId)
      if (!latest) throw error
      if (latest.teamsSync.operationId !== operationId) return latest
      if (latest.teamsSync.status === 'available') return latest
      log.error(`[TeamsTranscriptSync] Meeting ${meetingId} failed: ${message}`)
      return (
        repository.update(meetingId, (current) => ({
          ...current,
          teamsSync: {
            ...current.teamsSync,
            status: 'error',
            attempts,
            lastAttemptAt,
            operationId: undefined,
            error: message
          }
        })) ?? latest
      )
    }
  }

  private async finalizeSummary(meetingId: string, force: boolean): Promise<SavedMeeting> {
    const repository = getMeetingRepository()
    const meeting = repository.getById(meetingId)
    if (!meeting) throw new Error('Meeting not found.')
    const artifact = meeting.transcriptArtifacts.teams
    if (!artifact) return meeting

    const githubPat = credentialManager.getGitHubPAT()
    if (!githubPat) {
      return (
        repository.update(meetingId, (latest) => ({
          ...latest,
          teamsSync: {
            ...latest.teamsSync,
            summaryStatus: 'pending',
            summaryOperationId: undefined
          }
        })) ?? meeting
      )
    }
    if (!force && meeting.teamsSync.summaryStatus === 'available') return meeting
    if (
      !force &&
      meeting.teamsSync.summaryStatus !== 'generating' &&
      meeting.teamsSync.summaryAttempts >= MAX_SUMMARY_ATTEMPTS
    ) {
      return meeting
    }

    const summaryAttempts =
      meeting.teamsSync.summaryStatus === 'generating'
        ? meeting.teamsSync.summaryAttempts
        : meeting.teamsSync.summaryAttempts + 1
    const summaryLastAttemptAt = new Date().toISOString()
    const summaryOperationId = crypto.randomUUID()
    const generating = repository.update(meetingId, (latest) => ({
      ...latest,
      teamsSync: {
        ...latest.teamsSync,
        summaryStatus: 'generating',
        summaryAttempts,
        summaryLastAttemptAt,
        summaryOperationId,
        summaryError: undefined
      }
    }))
    if (!generating) throw new Error('Meeting was deleted during summary generation.')

    try {
      const notes = await summarizeMeeting(
        {
          segments: artifact.segments,
          participants: generating.participants,
          transcriptSource: 'teams'
        },
        settings.get('meetingSummaryModel') || 'openai/gpt-5',
        settings.get('userName') || ''
      )
      const current = repository.getById(meetingId)
      if (!current) throw new Error('Meeting was deleted during summary generation.')
      if (current.teamsSync.summaryOperationId !== summaryOperationId) return current
      const finalized = repository.update(meetingId, (latest) => {
        const latestGeneratedAt = latest.notes?.metadata.generatedAt
        const hasNewerTeamsSummary =
          latest.notes?.metadata.transcriptSource === 'teams' &&
          Boolean(latestGeneratedAt) &&
          new Date(latestGeneratedAt!).getTime() > new Date(summaryLastAttemptAt).getTime()
        return {
          ...latest,
          notes: hasNewerTeamsSummary ? latest.notes : preserveActionReviews(notes, latest.notes),
          teamsSync: {
            ...latest.teamsSync,
            summaryStatus: 'available',
            summaryAttempts,
            summaryLastAttemptAt,
            summaryOperationId: undefined,
            summaryError: undefined
          }
        }
      })
      if (!finalized) throw new Error('Meeting was deleted during summary generation.')
      return finalized
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const latest = repository.getById(meetingId)
      if (!latest) throw error
      if (latest.teamsSync.summaryOperationId !== summaryOperationId) return latest
      log.warn(`[TeamsTranscriptSync] Final summary for meeting ${meetingId} failed:`, error)
      const failed = repository.update(meetingId, (latest) => ({
        ...latest,
        teamsSync: {
          ...latest.teamsSync,
          summaryStatus: 'error',
          summaryAttempts,
          summaryLastAttemptAt,
          summaryOperationId: undefined,
          summaryError: message
        }
      }))
      if (!failed) throw error
      return failed
    }
  }
}

let instance: TeamsTranscriptSyncService | null = null

export function getTeamsTranscriptSyncService(): TeamsTranscriptSyncService {
  if (!instance) instance = new TeamsTranscriptSyncService()
  return instance
}
