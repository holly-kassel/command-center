import type { PendingPermission } from '../../../../shared/types/menagerie'
import { INK, PERMISSION_ICON, PERMISSION_VERB, relativeTime, shortDetail } from './format'

interface Props {
  permission: PendingPermission
  /** Opens the owning session in the Copilot app so the request can be answered */
  onOpen: () => void
  compact?: boolean
}

/**
 * "Needs approval" card. Copilot CLI only accepts permission answers from the
 * process that owns the session, so the Menagerie shows exactly what is being
 * asked and hands you to the session with one click.
 */
export function PermissionCard({ permission, onOpen, compact = false }: Props): React.JSX.Element {
  const detail = shortDetail(permission, compact ? 60 : 160)
  return (
    <div
      style={{
        marginTop: 6,
        padding: compact ? '5px 7px' : '7px 9px',
        background: '#fff1c2',
        border: `2px solid ${INK}`,
        boxShadow: `2px 2px 0 ${INK}`,
        fontSize: compact ? 10 : 11,
        lineHeight: 1.35
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span aria-hidden>{PERMISSION_ICON[permission.kind]}</span>
        <strong style={{ flex: 1 }}>Needs approval · {PERMISSION_VERB[permission.kind]}</strong>
        <span
          title={permission.readOnly ? 'Read-only request' : 'May change things'}
          style={{
            fontSize: 9,
            padding: '0 4px',
            border: `1px solid ${INK}`,
            background: permission.readOnly ? '#cdeccd' : '#f7c6c6'
          }}
        >
          {permission.readOnly ? 'read-only' : 'writes'}
        </span>
      </div>
      {detail && (
        <code
          title={permission.detail ?? undefined}
          style={{
            display: 'block',
            marginTop: 4,
            padding: '3px 5px',
            background: '#fffaf0',
            border: `1px dashed ${INK}`,
            whiteSpace: compact ? 'nowrap' : 'pre-wrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            wordBreak: 'break-all',
            fontFamily: 'inherit',
            fontSize: compact ? 10 : 11
          }}
        >
          {detail}
        </code>
      )}
      {permission.intention && (
        <div style={{ marginTop: 4, opacity: 0.75, fontStyle: 'italic' }}>
          “{permission.intention}”
        </div>
      )}
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ flex: 1, opacity: 0.6, fontSize: 9 }}>
          waiting {relativeTime(permission.requestedAt)}
        </span>
        <button
          onClick={onOpen}
          style={{
            background: '#ffe066',
            color: INK,
            border: `2px solid ${INK}`,
            boxShadow: `2px 2px 0 ${INK}`,
            padding: '3px 8px',
            fontFamily: 'inherit',
            fontSize: 10,
            cursor: 'pointer'
          }}
        >
          Open to approve ↗
        </button>
      </div>
    </div>
  )
}
