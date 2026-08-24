import { useEffect, useMemo, useRef } from 'react'
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
