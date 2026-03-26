import { useState } from 'react'
import { useMeetingStore } from '../../store/meetingStore'

interface MeetingSettingsProps {
  isOpen: boolean
  onClose: () => void
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'auto', label: 'Auto-detect' },
]

const CHUNK_INTERVALS = [
  { value: 15000, label: '15s' },
  { value: 30000, label: '30s' },
  { value: 60000, label: '60s' },
]

export function MeetingSettings({ isOpen, onClose }: MeetingSettingsProps): React.ReactElement | null {
  const { settings, updateSettings } = useMeetingStore()
  const [participantInput, setParticipantInput] = useState('')

  const addParticipant = (): void => {
    const name = participantInput.trim()
    if (name && !settings.participants.includes(name)) {
      updateSettings({ participants: [...settings.participants, name] })
    }
    setParticipantInput('')
  }

  const removeParticipant = (name: string): void => {
    updateSettings({ participants: settings.participants.filter((p) => p !== name) })
  }

  if (!isOpen) return null

  return (
    <div className="absolute right-0 top-10 z-50 w-64 rounded-lg bg-surface-muted border border-surface-border shadow-xl p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-primary">Settings</span>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-secondary text-xs transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Language */}
      <div>
        <label className="text-[11px] text-text-muted block mb-1">Language</label>
        <select
          value={settings.language}
          onChange={(e) => updateSettings({ language: e.target.value })}
          className="w-full px-2 py-1.5 rounded-lg bg-surface-muted/50 border border-surface-border text-text-primary text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-focus/50"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      {/* Speaker Diarization */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-muted">Speaker Diarization</span>
        <button
          onClick={() => updateSettings({ speakerDiarization: !settings.speakerDiarization })}
          className={`relative w-8 h-4.5 rounded-full transition-colors ${
            settings.speakerDiarization ? 'bg-focus' : 'bg-surface-border'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${
              settings.speakerDiarization ? 'translate-x-3.5' : ''
            }`}
          />
        </button>
      </div>

      {/* Chunk Interval */}
      <div>
        <label className="text-[11px] text-text-muted block mb-1">Chunk Interval</label>
        <div className="flex gap-1.5">
          {CHUNK_INTERVALS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateSettings({ chunkInterval: opt.value })}
              className={`flex-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                settings.chunkInterval === opt.value
                  ? 'bg-focus/20 text-focus border border-focus/30'
                  : 'bg-surface-muted/50 text-text-muted border border-surface-border hover:text-text-secondary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Participants */}
      <div>
        <label className="text-[11px] text-text-muted block mb-1">Participants</label>
        <div className="flex gap-1">
          <input
            type="text"
            value={participantInput}
            onChange={(e) => setParticipantInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addParticipant() } }}
            placeholder="Add name…"
            className="flex-1 px-2 py-1 rounded-lg bg-surface-muted/50 border border-surface-border text-text-primary text-xs placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus/50"
          />
          <button
            onClick={addParticipant}
            className="px-2 py-1 rounded-lg bg-focus/20 text-focus text-xs font-medium border border-focus/30 hover:bg-focus/30 transition-colors"
          >
            +
          </button>
        </div>
        {settings.participants.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {settings.participants.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface-muted/50 border border-surface-border text-[10px] text-text-secondary"
              >
                {name}
                <button
                  onClick={() => removeParticipant(name)}
                  className="text-text-muted hover:text-red-400 ml-0.5 transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-[10px] text-text-muted mt-1">Helps map speaker labels to real names</p>
      </div>
    </div>
  )
}
