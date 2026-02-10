// Shared types used across main + renderer via preload bridge

/** IPC channel names — keep in sync between main & preload */
export const IPC_CHANNELS = {
  // Obsidian
  OBSIDIAN_GET_TASKS: 'obsidian:get-tasks',
  OBSIDIAN_GET_WEEKLY_NOTE: 'obsidian:get-weekly-note',
  OBSIDIAN_APPEND_TO_DAY: 'obsidian:append-to-day',

  // Calendar
  CALENDAR_GET_EVENTS: 'calendar:get-events',

  // GitHub
  GITHUB_GET_NOTIFICATIONS: 'github:get-notifications',
  GITHUB_GET_PRS: 'github:get-prs',

  // App
  APP_GET_CONFIG: 'app:get-config',
  APP_SET_CONFIG: 'app:set-config',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

/** Task priority levels */
export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none'

/** A task parsed from an Obsidian note */
export interface Task {
  id: string
  text: string
  completed: boolean
  priority: Priority
  source: string // file path
  line: number
  dueDate?: string
  tags: string[]
}

/** A calendar event from Microsoft Graph */
export interface CalendarEvent {
  id: string
  subject: string
  start: string // ISO datetime
  end: string
  isAllDay: boolean
  location?: string
  organizer?: string
}

/** A GitHub notification */
export interface GitHubNotification {
  id: string
  title: string
  type: string // 'PullRequest' | 'Issue' | etc
  repo: string
  url: string
  reason: string
  updatedAt: string
  unread: boolean
}
