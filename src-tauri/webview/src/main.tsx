import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'
import { ThemeProvider, EditorSettingsProvider } from '@apinox/request-editor'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider standalone={false}>
      <EditorSettingsProvider>
        <App />
      </EditorSettingsProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
