// App configuration defaults and schema
import { z } from 'zod'

export const AppConfigSchema = z.object({
  obsidian: z.object({
    vaultPath: z.string().default(''),
  }),
  calendar: z.object({
    enabled: z.boolean().default(false),
  }),
  github: z.object({
    enabled: z.boolean().default(false),
  }),
  sync: z.object({
    intervalMs: z.number().default(60_000),
  }),
})

export type AppConfig = z.infer<typeof AppConfigSchema>

export const defaultConfig: AppConfig = AppConfigSchema.parse({
  obsidian: {},
  calendar: {},
  github: {},
  sync: {},
})
