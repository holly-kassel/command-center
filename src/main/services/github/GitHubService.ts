/**
 * GitHub Service
 *
 * Uses the GitHub REST API for notifications (not available via MCP server).
 * Keeps MCP client available for repo/PR/issue operations in future epics.
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import log from 'electron-log'
import { McpClient } from './McpClient'
import { credentialManager } from '../auth/CredentialManager'
import type {
  GitHubNotification,
  GitHubPullRequest,
  NotificationReason,
  NotificationSubjectType,
  PRInvolvement,
  PRReviewStatus,
  PRState,
} from '../../../shared/types/github'

const GITHUB_API = 'https://api.github.com'

/** Map GitHub API reason strings to our NotificationReason type */
const KNOWN_REASONS = new Set([
  'review_requested',
  'mention',
  'assign',
  'team_mention',
  'subscribed',
  'comment',
  'ci_activity',
  'approval_requested',
  'state_change',
])

/** Reasons that indicate direct involvement — filters out watch/subscribe noise */
const PARTICIPATING_REASONS = new Set([
  'review_requested',
  'approval_requested',
  'assign',
  'mention',
  'team_mention',
  'comment',
  'ci_activity',
  'state_change',
  'subscribed',
])



export class GitHubService {
  private mcpClient: McpClient
  private mcpInitialized = false

  constructor() {
    this.mcpClient = new McpClient()
  }

  /**
   * Get the stored PAT (or null).
   */
  private getPAT(): string | null {
    return credentialManager.getGitHubPAT()
  }

  /**
   * Initialize MCP client for repo/PR operations (lazy, optional).
   */
  async initializeMcp(): Promise<void> {
    if (this.mcpInitialized && this.mcpClient.isConnected()) return

    const pat = this.getPAT()
    if (!pat) throw new Error('GITHUB_NOT_CONFIGURED')

    const serverPath = this.findMcpServerBinary()
    if (!serverPath) {
      log.warn('[GitHubService] MCP server not found, repo operations unavailable')
      return
    }

    await this.mcpClient.connect({
      command: serverPath,
      args: ['stdio'],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: pat },
    })

    try {
      await this.mcpClient.listTools()
    } catch (error) {
      log.warn('[GitHubService] Could not list MCP tools:', error)
    }

    this.mcpInitialized = true
    log.info('[GitHubService] MCP client initialized')
  }

  /**
   * Fetch notifications via REST API, filtered to actionable items.
   */
  async getNotifications(): Promise<GitHubNotification[]> {
    const pat = this.getPAT()
    if (!pat) throw new Error('GITHUB_NOT_CONFIGURED')

    try {
      const response = await fetch(`${GITHUB_API}/notifications?per_page=100`, {
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })

      if (!response.ok) {
        const text = await response.text()
        log.error(`[GitHubService] Notifications API ${response.status}: ${text}`)
        throw new Error(`GitHub API error: ${response.status}`)
      }

      const raw = (await response.json()) as Record<string, unknown>[]

      const parsed = this.parseAndFilter(raw)
      log.info(`[GitHubService] Fetched ${parsed.length} notifications`)
      return parsed
    } catch (error) {
      log.error('[GitHubService] getNotifications error:', error)
      throw error
    }
  }

  /**
   * Mark a notification thread as read via REST API.
   */
  async markAsRead(threadId: string): Promise<void> {
    const pat = this.getPAT()
    if (!pat) throw new Error('GITHUB_NOT_CONFIGURED')

    try {
      const response = await fetch(`${GITHUB_API}/notifications/threads/${threadId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })

      if (!response.ok && response.status !== 205) {
        log.error(`[GitHubService] markAsRead ${response.status}`)
        throw new Error(`Failed to mark as read: ${response.status}`)
      }

      log.info(`[GitHubService] Marked notification ${threadId} as read`)
    } catch (error) {
      log.error('[GitHubService] markAsRead error:', error)
      throw error
    }
  }

  /**
   * Check if a GitHub PAT is stored.
   */
  isConfigured(): boolean {
    return this.getPAT() !== null
  }

  /**
   * Store a PAT and optionally initialize MCP.
   */
  async setPAT(pat: string): Promise<void> {
    credentialManager.storeGitHubPAT(pat)
    // Disconnect old MCP session if any
    await this.disconnect()
    // Try MCP init (non-blocking — notifications work without it)
    try {
      await this.initializeMcp()
    } catch {
      log.info('[GitHubService] MCP init skipped (server not found or error)')
    }
  }

  /**
   * Disconnect MCP client.
   */
  async disconnect(): Promise<void> {
    this.mcpInitialized = false
    await this.mcpClient.disconnect()
  }

  /**
   * Get the MCP client for direct tool calls (repo/PR operations).
   */
  getMcpClient(): McpClient {
    return this.mcpClient
  }

  // ─── Internal ─────────────────────────────────────────────────

  private findMcpServerBinary(): string | null {
    const candidates = [
      join(homedir(), 'go', 'bin', 'github-mcp-server'),
      '/usr/local/bin/github-mcp-server',
      '/opt/homebrew/bin/github-mcp-server',
    ]

    for (const p of candidates) {
      if (existsSync(p)) {
        log.info(`[GitHubService] Found MCP server at: ${p}`)
        return p
      }
    }

    return null
  }

  private parseAndFilter(
    raw: Record<string, unknown>[]
  ): GitHubNotification[] {
    return raw
      .map((item) => this.parseNotification(item))
      .filter((n) => n.repository.startsWith('github/'))
      .filter((n) => PARTICIPATING_REASONS.has(n.reason))
  }

  private parseNotification(
    item: Record<string, unknown>
  ): GitHubNotification {
    const subject = (item.subject || {}) as Record<string, unknown>
    const repo = (item.repository || {}) as Record<string, unknown>
    const reason = String(item.reason || 'other')

    // Build browser-friendly URL from API URL
    let url = String(subject.url || item.url || '')
    url = url
      .replace('https://api.github.com/repos/', 'https://github.com/')
      .replace('/pulls/', '/pull/')

    return {
      id: String(item.id || ''),
      title: String(subject.title || 'Untitled'),
      reason: KNOWN_REASONS.has(reason)
        ? (reason as NotificationReason)
        : 'other',
      repository: String(repo.full_name || repo.name || 'unknown'),
      url,
      updatedAt: String(item.updated_at || new Date().toISOString()),
      unread: Boolean(item.unread),
      type: this.mapSubjectType(String(subject.type || '')),
    }
  }

  private mapSubjectType(type: string): NotificationSubjectType {
    switch (type) {
      case 'PullRequest':
        return 'PullRequest'
      case 'Issue':
        return 'Issue'
      case 'Discussion':
        return 'Discussion'
      default:
        return 'other'
    }
  }

  // ─── Pull Requests ────────────────────────────────────────────

  /**
   * Fetch all open PRs involving the authenticated user.
   * Combines: authored, review-requested, assigned, and mentioned.
   */
  async getMyPullRequests(): Promise<GitHubPullRequest[]> {
    const pat = this.getPAT()
    if (!pat) throw new Error('GITHUB_NOT_CONFIGURED')

    const headers = {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }

    // Fetch user login
    const userRes = await fetch(`${GITHUB_API}/user`, { headers })
    if (!userRes.ok) throw new Error(`GitHub API error: ${userRes.status}`)
    const user = (await userRes.json()) as { login: string }
    const login = user.login

    // Run searches in parallel: authored, review-requested, assigned
    const queries = [
      { q: `is:pr is:open author:${login} archived:false`, involvement: 'author' as PRInvolvement },
      { q: `is:pr is:open review-requested:${login} archived:false`, involvement: 'review_requested' as PRInvolvement },
      { q: `is:pr is:open assignee:${login} archived:false`, involvement: 'assigned' as PRInvolvement },
    ]

    const results = await Promise.all(
      queries.map(async ({ q, involvement }) => {
        const url = `${GITHUB_API}/search/issues?q=${encodeURIComponent(q)}&per_page=50&sort=updated&order=desc`
        const res = await fetch(url, { headers })
        if (!res.ok) {
          log.warn(`[GitHubService] PR search failed (${res.status}): ${q}`)
          return []
        }
        const data = (await res.json()) as { items: Record<string, unknown>[] }
        return data.items.map((item) => this.parsePullRequest(item, involvement))
      })
    )

    // Merge and deduplicate by PR id, preferring more specific involvement
    const prMap = new Map<number, GitHubPullRequest>()
    const involvementPriority: Record<PRInvolvement, number> = {
      review_requested: 0,
      assigned: 1,
      mentioned: 2,
      author: 3,
    }

    for (const prs of results) {
      for (const pr of prs) {
        const existing = prMap.get(pr.id)
        if (!existing || involvementPriority[pr.involvement] < involvementPriority[existing.involvement]) {
          prMap.set(pr.id, pr)
        }
      }
    }

    const all = Array.from(prMap.values())
      .filter((pr) => pr.repository.startsWith('github/'))
      .filter((pr) => !pr.author.endsWith('[bot]'))
      .sort((a, b) => involvementPriority[a.involvement] - involvementPriority[b.involvement]
        || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    log.info(`[GitHubService] Fetched ${all.length} PRs involving user`)
    return all
  }

  private parsePullRequest(
    item: Record<string, unknown>,
    involvement: PRInvolvement
  ): GitHubPullRequest {
    const pr = (item.pull_request || {}) as Record<string, unknown>
    const repoUrl = String(item.repository_url || '')
    const repoFullName = repoUrl.replace('https://api.github.com/repos/', '')
    const user = (item.user || {}) as Record<string, unknown>

    // Determine state
    let state: PRState = 'open'
    if (pr.merged_at) {
      state = 'merged'
    } else if (item.state === 'closed') {
      state = 'closed'
    }

    return {
      id: Number(item.id),
      number: Number(item.number),
      title: String(item.title || 'Untitled'),
      repository: repoFullName,
      url: String(item.html_url || ''),
      state,
      draft: Boolean(item.draft),
      author: String(user.login || 'unknown'),
      involvement,
      reviewStatus: 'pending' as PRReviewStatus,
      createdAt: String(item.created_at || new Date().toISOString()),
      updatedAt: String(item.updated_at || new Date().toISOString()),
      additions: 0,
      deletions: 0,
    }
  }
}

// Singleton
let instance: GitHubService | null = null

export function getGitHubService(): GitHubService {
  if (!instance) {
    instance = new GitHubService()
  }
  return instance
}
