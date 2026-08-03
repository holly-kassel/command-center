/**
 * Auth IPC Handlers
 *
 * Registers ipcMain.handle() for authentication channels.
 * Bridges renderer ↔ WorkIQ-backed calendar connection.
 *
 * "Authentication" here means having a working WorkIQ connection to Microsoft
 * 365. WorkIQ handles the actual Microsoft sign-in itself (device-code + EULA),
 * so there is no Azure app registration or MSAL token to manage in this app.
 */
import { ipcMain } from 'electron'
import { getCalendarService } from '../services/calendar/CalendarService'
import { credentialManager } from '../services/auth/CredentialManager'
import { settings } from '../config/settings'
import log from 'electron-log'

export function registerAuthIpc(): void {
  const calendar = getCalendarService()
  const legacyOpenAIKey = settings.getLegacyOpenAIApiKey()
  if (legacyOpenAIKey && !credentialManager.getOpenAIKey()) {
    try {
      credentialManager.storeOpenAIKey(legacyOpenAIKey)
      settings.deleteLegacyOpenAIApiKey()
    } catch (error) {
      log.error('[IPC] Could not migrate the legacy OpenAI API key to secure storage:', error)
    }
  } else if (legacyOpenAIKey) {
    settings.deleteLegacyOpenAIApiKey()
  }

  ipcMain.handle('auth:loginMicrosoft', async () => {
    try {
      await calendar.connect()
      return { success: true }
    } catch (error) {
      log.error('[IPC] auth:loginMicrosoft error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  ipcMain.handle('auth:isAuthenticated', () => {
    return calendar.isConnected()
  })

  ipcMain.handle('auth:logout', async () => {
    try {
      await calendar.disconnect()
      return { success: true }
    } catch (error) {
      log.error('[IPC] auth:logout error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  ipcMain.handle('auth:isOpenAIConfigured', () => {
    return Boolean(credentialManager.getOpenAIKey())
  })

  ipcMain.handle('auth:setOpenAIKey', (_event, apiKey: string) => {
    const trimmed = apiKey.trim()
    if (!trimmed) throw new Error('OpenAI API key cannot be empty.')
    credentialManager.storeOpenAIKey(trimmed)
    return { success: true }
  })

  ipcMain.handle('auth:deleteOpenAIKey', () => {
    credentialManager.deleteOpenAIKey()
    return { success: true }
  })

  // LLM provider key — used by the foundry/custom chat providers.
  ipcMain.handle('auth:isLLMKeyConfigured', () => {
    return Boolean(credentialManager.getLLMApiKey())
  })

  ipcMain.handle('auth:setLLMKey', (_event, apiKey: string) => {
    const trimmed = apiKey.trim()
    if (!trimmed) throw new Error('LLM provider API key cannot be empty.')
    credentialManager.storeLLMApiKey(trimmed)
    return { success: true }
  })

  ipcMain.handle('auth:deleteLLMKey', () => {
    credentialManager.deleteLLMApiKey()
    return { success: true }
  })
}
