/**
 * ScreamIntoTheVoid
 *
 * Type whatever you want. It is NEVER saved anywhere.
 * Hit "Scream" and the text vanishes into the void, accompanied
 * by a synthesized Howie scream (the TIE Fighter shriek).
 *
 * Pure catharsis. Zero consequences.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

// ─── Howie Scream Synth ───────────────────────────────────────
// The Howie / TIE Fighter scream: try loading the real audio file,
// fall back to a synthesized approximation if not found.

/** Try to play the real Howie scream from resources/sounds/ */
async function playRealScream(): Promise<boolean> {
  try {
    const buffer = await window.api.app.getSound('howie-scream.mp3')
    if (!buffer) return false
    const ctx = new AudioContext()
    const audioBuffer = await ctx.decodeAudioData(buffer)
    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)
    source.start()
    source.onended = () => ctx.close()
    return true
  } catch {
    return false
  }
}

/** Synthesized Howie scream fallback */
function playSynthScream(): void {
  const ctx = new AudioContext()
  const now = ctx.currentTime
  const duration = 1.6

  // Master gain — shape the overall envelope
  const master = ctx.createGain()
  master.gain.setValueAtTime(0, now)
  master.gain.linearRampToValueAtTime(0.7, now + 0.05)
  master.gain.setValueAtTime(0.7, now + 0.3)
  master.gain.linearRampToValueAtTime(0.5, now + 0.9)
  master.gain.exponentialRampToValueAtTime(0.001, now + duration)
  master.connect(ctx.destination)

  // Waveshaper for gritty distortion
  const distortion = ctx.createWaveShaper()
  const curve = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    const x = (i * 2) / 256 - 1
    curve[i] = ((Math.PI + 40) * x) / (Math.PI + 40 * Math.abs(x))
  }
  distortion.curve = curve
  distortion.oversample = '4x'
  distortion.connect(master)

  // Bandpass to shape the "voice" quality
  const bandpass = ctx.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.setValueAtTime(2200, now)
  bandpass.frequency.exponentialRampToValueAtTime(800, now + duration)
  bandpass.Q.value = 2.5
  bandpass.connect(distortion)

  // Primary scream: sawtooth with pitch descent
  const osc1 = ctx.createOscillator()
  osc1.type = 'sawtooth'
  osc1.frequency.setValueAtTime(1400, now)
  osc1.frequency.exponentialRampToValueAtTime(600, now + duration)
  const g1 = ctx.createGain()
  g1.gain.value = 0.35
  osc1.connect(g1).connect(bandpass)
  osc1.start(now)
  osc1.stop(now + duration)

  // Harmonic overtone — higher, thinner
  const osc2 = ctx.createOscillator()
  osc2.type = 'sawtooth'
  osc2.frequency.setValueAtTime(2800, now)
  osc2.frequency.exponentialRampToValueAtTime(1200, now + duration)
  const g2 = ctx.createGain()
  g2.gain.value = 0.15
  osc2.connect(g2).connect(bandpass)
  osc2.start(now)
  osc2.stop(now + duration)

  // Sub-harmonic rumble
  const osc3 = ctx.createOscillator()
  osc3.type = 'square'
  osc3.frequency.setValueAtTime(700, now)
  osc3.frequency.exponentialRampToValueAtTime(300, now + duration)
  const g3 = ctx.createGain()
  g3.gain.value = 0.1
  osc3.connect(g3).connect(bandpass)
  osc3.start(now)
  osc3.stop(now + duration)

  // Noise layer — breathy scream texture
  const bufferSize = ctx.sampleRate * duration
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const noiseData = noiseBuffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    noiseData[i] = Math.random() * 2 - 1
  }
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuffer
  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(0.08, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration)
  const noiseFilter = ctx.createBiquadFilter()
  noiseFilter.type = 'bandpass'
  noiseFilter.frequency.setValueAtTime(2000, now)
  noiseFilter.frequency.exponentialRampToValueAtTime(700, now + duration)
  noiseFilter.Q.value = 3
  noise.connect(noiseFilter).connect(noiseGain).connect(master)
  noise.start(now)
  noise.stop(now + duration)

  // Vibrato via LFO on primary oscillator
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 6
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 30
  lfo.connect(lfoGain).connect(osc1.frequency)
  lfo.start(now)
  lfo.stop(now + duration)

  // Cleanup after the scream finishes
  setTimeout(() => ctx.close(), (duration + 0.5) * 1000)
}

/** Play Howie scream — real file if available, synth fallback */
async function playHowieScream(): Promise<void> {
  const played = await playRealScream()
  if (!played) playSynthScream()
}

// ─── Component ────────────────────────────────────────────────

interface ScreamIntoTheVoidProps {
  onClose: () => void
}

export function ScreamIntoTheVoid({ onClose }: ScreamIntoTheVoidProps): React.JSX.Element {
  const [text, setText] = useState('')
  const [screaming, setScreaming] = useState(false)
  const [voidPhase, setVoidPhase] = useState<'typing' | 'dissolving' | 'void'>('typing')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && voidPhase === 'typing') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, voidPhase])

  const scream = useCallback(() => {
    if (!text.trim() || screaming) return

    setScreaming(true)
    setVoidPhase('dissolving')

    // Play the Howie scream
    playHowieScream()

    // Text dissolves, then void phase
    setTimeout(() => {
      setVoidPhase('void')
      setText('') // Gone forever. Never saved anywhere.
    }, 800)

    setTimeout(() => {
      setScreaming(false)
      setVoidPhase('typing')
    }, 2400)
  }, [text, screaming])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      scream()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop — deep void black */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={voidPhase === 'typing' ? onClose : undefined}
      />

      {/* Content */}
      <div className="relative w-full max-w-lg mx-4">
        {/* Close button */}
        {voidPhase === 'typing' && (
          <button
            onClick={onClose}
            className="absolute -top-10 right-0 text-white/40 hover:text-white/70 transition-colors text-sm"
          >
            ✕
          </button>
        )}

        {voidPhase === 'void' ? (
          /* The void stares back */
          <div className="text-center animate-pulse">
            <div className="text-4xl mb-3">🕳️</div>
            <p className="text-white/30 text-sm italic">The void has consumed your words.</p>
            <p className="text-white/15 text-xs mt-1">They are gone forever.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header */}
            <div className="text-center">
              <h2 className="text-lg font-bold text-white/90">Scream Into The Void</h2>
              <p className="text-white/40 text-xs mt-1">Nothing here is saved. Ever. Let it out.</p>
            </div>

            {/* Textarea */}
            <div
              className={`transition-all duration-700 ${
                voidPhase === 'dissolving'
                  ? 'opacity-0 scale-95 blur-sm translate-y-4'
                  : 'opacity-100 scale-100 blur-0 translate-y-0'
              }`}
            >
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type whatever you need to get off your chest..."
                disabled={screaming}
                className="w-full h-48 bg-white/5 border border-white/10 rounded-xl p-4 text-white/90 placeholder-white/20 resize-none outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/20 transition-all text-sm leading-relaxed"
                spellCheck={false}
              />
            </div>

            {/* Scream button */}
            <div className="flex items-center justify-between">
              <span className="text-white/20 text-xs">⌘↵ to scream</span>
              <button
                onClick={scream}
                disabled={!text.trim() || screaming}
                className="group px-5 py-2.5 rounded-lg bg-red-600/80 hover:bg-red-500 text-white font-semibold text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-red-500/25"
              >
                {screaming ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="animate-ping inline-block w-2 h-2 rounded-full bg-white" />
                    AAAAA
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">🗣️ Scream</span>
                )}
              </button>
            </div>

            {/* Reassurance */}
            <p className="text-white/10 text-[10px] text-center">
              This text exists only in memory. No logs. No files. No history. Nothing.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
