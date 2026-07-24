import type { MeetingActionItem, SavedMeeting } from './types/transcription'

export function formatMeetingDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  if (minutes === 0) return `${remainder}s`
  return `${minutes}m${remainder > 0 ? ` ${remainder}s` : ''}`
}

export function acceptedMeetingActions(items: MeetingActionItem[]): MeetingActionItem[] {
  return items.filter((item) => item.reviewStatus === 'accepted')
}

export function formatMeetingAction(item: MeetingActionItem): string {
  const details: string[] = []
  if (item.owner?.displayName) details.push(item.owner.displayName)
  if (item.dueDate) details.push(`due ${item.dueDate}`)
  return details.length > 0 ? `${item.description} (${details.join(', ')})` : item.description
}

function appendList(lines: string[], heading: string, items: string[], checkbox = false): void {
  if (items.length === 0) return
  lines.push(heading, '')
  for (const item of items) lines.push(checkbox ? `- [ ] ${item}` : `- ${item}`)
  lines.push('')
}

export function formatMeetingMarkdown(meeting: SavedMeeting): string {
  const lines: string[] = [`# ${meeting.title}`, '']
  const activeArtifact = meeting.transcriptArtifacts[meeting.activeTranscriptSource]
  lines.push(
    `**Date:** ${new Date(meeting.createdAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
    `**Duration:** ${formatMeetingDuration(meeting.duration)}`,
    `**Transcript source:** ${meeting.activeTranscriptSource === 'teams' ? 'Microsoft Teams' : 'Local microphone'}`,
    `**Speaker attribution:** ${activeArtifact?.attribution === 'verified' ? 'Verified' : 'Unverified'}`
  )
  if (meeting.speakers.length > 0) lines.push(`**Speakers:** ${meeting.speakers.join(', ')}`)
  lines.push('')

  const notes = meeting.notes
  if (notes) {
    if (notes.summary) lines.push('## Summary', '', notes.summary, '')
    appendList(lines, '## Key topics', notes.keyTopics)
    appendList(lines, '## Key points', notes.keyPoints)

    const personalActions = acceptedMeetingActions(notes.myActionItems)
    const personalIds = new Set(personalActions.map((item) => item.id))
    const otherActions = acceptedMeetingActions(notes.actionItems).filter(
      (item) => !personalIds.has(item.id)
    )
    const acceptedFollowUps = acceptedMeetingActions(notes.suggestedFollowUps)
    appendList(lines, '## My action items', personalActions.map(formatMeetingAction), true)
    appendList(lines, '## Other action items', otherActions.map(formatMeetingAction), true)
    appendList(lines, '## Accepted follow-ups', acceptedFollowUps.map(formatMeetingAction), true)
    appendList(lines, '## Decisions', notes.decisions)
    appendList(lines, '## Open questions', notes.openQuestions)
  }

  if (meeting.manualNotes.trim()) lines.push('## My notes', '', meeting.manualNotes.trim(), '')
  if (meeting.segments.length > 0) {
    lines.push('## Transcript', '')
    for (const segment of meeting.segments) {
      lines.push(`**${segment.speaker} [${segment.timestamp}]:** ${segment.text}`)
    }
    lines.push('')
  }
  return lines.join('\n').trimEnd() + '\n'
}

export function formatMeetingForWeekly(meeting: SavedMeeting, transcriptLink?: string): string {
  const lines: string[] = [`#### ${meeting.title} (${formatMeetingDuration(meeting.duration)})`, '']
  if (transcriptLink) lines.push(transcriptLink, '')
  const notes = meeting.notes
  if (notes?.summary) lines.push(`**Summary:** ${notes.summary}`, '')
  if (notes?.keyPoints.length) appendList(lines, '**Key points:**', notes.keyPoints)
  if (notes) {
    const personal = acceptedMeetingActions(notes.myActionItems)
    const personalIds = new Set(personal.map((item) => item.id))
    const others = acceptedMeetingActions(notes.actionItems).filter(
      (item) => !personalIds.has(item.id)
    )
    appendList(lines, '**My action items:**', personal.map(formatMeetingAction), true)
    appendList(lines, '**Other action items:**', others.map(formatMeetingAction), true)
  }
  return lines.join('\n').trimEnd()
}
