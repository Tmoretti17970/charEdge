// ═══════════════════════════════════════════════════════════════════
// charEdge — GDPR Cookie Consent Banner
//
// Fixed-bottom banner shown when analytics consent is undecided.
// Two modes: "Accept Analytics" (opt-in) or "Necessary Only" (opt-out).
// Styled with glassmorphism + design tokens.
// ═══════════════════════════════════════════════════════════════════

import { C, F } from '../../../constants.js';
import { GLASS, DEPTH } from '../../../constants.js';
import { useConsentStore } from '../../../state/useConsentStore';
import cssStyles from './CookieConsent.module.css';

export default function CookieConsent() {
  const analytics = useConsentStore((s) => s.analytics);
  const acceptAll = useConsentStore((s) => s.acceptAll);
  const rejectAll = useConsentStore((s) => s.rejectAll);

  // Don't render if user has already made a choice
  if (analytics !== null) return null;

  return (
    <div
      id="tf-cookie-consent"
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        flexWrap: 'wrap',
        background: GLASS.heavy,
        backdropFilter: GLASS.blurMd,
        WebkitBackdropFilter: GLASS.blurMd,
        borderTop: GLASS.border,
        boxShadow: DEPTH[3],
        fontFamily: F,
      }}
      className={cssStyles.banner}
    >
      {/* Message */}
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: C.t2,
          lineHeight: 1.5,
          maxWidth: 600,
          flex: '1 1 300px',
        }}
      >
        <strong style={{ color: C.t1 }}>Your privacy matters.</strong>{' '}
        charEdge stores all trading data locally on your device.
        We use optional analytics (PostHog) to understand feature usage — never your trading data.{' '}
        <a
          href="/privacy.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: C.b, textDecoration: 'underline' }}
        >
          Privacy Policy
        </a>
      </p>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        <button
          id="tf-consent-reject"
          onClick={rejectAll}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: `1px solid ${C.bd}`,
            background: 'transparent',
            color: C.t2,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: F,
            cursor: 'pointer',
            transition: 'border-color 0.15s ease, color 0.15s ease',
          }}
          onMouseEnter={(e) => { e.target.style.borderColor = C.t3; e.target.style.color = C.t1; }}
          onMouseLeave={(e) => { e.target.style.borderColor = C.bd; e.target.style.color = C.t2; }}
        >
          Necessary Only
        </button>
        <button
          id="tf-consent-accept"
          onClick={acceptAll}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: `linear-gradient(135deg, ${C.b}, ${C.bH})`,
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            fontFamily: F,
            cursor: 'pointer',
            boxShadow: `0 2px 8px ${C.b}30`,
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
          onMouseEnter={(e) => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = `0 4px 16px ${C.b}50`; }}
          onMouseLeave={(e) => { e.target.style.transform = 'none'; e.target.style.boxShadow = `0 2px 8px ${C.b}30`; }}
        >
          Accept Analytics
        </button>
      </div>

    </div>
  );
}
