/**
 * Parse triage.sh output
 *
 * The verdict match is a port of parse_verdict in
 * billing-projects/python/evals/evals/triage_runner.py, so the app and the
 * triage evals agree on what counts as a verdict. Label, reason, and draft
 * extraction are app-only extras for the notification and dashboard card.
 *
 * Pure: no file system access. Draft candidates are unvalidated strings;
 * PasteTriageService checks that each one is a real file inside the vault.
 */
import { TRIAGE_VERDICTS, type TriageVerdict } from '../../../shared/types/triage'

export interface ParsedTriageOutput {
  verdict?: TriageVerdict
  /** Display form of the verdict, e.g. "Redirect to @sam" */
  verdictLabel?: string
  /** The "why" clause after the verdict */
  reason?: string
  /** Raw path strings from "Draft:" lines, in order, not yet validated */
  draftCandidates: string[]
}

// Same pattern and flags as parse_verdict
const VERDICT_RE = /Verdict:\s*\**\s*([^\n,.]+)/i
const DRAFT_LINE_RE = /^[ \t>*-]*Draft[*_]*[ \t]*:[*_]*[ \t]*(.+)$/gim
const MD_PATH_RE = /^(.*?\.md)(?=$|[\s)\]"'`,;:!?.*>])/i

const LABEL_MAX = 60
const REASON_MAX = 300
const MAX_DRAFT_CANDIDATES = 10

/** Python's str.strip("*` ") */
function stripMarkup(value: string): string {
  return value.replace(/^[*` ]+|[*` ]+$/g, '')
}

/** Port of parse_verdict: the first "Verdict:" line decides. */
export function parseVerdict(text: string): TriageVerdict | undefined {
  const match = VERDICT_RE.exec(text)
  if (!match) return undefined
  const found = stripMarkup(match[1].trim()).toLowerCase()
  return TRIAGE_VERDICTS.find((verdict) => found.startsWith(verdict.toLowerCase()))
}

export function parseTriageOutput(text: string): ParsedTriageOutput {
  const draftCandidates = extractDraftCandidates(text)
  const match = VERDICT_RE.exec(text)
  if (!match) return { draftCandidates }

  const phrase = stripMarkup(match[1].trim())
  const verdict = TRIAGE_VERDICTS.find((v) => phrase.toLowerCase().startsWith(v.toLowerCase()))
  if (!verdict) return { draftCandidates }

  // The rest of the verdict line, starting where the phrase starts. \s* in the
  // pattern can cross a newline, so start from the captured group, not the label.
  const groupStart = match.index + match[0].length - match[1].length
  const lineEnd = text.indexOf('\n', groupStart)
  const body = text.slice(groupStart, lineEnd === -1 ? undefined : lineEnd).replace(/^[*`\s]+/, '')

  const head = verdict === 'redirect' ? redirectHead(phrase) : body.slice(0, verdict.length)
  const reason = body.toLowerCase().startsWith(head.toLowerCase())
    ? cleanReason(body.slice(head.length))
    : undefined

  return {
    verdict,
    verdictLabel: toLabel(verdict === 'redirect' ? head : verdict),
    reason,
    draftCandidates
  }
}

/** "redirect to @owner, why" keeps the owner in the label */
function redirectHead(phrase: string): string {
  const handle = /^redirect\b.*?@[\w-]+(?:\/[\w-]+)?/i.exec(phrase)
  if (handle) return handle[0]
  return phrase.split(/\s+[-—–]\s+|\s*[—–]\s*/)[0].trim()
}

function toLabel(value: string): string {
  const label = value.charAt(0).toUpperCase() + value.slice(1)
  return label.length > LABEL_MAX ? `${label.slice(0, LABEL_MAX - 1).trimEnd()}…` : label
}

function cleanReason(rest: string): string | undefined {
  const reason = rest.replace(/^[\s,.;:*`—–-]+/, '').replace(/[\s*`]+$/, '')
  if (!reason) return undefined
  return reason.length > REASON_MAX ? `${reason.slice(0, REASON_MAX - 1).trimEnd()}…` : reason
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function cleanCandidate(raw: string): string | null {
  let value = raw.trim().replace(/^[*"'“”‘’`<\s]+|[*"'“”‘’`>\s]+$/g, '')
  if (/^file:\/\//i.test(value)) value = safeDecode(value.replace(/^file:\/\//i, ''))
  const match = MD_PATH_RE.exec(value)
  if (!match) return null
  const path = match[1].trim()
  return path.length > 3 && path.length <= 1024 ? path : null
}

/**
 * Collect path-like strings from "Draft:" lines. Handles bare paths, backtick
 * spans, markdown links, and lists joined with commas or "and". Paths can
 * contain spaces ("AI drafts/..."), so the whole remainder is kept as a
 * candidate as well as its split pieces.
 */
export function extractDraftCandidates(text: string): string[] {
  const raw: string[] = []
  for (const line of text.matchAll(DRAFT_LINE_RE)) {
    let rest = line[1]
    rest = rest.replace(
      /\[[^\]]*\]\(\s*(?:<([^>]*)>|([^)]*))\)/g,
      (_match, angle: string | undefined, bare: string | undefined) => {
        raw.push(safeDecode((angle ?? bare ?? '').trim()))
        return ' '
      }
    )
    rest = rest.replace(/`([^`]+)`/g, (_match, inner: string) => {
      raw.push(inner)
      return ' '
    })
    raw.push(rest)
    raw.push(...rest.split(/[,;]|\s+and\s+/))
  }

  const candidates: string[] = []
  for (const value of raw) {
    const candidate = cleanCandidate(value)
    if (candidate && !candidates.includes(candidate)) candidates.push(candidate)
    if (candidates.length >= MAX_DRAFT_CANDIDATES) break
  }
  return candidates
}
