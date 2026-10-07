// /triage background jobs (billing-projects/scripts/triage.sh)
import log from 'electron-log'
import { getObsidianService } from '../obsidian'
import { PasteTriageService } from './PasteTriageService'

let instance: PasteTriageService | null = null

export function getPasteTriageService(): PasteTriageService {
  if (!instance) {
    instance = new PasteTriageService({
      billingProjectsPath: process.env.BILLING_PROJECTS_PATH,
      resolveVaultPath: () => getObsidianService().getVaultPath() || undefined,
      logger: {
        info: (message) => log.info(message),
        warn: (message) => log.warn(message),
        error: (message) => log.error(message)
      }
    })
  }
  return instance
}

export { PasteTriageService } from './PasteTriageService'
export type { TriageDraftTarget, TriageSubmitResult } from './PasteTriageService'
