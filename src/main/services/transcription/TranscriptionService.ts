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
import type { TranscriptionResult } from '../../../shared/types/transcription'

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
