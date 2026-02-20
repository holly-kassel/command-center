/**
 * Transcription IPC Handlers
 *
 * Bridges renderer audio recording to main-process local Whisper transcription.
 * Renderer sends raw 16 kHz mono PCM audio (as ArrayBuffer from Float32Array).
 * Optionally pipes the result through the /transcript slash command.
 */
import { ipcMain } from 'electron'
import log from 'electron-log'
import { transcribeAudio } from '../services/transcription'
import { getSlashCommandRegistry } from '../services/commands/SlashCommandRegistry'
import type {
  TranscriptionResult,
  TranscriptionAndSummaryResult
} from '../../shared/types/transcription'

export function registerTranscriptionIpc(): void {
  /**
   * Transcribe audio only — returns raw text.
   * Renderer sends Float32 PCM samples as ArrayBuffer + duration.
   */
  ipcMain.handle(
    'transcription:transcribe',
    async (
      _event,
      pcmBuffer: ArrayBuffer,
      durationSeconds: number
    ): Promise<TranscriptionResult> => {
      try {
        const pcm = new Float32Array(pcmBuffer)
        return await transcribeAudio(pcm, durationSeconds)
      } catch (error) {
        log.error('[IPC] transcription:transcribe error:', error)
        throw error
      }
    }
  )

  /**
   * Transcribe audio AND run the result through /transcript slash command.
   * Returns both the raw transcript and the AI summary.
   */
  ipcMain.handle(
    'transcription:transcribeAndSummarize',
    async (
      _event,
      pcmBuffer: ArrayBuffer,
      durationSeconds: number
    ): Promise<TranscriptionAndSummaryResult> => {
      try {
        const pcm = new Float32Array(pcmBuffer)
        const transcription = await transcribeAudio(pcm, durationSeconds)

        if (!transcription.text || transcription.text.length < 10) {
          throw new Error(
            'Transcription was too short or empty. Try speaking louder or longer.'
          )
        }

        const registry = getSlashCommandRegistry()
        const result = await registry.execute(`/transcript ${transcription.text}`)

        if (!result.success) {
          throw new Error(`Transcript summarization failed: ${result.message}`)
        }

        return {
          transcript: transcription.text,
          summary: result.message,
          durationSeconds
        }
      } catch (error) {
        log.error('[IPC] transcription:transcribeAndSummarize error:', error)
        throw error
      }
    }
  )
}
