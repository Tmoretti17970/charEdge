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
import { registerSW } from './registerSW.js';
import { reportWebVitals } from './utils/webVitals.js';

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

// Register service worker for PWA support (production only)
registerSW();

// Core Web Vitals — FCP, LCP, CLS reporting
reportWebVitals();

