/**
 * GoalsPanel Component
 *
 * Main goals view with level tabs, category filter, tree view,
 * and create button. Supports compact (dashboard) and full modes.
 */
import { useState, useMemo } from 'react'
import { useGoalStore } from '../../store/goalStore'
import { GoalTree } from './GoalTree'
import { GoalCard } from './GoalCard'
import { GoalForm } from './GoalForm'
import type { Goal, GoalCategory } from '@shared/types/goal'
import { GOAL_LEVEL_ORDER, GOAL_LEVEL_LABELS, GOAL_CATEGORY_LABELS } from '@shared/types/goal'

interface GoalsPanelProps {
  compact?: boolean
}

export function GoalsPanel({ compact = false }: GoalsPanelProps): React.ReactElement {
  const goals = useGoalStore((s) => s.goals)
  const goalTree = useGoalStore((s) => s.goalTree)
  const summary = useGoalStore((s) => s.summary)
  const isLoading = useGoalStore((s) => s.isLoading)
  const levelFilter = useGoalStore((s) => s.levelFilter)
  const categoryFilter = useGoalStore((s) => s.categoryFilter)
  const setLevelFilter = useGoalStore((s) => s.setLevelFilter)
  const setCategoryFilter = useGoalStore((s) => s.setCategoryFilter)

  const [showForm, setShowForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>()
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('list')

  // Filter goals for list view
  const filteredGoals = useMemo(() => {
    let result = goals.filter((g) => g.status === 'active')
    if (levelFilter !== 'all') {
      result = result.filter((g) => g.level === levelFilter)
    }
    if (categoryFilter !== 'all') {
      result = result.filter((g) => g.category === categoryFilter)
    }
    return result.sort((a, b) => {
      const levelDiff = GOAL_LEVEL_ORDER.indexOf(a.level) - GOAL_LEVEL_ORDER.indexOf(b.level)
      if (levelDiff !== 0) return levelDiff
      return b.progress - a.progress // Higher progress first within same level
    })
  }, [goals, levelFilter, categoryFilter])

  const handleEdit = (goal: Goal): void => {
    setEditingGoal(goal)
    setShowForm(true)
  }

  const handleCloseForm = (): void => {
    setShowForm(false)
    setEditingGoal(undefined)
  }

  if (isLoading) {
    return (
      <div className="card">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-20 bg-surface-muted/40 rounded" />
          <div className="h-12 bg-surface-muted/30 rounded" />
          <div className="h-12 bg-surface-muted/30 rounded" />
        </div>
      </div>
    )
  }

  // ─── Compact mode (dashboard widget) ──────────────

  if (compact) {
    const activeGoals = goals.filter((g) => g.status === 'active')
    const weeklyGoals = activeGoals.filter((g) => g.level === 'weekly')
    const displayGoals = weeklyGoals.length > 0 ? weeklyGoals : activeGoals.slice(0, 4)

    return (
      <div className="card space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary tracking-wide flex items-center gap-1.5">
            <span>🎯</span>
            Goals
          </h3>
          <div className="flex items-center gap-2">
            {summary && (
              <span className="text-[10px] text-text-muted">
                {summary.totalActive} active · {summary.completedThisWeek} done this week
              </span>
            )}
            <button
              onClick={() => setShowForm(true)}
              className="text-xs text-focus hover:text-focus/80 transition-colors"
              title="New goal"
            >
              +
            </button>
          </div>
        </div>

        {displayGoals.length === 0 ? (
          <p className="text-xs text-text-muted py-2 text-center">
            No active goals. Tap + to add one.
          </p>
        ) : (
          <div className="space-y-0.5">
            {displayGoals.map((g) => (
              <GoalCard key={g.id} goal={g} compact onEdit={handleEdit} />
            ))}
          </div>
        )}

        {showForm && <GoalForm editGoal={editingGoal} onClose={handleCloseForm} />}
      </div>
    )
  }

  // ─── Full mode ────────────────────────────────────

  return (
    <div className="card space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary tracking-wide flex items-center gap-1.5">
          <span>🎯</span>
          Goals
        </h3>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex bg-surface-muted/20 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`text-[10px] px-2 py-0.5 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-focus/20 text-focus' : 'text-text-muted'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`text-[10px] px-2 py-0.5 rounded-md transition-colors ${
                viewMode === 'tree' ? 'bg-focus/20 text-focus' : 'text-text-muted'
              }`}
            >
              Tree
            </button>
          </div>

          <button
            onClick={() => setShowForm(true)}
            className="text-xs px-2.5 py-1 bg-focus/15 text-focus border border-focus/30 rounded-lg hover:bg-focus/25 transition-colors"
          >
            + New Goal
          </button>
        </div>
      </div>

      {/* Level tabs */}
      <div className="flex gap-1">
        <button
          onClick={() => setLevelFilter('all')}
          className={`text-[10px] px-2.5 py-1 rounded-lg transition-colors ${
            levelFilter === 'all'
              ? 'bg-focus/15 text-focus border border-focus/30'
              : 'text-text-muted hover:text-text-secondary bg-surface-muted/10'
          }`}
        >
          All
        </button>
        {GOAL_LEVEL_ORDER.map((level) => (
          <button
            key={level}
            onClick={() => setLevelFilter(level)}
            className={`text-[10px] px-2.5 py-1 rounded-lg transition-colors ${
              levelFilter === level
                ? 'bg-focus/15 text-focus border border-focus/30'
                : 'text-text-muted hover:text-text-secondary bg-surface-muted/10'
            }`}
          >
            {GOAL_LEVEL_LABELS[level]}
          </button>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`text-[10px] px-2 py-0.5 rounded-md transition-colors ${
            categoryFilter === 'all'
              ? 'bg-accent/15 text-accent'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          All
        </button>
        {(Object.entries(GOAL_CATEGORY_LABELS) as [GoalCategory, { label: string; icon: string }][]).map(
          ([key, { icon }]) => (
            <button
              key={key}
              onClick={() => setCategoryFilter(key)}
              className={`text-[10px] px-2 py-0.5 rounded-md transition-colors ${
                categoryFilter === key
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
              title={GOAL_CATEGORY_LABELS[key].label}
            >
              {icon}
            </button>
          )
        )}
      </div>

      {/* Content */}
      {viewMode === 'tree' ? (
        goalTree.length === 0 ? (
          <p className="text-xs text-text-muted py-4 text-center">
            No goals yet. Create one to get started.
          </p>
        ) : (
          <GoalTree nodes={goalTree} onEdit={handleEdit} />
        )
      ) : filteredGoals.length === 0 ? (
        <p className="text-xs text-text-muted py-4 text-center">
          {levelFilter === 'all' && categoryFilter === 'all'
            ? 'No active goals yet. Create one to get started.'
            : 'No matching goals. Try adjusting filters.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredGoals.map((g) => (
            <GoalCard key={g.id} goal={g} onEdit={handleEdit} />
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && <GoalForm editGoal={editingGoal} onClose={handleCloseForm} />}
    </div>
  )
}
