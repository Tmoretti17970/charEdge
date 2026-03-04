// ═══════════════════════════════════════════════════════════════════
// charEdge — Pricing Page (Task 2.2.4)
//
// 3-tier subscription pricing with glassmorphism cards, hover
// animations, and live feature comparison. Uses project design tokens.
// ═══════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { C, F, M } from '../constants.js';
import { useUIStore } from '../state/useUIStore.js';
import { useSubscriptionStore } from '../state/useSubscriptionStore.js';
import { GLASS, DEPTH } from '../constants/theme.js';

// ─── Plan Data ───────────────────────────────────────────────────

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Everything you need to start trading smarter.',
    accent: C.t2,
    features: [
      { label: 'GPU charting engine', included: true },
      { label: 'Trade journal & P&L', included: true },
      { label: 'Up to 4 charts', included: true },
      { label: 'Up to 500 trades', included: true },
      { label: 'CSV export', included: true },
      { label: 'AI Coach (Char)', included: false },
      { label: 'GPU compute shaders', included: false },
      { label: 'Script engine', included: false },
      { label: 'Cloud sync', included: false },
    ],
    cta: 'Get Started Free',
    popular: false,
  },
  {
    id: 'trader',
    name: 'Trader',
    price: '$14.99',
    period: '/mo',
    description: 'Intelligent analysis and expanded capacity.',
    accent: C.b,
    features: [
      { label: 'GPU charting engine', included: true },
      { label: 'Trade journal & P&L', included: true },
      { label: 'Up to 8 charts', included: true },
      { label: 'Up to 5,000 trades', included: true },
      { label: 'CSV + JSON export', included: true },
      { label: 'AI Coach (Char)', included: true },
      { label: 'GPU compute shaders', included: false },
      { label: 'Script engine', included: false },
      { label: 'Cloud sync', included: false },
    ],
    cta: 'Upgrade to Trader',
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$29.99',
    period: '/mo',
    description: 'Full power. GPU compute, scripting, cloud sync.',
    accent: C.p,
    features: [
      { label: 'GPU charting engine', included: true },
      { label: 'Trade journal & P&L', included: true },
      { label: 'Up to 16 charts', included: true },
      { label: 'Unlimited trades', included: true },
      { label: 'All export formats', included: true },
      { label: 'AI Coach (Char)', included: true },
      { label: 'GPU compute shaders', included: true },
      { label: 'Script engine', included: true },
      { label: 'Cloud sync + auto-import', included: true },
    ],
    cta: 'Go Pro',
    popular: false,
  },
];

// ─── Check Icon ──────────────────────────────────────────────────

function CheckIcon({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon({ color }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─── Pricing Card ────────────────────────────────────────────────

function PricingCard({ plan, currentPlan, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const isCurrent = currentPlan === plan.id;
  const isPopular = plan.popular;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: '1 1 320px',
        maxWidth: 380,
        position: 'relative',
        background: hovered ? C.sf2 : C.sf,
        border: isPopular
          ? `2px solid ${plan.accent}50`
          : hovered
            ? GLASS.borderHover
            : `1px solid ${C.bd}`,
        borderRadius: 20,
        padding: '32px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hovered ? 'translateY(-8px) scale(1.02)' : isPopular ? 'scale(1.02)' : 'none',
        boxShadow: isPopular
          ? `0 16px 56px ${plan.accent}20, ${DEPTH[2]}`
          : hovered
            ? DEPTH[3]
            : DEPTH[1],
      }}
    >
      {/* Popular badge */}
      {isPopular && (
        <div
          style={{
            position: 'absolute',
            top: -14,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '5px 20px',
            borderRadius: 20,
            background: `linear-gradient(135deg, ${C.b}, ${C.y})`,
            color: '#fff',
            fontSize: 11,
            fontWeight: 800,
            fontFamily: F,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            boxShadow: `0 4px 12px ${C.b}40`,
          }}
        >
          Most Popular
        </div>
      )}

      {/* Plan name */}
      <div>
        <h3
          style={{
            fontSize: 22,
            fontWeight: 800,
            fontFamily: F,
            color: C.t1,
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          {plan.name}
        </h3>
        <p
          style={{
            fontSize: 13,
            fontFamily: F,
            color: C.t3,
            margin: '6px 0 0',
            lineHeight: 1.5,
          }}
        >
          {plan.description}
        </p>
      </div>

      {/* Price */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span
          style={{
            fontSize: 48,
            fontWeight: 800,
            fontFamily: M,
            color: C.t1,
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}
        >
          {plan.price}
        </span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            fontFamily: F,
            color: C.t3,
          }}
        >
          {plan.period}
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: C.bd, borderRadius: 1 }} />

      {/* Features */}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {plan.features.map((feat) => (
          <li
            key={feat.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              fontFamily: F,
              color: feat.included ? C.t2 : C.t3,
              opacity: feat.included ? 1 : 0.5,
            }}
          >
            {feat.included
              ? <CheckIcon color={plan.accent} />
              : <XIcon color={C.t3} />
            }
            {feat.label}
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <button
        onClick={() => onSelect(plan.id)}
        disabled={isCurrent}
        style={{
          width: '100%',
          padding: '14px 24px',
          borderRadius: 12,
          border: isCurrent
            ? `1px solid ${C.bd}`
            : plan.id === 'free'
              ? `1px solid ${C.bd2}`
              : 'none',
          background: isCurrent
            ? 'transparent'
            : plan.id === 'free'
              ? 'transparent'
              : `linear-gradient(135deg, ${plan.accent}, ${plan.id === 'trader' ? C.y : '#a78bfa'})`,
          color: isCurrent
            ? C.t3
            : plan.id === 'free'
              ? C.t1
              : '#fff',
          fontSize: 14,
          fontWeight: 700,
          fontFamily: F,
          cursor: isCurrent ? 'default' : 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: !isCurrent && plan.id !== 'free'
            ? `0 4px 16px ${plan.accent}30`
            : 'none',
          letterSpacing: '-0.01em',
        }}
      >
        {isCurrent ? '✓ Current Plan' : plan.cta}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function PricingPage() {
  const setPage = useUIStore((s) => s.setPage);
  const currentPlan = useSubscriptionStore((s) => s.plan);
  const stripeConfigured = useSubscriptionStore((s) => s.stripeConfigured);

  const handleSelect = (planId) => {
    if (planId === 'free') {
      setPage('journal');
      return;
    }
    // If Stripe isn't configured, show a message
    if (!stripeConfigured) {
      console.info(`[Pricing] Stripe not configured. Selected plan: ${planId}`);
      setPage('journal');
      return;
    }
    // Trigger checkout (placeholder — needs auth token)
    useSubscriptionStore.getState().checkout(planId, null);
  };

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        background: C.bg,
        scrollBehavior: 'smooth',
      }}
    >
      {/* ═══ HEADER ═══════════════════════════════════════════════ */}
      <section
        id="pricing-header"
        style={{
          padding: '80px 24px 20px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Ambient glow */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            top: '30%',
            transform: 'translate(-50%, -50%)',
            width: 600,
            height: 400,
            borderRadius: '50%',
            background: `radial-gradient(ellipse, ${C.b}08, transparent 70%)`,
            pointerEvents: 'none',
          }}
        />

        <h1
          style={{
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontWeight: 800,
            fontFamily: F,
            color: C.t1,
            letterSpacing: '-0.04em',
            lineHeight: 1.15,
            margin: 0,
            position: 'relative',
          }}
        >
          Simple, Transparent{' '}
          <span
            style={{
              background: `linear-gradient(135deg, ${C.b}, ${C.y})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Pricing
          </span>
        </h1>

        <p
          style={{
            fontSize: 'clamp(15px, 2vw, 18px)',
            fontWeight: 500,
            fontFamily: F,
            color: C.t2,
            marginTop: 14,
            marginBottom: 0,
            maxWidth: 480,
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: 1.6,
            position: 'relative',
          }}
        >
          Start free. Upgrade when you're ready. Cancel anytime.
        </p>
      </section>

      {/* ═══ PRICING CARDS ════════════════════════════════════════ */}
      <section
        id="pricing-cards"
        style={{
          padding: '40px 24px 80px',
          maxWidth: 1240,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 24,
          justifyContent: 'center',
          alignItems: 'stretch',
        }}
      >
        {PLANS.map((plan) => (
          <PricingCard
            key={plan.id}
            plan={plan}
            currentPlan={currentPlan}
            onSelect={handleSelect}
          />
        ))}
      </section>

      {/* ═══ FAQ / TRUST ══════════════════════════════════════════ */}
      <section
        id="pricing-trust"
        style={{
          padding: '60px 24px',
          borderTop: `1px solid ${C.bd}`,
          textAlign: 'center',
          background: C.bg2,
        }}
      >
        <h2
          style={{
            fontSize: 22,
            fontWeight: 800,
            fontFamily: F,
            color: C.t1,
            marginBottom: 24,
            letterSpacing: '-0.02em',
          }}
        >
          Frequently Asked Questions
        </h2>

        <div
          style={{
            maxWidth: 640,
            margin: '0 auto',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <FAQItem
            q="Can I try everything before paying?"
            a="Yes! The free plan gives you full access to the GPU charting engine and trade journal. Upgrade only when you want AI coaching or advanced features."
          />
          <FAQItem
            q="What payment methods do you accept?"
            a="We use Stripe for secure payments. All major credit cards, debit cards, and Apple Pay / Google Pay are supported."
          />
          <FAQItem
            q="Can I cancel anytime?"
            a="Absolutely. No contracts, no hidden fees. Cancel from your account settings and you'll keep access until the end of your billing period."
          />
          <FAQItem
            q="Is my data safe?"
            a="100% client-side by default. Your trades and journal entries stay in your browser. Cloud sync (Pro plan) uses end-to-end encryption."
          />
        </div>

        {/* Back to app */}
        <div style={{ marginTop: 48 }}>
          <button
            onClick={() => setPage('journal')}
            style={{
              background: 'none',
              border: `1px solid ${C.bd}`,
              color: C.t2,
              padding: '10px 24px',
              borderRadius: 10,
              fontFamily: F,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            ← Back to App
          </button>
        </div>
      </section>

      {/* ═══ ANIMATIONS ═══════════════════════════════════════════ */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  );
}

// ─── FAQ Item ────────────────────────────────────────────────────

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        background: C.sf,
        border: `1px solid ${C.bd}`,
        borderRadius: 12,
        padding: '16px 20px',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onClick={() => setOpen(!open)}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: F, color: C.t1 }}>
          {q}
        </span>
        <span
          style={{
            fontSize: 18,
            color: C.t3,
            transition: 'transform 0.2s',
            transform: open ? 'rotate(45deg)' : 'none',
            flexShrink: 0,
            marginLeft: 12,
          }}
        >
          +
        </span>
      </div>
      {open && (
        <p
          style={{
            fontSize: 13,
            fontFamily: F,
            color: C.t2,
            lineHeight: 1.65,
            marginTop: 12,
            marginBottom: 0,
          }}
        >
          {a}
        </p>
      )}
    </div>
  );
}
