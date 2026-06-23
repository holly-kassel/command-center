import { useEffect, useRef, useMemo, useState } from 'react'
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
  const { segments, speakerMap, renameSpeaker, settings } = useMeetingStore()
  const [editingInputs, setEditingInputs] = useState<Record<string, string>>({})

  // Collect all original speaker labels (before mapping) by checking
  // which keys exist in the map, plus any unmapped labels in segments
  const detectedSpeakers = useMemo(() => {
    const labels = new Set<string>()
    // Keys in speakerMap are the original labels
    for (const key of Object.keys(speakerMap)) {
      labels.add(key)
    }
    // Also check segments for speakers that look like diarization labels
    for (const seg of segments) {
      const speaker = seg.speaker
      // If this speaker name is a mapped value, skip — the original key is already tracked
      const isMappedValue = Object.values(speakerMap).includes(speaker)
      if (!isMappedValue && /^(Speaker\s*\d+|[A-Z]|Unknown)$/i.test(speaker)) {
        labels.add(speaker)
      }
    }
    return Array.from(labels).sort()
  }, [segments, speakerMap])

  if (detectedSpeakers.length === 0) return null

  const handleRename = (originalLabel: string): void => {
    const newName = editingInputs[originalLabel]?.trim()
    if (newName && newName !== originalLabel) {
      renameSpeaker(originalLabel, newName)
      setEditingInputs((prev) => {
        const next = { ...prev }
        delete next[originalLabel]
        return next
      })
    }
  }

  return (
    <div className="mb-3 p-2.5 rounded-lg bg-surface-muted/50 border border-surface-border">
      <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <span>🎤</span> Identify Speakers
      </h4>
      <div className="space-y-1.5">
        {detectedSpeakers.map((label) => {
          const mappedName = speakerMap[label]
          const inputValue = editingInputs[label] ?? ''

          return (
            <div key={label} className="flex items-center gap-2">
              <span
                className="text-[11px] text-text-muted w-20 flex-shrink-0 truncate"
                title={label}
              >
                {label}
              </span>
              <span className="text-text-muted text-[10px]">→</span>
              {mappedName ? (
                <span className="text-[11px] text-text-primary font-medium flex-1 truncate">
                  {mappedName}
                </span>
              ) : (
                <div className="flex-1 flex gap-1">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) =>
                      setEditingInputs((prev) => ({ ...prev, [label]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleRename(label)
                      }
                    }}
                    placeholder={settings.participants[detectedSpeakers.indexOf(label)] || 'Name…'}
                    className="flex-1 px-2 py-0.5 rounded bg-surface-muted/50 border border-surface-border text-text-primary text-[11px] placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-focus/50"
                  />
                  <button
                    onClick={() => handleRename(label)}
                    disabled={!inputValue.trim()}
                    className="px-1.5 py-0.5 rounded bg-focus/20 text-focus text-[10px] font-medium border border-focus/30 hover:bg-focus/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    ✓
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TranscriptView(): React.ReactElement {
  const { segments, isRecording, speakerFilter, searchQuery, setSpeakerFilter, setSearchQuery } =
    useMeetingStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  const speakerColorMap = useMemo(() => {
    const map = new Map<string, (typeof SPEAKER_COLORS)[number]>()
    const seen: string[] = []
    for (const seg of segments) {
      if (!seen.includes(seg.speaker)) {
        seen.push(seg.speaker)
        map.set(seg.speaker, SPEAKER_COLORS[seen.length - 1] ?? SPEAKER_COLORS[0])
      }
    }
    return map
  }, [segments])

  const uniqueSpeakers = useMemo(() => {
    const set = new Set<string>()
    for (const seg of segments) set.add(seg.speaker)
    return Array.from(set)
  }, [segments])

  const filteredSegments = useMemo(() => {
    return segments.filter((seg) => {
      if (speakerFilter && seg.speaker !== speakerFilter) return false
      if (searchQuery && !seg.text.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [segments, speakerFilter, searchQuery])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [filteredSegments])

  return (
    <div className="flex flex-col h-full">
      {/* Speaker identification panel */}
      <SpeakerMapPanel />

      {/* Filters */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="Search transcript…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-3 py-1.5 rounded-lg bg-surface-muted/50 border border-surface-border text-text-primary text-xs placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus/50"
        />
        <select
          value={speakerFilter ?? ''}
          onChange={(e) => setSpeakerFilter(e.target.value)}
          className="px-2 py-1.5 rounded-lg bg-surface-muted/50 border border-surface-border text-text-primary text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-focus/50"
        >
          <option value="">All Speakers</option>
          {uniqueSpeakers.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Segments */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {filteredSegments.length === 0 && !isRecording && (
          <div className="flex flex-col items-center justify-center py-10">
            <p className="text-text-muted text-xs">Transcript will appear here…</p>
          </div>
        )}

        {filteredSegments.map((seg) => {
          const color = speakerColorMap.get(seg.speaker) ?? SPEAKER_COLORS[0]
          const initial = seg.speaker.charAt(0).toUpperCase()

          return (
            <div key={seg.id} className="flex gap-2.5 items-start">
              <div
                className={`w-6 h-6 rounded-full ${color.bg}/20 flex items-center justify-center flex-shrink-0 mt-0.5`}
              >
                <span className={`text-[10px] font-bold ${color.text}`}>{initial}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className={`text-xs font-medium ${color.text}`}>{seg.speaker}</span>
                  <span className="text-[10px] text-text-muted">{seg.timestamp}</span>
                </div>
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{seg.text}</p>
              </div>
            </div>
          )
        })}

        {isRecording && (
          <div className="flex items-center gap-2 py-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-text-muted">Listening…</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
