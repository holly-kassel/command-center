import type {
  CritterStatus,
  PendingPermission,
  PermissionKind
} from '../../../../shared/types/menagerie'

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
