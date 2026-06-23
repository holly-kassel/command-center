/**
 * Goal Types
 *
 * Hierarchical goal system with 4 levels, categories,
 * progress tracking, and task-link support.
 */

// ─── Enums / Unions ─────────────────────────────────────────

/** Goal hierarchy levels — cascade from vision down to daily */
export type GoalLevel = 'vision' | 'yearly' | 'quarterly' | 'weekly'

/** Broad life/work categories for filtering */
export type GoalCategory =
  | 'career'
  | 'health'
  | 'learning'
  | 'relationships'
  | 'finance'
  | 'creative'
  | 'personal'

/** Lifecycle states */
export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned'

/** Used for time-scoped queries */
export type TimePeriod = 'week' | 'month' | 'quarter' | 'year'

// ─── Core Models ────────────────────────────────────────────

export interface Goal {
  id: string
  title: string
  description?: string
  level: GoalLevel
  category: GoalCategory
  status: GoalStatus

  /** ID of the parent goal (null for top-level) */
  parentId: string | null

  /** 0-100 progress percentage */
  progress: number

  /** How progress is calculated */
  progressMode: 'manual' | 'tasks' | 'children'

  /** ISO date strings */
  startDate: string
  targetDate?: string
  completedDate?: string
  createdAt: string
  updatedAt: string
}

/** Goal with resolved children for tree rendering */
export interface GoalWithChildren extends Goal {
  children: GoalWithChildren[]
}

/** Links a task (from Obsidian checklist) to a goal */
export interface GoalTaskLink {
  id: string
  goalId: string
  /** The task text as it appears in Obsidian */
  taskText: string
  /** Whether the task is checked off */
  completed: boolean
  /** ISO date the link was created */
  linkedAt: string
}

// ─── Input Types ────────────────────────────────────────────

export interface CreateGoalInput {
  title: string
  description?: string
  level: GoalLevel
  category: GoalCategory
  parentId?: string
  progressMode?: 'manual' | 'tasks' | 'children'
  startDate?: string
  targetDate?: string
}

export interface UpdateGoalInput {
  title?: string
  description?: string
  category?: GoalCategory
  status?: GoalStatus
  parentId?: string | null
  progress?: number
  progressMode?: 'manual' | 'tasks' | 'children'
  targetDate?: string
}

// ─── View Helpers ───────────────────────────────────────────

export const GOAL_LEVEL_ORDER: GoalLevel[] = ['vision', 'yearly', 'quarterly', 'weekly']

export const GOAL_LEVEL_LABELS: Record<GoalLevel, string> = {
  vision: 'Vision',
  yearly: 'Yearly',
  quarterly: 'Quarterly',
  weekly: 'Weekly',
}

export const GOAL_CATEGORY_LABELS: Record<GoalCategory, { label: string; icon: string }> = {
  career: { label: 'Career', icon: '💼' },
  health: { label: 'Health', icon: '🏃' },
  learning: { label: 'Learning', icon: '📚' },
  relationships: { label: 'Relationships', icon: '🤝' },
  finance: { label: 'Finance', icon: '💰' },
  creative: { label: 'Creative', icon: '🎨' },
  personal: { label: 'Personal', icon: '🌱' },
}

export const GOAL_STATUS_LABELS: Record<GoalStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: 'text-focus' },
  completed: { label: 'Completed', color: 'text-green-400' },
  paused: { label: 'Paused', color: 'text-warning' },
  abandoned: { label: 'Abandoned', color: 'text-text-muted' },
}

/** Status of a kanban task */
export type KanbanStatus = 'todo' | 'in_progress' | 'done'

/** Where the task originated from */
export type KanbanTaskSource = 'manual' | 'slash_command' | 'triage'

/** A task on the kanban board */
export interface KanbanTask {
  id: string
  text: string
  status: KanbanStatus
  createdAt: string
  completedAt: string | null
  /** Which date (YYYY-MM-DD) the task was completed on — for daily logging */
  completedDate: string | null
  /** Where this task came from */
  source: KanbanTaskSource
  /** If from triage, the notification ID for linking */
  sourceNotificationId: string | null
  /** If from triage, the GitHub URL */
  sourceUrl: string | null
  /** Position within its column (lower = higher on board) */
  position: number
}

export const KANBAN_STATUS_LABELS: Record<KanbanStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}
