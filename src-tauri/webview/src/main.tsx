import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'
import { tokens } from './styles/tokens'
import { ThemeProvider, EditorSettingsProvider } from '@apinox/request-editor'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, color: '#f88', fontFamily: 'monospace', background: tokens.surface.base, height: '100vh', overflow: 'auto' }}>
          <h2 style={{ marginBottom: 12, color: tokens.text.danger }}>Render Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.5 }}>{this.state.error.stack ?? this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider standalone={false}>
        <EditorSettingsProvider>
          <App />
        </EditorSettingsProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
