import { z } from 'zod'
import type {
  MeetingActionItem,
  MeetingParticipant,
  MeetingSegment,
  SpeakerIdentity
} from '../../../shared/types/transcription'
import { callStructured } from './StructuredGitHubModels'

const candidateSchema = z
  .object({
    description: z.string().min(1),
    ownerName: z.string().nullable(),
    dueDate: z.string().nullable(),
    segmentId: z.string().min(1),
    quote: z.string().min(3),
    confidence: z.enum(['high', 'medium', 'low']),
    commitmentType: z.enum(['commitment', 'accepted-request', 'suggestion'])
  })
  .strict()

const extractionSchema = z
  .object({
    actions: z.array(candidateSchema),
    suggestedFollowUps: z.array(candidateSchema)
  })
  .strict()

type Candidate = z.infer<typeof candidateSchema>

const candidateJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'description',
    'ownerName',
    'dueDate',
    'segmentId',
    'quote',
    'confidence',
    'commitmentType'
  ],
  properties: {
    description: { type: 'string' },
    ownerName: { type: ['string', 'null'] },
    dueDate: { type: ['string', 'null'] },
    segmentId: { type: 'string' },
    quote: { type: 'string', minLength: 3 },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    commitmentType: {
      type: 'string',
      enum: ['commitment', 'accepted-request', 'suggestion']
    }
  }
}

const extractionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['actions', 'suggestedFollowUps'],
  properties: {
    actions: { type: 'array', items: candidateJsonSchema },
    suggestedFollowUps: { type: 'array', items: candidateJsonSchema }
  }
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, ' ')
    .trim()
}

function namesMatch(left: string, right: string): boolean {
  const a = normalizeName(left)
  const b = normalizeName(right)
  if (!a || !b) return false
  if (a === b) return true
  const partsA = a.split(' ')
  const partsB = b.split(' ')
  if (partsA.length > 1 && partsB.length > 1) return false
  const firstA = partsA[0]
  const firstB = partsB[0]
  return firstA.length > 1 && firstA === firstB
}

function resolveOwner(name: string | null, segment: MeetingSegment): SpeakerIdentity | null {
  if (!name || normalizeName(name) === 'unknown') return null
  const identity = segment.speakerIdentity
  if (!identity?.verified) return null
  const supported =
    namesMatch(identity.displayName, name) ||
    (identity.email ? namesMatch(identity.email, name) : false)
  return supported ? identity : null
}

function stableId(candidate: Candidate): string {
  const input = `${candidate.ownerName || 'unknown'}|${candidate.description}|${candidate.segmentId}`
  let hash = 2166136261
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `action-${(hash >>> 0).toString(36)}`
}

function formatTranscript(segments: MeetingSegment[]): string {
  return segments
    .map((segment) => {
      const identity = segment.speakerIdentity
      const attribution = identity?.verified ? 'verified' : 'unverified'
      return `[${segment.id}] [${segment.timestamp}] ${segment.speaker} (${attribution}): ${segment.text}`
    })
    .join('\n')
}

function toAction(
  candidate: Candidate,
  segmentsById: Map<string, MeetingSegment>,
  userName: string
): MeetingActionItem | null {
  const segment = segmentsById.get(candidate.segmentId)
  if (!segment || !segment.text.includes(candidate.quote)) return null
  const owner = resolveOwner(candidate.ownerName, segment)
  const accepted =
    candidate.confidence === 'high' &&
    candidate.commitmentType !== 'suggestion' &&
    owner?.verified === true
  return {
    id: stableId(candidate),
    description: candidate.description.trim(),
    owner,
    isCurrentUser:
      owner !== null &&
      (namesMatch(owner.displayName, userName) ||
        (owner.email ? namesMatch(owner.email, userName) : false)),
    dueDate: candidate.dueDate,
    evidence: {
      segmentId: segment.id,
      timestamp: segment.timestamp,
      quote: candidate.quote
    },
    confidence: candidate.confidence,
    commitmentType: candidate.commitmentType,
    reviewStatus: accepted ? 'accepted' : 'needs-review'
  }
}

function deduplicate(items: MeetingActionItem[]): MeetingActionItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${normalizeName(item.owner?.displayName || 'unknown')}|${normalizeName(item.description)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function extractActionItems(options: {
  segments: MeetingSegment[]
  participants: MeetingParticipant[]
  userName: string
  model: string
}): Promise<{
  actionItems: MeetingActionItem[]
  myActionItems: MeetingActionItem[]
  suggestedFollowUps: MeetingActionItem[]
}> {
  const participants = options.participants
    .map(
      (participant) =>
        `${participant.displayName} (${participant.verified ? 'verified identity' : 'calendar candidate'})`
    )
    .join(', ')
  const extracted = await callStructured({
    model: options.model,
    schemaName: 'meeting_action_items',
    jsonSchema: extractionJsonSchema,
    validator: extractionSchema,
    system: [
      'Extract evidence-backed follow-up work from a meeting transcript.',
      'An action is valid only when a person explicitly commits to work or explicitly accepts a request.',
      'Put unowned ideas, proposals, and statements such as “we should” in suggestedFollowUps.',
      'Do not turn status updates, in-meeting actions, social comments, or informational statements into actions.',
      'Copy an exact quote from one transcript segment and return that segment ID.',
      'Use an owner name only when that action evidence segment has verified attribution for the same speaker.',
      'Never map generic speaker labels to calendar attendees.'
    ].join(' '),
    user: `Participants: ${participants || 'none'}\n\nTranscript:\n${formatTranscript(options.segments)}`
  })
  const segmentsById = new Map(options.segments.map((segment) => [segment.id, segment]))
  const actions = deduplicate(
    extracted.actions
      .map((candidate) => toAction(candidate, segmentsById, options.userName))
      .filter((item): item is MeetingActionItem => item !== null)
  )
  const suggested = deduplicate(
    [
      ...extracted.suggestedFollowUps,
      ...extracted.actions.filter((item) => item.commitmentType === 'suggestion')
    ]
      .map((candidate) =>
        toAction({ ...candidate, commitmentType: 'suggestion' }, segmentsById, options.userName)
      )
      .filter((item): item is MeetingActionItem => item !== null)
  )
  const actionItems = actions.filter((item) => item.commitmentType !== 'suggestion')
  const myActionItems = actionItems.filter(
    (item) => item.reviewStatus === 'accepted' && item.isCurrentUser
  )
  return { actionItems, myActionItems, suggestedFollowUps: suggested }
}
