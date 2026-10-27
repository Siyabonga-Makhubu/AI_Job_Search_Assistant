import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Frontend rendering error', error, info.componentStack)
  }

  render() {
    if (this.state.failed) {
      return <main role="alert" style={{ maxWidth: 620, margin: '12vh auto', padding: 24, fontFamily: 'sans-serif', color: '#20233b' }}><h1>Something went wrong</h1><p>The page could not be displayed. Refresh to try again.</p><button onClick={() => window.location.reload()}>Refresh page</button></main>
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </StrictMode>,
)
