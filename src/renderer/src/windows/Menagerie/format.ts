import type {
  Automation,
  AutomationState,
  CritterStatus,
  PendingPermission,
  PermissionKind
} from '../../../../shared/types/menagerie'
import { automationState, dayKey, shiftDay } from '../../../../shared/types/menagerie'

export const FONT = 'ui-monospace, Menlo, monospace'
export const INK = '#2a2320'
export const PAPER = '#fffaf0'

export const STATUS_LABEL: Record<CritterStatus, string> = {
  working: 'Working',
  waiting: 'Waiting for you',
  idle: 'Idle',
  recent: 'Recently active',
  done: 'Finished'
}

export const STATUS_COLOR: Record<CritterStatus, string> = {
  working: '#43c466',
  waiting: '#ffd84d',
  idle: '#9fb7ff',
  recent: '#c9a24f',
  done: '#8a8f99'
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - Date.parse(iso))
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export const AUTOMATION_STATE_LABEL: Record<AutomationState, string> = {
  waiting: 'Needs you',
  running: 'Running now',
  failed: 'Last run failed',
  paused: 'Paused',
  idle: 'Idle'
}

export const AUTOMATION_STATE_COLOR: Record<AutomationState, string> = {
  waiting: '#ffd84d',
  running: '#43c466',
  failed: '#e5484d',
  paused: '#8a8f99',
  idle: '#9fb7ff'
}

/** A calendar-ish time: "today 4:30 PM", "tomorrow 9:00 AM", "Mon 8:00 AM", "Oct 20 9:00 AM" */
export function whenLabel(iso: string, now = new Date()): string {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return iso
  const time = t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const day = dayKey(t)
  const today = dayKey(now)
  if (day === today) return `today ${time}`
  if (day === shiftDay(today, 1)) return `tomorrow ${time}`
  if (day === shiftDay(today, -1)) return `yesterday ${time}`
  if (Math.abs(t.getTime() - now.getTime()) < 6 * 86_400_000) {
    return `${t.toLocaleDateString([], { weekday: 'short' })} ${time}`
  }
  return `${t.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`
}

/** "next today 4:30 PM", or "due …" once the scheduled time has passed */
export function nextRunLabel(iso: string, now = new Date()): string {
  const overdue = Date.parse(iso) < now.getTime()
  return `${overdue ? 'due' : 'next'} ${whenLabel(iso, now)}`
}

/** One-line status for a decoration label or list row: "running now", "next today 4:30 PM", … */
export function automationStatusShort(a: Automation, now = new Date()): string {
  const state = automationState(a)
  if (state === 'idle' && a.nextRunAt) return nextRunLabel(a.nextRunAt, now)
  return AUTOMATION_STATE_LABEL[state].toLowerCase()
}

export type DayPhase = 'day' | 'dusk' | 'night' | 'dawn'

export interface TimeOfDay {
  phase: DayPhase
  /** 0 at full day → 1 at full night */
  dark: number
}

/** Local clock → how dark the village should be drawn. */
export function timeOfDay(date = new Date()): TimeOfDay {
  const h = date.getHours() + date.getMinutes() / 60
  if (h >= 7 && h < 18) return { phase: 'day', dark: 0 }
  if (h >= 18 && h < 20) return { phase: 'dusk', dark: (h - 18) / 2 }
  if (h >= 5 && h < 7) return { phase: 'dawn', dark: 1 - (h - 5) / 2 }
  return { phase: 'night', dark: 1 }
}

/** Shorten tool titles so they fit in a pixel thought bubble. */
export function truncate(text: string, max = 18): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export const PERMISSION_VERB: Record<PermissionKind, string> = {
  shell: 'wants to run',
  write: 'wants to write',
  read: 'wants to read',
  path: 'wants to touch',
  url: 'wants to fetch',
  mcp: 'wants to call',
  'custom-tool': 'wants to use',
  extension: 'asks for access',
  memory: 'wants to remember',
  other: 'needs permission'
}

export const PERMISSION_ICON: Record<PermissionKind, string> = {
  shell: '⌘',
  write: '✎',
  read: '👀',
  path: '📁',
  url: '🌐',
  mcp: '🔌',
  'custom-tool': '🧰',
  extension: '🧩',
  memory: '🧠',
  other: '❓'
}

/** Short path/command for a bubble: last two path segments, or the first command token run. */
export function shortDetail(p: PendingPermission, max = 60): string | null {
  if (!p.detail) return null
  let d = p.detail.replace(/\s+/g, ' ').trim()
  if ((p.kind === 'write' || p.kind === 'read' || p.kind === 'path') && d.includes('/')) {
    const parts = d.split('/')
    d = parts.slice(-2).join('/')
  }
  return d.length > max ? d.slice(0, max - 1) + '…' : d
}
