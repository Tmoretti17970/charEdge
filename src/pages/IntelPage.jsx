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

import React, { useState, useCallback, useEffect, useRef, useMemo, Suspense } from 'react';
import {
  LazySection,
  useMemoGuard,
  useRenderCount,
  useFCPTracker,
  verifySuspenseBoundaries,
} from '../app/components/intel/IntelPerformanceGuard.jsx';
import SectionCustomizer, { loadCustomLayout, clearCustomLayout } from '../app/components/intel/SectionCustomizer.jsx';
import { C, F } from '../constants.js';
import { trackFeatureUse, trackClick } from '../observability/telemetry.ts';
import { useDataStore } from '../state/useDataStore.js';
import { useLayoutStore } from '../state/useLayoutStore.js';
import { alpha } from '@/shared/colorUtils';

// ─── Above-fold section IDs (Tier 1 & 2 — loaded immediately) ───
const ABOVE_FOLD = new Set(['brief', 'pulse']);

// ─── Stagger entrance animation (injected once) ─────────────────
const ANIM_ID = 'charEdge-intel-stagger';
if (typeof document !== 'undefined' && !document.getElementById(ANIM_ID)) {
  const style = document.createElement('style');
  style.id = ANIM_ID;
  style.textContent = `
    @keyframes ceIntelFadeUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .ce-intel-animate { animation: none !important; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Lazy-loaded section components ──────────────────────────────
const TheBrief = React.lazy(() => import('../app/components/intel/TheBrief.jsx'));
const MarketPulse = React.lazy(() => import('../app/components/intel/MarketPulse.jsx'));
const SignalsSection = React.lazy(() => import('../app/components/intel/SignalsSection.jsx'));
const ResearchSection = React.lazy(() => import('../app/components/intel/ResearchSection.jsx'));
const MacroSection = React.lazy(() => import('../app/components/intel/MacroSection.jsx'));
const IntelCopilot = React.lazy(() => import('../app/components/intel/IntelCopilot.jsx'));

// ─── Section registry (maps id → component + metadata) ─────────
const SECTION_REGISTRY = {
  brief: { Component: TheBrief, title: null, icon: null },
  pulse: { Component: MarketPulse, title: null, icon: null },
  signals: { Component: SignalsSection, title: 'Signals', icon: '\u{1F4E1}' },
  research: { Component: ResearchSection, title: 'Research', icon: '\u{1F50D}' },
  macro: { Component: MacroSection, title: 'Macro & Predictions', icon: '\u{1F30D}' },
};

// ─── Layout Presets ──────────────────────────────────────────────
const PERSONAS = [
  { id: 'daytrader', label: 'Day Trader', icon: '\u{1F4CA}', description: 'Flow + screeners + news' },
  { id: 'swing', label: 'Swing', icon: '\u{1F4C8}', description: 'Technicals + sectors + earnings' },
  { id: 'investor', label: 'Investor', icon: '\u{1F4BC}', description: 'Fundamentals + macro + analyst' },
  { id: 'learner', label: 'Learner', icon: '\u{1F393}', description: 'Briefing + education + basics' },
];

// ─── Persona Configurations ──────────────────────────────────
const PERSONA_CONFIGS = {
  daytrader: {
    sectionOrder: ['brief', 'pulse', 'signals', 'research', 'macro'],
    defaultSignalTab: 'flow',
    defaultResearchTab: undefined,
    showTips: false,
    tips: {},
  },
  swing: {
    sectionOrder: ['brief', 'signals', 'research', 'pulse', 'macro'],
    defaultSignalTab: 'technical',
    defaultResearchTab: undefined,
    showTips: false,
    tips: {},
  },
  investor: {
    sectionOrder: ['brief', 'macro', 'research', 'pulse', 'signals'],
    defaultSignalTab: undefined,
    defaultResearchTab: 'earnings',
    showTips: false,
    tips: {},
  },
  learner: {
    sectionOrder: ['brief', 'pulse', 'research', 'signals', 'macro'],
    defaultSignalTab: undefined,
    defaultResearchTab: undefined,
    showTips: true,
    tips: {
      brief: 'Start here — this is your AI-generated summary of what moved markets today.',
      pulse: 'Watch this strip for real-time sentiment and price action across major tickers.',
      signals: 'Signals surface unusual activity — options flow, insider trades, and more.',
      research: 'Dive deeper with sector maps, screeners, and earnings calendars.',
      macro: 'Macro events like Fed meetings and CPI releases drive broad market moves.',
    },
  },
};

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
function SectionBlock({ id, title, icon, tip, children, style, animDelay }) {
  return (
    <section
      id={`intel-section-${id}`}
      aria-labelledby={`intel-heading-${id}`}
      className="ce-intel-animate"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        animation: `ceIntelFadeUp 0.4s ease-out both`,
        animationDelay: animDelay != null ? `${animDelay}ms` : '0ms',
        ...style,
      }}
    >
      {title && (
        <div
          id={`intel-heading-${id}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
          {tip && (
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontStyle: 'italic',
                color: C.t3,
                fontFamily: F,
                lineHeight: 1.4,
                paddingLeft: 28,
              }}
            >
              {tip}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

// ─── Persona Selector ────────────────────────────────────────────
function PersonaSelector({ active, onSelect, isMobile }) {
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
        ...(isMobile ? { overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } : {}),
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

// ─── Mobile breakpoint hook ──────────────────────────────────────
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < breakpoint : false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

// ═════════════════════════════════════════════════════════════════
// Intel Page
// ═════════════════════════════════════════════════════════════════
function IntelPage() {
  const discoverPreset = useLayoutStore((s) => s.discoverPreset);
  const applyDiscoverPreset = useLayoutStore((s) => s.applyDiscoverPreset);

  const [activeSection, setActiveSection] = useState('brief');
  const [persona, setPersona] = useState(discoverPreset || 'daytrader');
  const [customLayout, setCustomLayout] = useState(() => loadCustomLayout());
  const pageRef = useRef(null);
  const isMobile = useIsMobile();
  const trackImpression = useDataStore((s) => s.trackImpression);

  // ─── Performance monitoring ──────────────────────────────────
  useFCPTracker('IntelPage');
  useRenderCount('IntelPage');

  // Dev-mode: verify all section components are memoized
  useMemoGuard('TheBrief', TheBrief);
  useMemoGuard('MarketPulse', MarketPulse);
  useMemoGuard('SignalsSection', SignalsSection);
  useMemoGuard('ResearchSection', ResearchSection);
  useMemoGuard('MacroSection', MacroSection);
  useMemoGuard('IntelCopilot', IntelCopilot);

  // Track page view on mount
  useEffect(() => {
    trackFeatureUse('intel_page_view');
  }, []);

  // Dev-mode: verify Suspense boundaries after mount
  useEffect(() => {
    verifySuspenseBoundaries(pageRef);
  }, []);

  // Sync persona with layout store — confirm reset if custom layout exists
  const handlePersonaChange = useCallback(
    (id) => {
      if (customLayout) {
         
        const shouldReset = confirm('You have a custom section layout. Reset it for this persona?');
        if (shouldReset) {
          clearCustomLayout();
          setCustomLayout(null);
        }
      }
      setPersona(id);
      applyDiscoverPreset(id);
      trackClick('intel_persona_' + id, 'intel');
    },
    [applyDiscoverPreset, customLayout],
  );

  // Handle layout changes from the customizer
  const handleLayoutChange = useCallback((layout) => {
    setCustomLayout(layout);
  }, []);

  // Resolve persona config
  const personaConfig = useMemo(() => PERSONA_CONFIGS[persona] || PERSONA_CONFIGS.daytrader, [persona]);

  // Resolve final section order: custom layout > persona > default
  const resolvedSections = useMemo(() => {
    if (customLayout) {
      const hiddenSet = new Set(customLayout.hidden || []);
      return customLayout.order.filter((id) => !hiddenSet.has(id) && SECTION_REGISTRY[id]);
    }
    return personaConfig.sectionOrder;
  }, [customLayout, personaConfig]);

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
            trackImpression('intel_section_' + id);
          }
        },
        { rootMargin: '-20% 0px -60% 0px' },
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [trackImpression]);

  return (
    <div
      ref={pageRef}
      role="main"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        padding: isMobile ? '16px 16px 120px' : '24px 28px 120px',
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
          alignItems: isMobile ? 'stretch' : 'flex-start',
          flexDirection: isMobile ? 'column' : 'row',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PersonaSelector active={persona} onSelect={handlePersonaChange} isMobile={isMobile} />
          <SectionCustomizer layout={customLayout} onLayoutChange={handleLayoutChange} />
        </div>
      </div>

      {/* ─── Dynamic section rendering (custom > persona > default) ── */}
      {resolvedSections.map((sectionId, idx) => {
        const entry = SECTION_REGISTRY[sectionId];
        if (!entry) return null;
        const { Component, title, icon } = entry;
        const delay = idx * 80;
        const tip = personaConfig.showTips ? personaConfig.tips[sectionId] : undefined;

        // Pass persona-specific default tabs where applicable
        const extraProps = {};
        if (sectionId === 'signals' && personaConfig.defaultSignalTab) {
          extraProps.defaultTab = personaConfig.defaultSignalTab;
        }
        if (sectionId === 'research' && personaConfig.defaultResearchTab) {
          extraProps.defaultTab = personaConfig.defaultResearchTab;
        }

        // Tier 1 (Brief) and Tier 2 (Pulse) load immediately (above fold).
        // Tier 3+ (Signals, Research, Macro) wrapped in LazySection.
        const isAboveFold = ABOVE_FOLD.has(sectionId);

        return (
          <SectionBlock key={sectionId} id={sectionId} title={title} icon={icon} tip={tip} animDelay={delay}>
            {isAboveFold ? (
              <Suspense fallback={<SectionSkeleton />}>
                <Component {...extraProps} />
              </Suspense>
            ) : (
              <LazySection id={sectionId} fallback={<SectionSkeleton />}>
                <Suspense fallback={<SectionSkeleton />}>
                  <Component {...extraProps} />
                </Suspense>
              </LazySection>
            )}
          </SectionBlock>
        );
      })}

      {/* ─── Tier 6: AI Copilot (fixed bottom) ────────────────── */}
      <Suspense fallback={null}>
        <IntelCopilot activeSection={activeSection} />
      </Suspense>
    </div>
  );
}

export default React.memo(IntelPage);
