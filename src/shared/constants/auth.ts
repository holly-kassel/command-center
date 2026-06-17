export const MICROSOFT_CLIENT_ID_MISSING_ERROR =
  'MICROSOFT_CLIENT_ID not set. Add it to .env or Settings.'

const MICROSOFT_AUTH_CONFIG_ERROR_MARKERS = [
  'MICROSOFT_CLIENT_ID not set',
  'MICROSOFT_TENANT_ID not set'
]

export function isMicrosoftAuthConfigurationError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return MICROSOFT_AUTH_CONFIG_ERROR_MARKERS.some((marker) => message.includes(marker))
}
