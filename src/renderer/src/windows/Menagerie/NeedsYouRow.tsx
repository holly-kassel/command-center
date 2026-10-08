import type { Critter } from '../../../../shared/types/menagerie'
import { Btn } from './panel'
import { PermissionCard } from './PermissionCard'

/** A critter waiting on you in a manager's report: who it is, and what it's asking for */
export function NeedsYouRow({
  critter,
  onOpen
}: {
  critter: Critter
  onOpen: () => void
}): React.JSX.Element {
  const repoShort = critter.repository.split('/').pop() ?? critter.repository
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{critter.species === 'puppy' ? '🐶' : '🐱'}</span>
        <span
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={critter.name}
        >
          {critter.name} <span style={{ opacity: 0.6 }}>· {repoShort}</span>
        </span>
        {!critter.pendingPermission && <Btn onClick={onOpen}>Open</Btn>}
      </div>
      {critter.pendingPermission && (
        <PermissionCard permission={critter.pendingPermission} compact onOpen={onOpen} />
      )}
    </div>
  )
}
