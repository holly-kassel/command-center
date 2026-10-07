/**
 * Triage Notifier
 *
 * Tells Holly when a /triage job finishes. The overlay hides on blur and the
 * dashboard is usually in the background, so results get a native
 * notification. A dock badge counts unseen results, which covers Focus mode
 * and muted notifications.
 */
import { app, Notification } from 'electron'
import log from 'electron-log'
import type { TriageJob } from '../../../shared/types/triage'
import type { PasteTriageService } from './PasteTriageService'

/** Electron stops delivering clicks once a notification is garbage collected */
const MAX_TRACKED_NOTIFICATIONS = 20
const MAX_BODY_CHARS = 240

export interface TriageNotifierOptions {
  /** Shows the dashboard with this job expanded */
  focusJob: (jobId: string) => void
  /** Opens one of the job's drafts in Obsidian */
  openDraft: (jobId: string, index: number) => void
  /** True when the dashboard has focus, so its card already shows the result */
  isDashboardFocused: () => boolean
}

export interface TriageNotificationCopy {
  title: string
  body: string
}

/** Notification text for a finished job, or null when it shouldn't notify */
export function describeFinishedJob(job: TriageJob): TriageNotificationCopy | null {
  switch (job.status) {
    case 'done': {
      const lines = [capitalize(job.reason ?? '')]
      const [draft, ...more] = job.drafts
      if (draft) {
        lines.push(`Draft: ${draft.fileName}${more.length > 0 ? ` (+${more.length} more)` : ''}`)
      }
      return {
        title: `Triage: ${job.verdictLabel ?? job.verdict ?? 'done'}`,
        body: lines.filter(Boolean).join('\n')
      }
    }
    case 'no_verdict':
      return {
        title: 'Triage finished without a verdict',
        body: 'It may have a question for you. Click to read its reply.'
      }
    case 'failed':
      return { title: 'Triage failed', body: job.error ?? 'Click to see the output.' }
    case 'timed_out':
      return { title: 'Triage timed out', body: job.error ?? '' }
    default:
      return null
  }
}

/** Starts notifying and badging for finished jobs. Returns a function that stops it. */
export function startTriageNotifier(
  service: PasteTriageService,
  options: TriageNotifierOptions
): () => void {
  const tracked = new Set<Notification>()

  const show = (job: TriageJob, copy: TriageNotificationCopy): void => {
    const notification = new Notification({
      title: copy.title,
      subtitle: job.preview,
      body: truncate(copy.body, MAX_BODY_CHARS)
    })
    notification.on('click', () => {
      tracked.delete(notification)
      options.focusJob(job.id)
      if (job.drafts.length > 0) options.openDraft(job.id, 0)
    })
    notification.on('close', () => tracked.delete(notification))
    notification.on('failed', () => {
      tracked.delete(notification)
      log.warn(`[Triage] Notification for job ${job.id} didn't show`)
      app.dock?.bounce('informational')
    })
    tracked.add(notification)
    if (tracked.size > MAX_TRACKED_NOTIFICATIONS) {
      const oldest = tracked.values().next().value
      if (oldest) tracked.delete(oldest)
    }
    notification.show()
  }

  const stopFinished = service.onFinished((job) => {
    // Runs before the service's "changed" event, so the badge doesn't flash
    if (options.isDashboardFocused()) service.markAllSeen()
    const copy = describeFinishedJob(job)
    if (!copy) return
    if (!Notification.isSupported()) {
      app.dock?.bounce('informational')
      return
    }
    show(job, copy)
    if (job.status === 'failed' || job.status === 'timed_out') app.dock?.bounce('informational')
  })

  const updateBadge = (): void => {
    app.setBadgeCount(service.unseenCount())
  }
  const stopChanged = service.onChanged(updateBadge)
  updateBadge()

  return () => {
    stopFinished()
    stopChanged()
    tracked.clear()
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Cuts by code point so an emoji isn't split */
function truncate(text: string, maxChars: number): string {
  const chars = Array.from(text)
  return chars.length > maxChars
    ? `${chars
        .slice(0, maxChars - 1)
        .join('')
        .trimEnd()}…`
    : text
}
