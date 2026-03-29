import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'
import { tokens } from './styles/tokens'
import { ThemeProvider, EditorSettingsProvider, DEFAULT_EDITOR_SETTINGS } from '@apinox/request-editor'
import type { EditorSettings } from '@apinox/request-editor'

// Persist editor settings across sessions
const EDITOR_SETTINGS_KEY = 'apiprox-editor-settings';
function loadPersistedSettings(): Partial<EditorSettings> {
  try {
    const raw = localStorage.getItem(EDITOR_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}
function persistSettings(s: EditorSettings) {
  try { localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

const initialEditorSettings: Partial<EditorSettings> = {
  ...DEFAULT_EDITOR_SETTINGS,
  ...loadPersistedSettings(),
};

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
        <EditorSettingsProvider initialSettings={initialEditorSettings} onSettingsChange={persistSettings}>
          <App />
        </EditorSettingsProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
