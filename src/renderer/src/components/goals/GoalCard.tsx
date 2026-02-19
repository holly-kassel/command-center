/**
 * GoalCard Component
 *
 * Compact card representing a single goal with progress ring,
 * category icon, title, and quick actions.
 */
import { useState } from 'react'
import { GoalProgress } from './GoalProgress'
import { useGoalStore } from '../../store/goalStore'
import type { Goal } from '@shared/types/goal'
import { GOAL_CATEGORY_LABELS, GOAL_LEVEL_LABELS, GOAL_STATUS_LABELS } from '@shared/types/goal'

interface GoalCardProps {
  goal: Goal
  compact?: boolean
  onEdit?: (goal: Goal) => void
}

export function GoalCard({ goal, compact = false, onEdit }: GoalCardProps): React.ReactElement {
  const updateGoal = useGoalStore((s) => s.updateGoal)
  const deleteGoal = useGoalStore((s) => s.deleteGoal)
  const [showActions, setShowActions] = useState(false)

  const categoryInfo = GOAL_CATEGORY_LABELS[goal.category]
  const statusInfo = GOAL_STATUS_LABELS[goal.status]

  const handleStatusToggle = async (): Promise<void> => {
    if (goal.status === 'active') {
      await updateGoal(goal.id, { status: 'completed' })
    } else if (goal.status === 'completed') {
      await updateGoal(goal.id, { status: 'active' })
    }
  }

  const handleDelete = async (): Promise<void> => {
    await deleteGoal(goal.id)
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-surface-muted/20 transition-colors group">
        <GoalProgress progress={goal.progress} size={28} strokeWidth={3} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium truncate ${goal.status === 'completed' ? 'text-text-muted line-through' : 'text-text-primary'}`}>
            {categoryInfo.icon} {goal.title}
          </p>
        </div>
        <span className={`text-[10px] ${statusInfo.color} opacity-0 group-hover:opacity-100 transition-opacity`}>
          {GOAL_LEVEL_LABELS[goal.level]}
        </span>
      </div>
    )
  }

  return (
    <div
      className="card p-3 space-y-2 group relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Header row */}
      <div className="flex items-center gap-2.5">
        <GoalProgress progress={goal.progress} size={36} strokeWidth={3.5} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${goal.status === 'completed' ? 'text-text-muted line-through' : 'text-text-primary'}`}>
            {goal.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px]">{categoryInfo.icon}</span>
            <span className="text-[10px] text-text-muted">{categoryInfo.label}</span>
            <span className="text-[10px] text-text-muted">·</span>
            <span className={`text-[10px] ${statusInfo.color}`}>{statusInfo.label}</span>
          </div>
        </div>

        {/* Level badge */}
        <span className="text-[10px] text-text-muted bg-surface-muted/30 rounded px-1.5 py-0.5">
          {GOAL_LEVEL_LABELS[goal.level]}
        </span>
      </div>

      {/* Description */}
      {goal.description && (
        <p className="text-xs text-text-secondary line-clamp-2">{goal.description}</p>
      )}

      {/* Progress bar */}
      <div className="w-full bg-surface-muted/20 rounded-full h-1.5">
        <div
          className="bg-focus/60 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, goal.progress)}%` }}
        />
      </div>

      {/* Quick actions overlay */}
      {showActions && (
        <div className="absolute top-2 right-2 flex gap-1">
          {onEdit && (
            <button
              onClick={() => onEdit(goal)}
              className="text-[10px] px-1.5 py-0.5 rounded bg-surface-muted/40 text-text-muted hover:text-text-primary transition-colors"
            >
              ✏️
            </button>
          )}
          <button
            onClick={handleStatusToggle}
            className="text-[10px] px-1.5 py-0.5 rounded bg-surface-muted/40 text-text-muted hover:text-text-primary transition-colors"
            title={goal.status === 'active' ? 'Complete' : 'Reopen'}
          >
            {goal.status === 'active' ? '✓' : '↩'}
          </button>
          <button
            onClick={handleDelete}
            className="text-[10px] px-1.5 py-0.5 rounded bg-surface-muted/40 text-text-muted hover:text-red-400 transition-colors"
            title="Delete"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
