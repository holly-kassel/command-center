import { z } from 'zod'
import { chatCompletion } from '../llm'

export async function callStructured<T>(options: {
  model: string
  schemaName: string
  jsonSchema: Record<string, unknown>
  validator: z.ZodType<T>
  system: string
  user: string
}): Promise<T> {
  const result = await chatCompletion(
    [
      { role: 'system', content: options.system },
      { role: 'user', content: options.user }
    ],
    {
      model: options.model,
      temperature: 0.1,
      maxTokens: 8192,
      reasoningEffort: options.model.startsWith('openai/gpt-5') ? 'high' : undefined,
      responseFormat: {
        type: 'json_schema',
        json_schema: {
          name: options.schemaName,
          strict: true,
          schema: options.jsonSchema
        }
      }
    }
  )
  let parsed: unknown
  try {
    parsed = JSON.parse(result.content)
  } catch {
    throw new Error('GitHub Models returned malformed structured JSON.')
  }
  const validated = options.validator.safeParse(parsed)
  if (!validated.success) {
    throw new Error(
      `GitHub Models response did not match the required schema: ${validated.error.message}`
    )
  }
  return validated.data
}
