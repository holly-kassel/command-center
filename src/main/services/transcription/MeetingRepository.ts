import log from 'electron-log'
import type {
  MeetingActionItem,
  MeetingDraft,
  MeetingNotes,
  MeetingParticipant,
  MeetingSegment,
  SavedMeeting,
  SpeakerIdentity,
  TranscriptArtifact,
  TranscriptSource
} from '../../../shared/types/transcription'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ElectronStore = require('electron-store')

const Store = ElectronStore.default || ElectronStore
const store = new Store({
  name: 'meetings',
  defaults: {
    meetings: [] as unknown[],
    draft: null as MeetingDraft | null
  }
})

const draftStore = new Store({
  name: 'meeting-draft',
  defaults: { draft: null as MeetingDraft | null }
})

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : []
}

function normalizeIdentity(value: unknown): SpeakerIdentity | null {
  if (!isRecord(value) || typeof value.displayName !== 'string') return null
  const source = value.source
  return {
    displayName: value.displayName,
    email: typeof value.email === 'string' ? value.email : undefined,
    source:
      source === 'teams' || source === 'manual' || source === 'calendar' || source === 'diarization'
        ? source
        : 'unknown',
    verified: Boolean(value.verified)
  }
}

function normalizeParticipant(value: unknown): MeetingParticipant | null {
  if (!isRecord(value) || typeof value.displayName !== 'string') return null
  const source = value.source
  return {
    displayName: value.displayName,
    email: typeof value.email === 'string' ? value.email : undefined,
    source: source === 'teams' || source === 'manual' ? source : 'calendar',
    verified: Boolean(value.verified)
  }
}

function normalizeSegment(
  value: unknown,
  source: TranscriptSource,
  index: number
): MeetingSegment | null {
  if (!isRecord(value) || typeof value.text !== 'string') return null
  const start = Number(value.start ?? 0)
  const end = Number(value.end ?? start)
  return {
    id: typeof value.id === 'string' ? value.id : `legacy-segment-${index}`,
    speaker: typeof value.speaker === 'string' ? value.speaker : 'Unknown',
    speakerIdentity: normalizeIdentity(value.speakerIdentity) ?? undefined,
    text: value.text,
    start: Number.isFinite(start) ? start : 0,
    end: Number.isFinite(end) ? end : 0,
    timestamp: typeof value.timestamp === 'string' ? value.timestamp : '00:00:00',
    source,
    chunkId: typeof value.chunkId === 'string' ? value.chunkId : undefined
  }
}

function stableActionId(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function parseLegacyAction(value: string): MeetingActionItem {
  const bracketed = value.match(/^\[([^\]]+)\]\s*(.*)$/)
  const owner =
    bracketed?.[1] && bracketed[1].toLowerCase() !== 'unknown'
      ? {
          displayName: bracketed[1],
          source: 'unknown' as const,
          verified: false
        }
      : null
  const description = bracketed?.[2] || value
  return {
    id: `legacy-action-${stableActionId(`${owner?.displayName || 'unknown'}|${description}`)}`,
    description,
    owner,
    isCurrentUser: false,
    dueDate: null,
    evidence: { segmentId: '', timestamp: '', quote: '' },
    confidence: 'low',
    commitmentType: 'commitment',
    reviewStatus: 'needs-review'
  }
}

function normalizeAction(value: unknown): MeetingActionItem | null {
  if (typeof value === 'string') return parseLegacyAction(value)
  if (!isRecord(value) || typeof value.description !== 'string') return null
  const evidence = isRecord(value.evidence) ? value.evidence : {}
  const owner = normalizeIdentity(value.owner)
  const confidence = value.confidence
  const commitmentType = value.commitmentType
  const reviewStatus = value.reviewStatus
  return {
    id:
      typeof value.id === 'string'
        ? value.id
        : `action-${stableActionId(`${owner?.displayName || 'unknown'}|${value.description}`)}`,
    description: value.description,
    owner,
    isCurrentUser: value.isCurrentUser === true,
    dueDate: typeof value.dueDate === 'string' ? value.dueDate : null,
    evidence: {
      segmentId: typeof evidence.segmentId === 'string' ? evidence.segmentId : '',
      timestamp: typeof evidence.timestamp === 'string' ? evidence.timestamp : '',
      quote: typeof evidence.quote === 'string' ? evidence.quote : ''
    },
    confidence: confidence === 'high' || confidence === 'medium' ? confidence : 'low',
    commitmentType:
      commitmentType === 'accepted-request' || commitmentType === 'suggestion'
        ? commitmentType
        : 'commitment',
    reviewStatus:
      reviewStatus === 'accepted' || reviewStatus === 'dismissed' ? reviewStatus : 'needs-review'
  }
}

function normalizeActions(value: unknown): MeetingActionItem[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => normalizeAction(item))
    .filter((item): item is MeetingActionItem => item !== null)
}

function normalizeNotes(
  value: unknown,
  createdAt: string,
  source: TranscriptSource
): MeetingNotes | null {
  if (!isRecord(value)) return null
  const metadata = isRecord(value.metadata) ? value.metadata : {}
  const rawPersonalActions = normalizeActions(value.myActionItems)
  const personalIds = new Set(rawPersonalActions.map((item) => item.id))
  const actionItems = normalizeActions(value.actionItems).map((item) => ({
    ...item,
    isCurrentUser: item.isCurrentUser || personalIds.has(item.id)
  }))
  return {
    summary: typeof value.summary === 'string' ? value.summary : '',
    keyTopics: toStringArray(value.keyTopics),
    keyPoints: toStringArray(value.keyPoints),
    actionItems,
    myActionItems: actionItems.filter(
      (item) => item.isCurrentUser && item.reviewStatus === 'accepted'
    ),
    suggestedFollowUps: normalizeActions(value.suggestedFollowUps),
    decisions: toStringArray(value.decisions),
    openQuestions: toStringArray(value.openQuestions),
    metadata: {
      model: typeof metadata.model === 'string' ? metadata.model : 'unknown',
      generatedAt: typeof metadata.generatedAt === 'string' ? metadata.generatedAt : createdAt,
      transcriptSource:
        metadata.transcriptSource === 'teams' || metadata.transcriptSource === 'local'
          ? metadata.transcriptSource
          : source,
      schemaVersion: 2
    }
  }
}

function buildArtifact(
  source: TranscriptSource,
  segmentsValue: unknown,
  transcriptValue: unknown,
  speakersValue: unknown,
  capturedAt: string,
  attributionValue?: unknown
): TranscriptArtifact {
  const segments = Array.isArray(segmentsValue)
    ? segmentsValue
        .map((segment, index) => normalizeSegment(segment, source, index))
        .filter((segment): segment is MeetingSegment => segment !== null)
    : []
  const transcript =
    typeof transcriptValue === 'string'
      ? transcriptValue
      : segments.map((segment) => `${segment.speaker}: ${segment.text}`).join('\n')
  const speakers = toStringArray(speakersValue)
  return {
    source,
    segments,
    transcript,
    speakers:
      speakers.length > 0 ? speakers : [...new Set(segments.map((segment) => segment.speaker))],
    attribution: attributionValue === 'verified' ? 'verified' : 'unverified',
    capturedAt
  }
}

function normalizeArtifact(
  value: unknown,
  source: TranscriptSource,
  createdAt: string
): TranscriptArtifact | null {
  if (!isRecord(value)) return null
  return buildArtifact(
    source,
    value.segments,
    value.transcript,
    value.speakers,
    typeof value.capturedAt === 'string' ? value.capturedAt : createdAt,
    value.attribution
  )
}

export function normalizeMeeting(value: unknown): SavedMeeting {
  if (!isRecord(value)) throw new Error('Meeting record is invalid.')
  const createdAt = typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString()
  const rawArtifacts = isRecord(value.transcriptArtifacts) ? value.transcriptArtifacts : {}
  const localArtifact =
    normalizeArtifact(rawArtifacts.local, 'local', createdAt) ??
    buildArtifact('local', value.segments, value.transcript, value.speakers, createdAt)
  const teamsArtifact = normalizeArtifact(rawArtifacts.teams, 'teams', createdAt)
  const requestedSource: TranscriptSource =
    value.activeTranscriptSource === 'teams' ? 'teams' : 'local'
  const activeTranscriptSource: TranscriptSource =
    requestedSource === 'teams' && teamsArtifact ? 'teams' : 'local'
  const active = activeTranscriptSource === 'teams' ? teamsArtifact! : localArtifact
  const rawSync = isRecord(value.teamsSync) ? value.teamsSync : {}
  const calendarContext = isRecord(value.calendarContext)
    ? {
        eventId:
          typeof value.calendarContext.eventId === 'string'
            ? value.calendarContext.eventId
            : undefined,
        title:
          typeof value.calendarContext.title === 'string'
            ? value.calendarContext.title
            : typeof value.title === 'string'
              ? value.title
              : 'Meeting Notes',
        startTime:
          typeof value.calendarContext.startTime === 'string'
            ? value.calendarContext.startTime
            : undefined,
        endTime:
          typeof value.calendarContext.endTime === 'string'
            ? value.calendarContext.endTime
            : undefined,
        onlineMeetingUrl:
          typeof value.calendarContext.onlineMeetingUrl === 'string'
            ? value.calendarContext.onlineMeetingUrl
            : undefined,
        attendees: Array.isArray(value.calendarContext.attendees)
          ? value.calendarContext.attendees
              .map(normalizeParticipant)
              .filter((participant): participant is MeetingParticipant => participant !== null)
          : []
      }
    : undefined
  const participants = Array.isArray(value.participants)
    ? value.participants
        .map(normalizeParticipant)
        .filter((participant): participant is MeetingParticipant => participant !== null)
    : (calendarContext?.attendees ?? [])
  const id = typeof value.id === 'string' ? value.id : crypto.randomUUID()
  const notes = normalizeNotes(value.notes, createdAt, activeTranscriptSource)
  const title = typeof value.title === 'string' ? value.title : 'Meeting Notes'
  const duration = Number(value.duration ?? 0)
  return {
    schemaVersion: 2,
    id,
    title,
    duration: Number.isFinite(duration) ? duration : 0,
    segments: active.segments,
    transcript: active.transcript,
    notes,
    speakers: active.speakers,
    manualNotes: typeof value.manualNotes === 'string' ? value.manualNotes : '',
    participants,
    transcriptArtifacts: {
      local: localArtifact,
      ...(teamsArtifact ? { teams: teamsArtifact } : {})
    },
    activeTranscriptSource,
    teamsSync: {
      status:
        rawSync.status === 'pending' ||
        rawSync.status === 'syncing' ||
        rawSync.status === 'available' ||
        rawSync.status === 'unavailable' ||
        rawSync.status === 'error'
          ? rawSync.status
          : teamsArtifact
            ? 'available'
            : 'not-requested',
      attempts: Number.isFinite(Number(rawSync.attempts)) ? Number(rawSync.attempts) : 0,
      lastAttemptAt: typeof rawSync.lastAttemptAt === 'string' ? rawSync.lastAttemptAt : undefined,
      operationId: typeof rawSync.operationId === 'string' ? rawSync.operationId : undefined,
      error: typeof rawSync.error === 'string' ? rawSync.error : undefined,
      summaryStatus:
        rawSync.summaryStatus === 'pending' ||
        rawSync.summaryStatus === 'generating' ||
        rawSync.summaryStatus === 'available' ||
        rawSync.summaryStatus === 'error'
          ? rawSync.summaryStatus
          : teamsArtifact
            ? notes?.metadata.transcriptSource === 'teams'
              ? 'available'
              : 'pending'
            : 'not-requested',
      summaryAttempts: Number.isFinite(Number(rawSync.summaryAttempts))
        ? Number(rawSync.summaryAttempts)
        : 0,
      summaryLastAttemptAt:
        typeof rawSync.summaryLastAttemptAt === 'string' ? rawSync.summaryLastAttemptAt : undefined,
      summaryOperationId:
        typeof rawSync.summaryOperationId === 'string' ? rawSync.summaryOperationId : undefined,
      summaryError: typeof rawSync.summaryError === 'string' ? rawSync.summaryError : undefined
    },
    calendarContext,
    language: typeof value.language === 'string' ? value.language : 'en',
    createdAt,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : createdAt
  }
}

export class MeetingRepository {
  getAll(): SavedMeeting[] {
    const meetings = store.get('meetings', []) as unknown[]
    return meetings.map(normalizeMeeting)
  }

  getById(id: string): SavedMeeting | null {
    return this.getAll().find((meeting) => meeting.id === id) ?? null
  }

  upsert(meeting: SavedMeeting): SavedMeeting {
    const normalized = normalizeMeeting({ ...meeting, updatedAt: new Date().toISOString() })
    const meetings = this.getAll()
    const index = meetings.findIndex((item) => item.id === normalized.id)
    if (index >= 0) meetings[index] = normalized
    else meetings.push(normalized)
    store.set('meetings', meetings)
    log.info(`[MeetingRepository] Upserted meeting ${normalized.id}`)
    return normalized
  }

  update(id: string, updater: (meeting: SavedMeeting) => SavedMeeting): SavedMeeting | null {
    const meetings = this.getAll()
    const index = meetings.findIndex((item) => item.id === id)
    if (index < 0) return null
    const normalized = normalizeMeeting({
      ...updater(meetings[index]),
      id,
      updatedAt: new Date().toISOString()
    })
    meetings[index] = normalized
    store.set('meetings', meetings)
    log.info(`[MeetingRepository] Updated meeting ${id}`)
    return normalized
  }

  delete(id: string): boolean {
    const meetings = this.getAll()
    const filtered = meetings.filter((meeting) => meeting.id !== id)
    store.set('meetings', filtered)
    return filtered.length !== meetings.length
  }

  saveDraft(meeting: SavedMeeting): MeetingDraft {
    const draft = { meeting: normalizeMeeting(meeting), updatedAt: new Date().toISOString() }
    draftStore.set('draft', draft)
    return draft
  }

  getDraft(): MeetingDraft | null {
    const value = (draftStore.get('draft') ?? store.get('draft')) as unknown
    if (!isRecord(value) || !value.meeting) return null
    return {
      meeting: normalizeMeeting(value.meeting),
      updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString()
    }
  }

  deleteDraft(meetingId?: string): boolean {
    if (meetingId) {
      const draft = this.getDraft()
      if (!draft || draft.meeting.id !== meetingId) return false
    } else if (draftStore.get('draft') == null && store.get('draft') == null) {
      return false
    }

    draftStore.set('draft', null)
    if (store.get('draft') != null) store.set('draft', null)
    return true
  }
}

let instance: MeetingRepository | null = null

export function getMeetingRepository(): MeetingRepository {
  if (!instance) instance = new MeetingRepository()
  return instance
}
