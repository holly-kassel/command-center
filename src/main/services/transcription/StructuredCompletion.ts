import { z } from 'zod'
import {
  chatCompletion,
  currentProviderId,
  EmptyChatCompletionError,
  isReasoningModel
} from '../llm'

export async function callStructured<T>(options: {
  model: string
  schemaName: string
  jsonSchema: Record<string, unknown>
  validator: z.ZodType<T>
  system: string
  user: string
}): Promise<T> {
  const messages = [
    { role: 'system' as const, content: options.system },
    { role: 'user' as const, content: options.user }
  ]
  // Must match how the request builder classifies the model, or the
  // empty-completion recovery below never fires on a Foundry deployment name.
  const reasoning = isReasoningModel(options.model, currentProviderId())
  const completionOptions = {
    model: options.model,
    temperature: 0.1,
    maxTokens: 8192,
    reasoningEffort: reasoning ? ('low' as const) : undefined,
    responseFormat: {
      type: 'json_schema' as const,
      json_schema: {
        name: options.schemaName,
        strict: true,
        schema: options.jsonSchema
      }
    }
  }
  let result
  try {
    result = await chatCompletion(messages, completionOptions)
  } catch (error) {
    if (!(error instanceof EmptyChatCompletionError) || !reasoning) {
      throw error
    }
    result = await chatCompletion(messages, {
      ...completionOptions,
      reasoningEffort: 'minimal'
    })
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(result.content)
  } catch {
    throw new Error('The model returned malformed structured JSON.')
  }
  const validated = options.validator.safeParse(parsed)
  if (!validated.success) {
    throw new Error(
      `The model response did not match the required schema: ${validated.error.message}`
    )
  }
  return validated.data
}
