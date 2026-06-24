import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useMeetingStore } from '../../store/meetingStore'
import { TranscriptView } from './TranscriptView'
import { NotesView } from './NotesView'
import { MeetingSettings } from './MeetingSettings'

interface MeetingNotesOverlayProps {
  onClose: () => void
}

async function decodeAudioBlob(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer()
  const audioCtx = new AudioContext({ sampleRate: 16000 })

  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer)
    return decoded.getChannelData(0)
  } finally {
    await audioCtx.close()
  }
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function MeetingNotesOverlay({ onClose }: MeetingNotesOverlayProps): React.ReactElement {
  const {
    isRecording,
    isPaused,
    elapsedTime,
    audioLevel,
    activeView,
    manualNotes,
    error,
    settings,
    recordingContext,
    setIsRecording,
    setIsPaused,
    setElapsedTime,
    setAudioLevel,
    setActiveView,
    setManualNotes,
    setError,
    transcribeChunk,
    generateNotes,
    saveMeeting,
    resetMeeting,
  } = useMeetingStore()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showDoneOptions, setShowDoneOptions] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [meetingTitle, setMeetingTitle] = useState(
    recordingContext?.title?.trim() || 'Meeting Notes'
  )
  const [isEditingTitle, setIsEditingTitle] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const autoNotesRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const chunkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopEverything = useCallback(() => {
    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current)
      chunkIntervalRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (autoNotesRef.current) {
      clearInterval(autoNotesRef.current)
      autoNotesRef.current = null
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    analyserRef.current = null
  }, [])

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return
    const data = new Uint8Array(analyserRef.current.fftSize)
    analyserRef.current.getByteTimeDomainData(data)

    let sum = 0
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128
      sum += v * v
    }
    const rms = Math.sqrt(sum / data.length)
    setAudioLevel(Math.min(1, rms * 3))

    animFrameRef.current = requestAnimationFrame(updateAudioLevel)
  }, [setAudioLevel])

  const startRecording = useCallback(async () => {
    try {
      resetMeeting()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Set up analyser for audio level
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser
      updateAudioLevel()

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      // On each interval, stop/restart to flush a complete webm file, decode to PCM, send to OpenAI
      chunkIntervalRef.current = setInterval(async () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return

        // Stop to finalize the webm, then restart
        const recorder = mediaRecorderRef.current
        await new Promise<void>((resolve) => {
          const prevOnStop = recorder.onstop
          recorder.onstop = () => {
            if (prevOnStop) prevOnStop.call(recorder, new Event('stop'))
            resolve()
          }
          recorder.stop()
        })

        // Grab accumulated chunks as a complete webm blob
        const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' })
        chunksRef.current = []

        // Restart recording
        if (streamRef.current && streamRef.current.active) {
          const newRecorder = new MediaRecorder(streamRef.current, {
            mimeType: 'audio/webm;codecs=opus',
          })
          newRecorder.ondataavailable = (ev) => {
            if (ev.data.size > 0) chunksRef.current.push(ev.data)
          }
          mediaRecorderRef.current = newRecorder
          newRecorder.start()
        }

        // Decode complete blob to PCM and send (skip near-silent chunks)
        if (blob.size > 1000) {
          try {
            const pcm = await decodeAudioBlob(blob)
            // Compute RMS energy — skip chunks that are mostly silence
            let sum = 0
            for (let i = 0; i < pcm.length; i++) {
              sum += pcm[i] * pcm[i]
            }
            const rms = Math.sqrt(sum / pcm.length)
            if (rms >= 0.01) {
              await transcribeChunk(pcm.buffer as ArrayBuffer)
            }
          } catch {
            // Skip failed chunks
          }
        }
      }, settings.chunkInterval)

      mediaRecorder.start()
      setIsRecording(true)
      setIsPaused(false)
      setError(null)

      // Elapsed timer
      timerRef.current = setInterval(() => {
        setElapsedTime(useMeetingStore.getState().elapsedTime + 1)
      }, 1000)

      // Auto-generate notes every 5 minutes
      autoNotesRef.current = setInterval(() => {
        generateNotes()
      }, 300000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(
        msg.includes('Permission') || msg.includes('not allowed')
          ? 'Microphone access denied. Check System Settings → Privacy → Microphone.'
          : `Could not access microphone: ${msg}`
      )
    }
  }, [
    resetMeeting,
    settings.chunkInterval,
    setIsRecording,
    setIsPaused,
    setError,
    setElapsedTime,
    transcribeChunk,
    generateNotes,
    updateAudioLevel,
  ])

  const togglePause = useCallback(() => {
    if (!mediaRecorderRef.current) return

    if (isPaused) {
      mediaRecorderRef.current.resume()
      timerRef.current = setInterval(() => {
        setElapsedTime(useMeetingStore.getState().elapsedTime + 1)
      }, 1000)
      setIsPaused(false)
    } else {
      mediaRecorderRef.current.pause()
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      setIsPaused(true)
    }
  }, [isPaused, setIsPaused, setElapsedTime])

  const handleDone = useCallback(() => {
    stopEverything()
    setIsRecording(false)
    setShowDoneOptions(true)
  }, [stopEverything, setIsRecording])

  const handleSaveOnly = useCallback(async () => {
    setIsSaving(true)
    try {
      await saveMeeting(meetingTitle)
    } catch {
      // Meeting save is best-effort at this point
    }
    onClose()
  }, [saveMeeting, onClose, meetingTitle])

  const handleSummarizeAndLink = useCallback(async () => {
    setIsSaving(true)
    try {
      await saveMeeting(meetingTitle)

      const { notes, segments, manualNotes: currentManualNotes, elapsedTime: currentElapsed } = useMeetingStore.getState()

      // Generate notes if we don't have them yet
      let meetingNotes = notes
      if (!meetingNotes && segments.length > 0) {
        try {
          await useMeetingStore.getState().generateNotes()
          meetingNotes = useMeetingStore.getState().notes
        } catch {
          // Continue without summary
        }
      }

      // Build a SavedMeeting object for vault file
      const speakers = [...new Set(segments.map((s) => s.speaker))]
      const meeting = {
        id: Date.now().toString(),
        title: meetingTitle,
        duration: currentElapsed,
        segments,
        transcript: segments.map((s) => `${s.speaker}: ${s.text}`).join('\n'),
        notes: meetingNotes,
        speakers,
        manualNotes: currentManualNotes,
        language: settings.language,
        createdAt: new Date().toISOString(),
      }

      // Save transcript file to Obsidian vault
      const { filename } = await window.api.transcription.saveTranscriptToVault(meeting)

      // Build summary block for weekly notes with wiki-link
      const m = Math.floor(currentElapsed / 60)
      const s = currentElapsed % 60
      const durationStr = m > 0 ? `${m}m${s > 0 ? ` ${s}s` : ''}` : `${s}s`
      const noteLink = `[[transcripts/${filename}|${meetingTitle}]]`

      const lines: string[] = []
      lines.push(`#### 📝 ${noteLink} (${durationStr})`)
      lines.push('')
      if (meetingNotes?.summary) {
        lines.push(`**Summary:** ${meetingNotes.summary}`)
        lines.push('')
      }
      if (meetingNotes?.keyTopics && meetingNotes.keyTopics.length > 0) {
        lines.push('**Key Topics:**')
        for (const topic of meetingNotes.keyTopics) lines.push(`- ${topic}`)
        lines.push('')
      }
      if (meetingNotes?.myActionItems && meetingNotes.myActionItems.length > 0) {
        lines.push('**My Action Items:**')
        for (const item of meetingNotes.myActionItems) lines.push(`- [ ] ${item}`)
        lines.push('')
      }
      if (meetingNotes?.actionItems && meetingNotes.actionItems.length > 0) {
        lines.push(meetingNotes?.myActionItems && meetingNotes.myActionItems.length > 0 ? '**All Action Items:**' : '**Action Items:**')
        for (const item of meetingNotes.actionItems) lines.push(`- [ ] ${item}`)
        lines.push('')
      }

      await window.api.obsidian.appendBlockToToday(lines.join('\n'))
    } catch {
      // Weekly note append is best-effort; meeting is already saved
    }
    onClose()
  }, [saveMeeting, settings.language, onClose, meetingTitle])

  // Start recording on mount
  useEffect(() => {
    startRecording()
    return () => {
      stopEverything()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Audio level dot color based on index and level
  const getDotColor = (index: number, level: number): string => {
    const threshold = (index + 1) / 8
    if (level < threshold) return 'bg-surface-border'
    if (index < 4) return 'bg-green-500'
    if (index < 6) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-40 bg-background/95 backdrop-blur-md flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md mx-auto rounded-xl bg-surface-muted/95 backdrop-blur border border-surface-border/40 shadow-xl flex flex-col"
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
            <span className="text-sm flex-shrink-0">🎙️</span>
            {isEditingTitle ? (
              <input
                autoFocus
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setIsEditingTitle(false)
                  if (e.key === 'Escape') setIsEditingTitle(false)
                }}
                className="text-sm font-bold text-text-primary bg-transparent border-b border-focus outline-none min-w-0 flex-1"
              />
            ) : (
              <h2
                onClick={() => setIsEditingTitle(true)}
                className="text-sm font-bold text-text-primary truncate cursor-text hover:text-focus transition-colors"
                title="Click to rename"
              >
                {meetingTitle}
              </h2>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Settings gear */}
            <div className="relative">
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="text-text-muted hover:text-text-secondary text-sm transition-colors"
              >
                ⚙
              </button>
              <MeetingSettings isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
            </div>
            {/* Close */}
            <button
              onClick={handleDone}
              className="text-text-muted hover:text-text-secondary text-sm transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-1 mx-4 mb-3 p-0.5 rounded-lg bg-surface-muted/50">
          <button
            onClick={() => setActiveView('transcript')}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeView === 'transcript'
                ? 'bg-focus/20 text-focus'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Transcript
          </button>
          <button
            onClick={() => setActiveView('notes')}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeView === 'notes'
                ? 'bg-focus/20 text-focus'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Notes
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-4 mb-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden px-4" style={{ minHeight: '200px' }}>
          {activeView === 'transcript' ? <TranscriptView /> : <NotesView />}
        </div>

        {/* Manual notes */}
        <div className="px-4 pt-2">
          <textarea
            value={manualNotes}
            onChange={(e) => setManualNotes(e.target.value)}
            placeholder="Type notes here…"
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-surface-muted/50 border border-surface-border text-text-primary text-xs placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus/50 resize-none"
          />
        </div>

        {/* Bottom bar */}
        {showDoneOptions ? (
          <div className="px-4 py-3 space-y-2">
            <p className="text-xs text-text-secondary text-center mb-2">Recording stopped — what would you like to do?</p>
            <button
              onClick={handleSaveOnly}
              disabled={isSaving}
              className="w-full px-4 py-2.5 rounded-lg bg-surface-muted/50 text-text-primary text-xs font-medium border border-surface-border hover:bg-surface-hover transition-colors disabled:opacity-50 text-left"
            >
              <span className="block font-semibold">💾 Save to Transcripts</span>
              <span className="block text-text-muted mt-0.5">Save the recording to your transcript library</span>
            </button>
            <button
              onClick={handleSummarizeAndLink}
              disabled={isSaving}
              className="w-full px-4 py-2.5 rounded-lg bg-focus/10 text-focus text-xs font-medium border border-focus/30 hover:bg-focus/20 transition-colors disabled:opacity-50 text-left"
            >
              <span className="block font-semibold">📝 Summarize & Add to Weekly Notes</span>
              <span className="block text-focus/70 mt-0.5">Save transcript, summarize, and link in today&apos;s notes</span>
            </button>
            {isSaving && (
              <p className="text-xs text-text-muted text-center animate-pulse">Saving…</p>
            )}
          </div>
        ) : (
        <div className="flex items-center justify-between px-4 py-3">
          {/* Timer + audio level */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-text-secondary">{formatTime(elapsedTime)}</span>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${getDotColor(i, audioLevel)}`}
                />
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {isRecording && (
              <button
                onClick={togglePause}
                className="px-3 py-1.5 rounded-lg bg-surface-muted/50 text-text-secondary text-xs border border-surface-border hover:bg-surface-hover hover:text-text-primary transition-colors"
              >
                {isPaused ? '▶ Resume' : '⏸ Pause'}
              </button>
            )}
            <button
              onClick={handleDone}
              className="px-4 py-1.5 rounded-lg bg-focus/20 text-focus font-medium text-xs hover:bg-focus/30 border border-focus/30 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
        )}
      </motion.div>
    </motion.div>
  )
}
