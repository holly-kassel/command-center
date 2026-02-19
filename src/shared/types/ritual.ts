/**
 * Ritual & Streak Types
 *
 * Shared types for the morning/evening ritual system and streak tracking.
 */

// ─── Streak Types ─────────────────────────────────────────────

export type StreakType = 'morning_ritual' | 'evening_ritual' | 'full_day' | 'focus'

export interface Streak {
  streakType: StreakType
  currentCount: number
  bestCount: number
  lastDate: string // YYYY-MM-DD
}

// ─── Daily Log ────────────────────────────────────────────────

export interface DailyLog {
  date: string // YYYY-MM-DD
  morningRitualCompleted: boolean
  morningRitualTime: string | null // ISO timestamp
  intention: string | null
  eveningRitualCompleted: boolean
  eveningRitualTime: string | null // ISO timestamp
  reflection: {
    wentWell: string
    couldImprove: string
  } | null
  gratitude: string | null
  untrackedWins: string | null
  focusAchieved: boolean
  energyLevel: number | null // 1-5
}

// ─── Ritual Steps ─────────────────────────────────────────────

export interface RitualStep {
  id: string
  title: string
  description: string
  durationSeconds?: number
}

export const MORNING_RITUAL_STEPS: RitualStep[] = [
  {
    id: 'breathe',
    title: 'Breathe',
    description: 'Center yourself with a 4-7-8 breathing exercise',
    durationSeconds: 60,
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Check your focus and upcoming meetings',
  },
  {
    id: 'intention',
    title: 'Intention',
    description: 'Set your intention for today',
  },
  {
    id: 'focus',
    title: 'Commit',
    description: 'Commit to your focus for the day',
  },
]

export const EVENING_RITUAL_STEPS: RitualStep[] = [
  {
    id: 'wins',
    title: 'Wins',
    description: 'Celebrate what you accomplished today',
  },
  {
    id: 'reflect',
    title: 'Reflect',
    description: 'What went well and what could improve',
  },
  {
    id: 'gratitude',
    title: 'Gratitude',
    description: 'What are you grateful for today?',
  },
  {
    id: 'tomorrow',
    title: 'Tomorrow',
    description: "Preview tomorrow's schedule and tasks",
  },
]

// ─── Ritual Data ──────────────────────────────────────────────

export interface MorningRitualResult {
  intention: string
  focusCommitted: boolean
}

export interface EveningRitualResult {
  untrackedWins: string
  wentWell: string
  couldImprove: string
  gratitude: string
  energyLevel: number
}

// ─── Weekly Metrics ───────────────────────────────────────────

export interface WeeklyRitualMetrics {
  weekStart: string // YYYY-MM-DD
  morningCompleted: number
  eveningCompleted: number
  fullDays: number
  focusDays: number
  averageEnergy: number | null
  dailyStatuses: Array<{
    date: string
    morning: boolean
    evening: boolean
  }>
}
