import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Catch any unhandled window-level errors or module crashes
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    // eslint-disable-next-line no-console
    console.error('[Global Window Error]:', event.error || event.message);
    const root = document.getElementById('root');
    if (root && (!root.innerHTML || root.innerHTML.trim() === '')) {
      root.innerHTML = `
        <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #0f172a; color: white; padding: 20px; font-family: system-ui, sans-serif;">
          <div style="max-width: 520px; width: 100%; background: #1e293b; padding: 32px; border-radius: 20px; border: 1px solid #334155; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
            <h2 style="color: #f43f5e; margin-top: 0; font-size: 20px; font-weight: 800;">Console Initialization Error</h2>
            <p style="font-size: 12px; color: #cbd5e1; background: #020617; padding: 14px; border-radius: 10px; font-family: monospace; word-break: break-all;">
              ${event.message || event.error || 'Unknown initialization error'}
            </p>
            <div style="margin-top: 20px;">
              <button onclick="localStorage.clear(); window.location.reload();" style="background: #6366f1; color: white; border: none; padding: 12px 20px; border-radius: 10px; cursor: pointer; font-weight: 700; font-size: 13px;">
                Clear Cache & Reload Console
              </button>
            </div>
          </div>
        </div>
      `;
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
