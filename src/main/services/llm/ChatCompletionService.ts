/**
 * Chat Completion Service
 *
 * Provider-agnostic client for the OpenAI chat-completions wire format.
 * The endpoint, credentials, and model naming come from ChatProvider, so
 * switching between OpenAI, Microsoft Foundry, or a local OpenAI-compatible
 * runtime is a settings change rather than a code change.
 *
 * No extra dependencies — just native fetch.
 */
import log from 'electron-log'
import {
  assertCredentials,
  buildAuthHeaders,
  defaultChatModel,
  describeHttpError,
  isReasoningModel,
  normalizeModel,
  resolveProvider
} from './ChatProvider'
import type { ResolvedProvider } from './ChatProvider'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type ChatResponseFormat =
  | { type: 'json_object' }
  | {
      type: 'json_schema'
      json_schema: {
        name: string
        strict: boolean
        schema: Record<string, unknown>
      }
    }

export interface ChatCompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  responseFormat?: ChatResponseFormat
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high'
}

export interface ChatCompletionResult {
  content: string
  model: string
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

export class EmptyChatCompletionError extends Error {
  constructor(
    public readonly finishReason?: string,
    public readonly usage?: ChatCompletionResult['usage']
  ) {
    const detail = finishReason ? ` (finish reason: ${finishReason})` : ''
    super(`No content in chat completion response${detail}`)
    this.name = 'EmptyChatCompletionError'
  }
}

/** Builds the request body shared by streaming and non-streaming calls. */
function buildRequestBody(
  provider: ResolvedProvider,
  messages: ChatMessage[],
  options: ChatCompletionOptions,
  stream: boolean,
  forceReasoningShape?: boolean
): { body: Record<string, unknown>; model: string } {
  const model = normalizeModel(options.model ?? defaultChatModel(), provider.id)
  const body: Record<string, unknown> = { model, messages }
  if (stream) body.stream = true

  const reasoning = forceReasoningShape ?? isReasoningModel(model, provider.id)
  if (reasoning) {
    body.max_completion_tokens = options.maxTokens ?? 2048
    // On a forced flip the caller supplied no effort because it believed this
    // wasn't a reasoning model, so its token budget is sized for a plain
    // completion. Spending that budget at maximum effort can return empty
    // content, so stay conservative.
    body.reasoning_effort = options.reasoningEffort ?? (forceReasoningShape ? 'low' : 'high')
  } else {
    body.max_tokens = options.maxTokens ?? 2048
    body.temperature = options.temperature ?? 0.3
  }
  if (options.responseFormat) body.response_format = options.responseFormat

  return { body, model }
}

const SHAPE_PARAMS = ['max_tokens', 'max_completion_tokens', 'reasoning_effort', 'temperature']

/**
 * A 400 saying a token or reasoning parameter doesn't belong on this model means
 * the model is the opposite shape to what we guessed. Unavoidable on Foundry,
 * where the model string is a deployment name and carries no reliable signal.
 *
 * Matched against the parsed error rather than the raw body: every OpenAI and
 * Azure 400 carries `"type":"invalid_request_error"`, so substring-matching
 * "invalid" would fire on all of them. The wording must specifically mean "this
 * parameter does not belong here", never a value-range complaint such as
 * "max_tokens is too large", which a retry cannot fix.
 */
function isParameterShapeError(status: number, body: string): boolean {
  if (status !== 400) return false

  let message = body
  let code = ''
  let param = ''
  try {
    const parsed = JSON.parse(body)
    message = String(parsed?.error?.message ?? body)
    code = String(parsed?.error?.code ?? '')
    param = String(parsed?.error?.param ?? '')
  } catch {
    // Non-JSON body — fall back to matching the raw text.
  }

  const namesShapeParam = SHAPE_PARAMS.some((p) => param === p || message.includes(p))
  if (!namesShapeParam) return false

  if (code === 'unsupported_parameter' || code === 'unsupported_value') return true
  return /unsupported (?:parameter|value)|is not supported with this model|unrecognized request argument/i.test(
    message
  )
}

/** POSTs the request, retrying once with the opposite parameter shape on a 400. */
async function postCompletion(
  provider: ResolvedProvider,
  messages: ChatMessage[],
  options: ChatCompletionOptions,
  stream: boolean
): Promise<{ response: Response; model: string }> {
  const { body, model } = buildRequestBody(provider, messages, options, stream)
  const headers = buildAuthHeaders(provider)

  const response = await fetch(provider.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })
  if (response.ok) return { response, model }

  const errorText = await response.text()
  if (!isParameterShapeError(response.status, errorText)) {
    log.error(`[LLM] API error ${response.status}: ${errorText}`)
    throw new Error(describeHttpError(provider, response.status, errorText))
  }

  const flipped = !(isReasoningModel(model, provider.id) as boolean)
  log.warn(
    `[LLM] ${provider.label} rejected the parameter shape for "${model}"; retrying as ${
      flipped ? 'a reasoning model' : 'a standard model'
    }`
  )

  const retry = buildRequestBody(provider, messages, options, stream, flipped)
  const retryResponse = await fetch(provider.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(retry.body)
  })
  if (!retryResponse.ok) {
    const retryText = await retryResponse.text()
    log.error(`[LLM] API error ${retryResponse.status}: ${retryText}`)
    throw new Error(describeHttpError(provider, retryResponse.status, retryText))
  }
  return { response: retryResponse, model }
}

/**
 * Send a chat completion request to the configured provider.
 * Throws if credentials are missing or the API returns an error.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResult> {
  const provider = resolveProvider()
  assertCredentials(provider)

  log.info(
    `[LLM] Sending chat completion request (provider: ${provider.id}, messages: ${messages.length})`
  )

  const { response, model } = await postCompletion(provider, messages, options, false)

  const data = await response.json()
  const choice = data.choices?.[0]

  if (!choice?.message?.content) {
    log.warn('[LLM] Empty chat completion response', {
      provider: provider.id,
      model: data.model ?? model,
      finishReason: choice?.finish_reason,
      usage: data.usage
    })
    throw new EmptyChatCompletionError(choice?.finish_reason, data.usage)
  }

  log.info('[LLM] Chat completion received successfully')

  return {
    content: choice.message.content,
    model: data.model ?? model,
    usage: data.usage
  }
}

/**
 * Send a streaming chat completion request to the configured provider.
 * Yields content chunks as they arrive via SSE.
 */
export async function* chatCompletionStream(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): AsyncGenerator<string, void, unknown> {
  const provider = resolveProvider()
  assertCredentials(provider)

  log.info(
    `[LLM] Sending streaming chat completion (provider: ${provider.id}, messages: ${messages.length})`
  )

  const { response } = await postCompletion(provider, messages, options, true)

  if (!response.body) {
    throw new Error('No response body for streaming request')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete SSE lines
      const lines = buffer.split('\n')
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) continue

        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6)
          if (data === '[DONE]') return

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              yield content
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  log.info('[LLM] Streaming chat completion finished')
}
