import { forwardRef } from 'react'
import type { Automation } from '../../../../shared/types/menagerie'
import { automationState } from '../../../../shared/types/menagerie'
import {
  AUTOMATION_STATE_COLOR,
  AUTOMATION_STATE_LABEL,
  FONT,
  INK,
  PAPER,
  STATUS_COLOR,
  STATUS_LABEL,
  nextRunLabel,
  relativeTime
} from './format'
import { Btn } from './panel'
import { PermissionCard } from './PermissionCard'
import { decorationFor } from './sprites'

interface Props {
  automation: Automation
  /** Its place in the town square, which picks the decoration (and icon) */
  index: number
  onClose: () => void
}

const SHOWN_RUNS = 4

/**
 * Card over a town-square decoration. Positioned by the parent via `ref`,
 * like the critter speech bubble.
 */
export const AutomationBubble = forwardRef<HTMLDivElement, Props>(function AutomationBubble(
  { automation: a, index, onClose },
  ref
) {
  const state = automationState(a)
  const { sprite } = decorationFor(index)
  const waiting = a.runs.find((c) => c.status === 'waiting' && c.pendingPermission)
  const latest = a.lastRun?.sessionId ?? a.runs[0]?.id ?? null
  const open = (id: string): void => void window.api.menagerie.openSession(id)

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        transform: 'translate(-50%, calc(-100% - 14px))',
        width: 260,
        background: PAPER,
        color: INK,
        border: `3px solid ${INK}`,
        boxShadow: '4px 4px 0 #0008',
        padding: '8px 10px',
        fontFamily: FONT,
        fontSize: 11,
        lineHeight: 1.35,
        pointerEvents: 'auto',
        zIndex: 10
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}
      >
        <strong
          style={{
            fontSize: 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          title={a.name}
        >
          {sprite.icon} {a.name}
        </strong>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            color: INK,
            padding: 0
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Dot color={AUTOMATION_STATE_COLOR[state]} />
        <span>{AUTOMATION_STATE_LABEL[state]}</span>
        <span style={{ opacity: 0.6 }}>
          · {a.lastRun ? `ran ${relativeTime(a.lastRun.startedAt)}` : 'never run'}
        </span>
      </div>
      <div style={{ marginTop: 4, opacity: 0.85 }}>
        🗓 {a.schedule}
        {a.enabled ? '' : ' · paused'}
      </div>
      {a.project && <div style={{ marginTop: 2, opacity: 0.85 }}>🏠 {a.project}</div>}
      {a.nextRunAt && (
        <div style={{ marginTop: 2, opacity: 0.85 }}>⏭ {nextRunLabel(a.nextRunAt)}</div>
      )}
      {state === 'failed' && a.lastRun?.error && (
        <div style={{ marginTop: 4, color: '#b3261e' }}>⚠ {a.lastRun.error}</div>
      )}
      {waiting?.pendingPermission && (
        <PermissionCard
          permission={waiting.pendingPermission}
          compact
          onOpen={() => open(waiting.id)}
        />
      )}

      {a.runs.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div
            style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.55 }}
          >
            Runs in the last 24h
          </div>
          {a.runs.slice(0, SHOWN_RUNS).map((c) => (
            <button
              key={c.id}
              onClick={() => open(c.id)}
              title="Open this run's session"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                width: '100%',
                marginTop: 2,
                padding: '2px 0',
                background: 'none',
                border: 'none',
                color: INK,
                fontFamily: FONT,
                fontSize: 11,
                textAlign: 'left',
                cursor: 'pointer'
              }}
            >
              <Dot color={STATUS_COLOR[c.status]} />
              <span style={{ flex: 1 }}>{STATUS_LABEL[c.status]}</span>
              <span style={{ opacity: 0.6 }}>{relativeTime(c.lastActivityAt)} ↗</span>
            </button>
          ))}
          {a.runs.length > SHOWN_RUNS && (
            <div style={{ opacity: 0.6, marginTop: 2 }}>+{a.runs.length - SHOWN_RUNS} more</div>
          )}
        </div>
      )}

      <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
        <Btn onClick={() => latest && open(latest)} disabled={!latest}>
          Open latest run
        </Btn>
      </div>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: '50%',
          bottom: -11,
          width: 0,
          height: 0,
          transform: 'translateX(-50%)',
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: `10px solid ${INK}`
        }}
      />
    </div>
  )
})

function Dot({ color }: { color: string }): React.JSX.Element {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        flexShrink: 0,
        background: color,
        border: `1px solid ${INK}`
      }}
    />
  )
}
