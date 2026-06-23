/**
 * Chat Tools — GitHub operations Katya can invoke
 *
 * When the LLM outputs [TOOL:name]{args}, ChatService intercepts it,
 * calls the appropriate function here via MCP, and feeds results back.
 */
import log from 'electron-log'
import { getGitHubService } from '../github/GitHubService'

export interface ToolCall {
  name: string
  args: Record<string, unknown>
}

export interface ToolResult {
  tool: string
  success: boolean
  data: unknown
  error?: string
}

/**
 * Parse tool calls from LLM output.
 * Format: [TOOL:tool_name]{"arg1": "value1"}
 */
export function parseToolCalls(text: string): ToolCall[] {
  const regex = /\[TOOL:(\w+)\]\s*(\{[^}]+\})/g
  const calls: ToolCall[] = []
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    try {
      const args = JSON.parse(match[2])
      calls.push({ name: match[1], args })
    } catch {
      log.warn(`[ChatTools] Failed to parse tool args: ${match[2]}`)
    }
  }

  return calls
}

/**
 * Strip tool call markers from text for display.
 */
export function stripToolCalls(text: string): string {
  return text.replace(/\[TOOL:\w+\]\s*\{[^}]+\}/g, '').trim()
}

/**
 * Execute a tool call via the GitHub MCP client.
 */
export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const github = getGitHubService()

  try {
    // Ensure MCP is connected
    await github.initializeMcp()
    const mcp = github.getMcpClient()

    if (!mcp.isConnected()) {
      return {
        tool: call.name,
        success: false,
        data: null,
        error: 'GitHub MCP server not available. Make sure github-mcp-server is installed.',
      }
    }

    log.info(`[ChatTools] Executing tool: ${call.name}`, call.args)
    const result = await mcp.callTool(call.name, call.args)

    return {
      tool: call.name,
      success: true,
      data: result,
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    log.error(`[ChatTools] Tool ${call.name} failed:`, msg)
    return {
      tool: call.name,
      success: false,
      data: null,
      error: msg,
    }
  }
}

/**
 * Format tool results as context for the LLM to use in its response.
 */
export function formatToolResults(results: ToolResult[]): string {
  const parts = results.map((r) => {
    if (!r.success) {
      return `[Tool: ${r.tool}] Error: ${r.error}`
    }
    const data = typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2)
    // Truncate very long results to avoid blowing up context
    const truncated = data.length > 3000 ? data.slice(0, 3000) + '\n... (truncated)' : data
    return `[Tool: ${r.tool}] Result:\n${truncated}`
  })

  return '\n\n## Tool Results\n' + parts.join('\n\n')
}
