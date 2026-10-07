/**
 * Shared Triage Types
 *
 * A /triage job hands one paste, link, or screenshot to
 * billing-projects/scripts/triage.sh in the background and records the verdict.
 */

/** Canonical verdicts, in the order triage_runner.parse_verdict checks them */
export const TRIAGE_VERDICTS = ['respond now', 'redirect', 'Friday block', 'no action'] as const

export type TriageVerdict = (typeof TRIAGE_VERDICTS)[number]

export type TriageJobStatus =
  | 'queued'
  | 'running'
  | 'done'
  | 'no_verdict'
  | 'failed'
  | 'timed_out'
  | 'cancelled'

/** A draft reply the triage agent saved in the vault */
export interface TriageDraft {
  /** Vault-relative path with forward slashes */
  relativePath: string
  fileName: string
}

export interface TriageJob {
  id: string
  status: TriageJobStatus
  /** First line of the item, shortened, so the card can tell jobs apart */
  preview: string
  imageCount: number
  queuedAt: number
  startedAt?: number
  finishedAt?: number
  verdict?: TriageVerdict
  /** Verdict phrase for display, e.g. "Redirect to @sam" */
  verdictLabel?: string
  /** The "why" clause after the verdict */
  reason?: string
  drafts: TriageDraft[]
  /** Combined stdout and stderr, trimmed to the first and last 8 KB */
  output?: string
  error?: string
  exitCode?: number | null
  /** True until the main window has been focused since the job finished */
  unseen: boolean
}
