/**
 * Decision Evaluation Service
 *
 * Cross-references meeting summary decisions against ground-truth sources:
 * 1. TBB docs from github/token-based-billing-notes/docs
 * 2. Decision-labeled issues from the TBB project board
 *
 * Uses an LLM to evaluate each decision's accuracy and flag outdated/contradicted ones.
 */
import log from 'electron-log'
import { credentialManager } from '../auth/CredentialManager'
import { settings } from '../../config/settings'
import { chatCompletion } from '../llm'
import type { EvaluatedDecision, DecisionConfidence } from '../../../shared/types/transcription'

const GITHUB_API = 'https://api.github.com'
const GITHUB_GRAPHQL = 'https://api.github.com/graphql'
const TBB_DOCS_REPO = 'github/token-based-billing-notes'
const TBB_DOCS_PATH = 'docs'
const TBB_PROJECT_NUMBER = 23672
const TBB_ORG = 'github'

// Cache ground-truth context with a 10-minute TTL
let cachedContext: { docs: string; decisions: string; fetchedAt: number } | null = null
const CACHE_TTL_MS = 10 * 60 * 1000

function getHeaders(): Record<string, string> {
  const pat = credentialManager.getGitHubPAT()
  if (!pat) throw new Error('GitHub PAT not configured. Set it in Settings → GitHub.')
  return {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  }
}

/**
 * Fetch all markdown docs from the TBB notes repo.
 */
async function fetchTBBDocs(): Promise<string> {
  const headers = getHeaders()

  // List files in docs/
  const listResp = await fetch(`${GITHUB_API}/repos/${TBB_DOCS_REPO}/contents/${TBB_DOCS_PATH}`, {
    headers
  })

  if (!listResp.ok) {
    log.warn(`[DecisionEval] Failed to list TBB docs: ${listResp.status}`)
    return ''
  }

  const files = (await listResp.json()) as Array<{
    name: string
    download_url: string
    type: string
  }>
  const mdFiles = files.filter(
    (f) => f.type === 'file' && (f.name.endsWith('.md') || f.name.endsWith('.markdown'))
  )

  // Fetch each markdown file's content (limit to 20 files to stay reasonable)
  const docContents: string[] = []
  for (const file of mdFiles.slice(0, 20)) {
    try {
      const resp = await fetch(file.download_url, { headers })
      if (resp.ok) {
        const text = await resp.text()
        docContents.push(`--- ${file.name} ---\n${text}`)
      }
    } catch (err) {
      log.warn(`[DecisionEval] Failed to fetch doc ${file.name}:`, err)
    }
  }

  return docContents.join('\n\n')
}

/**
 * Fetch decision-labeled issues from the TBB project board using GraphQL.
 */
async function fetchTBBDecisions(): Promise<string> {
  const pat = credentialManager.getGitHubPAT()
  if (!pat) throw new Error('GitHub PAT not configured.')

  // Query project V2 items that are issues, then filter by labels client-side
  const query = `
    query($org: String!, $projectNumber: Int!, $cursor: String) {
      organization(login: $org) {
        projectV2(number: $projectNumber) {
          items(first: 100, after: $cursor) {
            nodes {
              content {
                ... on Issue {
                  title
                  body
                  state
                  url
                  updatedAt
                  labels(first: 20) {
                    nodes { name }
                  }
                }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }
  `

  const decisions: string[] = []
  let cursor: string | null = null
  let pages = 0
  const MAX_PAGES = 5

  while (pages < MAX_PAGES) {
    const resp = await fetch(GITHUB_GRAPHQL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pat}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        variables: { org: TBB_ORG, projectNumber: TBB_PROJECT_NUMBER, cursor }
      })
    })

    if (!resp.ok) {
      log.warn(`[DecisionEval] GraphQL request failed: ${resp.status}`)
      break
    }

    const data = (await resp.json()) as {
      data?: {
        organization?: {
          projectV2?: {
            items: {
              nodes: Array<{
                content: {
                  title?: string
                  body?: string
                  state?: string
                  url?: string
                  updatedAt?: string
                  labels?: { nodes: Array<{ name: string }> }
                } | null
              }>
              pageInfo: { hasNextPage: boolean; endCursor: string }
            }
          }
        }
      }
      errors?: Array<{ message: string }>
    }

    if (data.errors) {
      log.warn('[DecisionEval] GraphQL errors:', data.errors.map((e) => e.message).join(', '))
      break
    }

    const items = data.data?.organization?.projectV2?.items
    if (!items) break

    for (const item of items.nodes) {
      const content = item.content
      if (!content?.title || !content.labels) continue

      const labelNames = content.labels.nodes.map((l) => l.name.toLowerCase())
      const hasTBB = labelNames.some((l) => l.includes('token based billing') || l.includes('tbb'))
      const hasDecision = labelNames.includes('decision')

      if (hasTBB && hasDecision) {
        decisions.push(
          `[${content.state}] ${content.title} (updated: ${content.updatedAt})\n${content.url}\n${content.body?.slice(0, 2000) || '(no body)'}`
        )
      }
    }

    if (!items.pageInfo.hasNextPage) break
    cursor = items.pageInfo.endCursor
    pages++
  }

  log.info(`[DecisionEval] Found ${decisions.length} decision issues from project board`)
  return decisions.join('\n\n---\n\n')
}

/**
 * Fetch and cache ground-truth context from both sources.
 */
async function getGroundTruthContext(): Promise<{ docs: string; decisions: string }> {
  if (cachedContext && Date.now() - cachedContext.fetchedAt < CACHE_TTL_MS) {
    log.info('[DecisionEval] Using cached context')
    return { docs: cachedContext.docs, decisions: cachedContext.decisions }
  }

  log.info('[DecisionEval] Fetching fresh ground-truth context...')
  const [docs, decisions] = await Promise.all([fetchTBBDocs(), fetchTBBDecisions()])

  cachedContext = { docs, decisions, fetchedAt: Date.now() }
  return { docs, decisions }
}

/**
 * Evaluate a list of decisions from a meeting summary against ground-truth.
 */
export async function evaluateDecisions(decisions: string[]): Promise<EvaluatedDecision[]> {
  if (decisions.length === 0) return []

  const pat = credentialManager.getGitHubPAT()
  if (!pat) {
    log.warn('[DecisionEval] No GitHub PAT — skipping evaluation')
    return decisions.map((text) => ({
      text,
      confidence: 'unverifiable' as DecisionConfidence,
      annotation: 'Cannot evaluate: GitHub PAT not configured.',
      sources: []
    }))
  }

  let context: { docs: string; decisions: string }
  try {
    context = await getGroundTruthContext()
  } catch (err) {
    log.error('[DecisionEval] Failed to fetch ground-truth context:', err)
    return decisions.map((text) => ({
      text,
      confidence: 'unverifiable' as DecisionConfidence,
      annotation: 'Could not fetch ground-truth sources for verification.',
      sources: []
    }))
  }

  // If we got no context at all, mark everything unverifiable
  if (!context.docs && !context.decisions) {
    return decisions.map((text) => ({
      text,
      confidence: 'unverifiable' as DecisionConfidence,
      annotation: 'No ground-truth context available from TBB docs or project board.',
      sources: []
    }))
  }

  // Truncate context to fit in a reasonable prompt (~30k chars each)
  const truncatedDocs = context.docs.slice(0, 30000)
  const truncatedDecisions = context.decisions.slice(0, 30000)

  const systemPrompt = `You are a decision verification assistant. You cross-reference decisions stated in meeting summaries against authoritative source documents and tracked decision records.

Your job is to evaluate each decision and classify its reliability:
- "confirmed": The decision aligns with current documentation and tracked decisions.
- "potentially-outdated": The decision was likely true at some point but may have changed, or the source documents suggest a different direction.
- "contradicted": The decision directly conflicts with what the source documents or tracked decisions say.
- "unverifiable": There is no relevant information in the sources to confirm or deny this decision.

For each decision, provide:
1. A confidence classification (one of the four above)
2. A brief annotation (1-2 sentences) explaining your reasoning
3. Source references (file names or issue titles that informed your evaluation)

Return ONLY valid JSON — an array of objects with fields: "confidence", "annotation", "sources" (array of strings).

--- SOURCE DOCUMENTS (TBB Docs) ---
${truncatedDocs || '(none available)'}

--- TRACKED DECISIONS (Project Board Issues) ---
${truncatedDecisions || '(none available)'}`

  const userPrompt = `Evaluate these decisions from a meeting summary:\n\n${decisions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`

  try {
    const evalModel = settings.get('decisionEvalModel') || 'openai/gpt-4o-mini'
    const response = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      { model: evalModel, temperature: 0.2, maxTokens: 2048 }
    )
    const rawContent = response.content || '[]'
    const content = rawContent
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim()

    const evaluations = JSON.parse(content) as Array<{
      confidence: DecisionConfidence
      annotation: string
      sources: string[]
    }>

    return decisions.map((text, i) => ({
      text,
      confidence: evaluations[i]?.confidence || 'unverifiable',
      annotation: evaluations[i]?.annotation || 'Evaluation unavailable.',
      sources: evaluations[i]?.sources || []
    }))
  } catch (err) {
    log.error('[DecisionEval] Evaluation failed:', err)
    return decisions.map((text) => ({
      text,
      confidence: 'unverifiable' as DecisionConfidence,
      annotation: 'Evaluation failed due to an error.',
      sources: []
    }))
  }
}

/**
 * Invalidate the cached context (useful when user knows sources have changed).
 */
export function invalidateEvalCache(): void {
  cachedContext = null
  log.info('[DecisionEval] Context cache invalidated')
}
