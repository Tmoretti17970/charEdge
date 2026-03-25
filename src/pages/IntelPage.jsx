// ═══════════════════════════════════════════════════════════════════
// charEdge — Intel Page (Discover Tab Redesign)
//
// Your one-stop market intelligence hub. Organized as a narrative
// flow matching how traders actually think in the morning:
//
//   Tier 1: The Brief      — AI-narrated market summary
//   Tier 2: Market Pulse   — Compact ticker strip + sentiment
//   Tier 3: Signals        — Options flow, insider, technical, whale
//   Tier 4: Research       — Sector maps, screeners, earnings, analysts
//   Tier 5: Macro          — Economic calendar + prediction markets
//   Tier 6: Copilot        — Context-aware AI research assistant
//
// Layout presets adapt to trading style:
//   Day Trader | Swing | Investor | Learner
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { C, F } from '../constants.js';
import { useLayoutStore } from '../state/useLayoutStore.js';
import { alpha } from '@/shared/colorUtils';

// ─── Lazy-loaded section components ──────────────────────────────
const TheBrief = React.lazy(() => import('../app/components/intel/TheBrief.jsx'));
const MarketPulse = React.lazy(() => import('../app/components/intel/MarketPulse.jsx'));
const SignalsSection = React.lazy(() => import('../app/components/intel/SignalsSection.jsx'));
const ResearchSection = React.lazy(() => import('../app/components/intel/ResearchSection.jsx'));
const MacroSection = React.lazy(() => import('../app/components/intel/MacroSection.jsx'));
const IntelCopilot = React.lazy(() => import('../app/components/intel/IntelCopilot.jsx'));

// ─── Layout Presets ──────────────────────────────────────────────
const PERSONAS = [
  { id: 'daytrader', label: 'Day Trader', icon: '\u{1F4CA}', description: 'Flow + screeners + news' },
  { id: 'swing', label: 'Swing', icon: '\u{1F4C8}', description: 'Technicals + sectors + earnings' },
  { id: 'investor', label: 'Investor', icon: '\u{1F4BC}', description: 'Fundamentals + macro + analyst' },
  { id: 'learner', label: 'Learner', icon: '\u{1F393}', description: 'Briefing + education + basics' },
];

// ─── Section Skeleton ────────────────────────────────────────────
function SectionSkeleton() {
  return (
    <div style={{ padding: '20px 0' }} aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="tf-skeleton-pulse"
          style={{
            height: 14,
            background: alpha(C.t3, 0.08),
            borderRadius: 6,
            marginBottom: 10,
            width: `${90 - i * 15}%`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Section Wrapper with scroll tracking ────────────────────────
function SectionBlock({ id, title, icon, children, style }) {
  return (
    <section
      id={`intel-section-${id}`}
      aria-labelledby={`intel-heading-${id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        ...style,
      }}
    >
      {title && (
        <div
          id={`intel-heading-${id}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: C.t1,
              fontFamily: F,
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h2>
        </div>
      )}
      {children}
    </section>
  );
}

// ─── Persona Selector ────────────────────────────────────────────
function PersonaSelector({ active, onSelect }) {
  return (
    <div
      role="radiogroup"
      aria-label="Trading style preset"
      style={{
        display: 'flex',
        gap: 6,
        padding: 3,
        background: alpha(C.sf, 0.5),
        borderRadius: 12,
        border: `1px solid ${C.bd}`,
      }}
    >
      {PERSONAS.map((p) => {
        const isActive = active === p.id;
        return (
          <button
            key={p.id}
            role="radio"
            aria-checked={isActive}
            onClick={() => onSelect(p.id)}
            title={p.description}
            style={{
              padding: '6px 12px',
              borderRadius: 9,
              border: 'none',
              background: isActive
                ? `linear-gradient(135deg, ${alpha(C.b, 0.18)}, ${alpha(C.b, 0.08)})`
                : 'transparent',
              color: isActive ? C.b : C.t3,
              cursor: 'pointer',
              fontWeight: isActive ? 700 : 600,
              fontSize: 11,
              fontFamily: F,
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 13 }}>{p.icon}</span>
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Intel Page
// ═════════════════════════════════════════════════════════════════
function IntelPage() {
  const discoverPreset = useLayoutStore((s) => s.discoverPreset);
  const applyDiscoverPreset = useLayoutStore((s) => s.applyDiscoverPreset);

  const [activeSection, setActiveSection] = useState('brief');
  const [persona, setPersona] = useState(discoverPreset || 'daytrader');
  const pageRef = useRef(null);

  // Sync persona with layout store
  const handlePersonaChange = useCallback(
    (id) => {
      setPersona(id);
      applyDiscoverPreset(id);
    },
    [applyDiscoverPreset],
  );

  // Track which section is in view for copilot context
  useEffect(() => {
    const sections = ['brief', 'pulse', 'signals', 'research', 'macro'];
    const observers = [];

    sections.forEach((id) => {
      const el = document.getElementById(`intel-section-${id}`);
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(id);
          }
        },
        { rootMargin: '-20% 0px -60% 0px' },
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <div
      ref={pageRef}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        padding: '24px 28px 120px',
        maxWidth: 1200,
        width: '100%',
        margin: '0 auto',
        fontFamily: F,
      }}
    >
      {/* ─── Page Header ──────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: C.t1,
              margin: '0 0 4px 0',
              fontFamily: F,
              letterSpacing: '-0.02em',
            }}
          >
            Intel
          </h1>
          <p style={{ fontSize: 12, color: C.t3, margin: 0 }}>Your edge, briefed.</p>
        </div>
        <PersonaSelector active={persona} onSelect={handlePersonaChange} />
      </div>

      {/* ─── Tier 1: The Brief ────────────────────────────────── */}
      <SectionBlock id="brief">
        <Suspense fallback={<SectionSkeleton />}>
          <TheBrief />
        </Suspense>
      </SectionBlock>

      {/* ─── Tier 2: Market Pulse ─────────────────────────────── */}
      <SectionBlock id="pulse">
        <Suspense fallback={<SectionSkeleton />}>
          <MarketPulse />
        </Suspense>
      </SectionBlock>

      {/* ─── Tier 3: Signals ──────────────────────────────────── */}
      <SectionBlock id="signals" title="Signals" icon={'\u{1F4E1}'}>
        <Suspense fallback={<SectionSkeleton />}>
          <SignalsSection />
        </Suspense>
      </SectionBlock>

      {/* ─── Tier 4: Research ─────────────────────────────────── */}
      <SectionBlock id="research" title="Research" icon={'\u{1F50D}'}>
        <Suspense fallback={<SectionSkeleton />}>
          <ResearchSection />
        </Suspense>
      </SectionBlock>

      {/* ─── Tier 5: Macro & Predictions ──────────────────────── */}
      <SectionBlock id="macro" title="Macro & Predictions" icon={'\u{1F30D}'}>
        <Suspense fallback={<SectionSkeleton />}>
          <MacroSection />
        </Suspense>
      </SectionBlock>

      {/* ─── Tier 6: AI Copilot (fixed bottom) ────────────────── */}
      <Suspense fallback={null}>
        <IntelCopilot activeSection={activeSection} />
      </Suspense>
    </div>
  );
}

export default React.memo(IntelPage);
