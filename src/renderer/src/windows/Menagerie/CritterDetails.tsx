import { useState } from 'react'
import type { Critter } from '../../../../shared/types/menagerie'
import { STATUS_COLOR, STATUS_LABEL, relativeTime, INK } from './format'
import { Btn, Row, Section } from './panel'
import { PermissionCard } from './PermissionCard'

/** Full session details for the close-up side panels (yard and nap time) */
export function CritterDetails({ critter }: { critter: Critter }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const copy = async (): Promise<void> => {
    await window.api.menagerie.copyId(critter.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <Section title="Session">
      <div style={{ fontWeight: 700, fontSize: 12 }}>{critter.name}</div>
      <Row label="Status">
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            background: STATUS_COLOR[critter.status],
            border: `1px solid ${INK}`,
            marginRight: 4
          }}
        />
        {STATUS_LABEL[critter.status]}
      </Row>
      <Row label="Last seen">
        {relativeTime(critter.lastActivityAt)} · {new Date(critter.lastActivityAt).toLocaleString()}
      </Row>
      {critter.branch && <Row label="Branch">🌿 {critter.branch}</Row>}
      <Row label="Client">
        {critter.client}
        {critter.pid ? ` (pid ${critter.pid})` : ''}
      </Row>
      {critter.cwd && (
        <Row label="Folder">
          <span style={{ wordBreak: 'break-all' }}>{critter.cwd}</span>
        </Row>
      )}
      <Row label="Session id">
        <span style={{ wordBreak: 'break-all', opacity: 0.7 }}>{critter.id}</span>
      </Row>
      {critter.pendingPermission && (
        <PermissionCard
          permission={critter.pendingPermission}
          onOpen={() => void window.api.menagerie.openSession(critter.id)}
        />
      )}
      {critter.currentTool && (
        <Row label="Doing now">
          <span>{critter.currentTool}</span>
        </Row>
      )}
      {critter.subagents > 0 && (
        <Row label="Sub-agents">
          <span>
            {'🐱'.repeat(Math.min(critter.subagents, 6))} {critter.subagents} running
          </span>
        </Row>
      )}
      {critter.lastActivity && !critter.currentTool && (
        <div style={{ marginTop: 6, fontStyle: 'italic', opacity: 0.8 }}>
          “{critter.lastActivity}”
        </div>
      )}
      <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Btn onClick={() => void window.api.menagerie.openSession(critter.id)}>Open session</Btn>
        <Btn
          onClick={() => critter.cwd && void window.api.menagerie.reveal(critter.cwd)}
          disabled={!critter.cwd}
        >
          Reveal in Finder
        </Btn>
        <Btn onClick={() => void copy()}>{copied ? 'Copied!' : 'Copy session ID'}</Btn>
      </div>
    </Section>
  )
}
