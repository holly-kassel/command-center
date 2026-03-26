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
  if (participants.length === 0) return ''
  return `\n\nMeeting participants: ${participants.join(', ')}. Use these names to identify speakers — map generic speaker labels (Speaker 0, Speaker 1, A, B, etc.) to real names based on context clues like introductions, role mentions, and conversational references.`
}

/**
 * Dedicated action-item extraction pass.
 * Runs a focused LLM call specifically to find action items the initial summary may have missed.
 */
async function extractActionItems(
  transcript: string,
  apiKey: string,
  existingItems: string[],
  participants: string[]
): Promise<string[]> {
  const participantHint = buildParticipantHint(participants)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert at extracting action items from meeting transcripts. Your ONLY job is to find every single commitment, follow-up, request, or next step.${participantHint}

You must catch ALL of these patterns — they are commonly missed:
- End-of-meeting wrap-up tasks ("will you write the summary for X?", "can you send me X?")
- Casual verbal commitments ("yeah I can get that done", "I'll look into it", "let me pull that up")
- Requests for information ("please give me X when you have it", "send me the format")
- Requirements stated as needs ("we need to make sure X", "this has to be Y before Z date")
- Advocacy/escalation requests ("please reconsider X", "can you push back on Y")
- Sharing/access tasks ("I'll give you access", "I'll share the repo", "let me send you the link")
- Scheduling/coordination ("let's set up a meeting with X", "we should align with X")
- Information gathering ("I'll get those answers", "I need to find out about X")

Pay EXTRA attention to:
- The first and last 20% of the transcript (wrap-up items and post-meeting asks live here)
- Any statement where someone says "I'll", "I can", "let me", "I need to", "we should", "can you", "will you"
- Commitments made on behalf of others ("Holly will follow up", "the team needs to")

Return a JSON array of strings. Each item should be: "[Owner] action description" (use first names).
Include items even if they seem minor. Return ONLY valid JSON array, no markdown.`
        },
        {
          role: 'user',
          content: `Here are action items already captured (avoid exact duplicates but DO include items that are similar but distinct):\n${existingItems.map(i => `- ${i}`).join('\n')}\n\nNow find ALL additional action items from this transcript:\n\n${transcript}`
        }
      ],
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    log.warn('[Transcription] Action item extraction pass failed, using first-pass items only')
    return existingItems
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> }
  const content = data.choices?.[0]?.message?.content || '[]'

  try {
    const additional = JSON.parse(content) as string[]
    if (!Array.isArray(additional)) return existingItems

    // Merge: keep all existing items, add new ones that aren't near-duplicates
    const allItems = [...existingItems]
    const existingLower = existingItems.map(i => i.toLowerCase())
    for (const item of additional) {
      if (typeof item !== 'string' || !item.trim()) continue
      const itemLower = item.toLowerCase().trim()
      const isDuplicate = existingLower.some(e =>
        e.includes(itemLower) || itemLower.includes(e) ||
        levenshteinSimilarity(e, itemLower) > 0.7
      )
      if (!isDuplicate) {
        allItems.push(item.trim())
      }
    }
    return allItems
  } catch {
    log.warn('[Transcription] Failed to parse action item extraction JSON')
    return existingItems
  }
}

/** Simple similarity check based on shared words */
function levenshteinSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 3))
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 3))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let shared = 0
  for (const w of wordsA) {
    if (wordsB.has(w)) shared++
  }
  return shared / Math.max(wordsA.size, wordsB.size)
}

/**
 * Generate AI meeting notes from transcript using OpenAI Chat Completions.
 * Runs two passes: general summarization + dedicated action-item extraction.
 */
export async function summarizeMeeting(
  transcript: string,
  apiKey: string,
  participants: string[] = []
): Promise<MeetingNotes> {
  log.info('[Transcription] Generating meeting summary...')

  const context = await loadContext()
  const participantHint = buildParticipantHint(participants)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a thorough meeting notes assistant. Analyze the transcript and return a JSON object with exactly these fields:
- "summary" (string): A detailed 5-7 sentence summary covering the main discussion, context, and outcomes. Include who discussed what and any important nuances.
- "keyTopics" (array of strings): Main topics/themes discussed, each 2-5 words.
- "keyPoints" (array of strings): Detailed key points — each should be a full sentence capturing the substance of what was said, not just a topic label. Include specifics like names, numbers, and concrete details from the discussion.
- "actionItems" (array of strings): EVERY commitment, next step, or follow-up mentioned — both explicit ("I'll do X") and implicit ("we should do X", "can you look into X", "yeah I can get that done"). Include the owner's name when identifiable. Err on the side of capturing MORE rather than fewer. If someone said they'd share, review, send, schedule, create, update, or follow up on anything, include it.

  Common action item patterns you MUST NOT miss:
  * End-of-meeting wrap-up asks: "will you write the summary?", "can you send that to X?"
  * Casual commitments: "I'll get those answers for you", "let me share that"
  * Requirements stated as needs: "we need to make sure X doesn't show Y before date Z"
  * Requests for information: "please give me X when you have it"
  * Advocacy requests: "please reconsider removing X", "push back on Y"
  * Sharing/access: "I'll give you access to the repo", "I'll send the link"
  * Pay special attention to the BEGINNING and END of the meeting — wrap-up items and post-meeting asks are commonly missed.

- "decisions" (array of strings): Any decisions made or conclusions reached during the meeting.
- "openQuestions" (array of strings): Unresolved questions or topics that need follow-up.
Return ONLY valid JSON, no markdown.${participantHint}${context}`
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
  const content = data.choices?.[0]?.message?.content || '{}'

  let notes: MeetingNotes
  try {
    const parsed = JSON.parse(content) as MeetingNotes
    notes = {
      summary: parsed.summary || '',
      keyTopics: parsed.keyTopics || [],
      keyPoints: parsed.keyPoints || [],
      actionItems: parsed.actionItems || [],
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
      decisions: [],
      openQuestions: [],
    }
  }

  // Second pass: dedicated action-item extraction
  try {
    notes.actionItems = await extractActionItems(transcript, apiKey, notes.actionItems, participants)
    log.info(`[Transcription] Action items after second pass: ${notes.actionItems.length}`)
  } catch (err) {
    log.warn('[Transcription] Second-pass action item extraction failed:', err)
  }

  return notes
}
