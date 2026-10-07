import { forwardRef, useState } from 'react'
import type { Critter } from '../../../../shared/types/menagerie'
import { STATUS_COLOR, STATUS_LABEL, relativeTime } from './format'
import { PermissionCard } from './PermissionCard'

interface Props {
  critter: Critter
  onClose: () => void
}

/**
 * Positioned by the parent via `ref` (left/top updated every animation frame
 * so the bubble follows its critter without re-rendering React).
 */
export const SpeechBubble = forwardRef<HTMLDivElement, Props>(function SpeechBubble(
  { critter, onClose },
  ref
) {
  const [copied, setCopied] = useState(false)
  const repoShort = critter.repository.split('/').pop() ?? critter.repository

  const copy = async (): Promise<void> => {
    await window.api.menagerie.copyId(critter.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div
      ref={ref}
      className="menagerie-bubble"
      style={{
        position: 'absolute',
        transform: 'translate(-50%, calc(-100% - 14px))',
        width: 240,
        background: '#fffaf0',
        color: '#2a2320',
        border: '3px solid #2a2320',
        boxShadow: '4px 4px 0 #0008',
        padding: '8px 10px',
        fontFamily: 'ui-monospace, Menlo, monospace',
        fontSize: 11,
        lineHeight: 1.35,
        imageRendering: 'pixelated',
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
        >
          {critter.name}
        </strong>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            color: '#2a2320',
            padding: 0
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            background: STATUS_COLOR[critter.status],
            border: '1px solid #2a2320'
          }}
        />
        <span>{STATUS_LABEL[critter.status]}</span>
        <span style={{ opacity: 0.6 }}>· {relativeTime(critter.lastActivityAt)}</span>
      </div>
      <div style={{ marginTop: 4, opacity: 0.85 }}>
        <span title={critter.repository}>🏠 {repoShort}</span>
        {critter.branch && <span> · 🌿 {critter.branch}</span>}
      </div>
      {critter.subagents > 0 && (
        <div style={{ marginTop: 4, opacity: 0.85 }}>
          🐱 {critter.subagents} sub-agent{critter.subagents === 1 ? '' : 's'} running
        </div>
      )}
      {critter.pendingPermission && (
        <PermissionCard
          permission={critter.pendingPermission}
          compact
          onOpen={() => void window.api.menagerie.openSession(critter.id)}
        />
      )}
      {!critter.pendingPermission && (critter.currentTool || critter.lastActivity) && (
        <div
          style={{
            marginTop: 4,
            opacity: 0.75,
            fontStyle: 'italic',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          “{critter.currentTool ?? critter.lastActivity}”
        </div>
      )}
      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <BubbleButton onClick={() => void window.api.menagerie.openSession(critter.id)}>
          Open session
        </BubbleButton>
        <BubbleButton
          onClick={() => critter.cwd && void window.api.menagerie.reveal(critter.cwd)}
          disabled={!critter.cwd}
        >
          Reveal in Finder
        </BubbleButton>
        <BubbleButton onClick={() => void copy()}>
          {copied ? 'Copied!' : 'Copy session ID'}
        </BubbleButton>
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
          borderTop: '10px solid #2a2320'
        }}
      />
    </div>
  )
})

function BubbleButton({
  children,
  onClick,
  disabled
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        background: disabled ? '#d8d0c0' : '#ffe066',
        color: '#2a2320',
        border: '2px solid #2a2320',
        boxShadow: disabled ? 'none' : '2px 2px 0 #2a2320',
        padding: '4px 6px',
        fontFamily: 'inherit',
        fontSize: 10,
        cursor: disabled ? 'default' : 'pointer'
      }}
    >
      {children}
    </button>
  )
}
