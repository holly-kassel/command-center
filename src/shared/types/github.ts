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

/** PR review status */
export type PRReviewStatus = 'approved' | 'changes_requested' | 'review_required' | 'commented' | 'pending'

/** PR merge state */
export type PRState = 'open' | 'closed' | 'merged'

/** How the user is involved in this PR */
export type PRInvolvement = 'author' | 'review_requested' | 'assigned' | 'mentioned'

/** A GitHub pull request involving the user */
export interface GitHubPullRequest {
  id: number
  number: number
  title: string
  repository: string
  url: string
  state: PRState
  draft: boolean
  author: string
  involvement: PRInvolvement
  reviewStatus: PRReviewStatus
  createdAt: string
  updatedAt: string
  additions: number
  deletions: number
}
