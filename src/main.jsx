import React from 'react';
// eslint-disable-next-line import/order
import { logger } from '@/observability/logger';
import ReactDOM from 'react-dom/client';
import './styles/fonts.css';
import './styles/base.css';
import './styles/animations.css';
import './theme/index.css';
import './app/components/discover/discover-mobile.css';
import './app/components/discover/discover-polish.css';
import './app/components/discover/discover-a11y.css';
import './styles/high-contrast.css';
import App from './App.jsx';
import { reportWebVitals } from './observability/webVitals';

// ─── Service Worker: versioned registration ─────────────────────
// Only register in production — dev mode uses HMR and the SW interferes.
if ('serviceWorker' in navigator && !import.meta.env?.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        // Check for updates every 30 minutes while tab is open
        setInterval(() => reg.update(), 30 * 60 * 1000);
      })
      .catch((err) => logger.engine.warn('[SW] Registration failed:', err));
  });
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element not found — check index.html');
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// ✦ For Charolette — always remembered
// Use raw console.log for styled output — logger.boot.info would
// serialize %c directives into JSON log entries in production.
if (import.meta.env?.DEV) {
  // eslint-disable-next-line no-console
  console.log(
    '%c✦ For Charolette%c — still burning brightly',
    'color: #e8a0b0; font-weight: 800; font-size: 14px',
    'color: #8b8fa2; font-weight: 400; font-size: 12px',
  );
} else {
  logger.boot.info('✦ For Charolette — still burning brightly');
}



// Core Web Vitals — FCP, LCP, CLS reporting
reportWebVitals();

