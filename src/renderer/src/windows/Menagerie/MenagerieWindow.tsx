import { useCallback, useEffect, useRef, useState } from 'react'
import { selectCritter, selectZoomedYard, useMenagerieStore } from '../../store/menagerieStore'
import { MenagerieCanvas, type ScreenAnchor } from './MenagerieCanvas'
import { SpeechBubble } from './SpeechBubble'
import { YardCloseUp } from './YardCloseUp'
import { KatyaCloseUp } from './KatyaCloseUp'
import { COLLAR_COLORS } from './sprites'

const FONT = 'ui-monospace, Menlo, monospace'

export function MenagerieWindow(): React.JSX.Element {
  const snapshot = useMenagerieStore((s) => s.snapshot)
  const loading = useMenagerieStore((s) => s.loading)
  const error = useMenagerieStore((s) => s.error)
  const selectedId = useMenagerieStore((s) => s.selectedId)
  const selected = useMenagerieStore(selectCritter)
  const select = useMenagerieStore((s) => s.select)
  const zoomedYard = useMenagerieStore(selectZoomedYard)
  const zoom = useMenagerieStore((s) => s.zoom)
  const katyaOpen = useMenagerieStore((s) => s.katyaOpen)
  const openKatya = useMenagerieStore((s) => s.openKatya)
  const connect = useMenagerieStore((s) => s.connect)
  const refresh = useMenagerieStore((s) => s.refresh)

  const bubbleRef = useRef<HTMLDivElement>(null)

  useEffect(() => connect(), [connect])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      const st = useMenagerieStore.getState()
      if (st.katyaOpen) openKatya(false)
      else if (st.zoomedRepo) zoom(null)
      else select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [select, zoom, openKatya])

  const onAnchor = useCallback((a: ScreenAnchor | null) => {
    const el = bubbleRef.current
    if (!el) return
    if (!a) {
      el.style.visibility = 'hidden'
      return
    }
    el.style.visibility = 'visible'
    el.style.left = `${a.x}px`
    el.style.top = `${a.y}px`
  }, [])

  const counts = snapshot?.counts

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#1b1a2e',
        color: '#f3eee4',
        fontFamily: FONT,
        overflow: 'hidden'
      }}
    >
      <header
        style={
          {
            WebkitAppRegion: 'drag',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '10px 14px 10px 84px',
            borderBottom: '3px solid #0f0e1c',
            background: '#262544',
            fontSize: 12,
            userSelect: 'none'
          } as React.CSSProperties
        }
      >
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.5 }}>
          🐾 Katya&apos;s Menagerie
        </span>
        <span style={{ opacity: 0.55 }}>
          {snapshot
            ? `${snapshot.yards.length} yard${snapshot.yards.length === 1 ? '' : 's'}`
            : '…'}
        </span>
        <div style={{ flex: 1 }} />
        {counts && (
          <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
            <Stat color="#43c466" label="working" value={counts.working} />
            <Stat color="#ffd84d" label="waiting" value={counts.waiting} />
            <Stat color="#9fb7ff" label="idle" value={counts.idle} />
            <Stat color="#c9a24f" label="recent" value={counts.recent} />
            <Stat color="#8a8f99" label="done" value={counts.done} />
          </div>
        )}
        <button
          onClick={() => void refresh()}
          title="Refresh now"
          style={
            {
              WebkitAppRegion: 'no-drag',
              background: '#ffe066',
              color: '#2a2320',
              border: '2px solid #0f0e1c',
              boxShadow: '2px 2px 0 #0f0e1c',
              padding: '3px 8px',
              fontFamily: FONT,
              fontSize: 11,
              cursor: 'pointer'
            } as React.CSSProperties
          }
        >
          ↻
        </button>
      </header>

      <div style={{ position: 'relative', flex: 1, minHeight: 0 }} onClick={() => select(null)}>
        <MenagerieCanvas
          snapshot={snapshot}
          selectedId={selectedId}
          onSelect={select}
          onOpen={(id) => void window.api.menagerie.openSession(id)}
          onAnchor={onAnchor}
          onZoom={zoom}
          onKatya={() => openKatya(true)}
        />

        {selected && (
          <SpeechBubble
            key={selected.id}
            ref={bubbleRef}
            critter={selected}
            onClose={() => select(null)}
          />
        )}

        {zoomedYard && <YardCloseUp yard={zoomedYard} onClose={() => zoom(null)} />}
        {katyaOpen && snapshot && (
          <KatyaCloseUp
            snapshot={snapshot}
            onClose={() => openKatya(false)}
            onOpenSession={(id) => void window.api.menagerie.openSession(id)}
          />
        )}

        {loading && !snapshot && <Overlay>Waking up the puppies and kittens…</Overlay>}
        {error && <Overlay tone="error">{error}</Overlay>}
        {snapshot && snapshot.yards.length === 0 && (
          <Overlay>
            No Copilot sessions in the last 24 hours.
            <br />
            Start one and a critter will move in.
          </Overlay>
        )}
      </div>

      <footer
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '6px 14px',
          borderTop: '3px solid #0f0e1c',
          background: '#262544',
          fontSize: 10,
          opacity: 0.9
        }}
      >
        <Legend color={COLLAR_COLORS.cli} label="CLI collar" />
        <Legend color={COLLAR_COLORS.autopilot} label="Autopilot collar" />
        <Legend color={COLLAR_COLORS.unknown} label="Unknown collar" />
        <span style={{ opacity: 0.6 }}>
          🐶 digs / 🐱 yarn = working · ? = waiting · zz = idle/done · ♥♪ = playing · click a
          critter to open its session · click a cottage to zoom in · click Katya for the town report
          · finished tasks upgrade the cottage
        </span>
        <div style={{ flex: 1 }} />
        <NotificationsToggle />
        <button
          type="button"
          onClick={() => void window.api.menagerie.editNeighborhoods()}
          title="Group yards from several repos into one neighborhood (opens menagerie-neighborhoods.json)"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            font: 'inherit',
            cursor: 'pointer',
            padding: 0
          }}
        >
          ⌂ neighborhoods
        </button>
        {snapshot?.warnings.length ? (
          <span title={snapshot.warnings.join('\n')} style={{ color: '#ffd84d' }}>
            ⚠ {snapshot.warnings.length} warning{snapshot.warnings.length === 1 ? '' : 's'}
          </span>
        ) : null}
        <span style={{ opacity: 0.5 }}>⌘⇧M</span>
      </footer>
    </div>
  )
}

function NotificationsToggle(): React.JSX.Element {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    void window.api.menagerie.getNotifications().then(setEnabled)
  }, [])
  if (enabled === null) return <span />
  return (
    <label
      title="Notify (and badge the dock) when a critter needs you"
      style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => {
          setEnabled(e.target.checked)
          void window.api.menagerie.setNotifications(e.target.checked)
        }}
        style={{ margin: 0 }}
      />
      🔔 nudges
    </label>
  )
}

function Stat({
  color,
  label,
  value
}: {
  color: string
  label: string
  value: number
}): React.JSX.Element {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span
        style={{
          width: 8,
          height: 8,
          background: color,
          border: '1px solid #0f0e1c',
          display: 'inline-block'
        }}
      />
      <strong>{value}</strong>
      <span style={{ opacity: 0.6 }}>{label}</span>
    </span>
  )
}

function Legend({ color, label }: { color: string; label: string }): React.JSX.Element {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 10, height: 4, background: color, display: 'inline-block' }} />
      {label}
    </span>
  )
}

function Overlay({
  children,
  tone
}: {
  children: React.ReactNode
  tone?: 'error'
}): React.JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        pointerEvents: 'none',
        textAlign: 'center',
        fontSize: 12,
        lineHeight: 1.6
      }}
    >
      <div
        style={{
          background: tone === 'error' ? '#5a2a2a' : '#262544',
          border: '3px solid #0f0e1c',
          boxShadow: '4px 4px 0 #0008',
          padding: '12px 18px',
          maxWidth: 360
        }}
      >
        {children}
      </div>
    </div>
  )
}
