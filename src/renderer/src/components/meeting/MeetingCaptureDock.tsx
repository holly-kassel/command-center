import { useEffect, useState } from 'react'
import { formatMeetingForWeekly } from '@shared/formatMeetingMarkdown'
import type { SavedMeeting } from '@shared/types/transcription'
import { useMeetingRecorder } from '../../hooks/useMeetingRecorder'
import { useMeetingStore } from '../../store/meetingStore'
import { MeetingSettings } from './MeetingSettings'
import { NotesView } from './NotesView'
import { TranscriptView } from './TranscriptView'

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return [hours, minutes, secs].map((value) => String(value).padStart(2, '0')).join(':')
}

interface RecordingStatusBarProps {
  onExpand: () => void
  onPause: () => void
  onCancel: () => void
  onDone: () => void
  failedChunkCount: number
  isStopping: boolean
}

function RecordingStatusBar({
  onExpand,
  onPause,
  onCancel,
  onDone,
  failedChunkCount,
  isStopping
}: RecordingStatusBarProps): React.ReactElement {
  const { meetingTitle, elapsedTime, isPaused, audioLevel } = useMeetingStore()
  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl border border-surface-border bg-background/95 px-3 py-2 shadow-2xl backdrop-blur">
      <button
        onClick={onExpand}
        className="flex min-w-0 items-center gap-2 text-left"
        title="Open meeting notes"
      >
        <span
          className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${isPaused ? 'bg-yellow-400' : 'bg-red-500 animate-pulse'}`}
        />
        <span className="max-w-48 truncate text-xs font-medium text-text-primary">
          {meetingTitle}
        </span>
        <span className="font-mono text-[11px] text-text-muted">{formatTime(elapsedTime)}</span>
        {failedChunkCount > 0 && (
          <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-400">
            {failedChunkCount} failed
          </span>
        )}
        <span
          className="flex h-3 items-end gap-px"
          aria-label={`Audio level ${Math.round(audioLevel)} percent`}
        >
          {[25, 45, 65, 85].map((threshold) => (
            <span
              key={threshold}
              className={`w-0.5 rounded-full ${audioLevel >= threshold ? 'bg-focus' : 'bg-surface-border'}`}
              style={{ height: `${Math.max(3, threshold / 8)}px` }}
            />
          ))}
        </span>
      </button>
      <button
        onClick={onPause}
        disabled={isStopping}
        className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-surface-muted hover:text-text-primary disabled:opacity-50"
      >
        {isPaused ? 'Resume' : 'Pause'}
      </button>
      <button
        onClick={onCancel}
        disabled={isStopping}
        className="rounded-md px-2 py-1 text-xs text-text-muted hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        onClick={onDone}
        disabled={isStopping}
        className="rounded-md bg-red-500/15 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/25 disabled:opacity-50"
      >
        {isStopping ? 'Stopping…' : 'Done'}
      </button>
    </div>
  )
}

export function DraftRecoveryPrompt(): React.ReactElement | null {
  const draft = useMeetingStore((state) => state.recoverableDraft)
  const resumeDraft = useMeetingStore((state) => state.resumeDraft)
  const discardDraft = useMeetingStore((state) => state.discardDraft)
  if (!draft) return null
  return (
    <div className="fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-focus/30 bg-background/95 px-4 py-3 shadow-2xl backdrop-blur">
      <div className="min-w-0">
        <p className="text-xs font-medium text-text-primary">Resume {draft.meeting.title}?</p>
        <p className="text-[11px] text-text-muted">Your transcript and notes were autosaved.</p>
      </div>
      <button
        onClick={resumeDraft}
        className="rounded-md bg-focus/20 px-3 py-1.5 text-xs font-medium text-focus hover:bg-focus/30"
      >
        Resume
      </button>
      <button
        onClick={() => void discardDraft()}
        className="rounded-md px-2 py-1.5 text-xs text-text-muted hover:text-red-400"
      >
        Discard
      </button>
    </div>
  )
}

export function MeetingCaptureDock(): React.ReactElement {
  const {
    meetingTitle,
    setMeetingTitle,
    isRecording,
    isPaused,
    isDockCollapsed,
    setDockCollapsed,
    elapsedTime,
    audioLevel,
    manualNotes,
    setManualNotes,
    activeView,
    setActiveView,
    segments,
    notes,
    recordingContext,
    error,
    setError,
    draftStatus,
    saveDraft,
    generateNotes,
    saveMeeting,
    closeRecorder,
    cancelMeeting
  } = useMeetingStore()
  const {
    stop,
    cancel,
    togglePause,
    retryFailedChunks,
    discardFailedChunks,
    failedChunkCount,
    isRetryingFailedChunks,
    isStopping
  } = useMeetingRecorder()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showSaveOptions, setShowSaveOptions] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [addToWeeklyNote, setAddToWeeklyNote] = useState(true)
  const [allowPartialTranscript, setAllowPartialTranscript] = useState(false)
  const [persistedMeeting, setPersistedMeeting] = useState<SavedMeeting | null>(null)
  const [transcriptFilename, setTranscriptFilename] = useState<string | null>(null)

  useEffect(() => {
    setAllowPartialTranscript(false)
  }, [failedChunkCount])

  useEffect(() => {
    if (showSaveOptions || isCancelling || (!manualNotes.trim() && segments.length === 0)) return
    const timeout = setTimeout(() => void saveDraft(), 1000)
    return () => clearTimeout(timeout)
  }, [isCancelling, manualNotes, meetingTitle, notes, saveDraft, segments, showSaveOptions])

  const requestCancel = (): void => {
    setDockCollapsed(false)
    setShowCancelConfirm(true)
  }

  const handleCancel = async (): Promise<void> => {
    setIsCancelling(true)
    setError(null)
    let closed = false
    try {
      await cancel()
      discardFailedChunks()
      closed = await cancelMeeting()
      if (!closed) setShowCancelConfirm(false)
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : String(cancelError))
      setShowCancelConfirm(false)
    } finally {
      if (!closed) setIsCancelling(false)
    }
  }

  const handleDone = async (): Promise<void> => {
    await stop()
    await saveDraft()
    setShowSaveOptions(true)
  }

  const finishSave = async (summarize: boolean): Promise<void> => {
    if (failedChunkCount > 0 && !allowPartialTranscript) return
    setIsSaving(true)
    setError(null)
    try {
      let saved = persistedMeeting
      if (!saved) {
        if (summarize && segments.length > 0) {
          const generated = await generateNotes()
          if (!generated) return
        }
        saved = await saveMeeting(meetingTitle)
        if (!saved) return
        setPersistedMeeting(saved)
        if (allowPartialTranscript && failedChunkCount > 0) discardFailedChunks()
      }
      if (addToWeeklyNote) {
        let filename = transcriptFilename
        if (!filename) {
          const result = await window.api.transcription.saveTranscriptToVault(saved)
          filename = result.filename
          setTranscriptFilename(filename)
        }
        const transcriptLink = `[[transcripts/${filename.replace(/\.md$/, '')}|Full transcript]]`
        await window.api.obsidian.appendBlockToToday(formatMeetingForWeekly(saved, transcriptLink))
      }
      closeRecorder()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  if (isDockCollapsed) {
    return (
      <RecordingStatusBar
        onExpand={() => setDockCollapsed(false)}
        onPause={togglePause}
        onCancel={requestCancel}
        onDone={() => void handleDone()}
        failedChunkCount={failedChunkCount}
        isStopping={isStopping || isCancelling}
      />
    )
  }

  return (
    <aside className="fixed bottom-4 right-4 top-12 z-40 flex w-[430px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-surface-border bg-background/98 shadow-2xl backdrop-blur">
      <div className="relative border-b border-surface-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${isPaused ? 'bg-yellow-400' : isRecording ? 'bg-red-500 animate-pulse' : 'bg-text-muted'}`}
          />
          <input
            value={meetingTitle}
            onChange={(event) => setMeetingTitle(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-text-primary outline-none"
            aria-label="Meeting title"
          />
          <span className="font-mono text-xs text-text-muted">{formatTime(elapsedTime)}</span>
          {!persistedMeeting && (
            <button
              onClick={requestCancel}
              disabled={isSaving || isStopping || isCancelling}
              className="rounded px-2 py-1 text-[11px] text-text-muted hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
              title="Cancel and discard recording"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => setSettingsOpen((open) => !open)}
            className="rounded p-1 text-xs text-text-muted hover:bg-surface-muted hover:text-text-primary"
            title="Meeting settings"
          >
            ⚙
          </button>
          <button
            onClick={() => setDockCollapsed(true)}
            className="rounded p-1 text-xs text-text-muted hover:bg-surface-muted hover:text-text-primary"
            title="Collapse recorder"
          >
            ▾
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
          <span className="rounded-full border border-surface-border bg-surface-muted/50 px-2 py-0.5 text-text-muted">
            Local microphone
          </span>
          <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2 py-0.5 text-yellow-400">
            Speaker names unverified
          </span>
          {failedChunkCount > 0 && (
            <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-red-400">
              {failedChunkCount} failed audio {failedChunkCount === 1 ? 'chunk' : 'chunks'}
            </span>
          )}
          {recordingContext?.onlineMeetingUrl && (
            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-blue-400">
              Teams transcript will sync after the meeting
            </span>
          )}
          <span className="ml-auto text-text-muted">
            {draftStatus === 'saving'
              ? 'Saving draft…'
              : draftStatus === 'saved'
                ? 'Draft saved'
                : ''}
          </span>
        </div>
        <MeetingSettings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>

      {showCancelConfirm && !persistedMeeting && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-background/95 p-6 backdrop-blur"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-recording-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-red-500/25 bg-surface p-5 shadow-2xl">
            <h3 id="cancel-recording-title" className="text-sm font-semibold text-text-primary">
              Discard this recording?
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-text-muted">
              The transcript, notes, retained audio, and recovery draft for this recording will be
              deleted.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={isCancelling}
                className="rounded-lg border border-surface-border px-3 py-2 text-xs text-text-secondary hover:bg-surface-muted disabled:opacity-40"
              >
                Keep recording
              </button>
              <button
                onClick={() => void handleCancel()}
                disabled={isCancelling}
                className="rounded-lg bg-red-500/15 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/25 disabled:opacity-40"
              >
                {isCancelling ? 'Discarding…' : 'Discard recording'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaveOptions ? (
        <div className="flex flex-1 flex-col justify-center gap-4 p-6">
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              {persistedMeeting ? 'Meeting saved' : 'Save meeting'}
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              {persistedMeeting
                ? 'The meeting is safe. Retry the weekly-note export without saving it again.'
                : 'Generate the accuracy-first summary now, or save the transcript and notes as-is.'}
            </p>
          </div>
          {failedChunkCount > 0 && (
            <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-300">
              <p className="font-medium">
                {failedChunkCount} audio {failedChunkCount === 1 ? 'chunk has' : 'chunks have'} not
                been transcribed.
              </p>
              <button
                onClick={() => void retryFailedChunks()}
                disabled={isRetryingFailedChunks || isSaving}
                className="mt-2 rounded-md border border-red-400/30 px-2.5 py-1 text-[11px] font-medium hover:bg-red-500/10 disabled:opacity-50"
              >
                {isRetryingFailedChunks ? 'Retrying…' : 'Retry failed audio'}
              </button>
              <label className="mt-2 flex items-start gap-2 text-[11px] text-red-200/80">
                <input
                  type="checkbox"
                  checked={allowPartialTranscript}
                  onChange={(event) => setAllowPartialTranscript(event.target.checked)}
                  className="mt-0.5 accent-red-400"
                />
                Save a partial transcript and discard the failed audio.
              </label>
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
              {error}
            </div>
          )}
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={addToWeeklyNote}
              onChange={(event) => setAddToWeeklyNote(event.target.checked)}
              className="accent-focus"
            />
            Add a link and accepted action items to this week&apos;s note
          </label>
          <button
            onClick={() => void finishSave(true)}
            disabled={
              isSaving ||
              isRetryingFailedChunks ||
              (!manualNotes.trim() && segments.length === 0) ||
              (failedChunkCount > 0 && !allowPartialTranscript)
            }
            className="rounded-lg bg-focus/20 px-4 py-2.5 text-sm font-medium text-focus hover:bg-focus/30 disabled:opacity-40"
          >
            {isSaving
              ? persistedMeeting
                ? 'Exporting…'
                : 'Saving…'
              : persistedMeeting
                ? addToWeeklyNote
                  ? 'Retry weekly-note export'
                  : 'Finish'
                : 'Summarize and save'}
          </button>
          {!persistedMeeting && (
            <button
              onClick={() => void finishSave(false)}
              disabled={
                isSaving ||
                isRetryingFailedChunks ||
                (!manualNotes.trim() && segments.length === 0) ||
                (failedChunkCount > 0 && !allowPartialTranscript)
              }
              className="rounded-lg border border-surface-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-muted disabled:opacity-40"
            >
              Save without summary
            </button>
          )}
          {persistedMeeting ? (
            <button
              onClick={closeRecorder}
              disabled={isSaving}
              className="text-xs text-text-muted hover:text-text-secondary"
            >
              Close without weekly-note export
            </button>
          ) : (
            <button
              onClick={() => setShowSaveOptions(false)}
              disabled={isSaving}
              className="text-xs text-text-muted hover:text-text-secondary"
            >
              Keep editing
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="border-b border-surface-border p-3">
            <label className="mb-1.5 block text-[11px] font-medium text-text-muted">My notes</label>
            <textarea
              value={manualNotes}
              onChange={(event) => setManualNotes(event.target.value)}
              placeholder="Type notes while the meeting records…"
              rows={5}
              className="w-full resize-none rounded-lg border border-surface-border bg-surface-muted/40 px-3 py-2 text-xs leading-relaxed text-text-primary placeholder:text-text-muted focus:border-focus/50 focus:outline-none focus:ring-1 focus:ring-focus/30"
            />
          </div>

          <div className="flex border-b border-surface-border px-3">
            <button
              onClick={() => setActiveView('transcript')}
              className={`border-b-2 px-3 py-2 text-xs font-medium ${activeView === 'transcript' ? 'border-focus text-focus' : 'border-transparent text-text-muted'}`}
            >
              Transcript ({segments.length})
            </button>
            <button
              onClick={() => setActiveView('notes')}
              className={`border-b-2 px-3 py-2 text-xs font-medium ${activeView === 'notes' ? 'border-focus text-focus' : 'border-transparent text-text-muted'}`}
            >
              Summary
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {activeView === 'transcript' ? <TranscriptView /> : <NotesView />}
          </div>

          {error && (
            <div className="border-t border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 border-t border-surface-border px-4 py-3">
            <div
              className="flex h-5 flex-1 items-end gap-1"
              aria-label={`Audio level ${Math.round(audioLevel)} percent`}
            >
              {Array.from({ length: 18 }, (_, index) => {
                const threshold = (index / 18) * 100
                return (
                  <span
                    key={index}
                    className={`w-1 rounded-full transition-all ${audioLevel > threshold ? 'bg-focus' : 'bg-surface-border'}`}
                    style={{ height: `${4 + ((index * 7) % 14)}px` }}
                  />
                )
              })}
            </div>
            <button
              onClick={togglePause}
              disabled={!isRecording || isStopping}
              className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-muted disabled:opacity-40"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={() => void handleDone()}
              disabled={isStopping}
              className="rounded-lg bg-red-500/15 px-4 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/25 disabled:opacity-40"
            >
              {isStopping ? 'Stopping…' : 'Done'}
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
