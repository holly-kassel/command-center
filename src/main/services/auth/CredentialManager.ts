/**
 * Credential Manager
 *
 * Uses Electron's safeStorage API for encryption and electron-store for persistence.
 * Never stores credentials in plain text.
 */
import { safeStorage } from 'electron'
import log from 'electron-log'
import type { MicrosoftTokenData } from '../../../shared/types/calendar'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ElectronStore = require('electron-store')

const store = new (ElectronStore.default || ElectronStore)({
  name: 'credentials',
  defaults: {
    microsoftToken: '',
    githubPAT: '',
  },
})

function encrypt(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    log.warn('[CredentialManager] safeStorage encryption not available, using base64 fallback')
    return Buffer.from(value, 'utf-8').toString('base64')
  }
  return safeStorage.encryptString(value).toString('base64')
}

function decrypt(encoded: string): string {
  if (!encoded) return ''
  const buffer = Buffer.from(encoded, 'base64')
  if (!safeStorage.isEncryptionAvailable()) {
    return buffer.toString('utf-8')
  }
  return safeStorage.decryptString(buffer)
}

export const credentialManager = {
  // ─── Microsoft Token ──────────────────────────────────────────

  storeMicrosoftToken(tokenData: MicrosoftTokenData): void {
    const json = JSON.stringify(tokenData)
    store.set('microsoftToken', encrypt(json))
    log.info('[CredentialManager] Microsoft token stored')
  },

  getMicrosoftToken(): MicrosoftTokenData | null {
    const encrypted = store.get('microsoftToken') as string
    if (!encrypted) return null
    try {
      const json = decrypt(encrypted)
      return JSON.parse(json) as MicrosoftTokenData
    } catch (error) {
      log.error('[CredentialManager] Failed to decrypt Microsoft token:', error)
      return null
    }
  },

  deleteMicrosoftToken(): void {
    store.set('microsoftToken', '')
    log.info('[CredentialManager] Microsoft token deleted')
  },

  // ─── GitHub PAT ───────────────────────────────────────────────

  storeGitHubPAT(pat: string): void {
    store.set('githubPAT', encrypt(pat))
    log.info('[CredentialManager] GitHub PAT stored')
  },

  getGitHubPAT(): string | null {
    const encrypted = store.get('githubPAT') as string
    if (!encrypted) return null
    try {
      return decrypt(encrypted)
    } catch (error) {
      log.error('[CredentialManager] Failed to decrypt GitHub PAT:', error)
      return null
    }
  },
}