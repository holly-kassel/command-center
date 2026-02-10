import { useState, useEffect } from 'react'
import { Dashboard } from './windows/Dashboard/Dashboard'
import { QuickCaptureOverlay } from './windows/QuickCapture/QuickCaptureOverlay'
import { WhatsNextOverlay } from './windows/WhatsNext/WhatsNextOverlay'

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

  switch (route) {
    case 'quick-capture':
      return <QuickCaptureOverlay />
    case 'whats-next':
      return <WhatsNextOverlay />
    default:
      return <Dashboard />
  }
}

export default App
