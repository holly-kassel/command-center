import { useEffect, useMemo, useRef, useState } from 'react'
import { useMeetingStore } from '../../store/meetingStore'

const SPEAKER_COLORS = [
  { bg: 'bg-blue-500', text: 'text-blue-400' },
  { bg: 'bg-green-500', text: 'text-green-400' },
  { bg: 'bg-purple-500', text: 'text-purple-400' },
  { bg: 'bg-orange-500', text: 'text-orange-400' },
  { bg: 'bg-pink-500', text: 'text-pink-400' },
  { bg: 'bg-cyan-500', text: 'text-cyan-400' },
  { bg: 'bg-yellow-500', text: 'text-yellow-400' },
  { bg: 'bg-red-500', text: 'text-red-400' }
]

function SpeakerMapPanel(): React.ReactElement | null {
  const { segments, renameSpeaker, settings, recordingContext } = useMeetingStore()
  const [editingInputs, setEditingInputs] = useState<Record<string, string>>({})

  const detectedSpeakers = useMemo(() => {
    const found = new Map<
      string,
      { key: string; label: string; chunkId?: string; chunkNumber: number }
    >()
    const chunkNumbers = new Map<string, number>()
    for (const segment of segments) {
      if (segment.speakerIdentity?.verified) continue
      const chunkId = segment.chunkId
      if (chunkId && !chunkNumbers.has(chunkId)) chunkNumbers.set(chunkId, chunkNumbers.size + 1)
      const key = chunkId ? `${chunkId}:${segment.speaker}` : segment.speaker
      if (!found.has(key)) {
        found.set(key, {
          key,
          label: segment.speaker,
          chunkId,
          chunkNumber: chunkId ? (chunkNumbers.get(chunkId) ?? 1) : 1
        })
      }
    }
    return [...found.values()]
  }, [segments])

  const participantNames = [
    ...new Set([
      ...settings.participants,
      ...(recordingContext?.participants.map((participant) => participant.displayName) ?? [])
    ])
  ]

  if (detectedSpeakers.length === 0) return null

  const handleRename = (speaker: (typeof detectedSpeakers)[number]): void => {
    const newName = editingInputs[speaker.key]?.trim()
    if (!newName) return
    renameSpeaker(speaker.label, newName, speaker.chunkId)
    setEditingInputs((current) => {
      const next = { ...current }
      delete next[speaker.key]
      return next
    })
  }

  return (
    <div className="mb-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-2.5">
      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-yellow-400">
        Identify local speakers
      </h4>
      <p className="mb-2 text-[10px] leading-relaxed text-text-muted">
        Local labels can change between chunks. Each correction applies only to that audio chunk.
        Teams names replace these after sync.
      </p>
      <div className="space-y-1.5">
        {detectedSpeakers.map((speaker) => (
          <div key={speaker.key} className="flex items-center gap-2">
            <span
              className="w-24 flex-shrink-0 truncate text-[10px] text-text-muted"
              title={speaker.label}
            >
              {speaker.label} · part {speaker.chunkNumber}
            </span>
            <input
              type="text"
              value={editingInputs[speaker.key] ?? ''}
              onChange={(event) =>
                setEditingInputs((current) => ({ ...current, [speaker.key]: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleRename(speaker)
                }
              }}
              placeholder="Enter or choose a name"
              list="meeting-participant-names"
              className="min-w-0 flex-1 rounded border border-surface-border bg-surface-muted/50 px-2 py-0.5 text-[11px] text-text-primary placeholder:text-text-muted focus:border-focus/50 focus:outline-none"
            />
            <button
              onClick={() => handleRename(speaker)}
              disabled={!editingInputs[speaker.key]?.trim()}
              className="rounded bg-focus/20 px-1.5 py-0.5 text-[10px] font-medium text-focus disabled:opacity-30"
            >
              Save
            </button>
          </div>
        ))}
      </div>
      <datalist id="meeting-participant-names">
        {participantNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  )
}

export function TranscriptView(): React.ReactElement {
  const { segments, isRecording, speakerFilter, searchQuery, setSpeakerFilter, setSearchQuery } =
    useMeetingStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  const speakerColorMap = useMemo(() => {
    const map = new Map<string, (typeof SPEAKER_COLORS)[number]>()
    for (const segment of segments) {
      if (!map.has(segment.speaker))
        map.set(segment.speaker, SPEAKER_COLORS[map.size] ?? SPEAKER_COLORS[0])
    }
    return map
  }, [segments])

  const uniqueSpeakers = useMemo(
    () => [...new Set(segments.map((segment) => segment.speaker))],
    [segments]
  )
  const filteredSegments = useMemo(
    () =>
      segments.filter((segment) => {
        if (speakerFilter && segment.speaker !== speakerFilter) return false
        return !searchQuery || segment.text.toLowerCase().includes(searchQuery.toLowerCase())
      }),
    [searchQuery, segments, speakerFilter]
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [filteredSegments])

  return (
    <div className="flex h-full flex-col">
      <SpeakerMapPanel />
      <div className="mb-3 flex gap-2">
        <input
          type="text"
          placeholder="Search transcript…"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-surface-border bg-surface-muted/50 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus/50"
        />
        <select
          value={speakerFilter ?? ''}
          onChange={(event) => setSpeakerFilter(event.target.value || null)}
          className="max-w-32 rounded-lg border border-surface-border bg-surface-muted/50 px-2 py-1.5 text-xs text-text-primary focus:outline-none"
        >
          <option value="">All speakers</option>
          {uniqueSpeakers.map((speaker) => (
            <option key={speaker} value={speaker}>
              {speaker}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {filteredSegments.length === 0 && !isRecording && (
          <p className="py-10 text-center text-xs text-text-muted">Transcript will appear here.</p>
        )}
        {filteredSegments.map((segment) => {
          const color = speakerColorMap.get(segment.speaker) ?? SPEAKER_COLORS[0]
          const verified = segment.speakerIdentity?.verified === true
          return (
            <div key={segment.id} className="flex items-start gap-2.5">
              <div
                className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${color.bg}/20`}
              >
                <span className={`text-[10px] font-bold ${color.text}`}>
                  {segment.speaker.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-xs font-medium ${color.text}`}>{segment.speaker}</span>
                  <span
                    title={verified ? 'Verified identity' : 'Unverified local label'}
                    className={verified ? 'text-green-400' : 'text-yellow-400'}
                  >
                    {verified ? '✓' : '?'}
                  </span>
                  <span className="text-[10px] text-text-muted">{segment.timestamp}</span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">{segment.text}</p>
              </div>
            </div>
          )
        })}
        {isRecording && (
          <div className="flex items-center gap-2 py-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="text-xs text-text-muted">Listening…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
