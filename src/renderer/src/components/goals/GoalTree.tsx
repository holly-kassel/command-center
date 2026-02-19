/**
 * GoalTree Component
 *
 * Recursive tree rendering of goals with collapsible children.
 */
import { useState } from 'react'
import { GoalCard } from './GoalCard'
import type { Goal, GoalWithChildren } from '@shared/types/goal'

interface GoalTreeProps {
  nodes: GoalWithChildren[]
  depth?: number
  onEdit?: (goal: Goal) => void
}

export function GoalTree({ nodes, depth = 0, onEdit }: GoalTreeProps): React.ReactElement {
  return (
    <div className={depth > 0 ? 'ml-4 border-l border-surface-border/20 pl-3' : ''}>
      {nodes.map((node) => (
        <GoalTreeNode key={node.id} node={node} depth={depth} onEdit={onEdit} />
      ))}
    </div>
  )
}

function GoalTreeNode({
  node,
  depth,
  onEdit,
}: {
  node: GoalWithChildren
  depth: number
  onEdit?: (goal: Goal) => void
}): React.ReactElement {
  const [expanded, setExpanded] = useState(depth < 2) // Auto-expand first 2 levels
  const hasChildren = node.children.length > 0

  return (
    <div className="space-y-1.5 mb-2">
      <div className="flex items-center gap-1">
        {/* Expand toggle */}
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-text-muted hover:text-text-secondary text-xs w-4 h-4 flex items-center justify-center transition-colors"
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <div className="w-4" />
        )}

        {/* Goal card inline */}
        <div className="flex-1 min-w-0">
          <GoalCard goal={node} compact={depth > 0} onEdit={onEdit} />
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <GoalTree nodes={node.children} depth={depth + 1} onEdit={onEdit} />
      )}
    </div>
  )
}
