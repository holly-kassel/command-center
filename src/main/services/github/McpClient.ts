/**
 * MCP Client Wrapper
 *
 * Manages a connection to a local MCP server via stdio transport.
 * Used to communicate with the GitHub MCP server subprocess.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import log from 'electron-log'

interface McpConnectConfig {
  command: string
  args: string[]
  env: Record<string, string>
}

export class McpClient {
  private client: Client | null = null
  private transport: StdioClientTransport | null = null
  private connected = false

  /**
   * Spawn the MCP server subprocess and connect.
   */
  async connect(config: McpConnectConfig): Promise<void> {
    if (this.connected) {
      log.info('[McpClient] Already connected')
      return
    }

    this.transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: { ...process.env, ...config.env } as Record<string, string>,
    })

    this.client = new Client(
      { name: 'command-center', version: '1.0.0' },
      { capabilities: {} }
    )

    await this.client.connect(this.transport)
    this.connected = true
    log.info('[McpClient] Connected to MCP server')
  }

  /**
   * Call a tool on the MCP server and return the result.
   */
  async callTool(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<unknown> {
    if (!this.client || !this.connected) {
      throw new Error('MCP client not connected')
    }

    const result = await this.client.callTool({ name, arguments: args })

    // Extract text content from the result
    if (result.content && Array.isArray(result.content)) {
      const textParts = result.content
        .filter((c: { type: string }) => c.type === 'text')
        .map((c: { text?: string }) => c.text || '')
      const combined = textParts.join('')
      try {
        return JSON.parse(combined)
      } catch {
        return combined
      }
    }
    return result.content
  }

  /**
   * List available tools (useful for discovery and debugging).
   */
  async listTools(): Promise<string[]> {
    if (!this.client || !this.connected) {
      throw new Error('MCP client not connected')
    }

    const result = await this.client.listTools()
    const toolNames = result.tools.map((t) => t.name)
    log.info(`[McpClient] Available tools: ${toolNames.join(', ')}`)
    return toolNames
  }

  /**
   * Disconnect and kill the subprocess.
   */
  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close()
      this.transport = null
    }
    this.client = null
    this.connected = false
    log.info('[McpClient] Disconnected')
  }

  isConnected(): boolean {
    return this.connected
  }
}
