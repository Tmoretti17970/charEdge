// ═══════════════════════════════════════════════════════════════════
// charEdge — Terms of Service Page (Task 2.1.3)
//
// Static legal page covering acceptance of terms, service
// description, acceptable use, financial disclaimers, IP,
// limitation of liability, termination, and governing law.
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

export default function TermsPage() {
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
        📜 Terms of Service
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

      {/* ─── Acceptance ───────────────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>1. Acceptance of Terms</h2>
        <p style={TEXT_STYLE}>
          By accessing or using <strong>charEdge</strong> (&quot;the Service&quot;), you agree
          to be bound by these Terms of Service. If you do not agree with any
          part of these terms, you must not use the Service.
        </p>
      </section>

      {/* ─── Service Description ──────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>2. Description of Service</h2>
        <p style={TEXT_STYLE}>
          charEdge is a <strong>client-side trading analytics and charting
          platform</strong>. The Service provides:
        </p>
        <ul style={LIST_STYLE}>
          <li>Real-time and historical market data visualization</li>
          <li>Technical analysis tools and indicators</li>
          <li>Trade journaling and performance analytics</li>
          <li>AI-assisted educational chart analysis</li>
          <li>Paper trading simulation (when enabled)</li>
        </ul>
        <p style={TEXT_STYLE}>
          The Service operates primarily in your browser. Your data is stored
          locally on your device unless you explicitly connect to external
          services.
        </p>
      </section>

      {/* ─── User Accounts ────────────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>3. User Accounts</h2>
        <p style={TEXT_STYLE}>
          Certain features may require you to provide API keys for third-party
          data services (e.g., Polygon.io, FMP). You are responsible for:
        </p>
        <ul style={LIST_STYLE}>
          <li>Maintaining the security of your API keys</li>
          <li>Complying with the terms of service of data providers</li>
          <li>Any charges incurred through your use of third-party APIs</li>
        </ul>
      </section>

      {/* ─── Acceptable Use ───────────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>4. Acceptable Use</h2>
        <p style={TEXT_STYLE}>
          You agree not to:
        </p>
        <ul style={LIST_STYLE}>
          <li>Use the Service to manipulate markets or engage in illegal trading</li>
          <li>Reverse-engineer, decompile, or extract the source code beyond what is permitted by applicable law</li>
          <li>Abuse API rate limits or interfere with Service availability</li>
          <li>Redistribute, resell, or sublicense the Service without authorization</li>
          <li>Use the Service to violate any applicable laws or regulations</li>
        </ul>
      </section>

      {/* ─── Financial Disclaimer ─────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>5. Financial Disclaimer</h2>
        <div
          style={{
            background: `${C.y || '#F59E0B'}10`,
            border: `1px solid ${C.y || '#F59E0B'}30`,
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 10,
          }}
        >
          <p style={{ ...TEXT_STYLE, color: C.t1, fontWeight: 600, marginBottom: 6 }}>
            ⚠️ Educational analysis only — not financial advice.
          </p>
          <p style={{ ...TEXT_STYLE, marginBottom: 0 }}>
            charEdge and its AI features provide <strong>educational analysis
            only</strong>. Nothing in the Service constitutes financial, investment,
            or trading advice. Past performance does not guarantee future results.
            Trading involves substantial risk of loss. You should consult a
            qualified financial advisor before making investment decisions.
          </p>
        </div>
        <p style={TEXT_STYLE}>
          charEdge is not a registered investment advisor, broker-dealer, or
          financial planner. All trading decisions are made solely by the user.
        </p>
      </section>

      {/* ─── Intellectual Property ────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>6. Intellectual Property</h2>
        <p style={TEXT_STYLE}>
          The Service, including its code, design, charting engine, GPU shaders,
          and documentation, is the intellectual property of the charEdge team.
          All rights are reserved unless otherwise stated.
        </p>
        <p style={TEXT_STYLE}>
          You retain full ownership of your trade data, journal entries, notes,
          and any content you create within the Service.
        </p>
      </section>

      {/* ─── Third-Party Services ─────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>7. Third-Party Services</h2>
        <p style={TEXT_STYLE}>
          charEdge integrates with third-party data providers (Binance,
          Polygon.io, Pyth Network, Yahoo Finance). Your use of these services
          is governed by their respective terms and privacy policies. charEdge
          is not responsible for the availability, accuracy, or terms of
          third-party services.
        </p>
      </section>

      {/* ─── Limitation of Liability ──────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>8. Limitation of Liability</h2>
        <p style={TEXT_STYLE}>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTY OF ANY KIND, EXPRESS
          OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
          PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
        </p>
        <p style={TEXT_STYLE}>
          IN NO EVENT SHALL CHAREDGE, ITS CREATORS, OR CONTRIBUTORS BE LIABLE
          FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
          DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR
          TRADING LOSSES, ARISING FROM YOUR USE OF THE SERVICE.
        </p>
      </section>

      {/* ─── Data & Privacy ───────────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>9. Data &amp; Privacy</h2>
        <p style={TEXT_STYLE}>
          Your use of the Service is also governed by our Privacy Policy, which
          describes how data is handled, stored, and protected. Your data
          remains on your device; we do not operate servers that store personal
          information.
        </p>
      </section>

      {/* ─── Termination ──────────────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>10. Termination</h2>
        <p style={TEXT_STYLE}>
          You may stop using the Service at any time. Because your data is
          stored locally, simply closing the app or clearing browser data
          effectively terminates your use. We reserve the right to suspend
          access to hosted services (API proxy, cloud features) for users who
          violate these terms.
        </p>
      </section>

      {/* ─── Changes to Terms ─────────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>11. Changes to These Terms</h2>
        <p style={TEXT_STYLE}>
          We may update these Terms from time to time. Changes will be posted
          in the application with an updated &quot;Last updated&quot; date. Continued use
          of the Service after changes constitutes acceptance of the revised terms.
        </p>
      </section>

      {/* ─── Governing Law ────────────────────────────────────── */}
      <section style={SECTION_STYLE}>
        <h2 style={HEADING_STYLE}>12. Governing Law</h2>
        <p style={TEXT_STYLE}>
          These Terms shall be governed by and construed in accordance with the
          laws of the United States. Any disputes arising under these Terms
          shall be resolved through binding arbitration.
        </p>
      </section>

      {/* ─── Contact ──────────────────────────────────────────── */}
      <section style={{ ...SECTION_STYLE, marginBottom: 60 }}>
        <h2 style={HEADING_STYLE}>13. Contact</h2>
        <p style={TEXT_STYLE}>
          For questions about these Terms of Service, please open an issue on
          our GitHub repository or contact the development team.
        </p>
      </section>
    </div>
  );
}
