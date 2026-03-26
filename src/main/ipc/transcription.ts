/**
 * Transcription IPC Handlers
 *
 * Bridges renderer audio recording to main-process local Whisper transcription.
 * Renderer sends raw 16 kHz mono PCM audio (as ArrayBuffer from Float32Array).
 * Optionally pipes the result through the /transcript slash command.
 */
import { ipcMain } from 'electron'
import log from 'electron-log'
import { join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { transcribeAudio, transcribeChunkWithOpenAI, summarizeMeeting } from '../services/transcription'
import { getSlashCommandRegistry } from '../services/commands/SlashCommandRegistry'
import { getObsidianService } from '../services/obsidian'
import { settings } from '../config/settings'
import type {
  TranscriptionResult,
  TranscriptionAndSummaryResult,
  MeetingSegment,
  MeetingNotes,
  SavedMeeting
} from '../../shared/types/transcription'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ElectronStore = require('electron-store')

const meetingStore = new (ElectronStore.default || ElectronStore)({ name: 'meetings', defaults: { meetings: [] as SavedMeeting[] } })

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

  // Transcribe audio chunk via OpenAI API with diarization
  ipcMain.handle(
    'transcription:transcribeChunk',
    async (
      _event,
      audioBuffer: ArrayBuffer,
      options: { language?: string; speakerDiarization?: boolean }
    ): Promise<MeetingSegment[]> => {
      try {
        const apiKey = settings.get('openaiApiKey')
        if (!apiKey) throw new Error('OpenAI API key not configured. Add it in Settings.')
        return await transcribeChunkWithOpenAI(Buffer.from(audioBuffer), apiKey, options)
      } catch (error) {
        log.error('[IPC] transcription:transcribeChunk error:', error)
        throw error
      }
    }
  )

  // Generate AI meeting notes
  ipcMain.handle(
    'transcription:summarizeMeeting',
    async (_event, transcript: string, participants?: string[]): Promise<MeetingNotes> => {
      try {
        const apiKey = settings.get('openaiApiKey')
        if (!apiKey) throw new Error('OpenAI API key not configured. Add it in Settings.')
        return await summarizeMeeting(transcript, apiKey, participants || [])
      } catch (error) {
        log.error('[IPC] transcription:summarizeMeeting error:', error)
        throw error
      }
    }
  )

  // Save a meeting transcript
  ipcMain.handle(
    'transcription:saveMeeting',
    async (_event, meeting: SavedMeeting): Promise<SavedMeeting> => {
      try {
        const meetings = meetingStore.get('meetings', []) as SavedMeeting[]
        meetings.push(meeting)
        meetingStore.set('meetings', meetings)
        log.info(`[IPC] Meeting saved: ${meeting.id}`)
        return meeting
      } catch (error) {
        log.error('[IPC] transcription:saveMeeting error:', error)
        throw error
      }
    }
  )

  // Get all saved meetings
  ipcMain.handle(
    'transcription:getMeetings',
    async (): Promise<SavedMeeting[]> => {
      return meetingStore.get('meetings', []) as SavedMeeting[]
    }
  )

  // Delete a meeting
  ipcMain.handle(
    'transcription:deleteMeeting',
    async (_event, meetingId: string): Promise<boolean> => {
      try {
        const meetings = meetingStore.get('meetings', []) as SavedMeeting[]
        const filtered = meetings.filter((m) => m.id !== meetingId)
        meetingStore.set('meetings', filtered)
        return true
      } catch (error) {
        log.error('[IPC] transcription:deleteMeeting error:', error)
        throw error
      }
    }
  )

  // Save transcript as markdown file in the Obsidian vault and return filename for wiki-linking
  ipcMain.handle(
    'transcription:saveTranscriptToVault',
    async (_event, meeting: SavedMeeting): Promise<{ filename: string; path: string }> => {
      try {
        const obsidian = getObsidianService()
        const vaultPath = obsidian.getVaultPath()
        if (!vaultPath) throw new Error('Obsidian vault not configured')

        const transcriptsDir = join(vaultPath, 'transcripts')
        await mkdir(transcriptsDir, { recursive: true })

        const dateStr = new Date(meeting.createdAt).toISOString().slice(0, 10)
        const timeStr = new Date(meeting.createdAt).toTimeString().slice(0, 5).replace(':', '')
        const safeTitle = meeting.title
          .replace(/[^a-zA-Z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .slice(0, 60)
          .toLowerCase()
        const filename = `${dateStr}-${timeStr}-${safeTitle}.md`
        const filePath = join(transcriptsDir, filename)

        const m = Math.floor(meeting.duration / 60)
        const s = meeting.duration % 60
        const durationStr = m > 0 ? `${m}m${s > 0 ? ` ${s}s` : ''}` : `${s}s`

        const lines: string[] = []
        lines.push(`# ${meeting.title}`)
        lines.push('')
        lines.push(`**Date:** ${new Date(meeting.createdAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`)
        lines.push(`**Duration:** ${durationStr}`)
        if (meeting.speakers.length > 0) {
          lines.push(`**Speakers:** ${meeting.speakers.join(', ')}`)
        }
        lines.push('')

        if (meeting.notes) {
          lines.push('## Summary')
          lines.push('')
          if (meeting.notes.summary) lines.push(meeting.notes.summary)
          lines.push('')

          if (meeting.notes.keyTopics?.length > 0) {
            lines.push('## Key Topics')
            lines.push('')
            for (const topic of meeting.notes.keyTopics) lines.push(`- ${topic}`)
            lines.push('')
          }

          if (meeting.notes.keyPoints?.length > 0) {
            lines.push('## Key Points')
            lines.push('')
            for (const point of meeting.notes.keyPoints) lines.push(`- ${point}`)
            lines.push('')
          }

          if (meeting.notes.actionItems?.length > 0) {
            lines.push('## Action Items')
            lines.push('')
            for (const item of meeting.notes.actionItems) lines.push(`- [ ] ${item}`)
            lines.push('')
          }
        }

        if (meeting.manualNotes.trim()) {
          lines.push('## Manual Notes')
          lines.push('')
          lines.push(meeting.manualNotes.trim())
          lines.push('')
        }

        if (meeting.segments.length > 0) {
          lines.push('## Transcript')
          lines.push('')
          for (const seg of meeting.segments) {
            lines.push(`**${seg.speaker}:** ${seg.text}`)
          }
          lines.push('')
        }

        await writeFile(filePath, lines.join('\n'), 'utf-8')
        log.info(`[Transcription] Saved transcript to vault: ${filePath}`)

        return { filename, path: filePath }
      } catch (error) {
        log.error('[IPC] transcription:saveTranscriptToVault error:', error)
        throw error
      }
    }
  )
}
