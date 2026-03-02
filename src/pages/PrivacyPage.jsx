// ═══════════════════════════════════════════════════════════════════
// charEdge — Privacy Policy Page (Tier 3.4)
//
// Static legal page covering data collection, local storage,
// third-party APIs, analytics consent, and GDPR data rights.
// ═══════════════════════════════════════════════════════════════════

import { C, F, M } from '../constants.js';

const SECTION_STYLE = {
  marginBottom: 28,
};

const HEADING_STYLE = {
  fontSize: 16,
  fontWeight: 700,
  fontFamily: F,
  color: C.t1,
  marginBottom: 8,
};

const TEXT_STYLE = {
  fontSize: 13,
  fontFamily: F,
  color: C.t2,
  lineHeight: 1.7,
  marginBottom: 8,
};

const LIST_STYLE = {
  fontSize: 13,
  fontFamily: F,
  color: C.t2,
  lineHeight: 1.8,
  paddingLeft: 20,
  marginBottom: 8,
};

export default function PrivacyPage() {
  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '32px 40px',
        maxWidth: 720,
      }}
    >
      {/* Page Header */}
      <h1
        style={{
          fontSize: 24,
          fontWeight: 800,
          fontFamily: F,
          color: C.t1,
          letterSpacing: '-0.02em',
          marginBottom: 4,
        }}
      >
        🔒 Privacy Policy
      </h1>
      <p
        style={{
          fontSize: 12,
          fontFamily: M,
          color: C.t3,
          marginBottom: 28,
        }}
      >
        Last updated: March 2026
      </p>

      {/* ─── Overview ─────────────────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>Overview</h2>
        <p style={TEXT_STYLE}>
          charEdge is a <strong>client-side trading analytics application</strong>. Your
          data stays on your device. We do not operate servers that store your
          trades, settings, or personal information. This policy explains what
          data the app handles and how.
        </p>
      </section>

      {/* ─── Data We Collect ──────────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>Data We Collect</h2>
        <p style={TEXT_STYLE}>
          charEdge stores all user data <strong>locally in your browser</strong> using:
        </p>
        <ul style={LIST_STYLE}>
          <li><strong>IndexedDB</strong> — Trade journal entries, cached market data, settings</li>
          <li><strong>localStorage</strong> — UI preferences, encrypted API keys, consent choices</li>
          <li><strong>Origin Private File System (OPFS)</strong> — Offline data backups</li>
          <li><strong>Cache Storage</strong> — Service worker cache for offline access</li>
        </ul>
        <p style={TEXT_STYLE}>
          None of this data leaves your device unless you explicitly export it or
          connect to a cloud sync service.
        </p>
      </section>

      {/* ─── Third-Party Services ─────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>Third-Party Services</h2>
        <p style={TEXT_STYLE}>
          charEdge connects to the following external services for market data:
        </p>
        <ul style={LIST_STYLE}>
          <li>
            <strong>Binance API</strong> — Cryptocurrency OHLCV data and WebSocket streams.
            Binance may see your IP address and requested symbols.
          </li>
          <li>
            <strong>Polygon.io</strong> — Equities data (requires user-provided API key).
            Polygon may see your IP address and requested symbols.
          </li>
          <li>
            <strong>Pyth Network</strong> — Decentralized price feeds via SSE.
            Pyth endpoints may see your IP address.
          </li>
          <li>
            <strong>Yahoo Finance (via proxy)</strong> — Historical data fallback.
            Proxied through the server to protect your IP.
          </li>
        </ul>
        <p style={TEXT_STYLE}>
          We do not sell, share, or transmit your trading activity to any
          third party.
        </p>
      </section>

      {/* ─── Analytics ────────────────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>Analytics &amp; Telemetry</h2>
        <p style={TEXT_STYLE}>
          charEdge includes <strong>opt-in</strong> anonymous usage analytics
          (powered by PostHog). Analytics are <strong>disabled by default</strong> and
          only activated when you explicitly opt in via Settings → Data &amp; Privacy.
        </p>
        <p style={TEXT_STYLE}>
          When enabled, analytics collect:
        </p>
        <ul style={LIST_STYLE}>
          <li>Page views and feature usage (anonymized)</li>
          <li>Performance metrics (Core Web Vitals)</li>
          <li>Error reports (stack traces only, no personal data)</li>
        </ul>
        <p style={TEXT_STYLE}>
          Analytics <strong>never</strong> collect: trade data, symbol names, account
          balances, API keys, or any personally identifiable information.
        </p>
      </section>

      {/* ─── API Key Security ─────────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>API Key Security</h2>
        <p style={TEXT_STYLE}>
          API keys you provide (Polygon, FMP, etc.) are stored locally using
          <strong> AES-256-GCM encryption</strong> via the Web Crypto API. Keys are:
        </p>
        <ul style={LIST_STYLE}>
          <li>Encrypted before storage in localStorage</li>
          <li>Decrypted only in-memory when needed for API requests</li>
          <li>Never transmitted to our servers</li>
          <li>Optionally protected by a user-provided passphrase</li>
        </ul>
      </section>

      {/* ─── Your Rights (GDPR) ───────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>Your Rights (GDPR)</h2>
        <p style={TEXT_STYLE}>
          Because your data is stored locally, you have full control:
        </p>
        <ul style={LIST_STYLE}>
          <li>
            <strong>Right of Access (Art. 15)</strong> — Export all your data as JSON
            via Settings → Data &amp; Privacy → Export My Data
          </li>
          <li>
            <strong>Right to Erasure (Art. 17)</strong> — Delete all data via
            Settings → Data &amp; Privacy → Delete Everything. This clears
            IndexedDB, localStorage, OPFS, service workers, and browser caches.
          </li>
          <li>
            <strong>Right to Withdraw Consent</strong> — Toggle analytics
            consent at any time via Settings → Data &amp; Privacy
          </li>
        </ul>
      </section>

      {/* ─── Cookies ──────────────────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>Cookies</h2>
        <p style={TEXT_STYLE}>
          charEdge does not use traditional cookies. The app uses
          localStorage and IndexedDB for persistence, and a service worker
          for offline caching. No tracking cookies are set.
        </p>
      </section>

      {/* ─── Children ─────────────────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>Children&apos;s Privacy</h2>
        <p style={TEXT_STYLE}>
          charEdge is a financial analysis tool intended for users 18 years
          and older. We do not knowingly collect data from children.
        </p>
      </section>

      {/* ─── Contact ──────────────────────────────────────────── */}
      <section style={{ ...SECTION_STYLE, marginBottom: 60 }}>
        <h2 style={HEADING_STYLE}>Contact</h2>
        <p style={TEXT_STYLE}>
          For privacy-related questions, please open an issue on our GitHub
          repository or contact the development team.
        </p>
      </section>
    </div>
  );
}
