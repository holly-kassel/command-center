/**
 * Chat Provider Resolution
 *
 * GitHub Models was retired on 2026-07-30 and its endpoint now returns HTTP 410,
 * which took out every LLM-backed feature at once. The provider is therefore
 * configuration rather than a hardcoded URL.
 *
 * Every supported target speaks the OpenAI chat-completions wire format, so a
 * single client covers all of them:
 *   openai  — https://api.openai.com/v1
 *   foundry — https://<resource>.openai.azure.com/openai/v1  (implicit versioning,
 *             so no api-version parameter; `model` is the deployment name)
 *   custom  — any OpenAI-compatible base URL (Ollama, LM Studio, a gateway)
 */
import { credentialManager } from '../auth'
import { settings } from '../../config/settings'
import { OPENAI_BASE_URL } from '../../../shared/types/settings'
import type { LLMProviderId } from '../../../shared/types/settings'

export interface ResolvedProvider {
  id: LLMProviderId
  label: string
  url: string
  apiKey: string | null
  headers: Record<string, string>
}

const PROVIDER_LABELS: Record<LLMProviderId, string> = {
  openai: 'OpenAI',
  foundry: 'Microsoft Foundry',
  custom: 'the configured LLM endpoint'
}

/**
 * GitHub Models used namespaced ids (`openai/gpt-5`). Settings are migrated on
 * load, but normalize defensively so a stale value can't produce a confusing
 * "model not found".
 *
 * Only safe for `openai` and `foundry`: OpenAI ids never contain a slash and
 * Azure deployment names cannot. Plenty of OpenAI-compatible endpoints do
 * require one though — OpenRouter (`anthropic/claude-sonnet-4`), LiteLLM, and
 * Ollama Hugging Face pulls (`hf.co/...`) — so `custom` is passed through.
 */
export function normalizeModel(model: string, providerId: LLMProviderId = 'openai'): string {
  const trimmed = model.trim()
  if (providerId === 'custom') return trimmed
  const slash = trimmed.lastIndexOf('/')
  return slash === -1 ? trimmed : trimmed.slice(slash + 1)
}

/**
 * Model for callers that don't pin one (chat, slash commands). Reads settings
 * rather than a literal, because a hardcoded OpenAI id can't exist on a Foundry
 * deployment or a local runtime.
 */
export function defaultChatModel(): string {
  return settings.get('llmChatModel') || 'gpt-4.1'
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

/**
 * True for models that use max_completion_tokens + reasoning_effort.
 *
 * This is a guess for `foundry`, where the string is a user-chosen deployment
 * name rather than a model id, so a wrong guess is recovered from by the
 * parameter-shape retry in ChatCompletionService.
 */
export function isReasoningModel(model: string, providerId: LLMProviderId = 'openai'): boolean {
  return /^(?:gpt-5(?:[-.]|$)|o\d)/.test(normalizeModel(model, providerId))
}

/**
 * The configured provider id on its own. Unlike resolveProvider() this never
 * throws, so callers that only need the id can't be broken by an unconfigured
 * base URL.
 */
export function currentProviderId(): LLMProviderId {
  return settings.get('llmProvider') || 'openai'
}

export function resolveProvider(): ResolvedProvider {
  const id = settings.get('llmProvider') || 'openai'
  const label = PROVIDER_LABELS[id] ?? id

  if (id === 'openai') {
    return {
      id,
      label,
      url: `${OPENAI_BASE_URL}/chat/completions`,
      apiKey: credentialManager.getOpenAIKey(),
      headers: {}
    }
  }

  const baseUrl = normalizeBaseUrl(settings.get('llmBaseUrl') || '')
  if (!baseUrl) {
    throw new Error(
      `No base URL configured for ${label}. Add it in Settings → Meeting Transcription.`
    )
  }

  return {
    id,
    label,
    url: `${baseUrl}/chat/completions`,
    // A local runtime such as Ollama needs no key, so custom may legitimately
    // have none. Foundry always requires one.
    apiKey: credentialManager.getLLMApiKey(),
    headers: {}
  }
}

/** Throws a provider-specific error when required credentials are missing. */
export function assertCredentials(provider: ResolvedProvider): void {
  if (provider.apiKey) return
  if (provider.id === 'openai') {
    throw new Error('OpenAI API key not configured. Add it in Settings → Meeting Transcription.')
  }
  if (provider.id === 'foundry') {
    throw new Error('Microsoft Foundry API key not configured. Add it in Settings.')
  }
  // custom: a keyless local endpoint is valid, so allow it through.
}

export function buildAuthHeaders(provider: ResolvedProvider): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...provider.headers
  }
  if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey}`
  return headers
}

/** Turns a non-OK response into an actionable message. */
export function describeHttpError(
  provider: ResolvedProvider,
  status: number,
  body: string
): string {
  if (status === 401 || status === 403) {
    return `${provider.label} rejected the API key (${status}). Check it in Settings.`
  }
  if (status === 404) {
    return `${provider.label} has no such model or deployment (404). Check the model name in Settings.`
  }
  if (status === 429) {
    return `Rate limited by ${provider.label}. Try again in a moment.`
  }
  if (status === 410) {
    return `${provider.label} endpoint is retired (410). Pick a different provider in Settings.`
  }
  return `${provider.label} API error (${status}): ${body}`
}
