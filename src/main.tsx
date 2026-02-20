import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import './i18n'
import App from './App.tsx'
import SkillDetail from './pages/SkillDetail.tsx'
import ErrorBoundary from './ErrorBoundary.tsx'

// Global error handler to catch uncaught errors in Tauri WebView
window.addEventListener('error', (event) => {
  const rootEl = document.getElementById('root')
  if (rootEl) {
    rootEl.innerHTML = `<pre style="color:red;padding:20px;white-space:pre-wrap;">UNCAUGHT ERROR:\n${event.message}\n\nFile: ${event.filename}\nLine: ${event.lineno}\nCol: ${event.colno}\n\nStack: ${event.error?.stack ?? 'N/A'}</pre>`
  }
})

window.addEventListener('unhandledrejection', (event) => {
  const rootEl = document.getElementById('root')
  if (rootEl && !rootEl.hasChildNodes()) {
    rootEl.innerHTML = `<pre style="color:red;padding:20px;white-space:pre-wrap;">UNHANDLED PROMISE REJECTION:\n${event.reason}\n\nStack: ${event.reason?.stack ?? 'N/A'}</pre>`
  }
})

const rootElement = document.getElementById('root')!
if (!rootElement) {
  throw new Error('Root element not found')
}

try {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/skills" element={<Navigate to="/" replace />} />
            <Route path="/skill/:skillId" element={<SkillDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  )
} catch (renderError) {
  rootElement.innerHTML = `<pre style="color:red;padding:20px;white-space:pre-wrap;">RENDER ERROR:\n${renderError}\n\nStack: ${(renderError as Error)?.stack ?? 'N/A'}</pre>`
}