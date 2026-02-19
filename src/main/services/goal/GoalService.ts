/**
 * GoalService
 *
 * Persistence and business logic for the hierarchical goal system.
 * Uses electron-store for local storage, same pattern as RitualService.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ElectronStore = require('electron-store')
import { randomUUID } from 'crypto'
import type {
  Goal,
  GoalWithChildren,
  GoalTaskLink,
  CreateGoalInput,
  UpdateGoalInput,
  GoalLevel,
  GoalCategory,
  GoalStatus,
} from '../../../shared/types/goal'

// ─── Store Schema ─────────────────────────────────────────

interface GoalStoreSchema {
  goals: Record<string, Goal>
  taskLinks: Record<string, GoalTaskLink>
}

const STORE_DEFAULTS: GoalStoreSchema = {
  goals: {},
  taskLinks: {},
}

// ─── Service ──────────────────────────────────────────────

let instance: GoalService | null = null

export function getGoalService(): GoalService {
  if (!instance) {
    instance = new GoalService()
  }
  return instance
}

export class GoalService {
  private store: InstanceType<typeof ElectronStore>

  constructor() {
    this.store = new ElectronStore({
      name: 'goal-data',
      defaults: STORE_DEFAULTS,
    })
  }

  // ─── CRUD ──────────────────────────────────────────

  createGoal(input: CreateGoalInput): Goal {
    const now = new Date().toISOString()
    const goal: Goal = {
      id: randomUUID(),
      title: input.title,
      description: input.description,
      level: input.level,
      category: input.category,
      status: 'active',
      parentId: input.parentId ?? null,
      progress: 0,
      progressMode: input.progressMode ?? 'manual',
      startDate: input.startDate ?? now.split('T')[0],
      targetDate: input.targetDate,
      createdAt: now,
      updatedAt: now,
    }
    this.store.set(`goals.${goal.id}`, goal)
    return goal
  }

  getGoal(id: string): Goal | null {
    return this.store.get(`goals.${id}`, null as unknown as Goal) ?? null
  }

  getAllGoals(): Goal[] {
    const goals = this.store.get('goals', {})
    return Object.values(goals)
  }

  updateGoal(id: string, updates: UpdateGoalInput): Goal | null {
    const existing = this.getGoal(id)
    if (!existing) return null

    const updated: Goal = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    // If status changed to completed, set completedDate
    if (updates.status === 'completed' && existing.status !== 'completed') {
      updated.completedDate = new Date().toISOString()
      updated.progress = 100
    }
    // If un-completing, clear completedDate
    if (updates.status && updates.status !== 'completed' && existing.status === 'completed') {
      updated.completedDate = undefined
    }

    this.store.set(`goals.${id}`, updated)
    return updated
  }

  deleteGoal(id: string): boolean {
    const existing = this.getGoal(id)
    if (!existing) return false

    // Delete any task links for this goal
    const links = this.getTaskLinksForGoal(id)
    for (const link of links) {
      this.store.delete(`taskLinks.${link.id}` as keyof GoalStoreSchema)
    }

    // Orphan children (set parentId to null) rather than cascade-delete
    const children = this.getChildren(id)
    for (const child of children) {
      this.store.set(`goals.${child.id}.parentId`, null)
    }

    this.store.delete(`goals.${id}` as keyof GoalStoreSchema)
    return true
  }

  // ─── Filtering ─────────────────────────────────────

  getGoalsByLevel(level: GoalLevel): Goal[] {
    return this.getAllGoals().filter((g) => g.level === level)
  }

  getGoalsByCategory(category: GoalCategory): Goal[] {
    return this.getAllGoals().filter((g) => g.category === category)
  }

  getGoalsByStatus(status: GoalStatus): Goal[] {
    return this.getAllGoals().filter((g) => g.status === status)
  }

  getActiveGoals(): Goal[] {
    return this.getGoalsByStatus('active')
  }

  // ─── Hierarchy ─────────────────────────────────────

  getChildren(parentId: string): Goal[] {
    return this.getAllGoals().filter((g) => g.parentId === parentId)
  }

  /** Returns top-level goals (no parent) */
  getRootGoals(): Goal[] {
    return this.getAllGoals().filter((g) => g.parentId === null)
  }

  /** Build a full tree starting from root goals */
  getGoalTree(): GoalWithChildren[] {
    const all = this.getAllGoals()
    const byParent = new Map<string | 'root', Goal[]>()

    for (const goal of all) {
      const key = goal.parentId ?? 'root'
      const list = byParent.get(key) || []
      list.push(goal)
      byParent.set(key, list)
    }

    const buildChildren = (parentId: string): GoalWithChildren[] => {
      const kids = byParent.get(parentId) || []
      return kids.map((g) => ({
        ...g,
        children: buildChildren(g.id),
      }))
    }

    const roots = byParent.get('root') || []
    return roots.map((g) => ({
      ...g,
      children: buildChildren(g.id),
    }))
  }

  /** Get goals that could be parents for a goal at the given level */
  getSuggestedParents(level: GoalLevel): Goal[] {
    const levelIndex = ['vision', 'yearly', 'quarterly', 'weekly'].indexOf(level)
    if (levelIndex <= 0) return [] // Vision goals have no parents

    const parentLevels = ['vision', 'yearly', 'quarterly', 'weekly'].slice(0, levelIndex)
    return this.getActiveGoals().filter((g) => parentLevels.includes(g.level))
  }

  // ─── Task Links ────────────────────────────────────

  linkTask(goalId: string, taskText: string): GoalTaskLink {
    const link: GoalTaskLink = {
      id: randomUUID(),
      goalId,
      taskText,
      completed: false,
      linkedAt: new Date().toISOString(),
    }
    this.store.set(`taskLinks.${link.id}`, link)
    return link
  }

  unlinkTask(linkId: string): boolean {
    const links = this.store.get('taskLinks', {})
    if (!links[linkId]) return false
    this.store.delete(`taskLinks.${linkId}` as keyof GoalStoreSchema)
    return true
  }

  getTaskLinksForGoal(goalId: string): GoalTaskLink[] {
    const links = this.store.get('taskLinks', {})
    return Object.values(links).filter((l) => l.goalId === goalId)
  }

  getAllTaskLinks(): GoalTaskLink[] {
    const links = this.store.get('taskLinks', {})
    return Object.values(links)
  }

  updateTaskCompletion(taskText: string, completed: boolean): GoalTaskLink[] {
    const links = this.store.get('taskLinks', {})
    const updated: GoalTaskLink[] = []

    for (const link of Object.values(links)) {
      if (link.taskText === taskText) {
        const updatedLink = { ...link, completed }
        this.store.set(`taskLinks.${link.id}`, updatedLink)
        updated.push(updatedLink)
      }
    }

    // Recalc progress for affected goals
    const goalIds = new Set(updated.map((l) => l.goalId))
    for (const goalId of goalIds) {
      this.recalculateProgress(goalId)
    }

    return updated
  }

  // ─── Progress ──────────────────────────────────────

  recalculateProgress(goalId: string): number {
    const goal = this.getGoal(goalId)
    if (!goal) return 0

    let progress = goal.progress

    if (goal.progressMode === 'tasks') {
      const links = this.getTaskLinksForGoal(goalId)
      if (links.length > 0) {
        const completed = links.filter((l) => l.completed).length
        progress = Math.round((completed / links.length) * 100)
      }
    } else if (goal.progressMode === 'children') {
      const children = this.getChildren(goalId)
      if (children.length > 0) {
        const totalProgress = children.reduce((sum, c) => sum + c.progress, 0)
        progress = Math.round(totalProgress / children.length)
      }
    }

    if (progress !== goal.progress) {
      this.store.set(`goals.${goalId}.progress`, progress)
      this.store.set(`goals.${goalId}.updatedAt`, new Date().toISOString())

      // Auto-complete if progress reaches 100
      if (progress >= 100 && goal.status === 'active') {
        this.store.set(`goals.${goalId}.status`, 'completed')
        this.store.set(`goals.${goalId}.completedDate`, new Date().toISOString())
      }
    }

    // Cascade up to parent
    if (goal.parentId) {
      const parent = this.getGoal(goal.parentId)
      if (parent?.progressMode === 'children') {
        this.recalculateProgress(goal.parentId)
      }
    }

    return progress
  }

  // ─── Summary ───────────────────────────────────────

  /** Quick stats for dashboard display */
  getSummary(): {
    totalActive: number
    byLevel: Record<GoalLevel, number>
    byCategory: Record<GoalCategory, number>
    completedThisWeek: number
  } {
    const active = this.getActiveGoals()
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay() + 1) // Monday
    weekStart.setHours(0, 0, 0, 0)

    const completedThisWeek = this.getAllGoals().filter(
      (g) =>
        g.status === 'completed' &&
        g.completedDate &&
        new Date(g.completedDate) >= weekStart
    ).length

    const byLevel = { vision: 0, yearly: 0, quarterly: 0, weekly: 0 } as Record<GoalLevel, number>
    const byCategory = {
      career: 0,
      health: 0,
      learning: 0,
      relationships: 0,
      finance: 0,
      creative: 0,
      personal: 0,
    } as Record<GoalCategory, number>

    for (const g of active) {
      byLevel[g.level]++
      byCategory[g.category]++
    }

    return {
      totalActive: active.length,
      byLevel,
      byCategory,
      completedThisWeek,
    }
  }
}
