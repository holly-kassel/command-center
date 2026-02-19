/**
 * GitHub Models LLM Service
 *
 * Calls the GitHub Models inference API for chat completions.
 * Reuses the existing GitHub PAT from CredentialManager.
 * No extra dependencies — just native fetch.
 */
import log from 'electron-log'
import { credentialManager } from '../auth'

const GITHUB_MODELS_URL = 'https://models.github.ai/inference/chat/completions'
const DEFAULT_MODEL = 'openai/gpt-4.1'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface ChatCompletionResult {
  content: string
  model: string
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

/**
 * Send a chat completion request to GitHub Models.
 * Throws if PAT is missing or API returns an error.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResult> {
  const pat = credentialManager.getGitHubPAT()
  if (!pat) {
    throw new Error('GitHub PAT not configured. Set it in Settings → GitHub.')
  }

  const model = options.model ?? DEFAULT_MODEL
  const body = {
    model,
    messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 2048
  }

  log.info(`[LLM] Sending chat completion request (model: ${model}, messages: ${messages.length})`)

  const response = await fetch(GITHUB_MODELS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errorText = await response.text()
    log.error(`[LLM] API error ${response.status}: ${errorText}`)

    if (response.status === 401) {
      throw new Error('GitHub PAT is invalid or missing models:read scope.')
    }
    if (response.status === 429) {
      throw new Error('Rate limited by GitHub Models. Try again in a moment.')
    }

    throw new Error(`GitHub Models API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const choice = data.choices?.[0]

  if (!choice?.message?.content) {
    throw new Error('No content in GitHub Models response')
  }

  log.info('[LLM] Chat completion received successfully')

  return {
    content: choice.message.content,
    model: data.model ?? model,
    usage: data.usage
  }
}
