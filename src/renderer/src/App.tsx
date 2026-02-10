import { useState, useEffect, useMemo } from 'react'
import { Toaster } from 'react-hot-toast'
import { Dashboard } from './windows/Dashboard/Dashboard'
import { QuickCaptureOverlay } from './windows/QuickCapture/QuickCaptureOverlay'
import { WhatsNextOverlay } from './windows/WhatsNext/WhatsNextOverlay'
import { ErrorBoundary } from './components/ErrorBoundary'
import { OfflineBanner } from './components/OfflineBanner'

type AppRoute = 'dashboard' | 'quick-capture' | 'whats-next'

function getRoute(): AppRoute {
  const hash = window.location.hash.replace('#/', '').replace('#', '')
  if (hash === 'quick-capture') return 'quick-capture'
  if (hash === 'whats-next') return 'whats-next'
  return 'dashboard'
}

/** Resolve effective theme: 'system' checks OS preference */
function resolveTheme(theme: string): 'dark' | 'light' {
  if (theme === 'light') return 'light'
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'dark'
}

function App(): React.JSX.Element {
  const [route, setRoute] = useState<AppRoute>(getRoute)
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark')

  useEffect(() => {
    const onHashChange = (): void => setRoute(getRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Load theme from settings and listen for changes
  useEffect(() => {
    window.api.settings.get('theme').then((t) => {
      if (t) setTheme(t as 'dark' | 'light' | 'system')
    })

    // Poll for theme changes when settings are saved (simple approach)
    const interval = setInterval(async () => {
      const t = await window.api.settings.get('theme')
      if (t) setTheme(t as 'dark' | 'light' | 'system')
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Apply theme to <html> element
  const resolved = resolveTheme(theme)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved)
    // Also update body background for the transition
    document.body.style.background = resolved === 'light' ? '#f8f9fb' : '#0f1117'
  }, [resolved])

  // Listen for OS theme changes when set to 'system'
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (): void => {
      document.documentElement.setAttribute('data-theme', resolveTheme('system'))
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  // Theme-aware toast styles
  const toastStyle = useMemo(
    () =>
      resolved === 'light'
        ? {
            background: 'rgba(255, 255, 255, 0.95)',
            color: '#1f2937',
            border: '1px solid rgba(209, 213, 219, 0.5)',
            backdropFilter: 'blur(12px)',
            fontSize: '13px',
          }
        : {
            background: 'rgba(30, 32, 44, 0.95)',
            color: '#e8eaf0',
            border: '1px solid rgba(100, 110, 140, 0.25)',
            backdropFilter: 'blur(12px)',
            fontSize: '13px',
          },
    [resolved]
  )

  // Overlays don't need ErrorBoundary/Toaster chrome
  if (route === 'quick-capture') return <QuickCaptureOverlay />
  if (route === 'whats-next') return <WhatsNextOverlay />

  return (
    <ErrorBoundary>
      <OfflineBanner />
      <Dashboard />
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: toastStyle,
        }}
      />
    </ErrorBoundary>
  )
}

export default App
