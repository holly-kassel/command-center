/**
 * VoiceRecorder Component
 *
 * Full-screen overlay: Record → auto-transcribe → review/edit → summarize → save.
 *
 * Records audio via MediaRecorder (webm/opus), decodes to 16 kHz mono PCM
 * in the renderer using AudioContext, then sends the raw samples to the main
 * process where Whisper (ONNX via onnxruntime-node) transcribes them locally.
 * No API keys needed — model downloads on first use (~75 MB), cached after.
 *
 * The transcript (auto or manual) is piped through /transcript for AI
 * summarization and saved to today's notes.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import type { CalendarEvent } from '@shared/types/calendar'

type RecorderState =
  | 'idle'
  | 'recording'
  | 'processing' // converting audio + calling transcription API
  | 'editing' // reviewing/editing transcript before summarizing
  | 'summarizing'
  | 'done'
  | 'error'

interface VoiceRecorderProps {
  onComplete: () => void
  onClose: () => void
  /** When set, the recording is bound to this meeting and saved with its metadata. */
  meeting?: CalendarEvent
}

// ─── Audio Decode Helper ──────────────────────────────────────

/**
 * Decode a webm/opus blob to 16 kHz mono Float32Array (PCM).
 * Whisper expects this format directly — no WAV encoding needed.
 */
async function decodeAudioBlob(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer()
  const audioCtx = new AudioContext({ sampleRate: 16000 })

  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer)
    return decoded.getChannelData(0) // mono — channel 0
  } finally {
    await audioCtx.close()
  }
}

/** Format a meeting start time (already offset-correct — never append "Z"). */
function formatMeetingTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ─── Component ────────────────────────────────────────────────

export function VoiceRecorder({
  onComplete,
  onClose,
  meeting
}: VoiceRecorderProps): React.ReactElement {
  const [state, setState] = useState<RecorderState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [transcript, setTranscript] = useState('')
  const [summary, setSummary] = useState('')
  const [autoTranscribeFailed, setAutoTranscribeFailed] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.start(1000)
      setState('recording')
      setElapsed(0)
      setErrorMessage('')
      setTranscript('')
      setSummary('')
      setAutoTranscribeFailed(false)

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(
        msg.includes('Permission') || msg.includes('not allowed')
          ? 'Microphone access denied. Check System Settings → Privacy → Microphone.'
          : `Could not access microphone: ${msg}`
      )
      setState('error')
    }
  }, [])

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    // Wait for MediaRecorder to flush
    await new Promise<void>((resolve) => {
      const recorder = mediaRecorderRef.current!
      recorder.onstop = () => resolve()
      recorder.stop()
    })

    // Release mic
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' })
    if (blob.size < 1000) {
      setErrorMessage('Recording was too short. Try speaking for at least a few seconds.')
      setState('error')
      return
    }

    // Decode to PCM and send to main process for Whisper transcription
    setState('processing')
    try {
      const pcm = await decodeAudioBlob(blob)
      // Send Float32 PCM as ArrayBuffer via IPC → main process Whisper
      const result = await window.api.transcription.transcribe(pcm.buffer as ArrayBuffer, elapsed)
      setTranscript(result.text)
      setState('editing')
    } catch (err) {
      // Transcription failed — fall back to manual entry
      const msg = err instanceof Error ? err.message : String(err)
      setAutoTranscribeFailed(true)
      setErrorMessage(msg)
      setTranscript('')
      setState('editing')
    }
  }, [])

  const handleSummarize = useCallback(async () => {
    const text = transcript.trim()
    if (!text || text.length < 10) {
      setErrorMessage('Transcript is too short \u2014 need at least a couple sentences.')
      return
    }

    setState('summarizing')
    setErrorMessage('')
    try {
      const result = meeting
        ? await window.api.transcription.summarizeMeeting(meeting, text)
        : await window.api.obsidian.executeSlashCommand(`/transcript ${text}`)
      if (result.success) {
        setSummary(result.message)
        setState('done')
      } else {
        setErrorMessage(`Summarization failed: ${result.message}`)
        setState('error')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMessage(msg)
      setState('error')
    }
  }, [transcript, meeting])

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-md flex items-center justify-center">
      <div className="w-full max-w-lg mx-auto px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <span>🎙️</span> {meeting ? 'Record Meeting' : 'Voice Recorder'}
            </h2>
            {meeting ? (
              <p className="text-xs text-text-muted mt-0.5 max-w-sm truncate">
                {meeting.title}
                {!meeting.isAllDay && ` · ${formatMeetingTime(meeting.start)}`}
              </p>
            ) : (
              <p className="text-xs text-text-muted mt-0.5">
                Record → Transcribe → Summarize → Save
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-secondary text-sm"
            disabled={state === 'processing' || state === 'summarizing'}
          >
            ✕
          </button>
        </div>

        {/* ─── Idle ─── */}
        {state === 'idle' && (
          <div className="flex flex-col items-center gap-6 py-8">
            <button
              onClick={startRecording}
              className="w-28 h-28 rounded-full bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center hover:bg-red-500/30 hover:border-red-500/60 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-red-500 group-hover:scale-110 transition-transform" />
            </button>
            <p className="text-text-secondary text-sm">Click to start recording</p>
            <p className="text-text-muted text-xs text-center max-w-xs">
              Talk through your thoughts. When you stop, the audio is transcribed and summarized to
              your daily notes.
            </p>
          </div>
        )}

        {/* ─── Recording ─── */}
        {state === 'recording' && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-red-500/20 border-2 border-red-500/60 flex items-center justify-center animate-pulse">
                <div className="w-8 h-8 rounded-full bg-red-500" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-red-500/30 animate-ping" />
            </div>
            <div className="text-center">
              <p className="text-2xl font-mono text-red-400">{formatTime(elapsed)}</p>
              <p className="text-xs text-text-muted mt-1">Recording…</p>
            </div>
            <button
              onClick={stopRecording}
              className="px-6 py-2.5 rounded-lg bg-surface-muted border border-surface-border text-text-primary font-medium text-sm hover:bg-surface-muted/80 transition-colors"
            >
              ⏹ Stop Recording
            </button>
          </div>
        )}

        {/* ─── Processing (decoding + transcribing) ─── */}
        {state === 'processing' && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="w-24 h-24 rounded-full bg-focus/10 border-2 border-focus/30 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-focus/60 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-text-primary font-medium">Transcribing…</p>
              <p className="text-xs text-text-muted mt-1">
                {formatTime(elapsed)} of audio · first run downloads model (~75 MB)
              </p>
            </div>
          </div>
        )}

        {/* ─── Editing transcript ─── */}
        {state === 'editing' && (
          <div className="flex flex-col gap-4 py-4">
            {autoTranscribeFailed && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                <p className="text-xs text-amber-400 font-medium">Auto-transcription unavailable</p>
                <p className="text-xs text-text-muted mt-0.5">
                  Type or paste what you said below. The AI will still summarize and save it.
                </p>
              </div>
            )}

            <div>
              <label className="text-xs text-text-muted mb-1 block">
                {autoTranscribeFailed ? 'Type your transcript' : 'Review and edit transcript'}
              </label>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Type or paste what you said…"
                rows={8}
                className="w-full px-3 py-2.5 rounded-lg bg-surface-muted border border-surface-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus/50 resize-y min-h-[120px] max-h-[300px]"
                autoFocus
              />
              <p className="text-[11px] text-text-muted mt-1">
                {transcript.length > 0
                  ? `${transcript.trim().split(/\s+/).length} words`
                  : 'Waiting for input…'}
              </p>
            </div>

            {errorMessage && !autoTranscribeFailed && (
              <p className="text-xs text-red-400">✗ {errorMessage}</p>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setState('idle')
                  setTranscript('')
                  setErrorMessage('')
                  setAutoTranscribeFailed(false)
                }}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                ← Record again
              </button>
              <button
                onClick={handleSummarize}
                disabled={transcript.trim().length < 10}
                className="px-5 py-2 rounded-lg bg-focus/20 text-focus font-medium text-sm hover:bg-focus/30 border border-focus/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Summarize &amp; Save
              </button>
            </div>
          </div>
        )}

        {/* ─── Summarizing ─── */}
        {state === 'summarizing' && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="w-24 h-24 rounded-full bg-accent/10 border-2 border-accent/30 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-accent/60 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-text-primary font-medium">Summarizing…</p>
              <p className="text-xs text-text-muted mt-1">
                {meeting ? 'Building meeting notes…' : 'Running through /transcript'}
              </p>
            </div>
          </div>
        )}

        {/* ─── Done ─── */}
        {state === 'done' && (
          <div className="flex flex-col items-center gap-5 py-6">
            <div className="w-20 h-20 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center">
              <span className="text-3xl">✓</span>
            </div>
            <div className="text-center">
              <p className="text-text-primary font-medium text-green-400">{summary}</p>
              <p className="text-xs text-text-muted mt-1">{formatTime(elapsed)} recorded</p>
            </div>
            <details className="w-full">
              <summary className="text-xs text-text-muted cursor-pointer hover:text-text-secondary">
                View transcript
              </summary>
              <div className="mt-2 rounded-lg bg-surface-muted/30 border border-surface-border/30 p-3 max-h-40 overflow-y-auto">
                <p className="text-xs text-text-secondary whitespace-pre-wrap">{transcript}</p>
              </div>
            </details>
            <button
              onClick={onComplete}
              className="px-6 py-2.5 rounded-lg bg-focus/20 text-focus font-medium text-sm hover:bg-focus/30 border border-focus/30 transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {/* ─── Error ─── */}
        {state === 'error' && (
          <div className="flex flex-col items-center gap-5 py-6">
            <div className="w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
              <span className="text-3xl">✗</span>
            </div>
            <div className="text-center max-w-sm">
              <p className="text-red-400 text-sm font-medium">Something went wrong</p>
              <p className="text-xs text-text-muted mt-1">{errorMessage}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setState('idle')
                  setErrorMessage('')
                }}
                className="px-5 py-2 rounded-lg bg-focus/20 text-focus font-medium text-sm hover:bg-focus/30 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-lg bg-surface-muted/50 text-text-muted text-sm hover:text-text-secondary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
