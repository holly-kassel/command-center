import { useCallback, useEffect, useRef, useState } from 'react'
import { useMeetingStore } from '../store/meetingStore'

interface MeetingRecorderController {
  stop: () => Promise<void>
  cancel: () => Promise<void>
  togglePause: () => void
  retryFailedChunks: () => Promise<void>
  discardFailedChunks: () => void
  failedChunkCount: number
  isRetryingFailedChunks: boolean
  isStopping: boolean
}

interface AudioChunk {
  id: string
  blob: Blob
  offsetSeconds: number
}

async function convertBlobToPcm(blob: Blob): Promise<ArrayBuffer> {
  const audioContext = new AudioContext()
  try {
    const audioBuffer = await audioContext.decodeAudioData(await blob.arrayBuffer())
    const offlineContext = new OfflineAudioContext(
      1,
      Math.ceil(audioBuffer.duration * 16000),
      16000
    )
    const source = offlineContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(offlineContext.destination)
    source.start()
    const rendered = await offlineContext.startRendering()
    const channelData = rendered.getChannelData(0)
    return channelData.buffer.slice(
      channelData.byteOffset,
      channelData.byteOffset + channelData.byteLength
    )
  } finally {
    await audioContext.close()
  }
}

export function useMeetingRecorder(): MeetingRecorderController {
  const sessionId = useMeetingStore((state) => state.sessionId)
  const isRecording = useMeetingStore((state) => state.isRecording)
  const isPaused = useMeetingStore((state) => state.isPaused)
  const chunkInterval = useMeetingStore((state) => state.settings.chunkInterval)
  const transcribeChunk = useMeetingStore((state) => state.transcribeChunk)
  const setAudioLevel = useMeetingStore((state) => state.setAudioLevel)
  const setElapsedTime = useMeetingStore((state) => state.setElapsedTime)
  const setIsPaused = useMeetingStore((state) => state.setIsPaused)
  const setIsRecording = useMeetingStore((state) => state.setIsRecording)
  const setError = useMeetingStore((state) => state.setError)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useRef(0)
  const chunkOffsetRef = useRef(0)
  const captureQueueRef = useRef<Promise<void>>(Promise.resolve())
  const transcriptionQueueRef = useRef<Promise<void>>(Promise.resolve())
  const activeRef = useRef(false)
  const pausedRef = useRef(false)
  const cancelledRef = useRef(false)
  const stoppingRef = useRef(false)
  const mountedRef = useRef(true)
  const failedChunksRef = useRef<AudioChunk[]>([])
  const [failedChunkCount, setFailedChunkCount] = useState(0)
  const [isRetryingFailedChunks, setIsRetryingFailedChunks] = useState(false)
  const [isStopping, setIsStopping] = useState(false)

  const startChunk = useCallback(() => {
    const stream = streamRef.current
    const current = mediaRecorderRef.current
    if (
      !activeRef.current ||
      stoppingRef.current ||
      pausedRef.current ||
      !stream?.active ||
      (current && current.state !== 'inactive')
    ) {
      return
    }
    chunksRef.current = []
    const recorder = new MediaRecorder(stream)
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.start(1000)
    mediaRecorderRef.current = recorder
  }, [])

  const transcribeAudioChunk = useCallback(
    async (chunk: AudioChunk): Promise<boolean> => {
      try {
        if (cancelledRef.current) return true
        if (!sessionId) {
          setError('Meeting recording session is missing.')
          return false
        }
        const pcm = await convertBlobToPcm(chunk.blob)
        if (cancelledRef.current) return true
        return await transcribeChunk(pcm, chunk.offsetSeconds, chunk.id, sessionId)
      } catch (error) {
        if (cancelledRef.current || useMeetingStore.getState().sessionId !== sessionId) return true
        setError(error instanceof Error ? error.message : String(error))
        return false
      }
    },
    [sessionId, setError, transcribeChunk]
  )

  const enqueueTranscription = useCallback(
    (blob: Blob, offsetSeconds: number): void => {
      const chunk = { id: crypto.randomUUID(), blob, offsetSeconds }
      transcriptionQueueRef.current = transcriptionQueueRef.current.then(async () => {
        if (cancelledRef.current) return
        if (!(await transcribeAudioChunk(chunk))) {
          failedChunksRef.current.push(chunk)
          if (mountedRef.current) setFailedChunkCount(failedChunksRef.current.length)
        }
      })
    },
    [transcribeAudioChunk]
  )

  const discardFailedChunks = useCallback((): void => {
    failedChunksRef.current = []
    if (mountedRef.current) setFailedChunkCount(0)
  }, [])

  const retryFailedChunks = useCallback(async (): Promise<void> => {
    if (failedChunksRef.current.length === 0) return
    if (mountedRef.current) setIsRetryingFailedChunks(true)
    const retry = transcriptionQueueRef.current.then(async () => {
      const pending = failedChunksRef.current.splice(0)
      if (mountedRef.current) setFailedChunkCount(0)
      for (const chunk of pending) {
        if (!(await transcribeAudioChunk(chunk))) failedChunksRef.current.push(chunk)
      }
      if (mountedRef.current) {
        setFailedChunkCount(failedChunksRef.current.length)
        if (failedChunksRef.current.length === 0) setError(null)
      }
    })
    transcriptionQueueRef.current = retry
    try {
      await retry
    } finally {
      if (mountedRef.current) setIsRetryingFailedChunks(false)
    }
  }, [setError, transcribeAudioChunk])

  const captureChunk = useCallback(
    (restart: boolean): Promise<void> => {
      const capture = captureQueueRef.current.then(async () => {
        const recorder = mediaRecorderRef.current
        if (!recorder || recorder.state === 'inactive') return
        const offsetSeconds = chunkOffsetRef.current
        try {
          const stopped = new Promise<void>((resolve) => {
            recorder.addEventListener('stop', () => resolve(), { once: true })
          })
          recorder.stop()
          await stopped
          if (mediaRecorderRef.current === recorder) mediaRecorderRef.current = null
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || 'audio/webm'
          })
          chunksRef.current = []
          chunkOffsetRef.current = elapsedRef.current
          if (restart && activeRef.current && !stoppingRef.current && !pausedRef.current) {
            startChunk()
          }
          if (blob.size > 0 && !cancelledRef.current) {
            enqueueTranscription(blob, offsetSeconds)
          }
        } catch (error) {
          setError(error instanceof Error ? error.message : String(error))
        }
      })
      captureQueueRef.current = capture
      return capture
    },
    [enqueueTranscription, setError, startChunk]
  )

  const releaseMedia = useCallback(async () => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      await audioContextRef.current.close()
    }
    audioContextRef.current = null
    setAudioLevel(0)
  }, [setAudioLevel])

  const stop = useCallback(async () => {
    if (stoppingRef.current) {
      await captureQueueRef.current
      await transcriptionQueueRef.current
      return
    }
    stoppingRef.current = true
    activeRef.current = false
    pausedRef.current = false
    setIsStopping(true)
    if (timerRef.current) clearInterval(timerRef.current)
    if (chunkTimerRef.current) clearInterval(chunkTimerRef.current)
    timerRef.current = null
    chunkTimerRef.current = null
    try {
      await captureChunk(false)
      await releaseMedia()
      await transcriptionQueueRef.current
      setIsPaused(false)
      setIsRecording(false)
    } finally {
      stoppingRef.current = false
      if (mountedRef.current) setIsStopping(false)
    }
  }, [captureChunk, releaseMedia, setIsPaused, setIsRecording])

  const cancel = useCallback(async () => {
    cancelledRef.current = true
    if (stoppingRef.current) {
      await captureQueueRef.current
      return
    }

    stoppingRef.current = true
    activeRef.current = false
    pausedRef.current = false
    setIsStopping(true)
    if (timerRef.current) clearInterval(timerRef.current)
    if (chunkTimerRef.current) clearInterval(chunkTimerRef.current)
    timerRef.current = null
    chunkTimerRef.current = null

    try {
      const discardCapture = captureQueueRef.current.then(async () => {
        const recorder = mediaRecorderRef.current
        if (recorder && recorder.state !== 'inactive') {
          recorder.ondataavailable = null
          const stopped = new Promise<void>((resolve) => {
            recorder.addEventListener('stop', () => resolve(), { once: true })
          })
          recorder.stop()
          await stopped
        }
        if (mediaRecorderRef.current === recorder) mediaRecorderRef.current = null
        chunksRef.current = []
      })
      captureQueueRef.current = discardCapture
      await discardCapture
      failedChunksRef.current = []
      if (mountedRef.current) setFailedChunkCount(0)
      await releaseMedia()
      setIsPaused(false)
      setIsRecording(false)
    } finally {
      stoppingRef.current = false
      if (mountedRef.current) setIsStopping(false)
    }
  }, [releaseMedia, setIsPaused, setIsRecording])

  const togglePause = useCallback(() => {
    const shouldPause = !isPaused
    pausedRef.current = shouldPause
    const recorder = mediaRecorderRef.current
    if (shouldPause) {
      if (recorder?.state === 'recording') recorder.pause()
      setIsPaused(true)
      setAudioLevel(0)
      return
    }
    if (recorder?.state === 'paused') {
      recorder.resume()
    } else {
      void captureQueueRef.current.then(() => startChunk())
    }
    setIsPaused(false)
  }, [isPaused, setAudioLevel, setIsPaused, startChunk])

  useEffect(() => {
    mountedRef.current = true
    activeRef.current = true
    pausedRef.current = false
    cancelledRef.current = false
    stoppingRef.current = false
    const initialElapsed = useMeetingStore.getState().elapsedTime
    failedChunksRef.current = []
    setFailedChunkCount(0)
    setIsRetryingFailedChunks(false)
    elapsedRef.current = initialElapsed
    chunkOffsetRef.current = initialElapsed
    let cancelled = false

    const start = async (): Promise<void> => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
        if (cancelled || !activeRef.current || stoppingRef.current) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        startChunk()
        const audioContext = new AudioContext()
        audioContextRef.current = audioContext
        const source = audioContext.createMediaStreamSource(stream)
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)
        const updateLevel = (): void => {
          if (cancelled || !activeRef.current) return
          analyser.getByteFrequencyData(data)
          const average = data.reduce((sum, value) => sum + value, 0) / data.length
          setAudioLevel(Math.min(100, (average / 128) * 100))
          animationFrameRef.current = requestAnimationFrame(updateLevel)
        }
        updateLevel()
        setIsRecording(true)
        setError(null)
      } catch (error) {
        if (!cancelled && activeRef.current) {
          setError(
            error instanceof Error
              ? `Microphone access failed: ${error.message}`
              : 'Microphone access failed.'
          )
          setIsRecording(false)
        }
      }
    }

    void start()
    return () => {
      cancelled = true
      activeRef.current = false
      cancelledRef.current = true
      mountedRef.current = false
      if (timerRef.current) clearInterval(timerRef.current)
      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current)
      const recorder = mediaRecorderRef.current
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      mediaRecorderRef.current = null
      void releaseMedia()
    }
  }, [sessionId, releaseMedia, setAudioLevel, setError, setIsRecording, startChunk])

  useEffect(() => {
    if (!isRecording || isPaused) return
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1
      setElapsedTime(elapsedRef.current)
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [isPaused, isRecording, setElapsedTime])

  useEffect(() => {
    if (!isRecording || isPaused) return
    chunkTimerRef.current = setInterval(() => void captureChunk(true), chunkInterval)
    return () => {
      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current)
      chunkTimerRef.current = null
    }
  }, [captureChunk, chunkInterval, isPaused, isRecording])

  return {
    stop,
    cancel,
    togglePause,
    retryFailedChunks,
    discardFailedChunks,
    failedChunkCount,
    isRetryingFailedChunks,
    isStopping
  }
}
