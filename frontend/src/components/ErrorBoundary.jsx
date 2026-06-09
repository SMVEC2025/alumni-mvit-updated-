import { Component } from 'react'

// App-wide error boundary. Catches render/lifecycle errors thrown anywhere in
// the wrapped subtree (the routed pages) so a single bad render shows a
// recoverable fallback instead of a blank white screen. Must be a class
// component — only class components can be error boundaries in React.
//
// Styling is inline on purpose: the boundary has to render even if a stylesheet
// failed to load or the error happened before styles applied.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Log full detail to the console for debugging; never shown to the user.
    console.error('[ErrorBoundary] Uncaught render error:', error, info?.componentStack)
  }

  // Reset to a clean slate. We navigate home with a hard location change so the
  // whole tree re-mounts fresh (the failed component's state is gone).
  handleReset = () => {
    this.setState({ hasError: false, error: null })
    if (typeof window !== 'undefined') window.location.assign('/')
  }

  handleReload = () => {
    if (typeof window !== 'undefined') window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV

    return (
      <div style={styles.wrap} role="alert" aria-live="assertive">
        <div style={styles.card}>
          <div style={styles.icon} aria-hidden="true">⚠️</div>
          <h1 style={styles.title}>Something went wrong</h1>
          <p style={styles.text}>
            The page hit an unexpected error. You can reload or go back to the home page.
          </p>
          {isDev && this.state.error ? (
            <pre style={styles.detail}>{String(this.state.error?.message || this.state.error)}</pre>
          ) : null}
          <div style={styles.actions}>
            <button type="button" onClick={this.handleReload} style={styles.primaryBtn}>
              Reload page
            </button>
            <button type="button" onClick={this.handleReset} style={styles.secondaryBtn}>
              Go to home
            </button>
          </div>
        </div>
      </div>
    )
  }
}

const styles = {
  wrap: {
    minHeight: '70vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: "'Futura PT', system-ui, -apple-system, sans-serif",
  },
  card: {
    maxWidth: '440px',
    width: '100%',
    textAlign: 'center',
    background: '#fff',
    border: '1px solid #e6e6e6',
    borderRadius: '14px',
    padding: '36px 28px',
    boxShadow: '0 6px 24px rgba(0,0,0,0.06)',
  },
  icon: { fontSize: '44px', lineHeight: 1, marginBottom: '12px' },
  title: { fontSize: '1.4rem', fontWeight: 700, color: '#1f2937', margin: '0 0 8px' },
  text: { fontSize: '0.96rem', color: '#6b7280', margin: '0 0 18px', lineHeight: 1.5 },
  detail: {
    textAlign: 'left',
    background: '#f9fafb',
    border: '1px solid #eee',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '0.8rem',
    color: '#b91c1c',
    overflowX: 'auto',
    margin: '0 0 18px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  actions: { display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' },
  primaryBtn: {
    padding: '10px 22px',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#fff',
    background: '#054d5a',
    border: '1px solid #054d5a',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '10px 22px',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#054d5a',
    background: '#fff',
    border: '1px solid #054d5a',
    borderRadius: '6px',
    cursor: 'pointer',
  },
}

export default ErrorBoundary
