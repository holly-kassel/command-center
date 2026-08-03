import { z } from 'zod'
import type { MeetingNotes, MeetingSummaryInput } from '../../../shared/types/transcription'
import { loadLLMContext } from '../llm/contextLoader'
import { extractActionItems } from './ActionItemExtractor'
import { callStructured } from './StructuredCompletion'

const summarySchema = z
  .object({
    summary: z.string(),
    keyTopics: z.array(z.string()),
    keyPoints: z.array(z.string()),
    decisions: z.array(z.string()),
    openQuestions: z.array(z.string())
  })
  .strict()

const summaryJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'keyTopics', 'keyPoints', 'decisions', 'openQuestions'],
  properties: {
    summary: { type: 'string' },
    keyTopics: { type: 'array', items: { type: 'string' } },
    keyPoints: { type: 'array', items: { type: 'string' } },
    decisions: { type: 'array', items: { type: 'string' } },
    openQuestions: { type: 'array', items: { type: 'string' } }
  }
}

function formatTranscript(input: MeetingSummaryInput): string {
  return input.segments
    .map((segment) => `[${segment.id}] [${segment.timestamp}] ${segment.speaker}: ${segment.text}`)
    .join('\n')
}

export async function summarizeMeeting(
  input: MeetingSummaryInput,
  model: string,
  userName: string
): Promise<MeetingNotes> {
  if (input.segments.length === 0) throw new Error('A transcript is required to generate notes.')
  const actions = await extractActionItems({
    segments: input.segments,
    participants: input.participants,
    userName,
    model
  })
  const context = await loadLLMContext(['business-profile.md', 'billing-domain.md'])
  const validatedActions = actions.actionItems
    .map(
      (item) =>
        `- ${item.owner?.displayName || 'Unknown'}: ${item.description} [${item.reviewStatus}]`
    )
    .join('\n')
  const summary = await callStructured({
    model,
    schemaName: 'meeting_summary',
    jsonSchema: summaryJsonSchema,
    validator: summarySchema,
    system: [
      'Create accurate product meeting notes from the supplied transcript.',
      'Use 3 to 7 sentences for the summary.',
      'Keep key points concrete and preserve names, numbers, constraints, and outcomes.',
      'List only decisions actually reached and questions left unresolved.',
      'Do not create action items because they were extracted and validated separately.',
      context
    ].join('\n\n'),
    user: `Validated actions for context:\n${validatedActions || 'None'}\n\nTranscript:\n${formatTranscript(input)}`
  })
  return {
    ...summary,
    ...actions,
    metadata: {
      model,
      generatedAt: new Date().toISOString(),
      transcriptSource: input.transcriptSource,
      schemaVersion: 2
    }
  }
}
