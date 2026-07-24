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
import type {
  MeetingSegment,
  MeetingTranscriptionChunkOptions,
  TranscriptionResult
} from '../../../shared/types/transcription'

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
  options: MeetingTranscriptionChunkOptions = {}
): Promise<MeetingSegment[]> {
  const { language = 'en', speakerDiarization = true } = options
  const requestedOffset = Number(options.offsetSeconds ?? 0)
  const offsetSeconds = Number.isFinite(requestedOffset) ? Math.max(0, requestedOffset) : 0
  const chunkId = options.chunkId?.trim() || crypto.randomUUID()

  // Convert raw PCM Float32 ArrayBuffer to WAV
  const pcmFloat32 = new Float32Array(
    audioBuffer.buffer,
    audioBuffer.byteOffset,
    audioBuffer.byteLength / 4
  )
  const wavBuffer = encodeWav(pcmFloat32)

  const model = speakerDiarization ? 'gpt-4o-transcribe-diarize' : 'gpt-4o-transcribe'
  const responseFormat = speakerDiarization ? 'diarized_json' : 'json'

  // Build FormData manually for Node.js
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
  const parts: Buffer[] = []

  // File part — send as WAV
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.wav"\r\nContent-Type: audio/wav\r\n\r\n`
    )
  )
  parts.push(wavBuffer)
  parts.push(Buffer.from('\r\n'))

  // Model part
  parts.push(
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n`)
  )

  // Response format part
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\n${responseFormat}\r\n`
    )
  )

  // Language part
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${language}\r\n`
    )
  )

  // Chunking strategy (required for diarization with audio > 30s)
  if (speakerDiarization) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="chunking_strategy"\r\n\r\nauto\r\n`
      )
    )
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`))

  const body = Buffer.concat(parts)

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body
  })

  if (!response.ok) {
    const errorText = await response.text()
    log.error('[Transcription] OpenAI API error:', errorText)
    throw new Error(`OpenAI transcription failed: ${response.status} ${errorText}`)
  }

  const result = (await response.json()) as Record<string, unknown>

  // Parse segments
  const segments: MeetingSegment[] = []
  const rawSegments = (result.segments || []) as Array<Record<string, unknown>>

  for (const seg of rawSegments) {
    const startSec = offsetSeconds + Number(seg.start || 0)
    const speaker = String(seg.speaker || 'Unknown')
    segments.push({
      id: `seg-${chunkId}-${segments.length}`,
      speaker,
      speakerIdentity: { displayName: speaker, source: 'diarization', verified: false },
      text: String(seg.text || '').trim(),
      start: startSec,
      end: offsetSeconds + Number(seg.end || 0),
      timestamp: formatTimestamp(startSec),
      source: 'local',
      chunkId
    })
  }

  // If non-diarized, the response has a single "text" field
  if (segments.length === 0 && result.text) {
    segments.push({
      id: `seg-${chunkId}-0`,
      speaker: 'Unknown',
      speakerIdentity: { displayName: 'Unknown', source: 'unknown', verified: false },
      text: String(result.text).trim(),
      start: offsetSeconds,
      end: offsetSeconds + pcmFloat32.length / 16000,
      timestamp: formatTimestamp(offsetSeconds),
      source: 'local',
      chunkId
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
