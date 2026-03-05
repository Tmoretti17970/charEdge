import React from 'react';
import { logger } from './utils/logger.ts';
import ReactDOM from 'react-dom/client';
import './styles/fonts.css';
import './styles/base.css';
import './styles/animations.css';
import './theme/index.css';
import './app/components/discover/discover-mobile.css';
import './app/components/discover/discover-polish.css';
import './app/components/discover/discover-a11y.css';
import App from './App.jsx';
import { reportWebVitals } from './utils/webVitals.js';

// ─── Nuclear: kill ALL service workers + caches on load ──────────
// This fixes blank screens caused by stale cached content, especially on Safari iOS.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((reg) => reg.unregister());
  });
  if ('caches' in window) {
    caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// ✦ For Charolette — always remembered
logger.boot.info(
  '%c✦ For Charolette%c — still burning brightly',
  'color: #e8a0b0; font-weight: 800; font-size: 14px',
  'color: #8b8fa2; font-weight: 400; font-size: 12px',
);

// Service workers disabled — see nuclear cleanup above

// Core Web Vitals — FCP, LCP, CLS reporting
reportWebVitals();

