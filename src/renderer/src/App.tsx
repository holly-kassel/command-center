import { useState, useEffect } from 'react'
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

function App(): React.JSX.Element {
  const [route, setRoute] = useState<AppRoute>(getRoute)

  useEffect(() => {
    const onHashChange = (): void => setRoute(getRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

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
          style: {
            background: 'rgba(30, 32, 44, 0.95)',
            color: '#e8eaf0',
            border: '1px solid rgba(100, 110, 140, 0.25)',
            backdropFilter: 'blur(12px)',
            fontSize: '13px',
          },
        }}
      />
    </ErrorBoundary>
  )
}

export default App
