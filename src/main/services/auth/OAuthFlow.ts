/**
 * Microsoft Graph OAuth Flow
 *
 * Handles OAuth 2.0 authorization code flow using MSAL-node.
 * Opens a BrowserWindow for interactive login, captures the auth code
 * via a localhost redirect, and exchanges it for tokens.
 */
import { BrowserWindow } from 'electron'
import {
  PublicClientApplication,
  type Configuration,
  type AuthenticationResult
} from '@azure/msal-node'
import { createServer, type Server } from 'node:http'
import log from 'electron-log'
import { credentialManager } from './CredentialManager'
import type { MicrosoftTokenData } from '../../../shared/types/calendar'
import { MICROSOFT_CLIENT_ID_MISSING_ERROR } from '../../../shared/constants/auth'
import { settings } from '../../config/settings'

const SCOPES = ['Calendars.Read', 'User.Read', 'offline_access']
const REDIRECT_PORT = 3845
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/auth/callback`

export class GraphAuthService {
  private pca: PublicClientApplication | null = null
  private pcaConfigKey: string | null = null

  private normalizeConfigValue(value: unknown): string {
    if (typeof value !== 'string') {
      return ''
    }

    const normalized = value.trim()
    if (!normalized) {
      return ''
    }

    const lower = normalized.toLowerCase()
    if (lower === 'undefined' || lower === 'null') {
      return ''
    }

    return normalized
  }

  private getClientId(): string {
    const envClientId = this.normalizeConfigValue(process.env.MICROSOFT_CLIENT_ID)
    if (envClientId) return envClientId

    return this.normalizeConfigValue(settings.get('microsoftClientId'))
  }

  private getTenantId(): string {
    const envTenantId = this.normalizeConfigValue(process.env.MICROSOFT_TENANT_ID)
    if (envTenantId) return envTenantId

    const tenantFromSettings = this.normalizeConfigValue(settings.get('microsoftTenantId'))
    return tenantFromSettings || 'common'
  }

  private async getPca(): Promise<PublicClientApplication> {
    const clientId = this.getClientId()
    if (!clientId) {
      throw new Error(MICROSOFT_CLIENT_ID_MISSING_ERROR)
    }

    const tenantId = this.getTenantId()
    const configKey = `${clientId}::${tenantId}`

    if (!this.pca || this.pcaConfigKey !== configKey) {
      const config: Configuration = {
        auth: {
          clientId,
          authority: `https://login.microsoftonline.com/${tenantId}`
        }
      }
      this.pca = new PublicClientApplication(config)
      this.pcaConfigKey = configKey
    }

    return this.pca
  }

  /**
   * Check whether Microsoft auth is configured with a usable client ID.
   */
  isConfigured(): boolean {
    return this.getClientId().length > 0
  }

  /**
   * Get a valid access token, refreshing or re-authenticating as needed.
   */
  async getAccessToken(): Promise<string> {
    // 1. Check stored token
    const stored = credentialManager.getMicrosoftToken()
    if (stored && stored.expiresAt > Date.now() + 60_000) {
      return stored.accessToken
    }

    // 2. Try silent refresh
    if (stored) {
      try {
        const token = await this.refreshToken()
        if (token) return token
      } catch {
        log.info('[GraphAuth] Silent refresh failed, will re-authenticate')
      }
    }

    // 3. Interactive login
    return this.acquireTokenInteractive()
  }

  /**
   * Check if we have valid (or refreshable) credentials.
   */
  isAuthenticated(): boolean {
    if (!this.isConfigured()) {
      return false
    }

    const stored = credentialManager.getMicrosoftToken()
    return stored !== null
  }

  /**
   * Interactive OAuth flow: open browser window → capture auth code → exchange for tokens.
   */
  async acquireTokenInteractive(): Promise<string> {
    const pca = await this.getPca()

    // Generate auth code URL
    const authCodeUrl = await pca.getAuthCodeUrl({
      scopes: SCOPES,
      redirectUri: REDIRECT_URI
    })

    // Start temporary local server to capture the callback
    const authCode = await this.captureAuthCode(authCodeUrl)

    // Exchange auth code for tokens
    const result: AuthenticationResult = await pca.acquireTokenByCode({
      code: authCode,
      scopes: SCOPES,
      redirectUri: REDIRECT_URI
    })

    if (!result.accessToken) {
      throw new Error('Failed to acquire access token')
    }

    // Persist tokens
    const tokenData: MicrosoftTokenData = {
      accessToken: result.accessToken,
      refreshToken: '', // MSAL manages refresh internally via cache
      expiresAt: result.expiresOn ? result.expiresOn.getTime() : Date.now() + 3600_000,
      account: result.account?.homeAccountId
    }
    credentialManager.storeMicrosoftToken(tokenData)

    log.info('[GraphAuth] Interactive auth successful')
    return result.accessToken
  }

  /**
   * Attempt to refresh the token silently using MSAL's token cache.
   */
  private async refreshToken(): Promise<string | null> {
    const pca = await this.getPca()
    const accounts = await pca.getTokenCache().getAllAccounts()

    if (accounts.length === 0) {
      return null
    }

    const account = accounts[0]
    try {
      const result = await pca.acquireTokenSilent({
        scopes: SCOPES,
        account
      })

      if (result.accessToken) {
        const tokenData: MicrosoftTokenData = {
          accessToken: result.accessToken,
          refreshToken: '',
          expiresAt: result.expiresOn ? result.expiresOn.getTime() : Date.now() + 3600_000,
          account: result.account?.homeAccountId
        }
        credentialManager.storeMicrosoftToken(tokenData)
        log.info('[GraphAuth] Token refreshed silently')
        return result.accessToken
      }
    } catch (error) {
      log.warn('[GraphAuth] Silent refresh failed:', error)
    }

    return null
  }

  /**
   * Log out: clear stored tokens and MSAL cache.
   */
  async logout(): Promise<void> {
    credentialManager.deleteMicrosoftToken()
    if (this.pca) {
      const accounts = await this.pca.getTokenCache().getAllAccounts()
      for (const account of accounts) {
        await this.pca.getTokenCache().removeAccount(account)
      }
    }
    log.info('[GraphAuth] Logged out')
  }

  // ─── Internal: Auth code capture ──────────────────────────────

  /**
   * Open a BrowserWindow to the auth URL and capture the auth code
   * from the localhost redirect callback.
   */
  private captureAuthCode(authCodeUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let server: Server | null = null
      let authWindow: BrowserWindow | null = null

      const cleanup = (): void => {
        if (authWindow && !authWindow.isDestroyed()) {
          authWindow.close()
        }
        authWindow = null
        if (server) {
          server.close()
          server = null
        }
      }

      // Start temporary HTTP server
      server = createServer((req, res) => {
        const url = new URL(req.url || '', `http://localhost:${REDIRECT_PORT}`)

        if (url.pathname === '/auth/callback') {
          const code = url.searchParams.get('code')
          const error = url.searchParams.get('error')

          res.writeHead(200, { 'Content-Type': 'text/html' })
          if (code) {
            res.end(
              '<html><body><h2>✓ Authentication successful!</h2><p>You can close this window.</p></body></html>'
            )
            cleanup()
            resolve(code)
          } else {
            res.end(
              `<html><body><h2>✗ Authentication failed</h2><p>${error || 'Unknown error'}</p></body></html>`
            )
            cleanup()
            reject(new Error(`Auth failed: ${error}`))
          }
        }
      })

      server.listen(REDIRECT_PORT, () => {
        log.info(`[GraphAuth] Auth callback server listening on port ${REDIRECT_PORT}`)
      })

      server.on('error', (err) => {
        cleanup()
        reject(new Error(`Could not start auth server: ${err.message}`))
      })

      // Open BrowserWindow for login
      authWindow = new BrowserWindow({
        width: 500,
        height: 700,
        title: 'Sign in to Microsoft',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      authWindow.loadURL(authCodeUrl)

      authWindow.on('closed', () => {
        authWindow = null
        // If window closed without completing auth, clean up
        if (server) {
          server.close()
          server = null
          reject(new Error('Auth window closed by user'))
        }
      })
    })
  }
}

// Singleton
let instance: GraphAuthService | null = null

export function getGraphAuthService(): GraphAuthService {
  if (!instance) {
    instance = new GraphAuthService()
  }
  return instance
}
