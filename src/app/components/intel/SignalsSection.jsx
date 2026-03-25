// ═══════════════════════════════════════════════════════════════════
// charEdge — Signals Section
//
// Main container for the Signals tier in the Intel tab.
// Tab bar toggles between signal types; "All" shows a unified feed
// with the top 3 entries from each signal type sorted by time.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { C, F } from '../../../constants.js';
import { trackClick } from '../../../observability/telemetry.ts';
import InsiderCompact from './InsiderCompact';
import LiquidationCompact from './LiquidationCompact';
import OptionsFlowCompact from './OptionsFlowCompact';
import TechnicalSignalsCompact from './TechnicalSignalsCompact';
import WhaleCompact from './WhaleCompact';
import { alpha } from '@/shared/colorUtils';

// ─── Tabs ───────────────────────────────────────────────────────
const TABS = [
  { id: 'all', label: 'All' },
  { id: 'flow', label: 'Flow' },
  { id: 'insider', label: 'Insider' },
  { id: 'technical', label: 'Technical' },
  { id: 'whale', label: 'Whale' },
  { id: 'liquidations', label: 'Liquidations' },
];

// ─── Unified "All" feed mock data (top 3 from each type) ───────
const ALL_FEED = [
  { id: 'f1', ts: '14:32', kind: 'flow', label: 'NVDA 900C', detail: 'Buy $2.85M SWEEP', tint: 'g' },
  { id: 'f2', ts: '14:30', kind: 'flow', label: 'SPY 505P', detail: 'Sell $1.24M', tint: 'r' },
  { id: 'f3', ts: '14:28', kind: 'flow', label: 'AAPL 200C', detail: 'Buy $890K', tint: 'g' },
  { id: 'i1', ts: '14:26', kind: 'insider', label: 'JPM — Jamie Dimon', detail: 'CEO Buy $8.2M', tint: 'g' },
  { id: 'i2', ts: '14:24', kind: 'insider', label: 'MCD — Peter Lynch', detail: 'Dir Buy $3.4M CLUSTER', tint: 'g' },
  { id: 'i3', ts: '14:22', kind: 'insider', label: 'NVDA — Jensen Huang', detail: 'CEO Sell $106.8M', tint: 'r' },
  { id: 't1', ts: '14:20', kind: 'technical', label: 'NVDA Bull Flag', detail: '4H Bullish 87%', tint: 'g' },
  { id: 't2', ts: '14:18', kind: 'technical', label: 'BTC Cup & Handle', detail: '1D Bullish 82%', tint: 'g' },
  { id: 't3', ts: '14:16', kind: 'technical', label: 'TSLA Head & Shoulders', detail: '4H Bearish 78%', tint: 'r' },
  { id: 'w1', ts: '14:29', kind: 'whale', label: 'BTC 500 → Coinbase', detail: '$34.7M Deposit', tint: 'r' },
  { id: 'w2', ts: '14:25', kind: 'whale', label: 'ETH 15K ← Binance', detail: '$52.8M Withdraw', tint: 'g' },
  { id: 'w3', ts: '14:22', kind: 'whale', label: 'USDT 80M Mint', detail: '$80M Treasury', tint: 'g' },
  { id: 'l1', ts: '14:30', kind: 'liquidations', label: 'BTC LONG Liquidated', detail: '$2.3M @69.4K', tint: 'r' },
  { id: 'l2', ts: '14:27', kind: 'liquidations', label: 'ETH SHORT Liquidated', detail: '$890K @3520', tint: 'g' },
  { id: 'l3', ts: '14:22', kind: 'liquidations', label: 'BTC LONG Liquidated', detail: '$5.2M @69.1K', tint: 'r' },
];

// ─── Pulsing live dot + tab fade keyframes (injected once) ──────
const PULSE_ID = 'charEdge-signals-pulse';
if (typeof document !== 'undefined' && !document.getElementById(PULSE_ID)) {
  const style = document.createElement('style');
  style.id = PULSE_ID;
  style.textContent = `
    @keyframes ceSignalPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%      { opacity: 0.4; transform: scale(0.75); }
    }
    @keyframes ceTabFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .ce-tab-fade { animation: none !important; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Kind tag colors ────────────────────────────────────────────
const KIND_COLORS = {
  flow: C.b,
  insider: '#a78bfa',
  technical: '#38bdf8',
  whale: '#f472b6',
  liquidations: '#fb923c',
};

// ─── Unified feed row ───────────────────────────────────────────
function FeedRow({ item }) {
  const tint = item.tint === 'g' ? C.g : C.r;
  const kindColor = KIND_COLORS[item.kind] || C.t3;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 36,
        padding: '0 10px',
        borderRadius: 8,
        background: alpha(tint, 0.04),
        borderLeft: `2px solid ${alpha(tint, 0.4)}`,
        fontFamily: F,
        fontSize: 12,
        color: C.t1,
      }}
    >
      {/* Time */}
      <span style={{ color: C.t3, fontSize: 11, minWidth: 36, flexShrink: 0 }}>{item.ts}</span>

      {/* Kind tag */}
      <span
        style={{
          padding: '1px 5px',
          borderRadius: 4,
          background: alpha(kindColor, 0.12),
          color: kindColor,
          fontSize: 9,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          flexShrink: 0,
        }}
      >
        {item.kind}
      </span>

      {/* Label */}
      <span
        style={{
          fontWeight: 700,
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {item.label}
      </span>

      {/* Detail */}
      <span style={{ color: C.t2, fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{item.detail}</span>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────
function SignalsSection() {
  const [activeTab, setActiveTab] = useState('all');
  const tabsRef = useRef([]);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    trackClick('intel_signal_tab_' + tabId, 'intel');
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

  const content = useMemo(() => {
    switch (activeTab) {
      case 'all':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {ALL_FEED.map((item) => (
              <FeedRow key={item.id} item={item} />
            ))}
          </div>
        );
      case 'flow':
        return <OptionsFlowCompact />;
      case 'insider':
        return <InsiderCompact />;
      case 'technical':
        return <TechnicalSignalsCompact />;
      case 'whale':
        return <WhaleCompact />;
      case 'liquidations':
        return <LiquidationCompact />;
      default:
        return null;
    }
  }, [activeTab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ─── Section Header ─────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontFamily: F,
            fontWeight: 700,
            fontSize: 14,
            color: C.t1,
            letterSpacing: 0.2,
          }}
        >
          Signals
        </span>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: C.g,
            boxShadow: `0 0 6px ${C.g}`,
            animation: 'ceSignalPulse 2s ease-in-out infinite',
          }}
          title="Live"
        />
        <span style={{ fontFamily: F, fontSize: 10, color: C.t3, fontWeight: 600 }}>LIVE</span>
      </div>

      {/* ─── Tab Bar ────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Signal type tabs"
        style={{
          display: 'flex',
          gap: 6,
          padding: 4,
          background: alpha(C.sf, 0.5),
          borderRadius: 14,
          border: `1px solid ${C.bd}`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabsRef.current[TABS.indexOf(tab)] = el;
              }}
              id={`signals-tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls="signals-tabpanel"
              tabIndex={isActive ? 0 : -1}
              onClick={() => handleTabChange(tab.id)}
              onKeyDown={handleTabKeyDown}
              style={{
                flex: 1,
                minWidth: 0,
                flexShrink: 0,
                padding: '7px 6px',
                borderRadius: 10,
                border: 'none',
                background: isActive
                  ? `linear-gradient(135deg, ${alpha(C.b, 0.18)}, ${alpha(C.b, 0.08)})`
                  : 'transparent',
                color: isActive ? C.b : C.t2,
                cursor: 'pointer',
                fontWeight: isActive ? 700 : 600,
                fontSize: 11,
                fontFamily: F,
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                textAlign: 'center',
                position: 'relative',
                whiteSpace: 'nowrap',
                boxShadow: isActive ? `0 1px 4px ${alpha(C.b, 0.15)}` : 'none',
              }}
            >
              {tab.label}
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 16,
                    height: 2,
                    borderRadius: 1,
                    background: C.b,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Tab Content ────────────────────────────────────── */}
      <div
        key={activeTab}
        id="signals-tabpanel"
        role="tabpanel"
        aria-labelledby={`signals-tab-${activeTab}`}
        tabIndex={0}
        className="ce-tab-fade"
        style={{
          animation: 'ceTabFadeIn 0.25s ease-out',
        }}
      >
        {content}
      </div>
    </div>
  );
}

export default React.memo(SignalsSection);
