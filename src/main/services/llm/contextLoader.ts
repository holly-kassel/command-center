/**
 * LLM Context Loader
 *
 * Loads personal/domain context files from the Obsidian vault's LLM-context/ directory.
 * Used by SlashCommands and ChatService to inject relevant context into system prompts.
 */
import log from 'electron-log'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getObsidianService } from '../obsidian/ObsidianService'

/**
 * Load LLM context files from the Obsidian vault.
 * Returns the combined content wrapped in a header, or empty string if vault/files not found.
 */
export async function loadLLMContext(fileNames: string[]): Promise<string> {
  const vaultPath = getObsidianService().getVaultPath()
  if (!vaultPath) return ''

  const contextDir = join(vaultPath, 'LLM-context')
  if (!existsSync(contextDir)) return ''

  const sections: string[] = []

  for (const fileName of fileNames) {
    const filePath = join(contextDir, fileName)
    if (!existsSync(filePath)) {
      log.warn(`[ContextLoader] Context file not found: ${filePath}`)
      continue
    }

    try {
      const content = await readFile(filePath, 'utf-8')
      sections.push(`--- ${fileName} ---\n${content}`)
    } catch (err) {
      log.warn(`[ContextLoader] Failed to read context file: ${fileName}`, err)
    }
  }

  if (sections.length === 0) return ''

  return (
    '\n\n## Personal Context (use this to understand the user, their team, and domain terminology)\n\n' +
    sections.join('\n\n')
  )
}

/**
 * Load raw content from specific files in the Obsidian vault (not just LLM-context/).
 * Used for loading billing-experience docs and other vault content.
 */
export async function loadVaultFile(relativePath: string): Promise<string | null> {
  const vaultPath = getObsidianService().getVaultPath()
  if (!vaultPath) return null

  const filePath = join(vaultPath, relativePath)
  if (!existsSync(filePath)) return null

  try {
    return await readFile(filePath, 'utf-8')
  } catch (err) {
    log.warn(`[ContextLoader] Failed to read vault file: ${relativePath}`, err)
    return null
  }
}

/**
 * Load multiple vault files and combine them into a single context string.
 * Paths are relative to the vault root.
 */
export async function loadVaultFiles(relativePaths: string[]): Promise<string> {
  const sections: string[] = []

  for (const relativePath of relativePaths) {
    const content = await loadVaultFile(relativePath)
    if (content) {
      sections.push(`--- ${relativePath} ---\n${content}`)
    }
  }

  if (sections.length === 0) return ''

  return (
    '\n\n## Additional Domain Context (billing-experience docs from vault)\n\n' +
    sections.join('\n\n')
  )
}
