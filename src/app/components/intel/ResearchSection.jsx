// ═══════════════════════════════════════════════════════════════════
// charEdge — Research Section (Intel Tab)
//
// Tabbed container for deep-dive research tools.
// Each tab lazy-loads a discover widget via React.lazy.
// Tabs: Sectors | Screener | Earnings | Analysts | Volatility | Correlation
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useRef, Suspense } from 'react';
import { C, F } from '../../../constants.js';
import { trackClick } from '../../../observability/telemetry.ts';
import { alpha } from '@/shared/colorUtils';

// ─── Tab fade keyframes (injected once) ─────────────────────────
const RESEARCH_ANIM_ID = 'charEdge-research-tabfade';
if (typeof document !== 'undefined' && !document.getElementById(RESEARCH_ANIM_ID)) {
  const style = document.createElement('style');
  style.id = RESEARCH_ANIM_ID;
  style.textContent = `
    @keyframes ceResearchFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .ce-research-fade { animation: none !important; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Lazy-loaded Widgets ────────────────────────────────────────

const SectorRotationMap = React.lazy(() => import('../discover/SectorRotationMap.jsx'));
const SmartScreener = React.lazy(() => import('../discover/SmartScreener.jsx'));
const EarningsIntelligence = React.lazy(() => import('../discover/EarningsIntelligence.jsx'));
const AnalystConsensus = React.lazy(() => import('../discover/AnalystConsensus.jsx'));
const VolatilityDashboard = React.lazy(() => import('../discover/VolatilityDashboard.jsx'));
const CorrelationMatrix = React.lazy(() => import('../discover/CorrelationMatrix.jsx'));

// ─── Tab Definitions ────────────────────────────────────────────

const TABS = [
  { id: 'sectors', label: 'Sectors', Component: SectorRotationMap },
  { id: 'screener', label: 'Screener', Component: SmartScreener },
  { id: 'earnings', label: 'Earnings', Component: EarningsIntelligence },
  { id: 'analysts', label: 'Analysts', Component: AnalystConsensus },
  { id: 'volatility', label: 'Volatility', Component: VolatilityDashboard },
  { id: 'correlation', label: 'Correlation', Component: CorrelationMatrix },
];

// ─── Skeleton Fallback ──────────────────────────────────────────

function SkeletonFallback() {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            height: 16,
            borderRadius: 8,
            background: `linear-gradient(90deg, ${alpha(C.sf, 0.3)} 25%, ${alpha(C.sf, 0.6)} 50%, ${alpha(C.sf, 0.3)} 75%)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s ease infinite',
            width: i === 2 ? '60%' : i === 1 ? '80%' : '100%',
          }}
        />
      ))}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

// ─── Simple Error Boundary ──────────────────────────────────────

class WidgetErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            color: C.t3,
            fontFamily: F,
            fontSize: 12,
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>!</div>
          <div style={{ fontWeight: 600, color: C.t2, marginBottom: 4 }}>Widget failed to load</div>
          <div style={{ fontSize: 11 }}>{this.state.error?.message || 'An unexpected error occurred.'}</div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 12,
              padding: '6px 14px',
              borderRadius: 8,
              border: `1px solid ${C.bd}`,
              background: alpha(C.b, 0.1),
              color: C.b,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: F,
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════

function ResearchSection() {
  const [activeTab, setActiveTab] = useState('sectors');
  const tabsRef = useRef([]);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    trackClick('intel_research_tab_' + tabId, 'intel');
  }, []);

  const handleTabKeyDown = useCallback(
    (e) => {
      const currentIndex = TABS.findIndex((t) => t.id === activeTab);
      let nextIndex = -1;
      if (e.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % TABS.length;
      } else if (e.key === 'ArrowLeft') {
        nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
      }
      if (nextIndex >= 0) {
        e.preventDefault();
        setActiveTab(TABS[nextIndex].id);
        tabsRef.current[nextIndex]?.focus();
      }
    },
    [activeTab],
  );

  const current = TABS.find((t) => t.id === activeTab) || TABS[0];
  const ActiveWidget = current.Component;

  return (
    <div
      style={{
        background: C.bg2,
        borderRadius: 14,
        border: `1px solid ${C.bd}`,
        overflow: 'hidden',
      }}
    >
      {/* ─── Section Header ────────────────────────────────────── */}
      <div
        style={{
          padding: '16px 20px 0',
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: C.t1,
            fontFamily: F,
          }}
        >
          Research
        </span>
        <span
          style={{
            fontSize: 11,
            color: C.t3,
            fontFamily: F,
            fontWeight: 500,
          }}
        >
          Deep Dive
        </span>
      </div>

      {/* ─── Tab Bar ───────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Research type tabs"
        style={{
          display: 'flex',
          gap: 6,
          padding: '12px 20px 14px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabsRef.current[TABS.indexOf(tab)] = el;
              }}
              id={`research-tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls="research-tabpanel"
              tabIndex={isActive ? 0 : -1}
              onClick={() => handleTabChange(tab.id)}
              onKeyDown={handleTabKeyDown}
              style={{
                flexShrink: 0,
                padding: '5px 14px',
                borderRadius: 20,
                border: `1px solid ${isActive ? C.b : C.bd}`,
                background: isActive ? alpha(C.b, 0.12) : 'transparent',
                color: isActive ? C.b : C.t2,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 11,
                fontFamily: F,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── Widget Content ────────────────────────────────────── */}
      <div
        key={activeTab}
        id="research-tabpanel"
        role="tabpanel"
        aria-labelledby={`research-tab-${activeTab}`}
        tabIndex={0}
        className="ce-research-fade"
        style={{
          minHeight: 300,
          animation: 'ceResearchFadeIn 0.25s ease-out',
        }}
      >
        <WidgetErrorBoundary key={activeTab}>
          <Suspense fallback={<SkeletonFallback />}>
            <ActiveWidget />
          </Suspense>
        </WidgetErrorBoundary>
      </div>
    </div>
  );
}

export default React.memo(ResearchSection);
