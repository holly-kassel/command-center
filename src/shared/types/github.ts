/**
 * GitHub-specific type definitions
 * Used across main + renderer via preload bridge
 */

/** Reasons a notification was sent to the user */
export type NotificationReason =
  | 'review_requested'
  | 'mention'
  | 'assign'
  | 'team_mention'
  | 'subscribed'
  | 'comment'
  | 'ci_activity'
  | 'approval_requested'
  | 'state_change'
  | 'other'

/** GitHub notification subject type */
export type NotificationSubjectType = 'PullRequest' | 'Issue' | 'Discussion' | 'other'

/** A GitHub notification from the github org */
export interface GitHubNotification {
  id: string
  title: string
  reason: NotificationReason
  repository: string
  url: string
  updatedAt: string
  unread: boolean
  type: NotificationSubjectType
}

/** GitHub connection state exposed to renderer */
export interface GitHubStatus {
  configured: boolean
  connected: boolean
}
