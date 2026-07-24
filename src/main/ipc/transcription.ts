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
import {
  transcribeAudio,
  transcribeChunkWithOpenAI,
  summarizeMeeting,
  getTeamsTranscriptSyncService
} from '../services/transcription'
import { getSlashCommandRegistry } from '../services/commands/SlashCommandRegistry'
import { getObsidianService } from '../services/obsidian'
import { settings } from '../config/settings'
import { credentialManager } from '../services/auth/CredentialManager'
import { preserveActionReviews } from '../services/transcription/ActionReviewMerge'
import { getMeetingRepository } from '../services/transcription/MeetingRepository'
import type {
  TranscriptionResult,
  TranscriptionAndSummaryResult,
  MeetingSegment,
  MeetingNotes,
  MeetingNotesUpdateContext,
  MeetingTranscriptionChunkOptions,
  MeetingSummaryInput,
  SavedMeeting,
  MeetingDraft
} from '../../shared/types/transcription'
import { formatMeetingMarkdown } from '../../shared/formatMeetingMarkdown'

export function registerTranscriptionIpc(): void {
  const repository = getMeetingRepository()
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
          throw new Error('Transcription was too short or empty. Try speaking louder or longer.')
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
      options: MeetingTranscriptionChunkOptions
    ): Promise<MeetingSegment[]> => {
      try {
        const apiKey = credentialManager.getOpenAIKey()
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
    async (_event, input: MeetingSummaryInput): Promise<MeetingNotes> => {
      try {
        const model = settings.get('meetingSummaryModel') || 'openai/gpt-5'
        const userName = settings.get('userName') || ''
        return await summarizeMeeting(input, model, userName)
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
        return repository.upsert(meeting)
      } catch (error) {
        log.error('[IPC] transcription:saveMeeting error:', error)
        throw error
      }
    }
  )

  ipcMain.handle(
    'transcription:reviewAction',
    async (
      _event,
      meetingId: string,
      actionId: string,
      reviewStatus: 'accepted' | 'dismissed'
    ): Promise<SavedMeeting> => {
      let found = false
      const updateActions = (items: MeetingNotes['actionItems']): MeetingNotes['actionItems'] =>
        items.map((item) => {
          if (item.id !== actionId) return item
          found = true
          return { ...item, reviewStatus }
        })
      const updated = repository.update(meetingId, (meeting) => {
        if (!meeting.notes) throw new Error('This meeting has no summary to review.')
        const actionItems = updateActions(meeting.notes.actionItems)
        const notes = {
          ...meeting.notes,
          actionItems,
          myActionItems: actionItems.filter(
            (item) => item.isCurrentUser && item.reviewStatus === 'accepted'
          ),
          suggestedFollowUps: updateActions(meeting.notes.suggestedFollowUps)
        }
        if (!found) throw new Error('Action item not found.')
        return { ...meeting, notes }
      })
      if (!updated) throw new Error('Meeting not found.')
      return updated
    }
  )

  ipcMain.handle(
    'transcription:updateNotes',
    async (
      _event,
      meetingId: string,
      notes: MeetingNotes,
      context: MeetingNotesUpdateContext
    ): Promise<SavedMeeting> => {
      if (!context || notes.metadata.transcriptSource !== context.transcriptSource) {
        throw new Error('Summary update context does not match its transcript source.')
      }
      const updated = repository.update(meetingId, (meeting) => {
        const artifact = meeting.transcriptArtifacts[context.transcriptSource]
        if (
          meeting.activeTranscriptSource !== context.transcriptSource ||
          artifact?.capturedAt !== context.transcriptCapturedAt
        ) {
          throw new Error('The transcript changed while the summary was generating. Regenerate it.')
        }
        const currentGeneratedAt = meeting.notes?.metadata.generatedAt ?? null
        if (currentGeneratedAt !== context.baseNotesGeneratedAt) {
          throw new Error('The meeting summary changed while this version was generating.')
        }
        const mergedNotes = preserveActionReviews(notes, meeting.notes)
        return {
          ...meeting,
          notes: mergedNotes,
          teamsSync:
            meeting.activeTranscriptSource === 'teams' &&
            mergedNotes.metadata.transcriptSource === 'teams'
              ? {
                  ...meeting.teamsSync,
                  summaryStatus: 'available',
                  summaryLastAttemptAt: mergedNotes.metadata.generatedAt,
                  summaryOperationId: undefined,
                  summaryError: undefined
                }
              : meeting.teamsSync
        }
      })
      if (!updated) throw new Error('Meeting not found.')
      return updated
    }
  )

  // Get all saved meetings
  ipcMain.handle('transcription:getMeetings', async (): Promise<SavedMeeting[]> => {
    return repository.getAll()
  })

  ipcMain.handle(
    'transcription:getMeeting',
    async (_event, meetingId: string): Promise<SavedMeeting | null> => {
      return repository.getById(meetingId)
    }
  )

  ipcMain.handle(
    'transcription:syncTeamsTranscript',
    async (_event, meetingId: string): Promise<SavedMeeting> =>
      getTeamsTranscriptSyncService().syncMeeting(meetingId, true)
  )

  ipcMain.handle(
    'transcription:saveDraft',
    async (_event, meeting: SavedMeeting): Promise<MeetingDraft> => repository.saveDraft(meeting)
  )

  ipcMain.handle('transcription:getDraft', async (): Promise<MeetingDraft | null> => {
    return repository.getDraft()
  })

  ipcMain.handle(
    'transcription:deleteDraft',
    async (_event, meetingId?: string): Promise<boolean> => repository.deleteDraft(meetingId)
  )

  // Delete a meeting
  ipcMain.handle(
    'transcription:deleteMeeting',
    async (_event, meetingId: string): Promise<boolean> => {
      try {
        return repository.delete(meetingId)
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

        await writeFile(filePath, formatMeetingMarkdown(meeting), 'utf-8')
        log.info(`[Transcription] Saved transcript to vault: ${filePath}`)

        return { filename, path: filePath }
      } catch (error) {
        log.error('[IPC] transcription:saveTranscriptToVault error:', error)
        throw error
      }
    }
  )
}
