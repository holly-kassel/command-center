/**
 * Transcription Service — Local Whisper via @huggingface/transformers
 *
 * Runs Whisper (ONNX) in the main process using onnxruntime-node.
 * No API keys needed. Downloads the model (~75 MB) on first use, then
 * it's cached locally for instant startup.
 *
 * The renderer sends raw 16 kHz mono Float32 PCM via IPC. We feed it
 * directly to the Whisper pipeline.
 */
import log from 'electron-log'
import type { TranscriptionResult, MeetingSegment, MeetingNotes } from '../../../shared/types/transcription'

const MODEL_ID = 'onnx-community/whisper-base'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriber: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loadPromise: Promise<any> | null = null

/**
 * Dynamically import @huggingface/transformers.
 * Must be dynamic because it's an ESM-only package in a CJS main process.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadTransformers(): Promise<any> {
  return await import('@huggingface/transformers')
}

/**
 * Get or initialize the Whisper pipeline.
 * Downloads model files on first call, cached in HF_HOME (~/.cache/huggingface).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getTranscriber(onProgress?: (info: any) => void): Promise<any> {
  if (transcriber) return transcriber
  if (loadPromise) return loadPromise

  log.info('[Transcription] Initializing local Whisper pipeline…')

  loadPromise = (async () => {
    const { pipeline } = await loadTransformers()

    const pipe = await pipeline('automatic-speech-recognition', MODEL_ID, {
      dtype: 'q8',
      progress_callback: onProgress
    })

    log.info('[Transcription] Whisper pipeline ready')
    return pipe
  })()

  try {
    transcriber = await loadPromise
  } catch (err) {
    log.error('[Transcription] Failed to load Whisper pipeline:', err)
    throw err
  } finally {
    loadPromise = null
  }

  return transcriber
}

/**
 * Transcribe a Float32Array of 16 kHz mono PCM audio.
 *
 * @param pcmData - Raw PCM samples (16 kHz, mono, Float32)
 * @param durationSeconds - Recording duration for metadata
 * @param onProgress - Optional callback for model download progress
 * @returns Transcribed text + metadata
 */
export async function transcribeAudio(
  pcmData: Float32Array,
  durationSeconds: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onProgress?: (info: any) => void
): Promise<TranscriptionResult> {
  log.info(
    `[Transcription] Transcribing ${durationSeconds.toFixed(0)}s of audio (${pcmData.length} samples)`
  )

  const pipe = await getTranscriber(onProgress)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await pipe(pcmData, {
    language: 'en',
    task: 'transcribe',
    chunk_length_s: 30,
    stride_length_s: 5
  })

  let text: string
  if (typeof result === 'string') {
    text = result
  } else if (result && typeof result === 'object' && 'text' in result) {
    text = result.text
  } else {
    text = String(result)
  }

  text = text.trim()
  log.info(`[Transcription] Got ${text.length} chars`)

  return { text, durationSeconds, model: MODEL_ID }
}

/** True once the model has been loaded into memory. */
export function isWhisperReady(): boolean {
  return transcriber !== null
}

/**
 * Encode raw PCM Float32 samples (16 kHz mono) into a WAV file buffer.
 */
function encodeWav(pcmFloat32: Float32Array): Buffer {
  const numChannels = 1
  const sampleRate = 16000
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)

  // Convert Float32 [-1,1] to Int16
  const int16 = new Int16Array(pcmFloat32.length)
  for (let i = 0; i < pcmFloat32.length; i++) {
    const s = Math.max(-1, Math.min(1, pcmFloat32[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }

  const dataSize = int16.length * 2
  const buffer = Buffer.alloc(44 + dataSize)

  // RIFF header
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)

  // fmt chunk
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20) // PCM
  buffer.writeUInt16LE(numChannels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(bitsPerSample, 34)

  // data chunk
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  Buffer.from(int16.buffer).copy(buffer, 44)

  return buffer
}

/**
 * Transcribe an audio chunk using OpenAI API with speaker diarization.
 * Receives raw PCM Float32 (16 kHz mono) from renderer, encodes as WAV for OpenAI.
 */
export async function transcribeChunkWithOpenAI(
  audioBuffer: Buffer,
  apiKey: string,
  options: { language?: string; speakerDiarization?: boolean } = {}
): Promise<MeetingSegment[]> {
  const { language = 'en', speakerDiarization = true } = options

  // Convert raw PCM Float32 ArrayBuffer to WAV
  const pcmFloat32 = new Float32Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.byteLength / 4)
  const wavBuffer = encodeWav(pcmFloat32)

  const model = speakerDiarization ? 'gpt-4o-transcribe-diarize' : 'gpt-4o-transcribe'
  const responseFormat = speakerDiarization ? 'diarized_json' : 'json'

  // Build FormData manually for Node.js
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
  const parts: Buffer[] = []

  // File part — send as WAV
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n`))
  parts.push(wavBuffer)
  parts.push(Buffer.from('\r\n'))

  // Model part
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n`))

  // Response format part
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\n${responseFormat}\r\n`))

  // Language part
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${language}\r\n`))

  // Chunking strategy (required for diarization with audio > 30s)
  if (speakerDiarization) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chunking_strategy"\r\n\r\nauto\r\n`))
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`))

  const body = Buffer.concat(parts)

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  })

  if (!response.ok) {
    const errorText = await response.text()
    log.error('[Transcription] OpenAI API error:', errorText)
    throw new Error(`OpenAI transcription failed: ${response.status} ${errorText}`)
  }

  const result = await response.json() as Record<string, unknown>

  // Parse segments
  const segments: MeetingSegment[] = []
  const rawSegments = (result.segments || []) as Array<Record<string, unknown>>

  for (const seg of rawSegments) {
    const startSec = Number(seg.start || 0)
    segments.push({
      id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      speaker: String(seg.speaker || 'Unknown'),
      text: String(seg.text || '').trim(),
      start: startSec,
      end: Number(seg.end || 0),
      timestamp: formatTimestamp(startSec),
    })
  }

  // If non-diarized, the response has a single "text" field
  if (segments.length === 0 && result.text) {
    segments.push({
      id: `seg-${Date.now()}`,
      speaker: 'Unknown',
      text: String(result.text).trim(),
      start: 0,
      end: 0,
      timestamp: '00:00:00',
    })
  }

  return segments
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

/**
 * Load personal/domain context if available (same as slash command path).
 */
async function loadContext(): Promise<string> {
  try {
    const { loadLLMContext } = await import('../llm/contextLoader')
    return await loadLLMContext(['business-profile.md', 'billing-domain.md'])
  } catch {
    return ''
  }
}

/**
 * Build a participant hint for the system prompt when participant names are provided.
 */
function buildParticipantHint(participants: string[]): string {
  if (participants.length > 0) {
    return `\n\nMeeting participants: ${participants.join(', ')}. Use these names to identify speakers — map generic speaker labels (Speaker 0, Speaker 1, A, B, etc.) to real names based on context clues like introductions, role mentions, and conversational references.`
  }
  return `\n\nNo participant list was provided. Infer real first names from the conversation itself — look for introductions ("I'm David"), name mentions ("thanks Brittany"), and role references. Use inferred first names in action items. If a speaker's name truly cannot be determined, use "Unknown" — never use generic labels like "A", "Participant A", or "A participant".`
}

/**
 * Generate AI meeting notes from transcript using OpenAI Chat Completions.
 * Single-pass summarization with comprehensive action-item extraction built into the prompt.
 */
export async function summarizeMeeting(
  transcript: string,
  apiKey: string,
  participants: string[] = [],
  model: string = 'gpt-4o-mini',
  userName: string = ''
): Promise<MeetingNotes> {
  log.info('[Transcription] Generating meeting summary...')

  const context = await loadContext()
  const participantHint = buildParticipantHint(participants)
  const myItemsHint = userName
    ? `\n\nThe person recording this meeting is "${userName}". In "myActionItems", include ONLY action items where ${userName} is the owner — things ${userName} committed to, was asked to do, or was assigned. This is a strict subset of "actionItems". If ${userName} has no action items, return an empty array.`
    : ''

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a thorough meeting notes assistant. Analyze the transcript and return a JSON object with exactly these fields:
- "summary" (string): A detailed 5-7 sentence summary covering the main discussion, context, and outcomes. Include who discussed what and any important nuances.
- "keyTopics" (array of strings): Main topics/themes discussed, each 2-5 words.
- "keyPoints" (array of strings): Detailed key points — each should be a full sentence capturing the substance of what was said, not just a topic label. Include specifics like names, numbers, and concrete details from the discussion.
- "actionItems" (array of strings): Concrete follow-up tasks and commitments that need to happen AFTER this meeting. Extract both explicit ("I'll do X") and implicit ("we should do X", "can you look into X") commitments.

  QUALITY RULES — follow these strictly:
  * DEDUPLICATE: Each action item must appear exactly once. If the same commitment is mentioned multiple times in the conversation, merge into one clear item. Aim for 5-15 well-deduped items. If you have more than 20, you are almost certainly duplicating.
  * EXCLUDE in-meeting actions: Skip things already completed during the call (e.g., "I'll share my screen", "I'm recording this", "let me look at the board").
  * EXCLUDE personal/social items: Skip non-work items (e.g., posting vacation photos, personal travel plans, moving apartments).
  * EXCLUDE status updates: "I'm working on X" or "I've been doing X" describes current work, NOT a new commitment. Only include if someone is explicitly taking on NEW work or making a new promise.
  * EXCLUDE informational statements: "I'm out of office Wednesday" is information, not an action item.
  * BE SPECIFIC: Describe the concrete next step, not a vague restatement of the problem. Bad: "Address the license discrepancy." Good: "Investigate why Microsoft's snapshot shows 217k licenses vs 29k billed."

  Patterns to capture:
  * End-of-meeting wrap-up asks and post-meeting follow-ups
  * Casual commitments: "I'll get those answers for you", "let me share that"
  * Scheduling/coordination: "let's set up a meeting with X"
  * Information gathering: "I need to find out about X"
  * Commitments made on behalf of others ("Holly will follow up")
  * Pay special attention to the BEGINNING and END of the meeting.

  FORMAT: Every item must use this exact format: "[FirstName] action description" — use real first names inferred from the conversation. Never use "A", "B", "Participant A", "A participant", or "A team member". If the owner is truly unknown, use "[Unknown]".

- "myActionItems" (array of strings): A filtered subset of "actionItems" containing ONLY items owned by the person recording this meeting. Same format as actionItems. If no user identity is provided, return an empty array.
- "decisions" (array of strings): Any decisions made or conclusions reached during the meeting.
- "openQuestions" (array of strings): Unresolved questions or topics that need follow-up.
Return ONLY valid JSON, no markdown.${participantHint}${myItemsHint}${context}`
        },
        {
          role: 'user',
          content: `Generate structured meeting notes from this transcript:\n\n${transcript}`
        }
      ],
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    log.error('[Transcription] Summary API error:', errorText)
    throw new Error(`Summary generation failed: ${response.status}`)
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> }
  const rawContent = data.choices?.[0]?.message?.content || '{}'
  // Strip markdown code fences if the LLM wrapped the JSON
  const content = rawContent.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()

  try {
    const parsed = JSON.parse(content) as MeetingNotes
    return {
      summary: parsed.summary || '',
      keyTopics: parsed.keyTopics || [],
      keyPoints: parsed.keyPoints || [],
      actionItems: deduplicateItems(parsed.actionItems || []),
      myActionItems: deduplicateItems(parsed.myActionItems || []),
      decisions: parsed.decisions || [],
      openQuestions: parsed.openQuestions || [],
    }
  } catch {
    log.warn('[Transcription] Failed to parse summary JSON, using raw text')
    return {
      summary: content,
      keyTopics: [],
      keyPoints: [],
      actionItems: [],
      myActionItems: [],
      decisions: [],
      openQuestions: [],
    }
  }
}

/**
 * Deduplicate action items by removing entries whose normalized text
 * is a high-overlap subset of another item already in the list.
 * Uses word-level Jaccard similarity — items sharing ≥60% of words are duplicates.
 */
function deduplicateItems(items: string[]): string[] {
  if (items.length <= 1) return items

  const STOP_WORDS = new Set([
    'the', 'and', 'for', 'that', 'this', 'with', 'will', 'can', 'need',
    'should', 'would', 'could', 'about', 'into', 'from', 'have', 'has',
    'been', 'are', 'was', 'were', 'not', 'all', 'also', 'any', 'but',
    'get', 'got', 'its', 'let', 'may', 'our', 'out', 'own', 'too',
    'make', 'sure', 'going', 'look', 'ensure', 'check', 'address',
    'participant', 'team', 'member', 'them', 'their', 'they'
  ])

  const normalize = (s: string): Set<string> => {
    const words = s
      .toLowerCase()
      .replace(/^\[.*?\]\s*/, '') // strip "[Name]" prefix
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    return new Set(words)
  }

  const kept: string[] = []
  const keptSets: Set<string>[] = []

  for (const item of items) {
    const words = normalize(item)
    if (words.size === 0) {
      kept.push(item)
      keptSets.push(words)
      continue
    }

    const isDuplicate = keptSets.some((existing) => {
      if (existing.size === 0) return false
      const intersection = new Set([...words].filter((w) => existing.has(w)))
      const smaller = Math.min(words.size, existing.size)
      return smaller > 0 && intersection.size / smaller >= 0.65
    })

    if (!isDuplicate) {
      kept.push(item)
      keptSets.push(words)
    }
  }

  if (kept.length < items.length) {
    log.info(`[Transcription] Deduped action items: ${items.length} → ${kept.length}`)
  }

  return kept
}
