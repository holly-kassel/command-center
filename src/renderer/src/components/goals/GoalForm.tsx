/**
 * GoalForm Component
 *
 * Modal form for creating or editing a goal.
 * Supports parent selection, level, category, and progress mode.
 */
import { useState, useEffect } from 'react'
import { useGoalStore } from '../../store/goalStore'
import type {
  Goal,
  GoalLevel,
  GoalCategory,
  CreateGoalInput,
} from '@shared/types/goal'
import {
  GOAL_LEVEL_ORDER,
  GOAL_LEVEL_LABELS,
  GOAL_CATEGORY_LABELS,
} from '@shared/types/goal'

interface GoalFormProps {
  /** Pass a goal to enter edit mode; omit for create */
  editGoal?: Goal
  onClose: () => void
}

export function GoalForm({ editGoal, onClose }: GoalFormProps): React.ReactElement {
  const createGoal = useGoalStore((s) => s.createGoal)
  const updateGoal = useGoalStore((s) => s.updateGoal)

  const [title, setTitle] = useState(editGoal?.title ?? '')
  const [description, setDescription] = useState(editGoal?.description ?? '')
  const [level, setLevel] = useState<GoalLevel>(editGoal?.level ?? 'weekly')
  const [category, setCategory] = useState<GoalCategory>(editGoal?.category ?? 'career')
  const [progressMode, setProgressMode] = useState<'manual' | 'tasks' | 'children'>(
    editGoal?.progressMode ?? 'manual'
  )
  const [parentId, setParentId] = useState<string | undefined>(editGoal?.parentId ?? undefined)
  const [targetDate, setTargetDate] = useState(editGoal?.targetDate?.split('T')[0] ?? '')
  const [suggestedParents, setSuggestedParents] = useState<Goal[]>([])
  const [saving, setSaving] = useState(false)

  // Load suggested parents when level changes
  useEffect(() => {
    window.api.goal.getSuggestedParents(level).then(setSuggestedParents)
  }, [level])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    try {
      if (editGoal) {
        await updateGoal(editGoal.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          progressMode,
          parentId: parentId ?? null,
          targetDate: targetDate || undefined,
        })
      } else {
        const input: CreateGoalInput = {
          title: title.trim(),
          description: description.trim() || undefined,
          level,
          category,
          progressMode,
          parentId,
          targetDate: targetDate || undefined,
        }
        await createGoal(input)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md bg-background border border-surface-border/40 rounded-xl shadow-2xl p-5 space-y-4"
      >
        <h2 className="text-sm font-semibold text-text-primary">
          {editGoal ? 'Edit Goal' : 'New Goal'}
        </h2>

        {/* Title */}
        <div>
          <label className="block text-xs text-text-muted mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-surface-muted/20 border border-surface-border/30 rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-focus/50 focus:outline-none"
            placeholder="e.g., Ship billing dashboard v2"
            autoFocus
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs text-text-muted mb-1">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full bg-surface-muted/20 border border-surface-border/30 rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-focus/50 focus:outline-none resize-none"
            placeholder="What does success look like?"
          />
        </div>

        {/* Level + Category row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Level</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as GoalLevel)}
              disabled={!!editGoal}
              className="w-full bg-surface-muted/20 border border-surface-border/30 rounded-lg px-3 py-2 text-sm text-text-primary focus:border-focus/50 focus:outline-none disabled:opacity-50"
            >
              {GOAL_LEVEL_ORDER.map((l) => (
                <option key={l} value={l}>
                  {GOAL_LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as GoalCategory)}
              className="w-full bg-surface-muted/20 border border-surface-border/30 rounded-lg px-3 py-2 text-sm text-text-primary focus:border-focus/50 focus:outline-none"
            >
              {(Object.entries(GOAL_CATEGORY_LABELS) as [GoalCategory, { label: string; icon: string }][]).map(
                ([key, { label, icon }]) => (
                  <option key={key} value={key}>
                    {icon} {label}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        {/* Progress Mode */}
        <div>
          <label className="block text-xs text-text-muted mb-1">Progress tracking</label>
          <div className="flex gap-2">
            {(['manual', 'tasks', 'children'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setProgressMode(mode)}
                className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                  progressMode === mode
                    ? 'bg-focus/15 border-focus/40 text-focus'
                    : 'bg-surface-muted/10 border-surface-border/20 text-text-muted hover:text-text-secondary'
                }`}
              >
                {mode === 'manual' ? 'Manual' : mode === 'tasks' ? 'From Tasks' : 'From Children'}
              </button>
            ))}
          </div>
        </div>

        {/* Parent goal */}
        {suggestedParents.length > 0 && (
          <div>
            <label className="block text-xs text-text-muted mb-1">Parent goal (optional)</label>
            <select
              value={parentId ?? ''}
              onChange={(e) => setParentId(e.target.value || undefined)}
              className="w-full bg-surface-muted/20 border border-surface-border/30 rounded-lg px-3 py-2 text-sm text-text-primary focus:border-focus/50 focus:outline-none"
            >
              <option value="">None</option>
              {suggestedParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {GOAL_CATEGORY_LABELS[p.category].icon} {p.title} ({GOAL_LEVEL_LABELS[p.level]})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Target date */}
        <div>
          <label className="block text-xs text-text-muted mb-1">Target date (optional)</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full bg-surface-muted/20 border border-surface-border/30 rounded-lg px-3 py-2 text-sm text-text-primary focus:border-focus/50 focus:outline-none"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || saving}
            className="px-4 py-1.5 text-xs font-medium bg-focus/20 text-focus border border-focus/30 rounded-lg hover:bg-focus/30 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : editGoal ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}
