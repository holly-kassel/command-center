import type { MeetingActionItem, MeetingNotes } from '../../../shared/types/transcription'

function reviewKey(item: MeetingActionItem): string {
  const owner = item.owner?.email || item.owner?.displayName || 'unknown'
  return `${owner}|${item.description}`
    .toLowerCase()
    .replace(/[^a-z0-9@|]+/g, ' ')
    .trim()
}

export function preserveActionReviews(
  incoming: MeetingNotes,
  current: MeetingNotes | null
): MeetingNotes {
  if (!current) return incoming
  const reviews = new Map<string, MeetingActionItem['reviewStatus']>()
  for (const item of [...current.actionItems, ...current.suggestedFollowUps]) {
    if (item.reviewStatus !== 'needs-review') reviews.set(reviewKey(item), item.reviewStatus)
  }
  const apply = (items: MeetingActionItem[]): MeetingActionItem[] =>
    items.map((item) => {
      const reviewStatus = reviews.get(reviewKey(item))
      return reviewStatus ? { ...item, reviewStatus } : item
    })
  const actionItems = apply(incoming.actionItems)
  return {
    ...incoming,
    actionItems,
    myActionItems: actionItems.filter(
      (item) => item.isCurrentUser && item.reviewStatus === 'accepted'
    ),
    suggestedFollowUps: apply(incoming.suggestedFollowUps)
  }
}
