// ═══════════════════════════════════════════════════════════════════
// charEdge — Market Pulse Strip
//
// Compact horizontal strip for the Intel tab showing at-a-glance
// market status: mini ticker prices, Fear & Greed, trending
// narratives, and market regime badge.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, F } from '../../../constants.js';
import FearGreedMini from './FearGreedMini';
import TrendingNarratives from './TrendingNarratives';
import { alpha } from '@/shared/colorUtils';

// ─── Mock Ticker Data (same pattern as ResearchPanel.jsx) ────────
const MOCK_PRICES = {
  ES: { price: 5285.5, change: +0.42 },
  NQ: { price: 18452.25, change: +0.67 },
  BTC: { price: 68425.0, change: +2.14 },
  ETH: { price: 3842.18, change: +1.89 },
  SPY: { price: 528.45, change: +0.38 },
  AAPL: { price: 189.72, change: -0.31 },
};

const TICKERS = ['ES', 'NQ', 'BTC', 'ETH', 'SPY', 'AAPL'];

// ─── Market Regime (mock) ────────────────────────────────────────
const MOCK_REGIME = { label: 'Risk-On', type: 'on' }; // on | off | choppy

function getRegimeColor(type) {
  if (type === 'on') return C.g;
  if (type === 'off') return C.r;
  return C.y || '#f1c40f';
}

// ─── Divider ─────────────────────────────────────────────────────
function Divider() {
  return (
    <div
      style={{
        width: 1,
        alignSelf: 'stretch',
        margin: '8px 0',
        background: alpha(C.bd, 0.5),
        flexShrink: 0,
      }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════
// MarketPulse Component
// ═══════════════════════════════════════════════════════════════════

function MarketPulse() {
  const regimeColor = getRegimeColor(MOCK_REGIME.type);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 14px',
        background: C.bg2,
        border: `1px solid ${alpha(C.bd, 0.6)}`,
        borderRadius: 12,
        height: 100,
        boxSizing: 'border-box',
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* ── Mini Ticker Prices ────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        {TICKERS.map((sym) => {
          const data = MOCK_PRICES[sym];
          const isPositive = data.change >= 0;
          const changeColor = isPositive ? C.g : C.r;
          const formatted =
            data.price >= 10000
              ? data.price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
              : data.price >= 100
                ? data.price.toFixed(2)
                : data.price.toFixed(2);

          return (
            <div
              key={sym}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 2,
                padding: '6px 8px',
                borderRadius: 8,
                background: alpha(C.sf, 0.3),
                cursor: 'default',
                flexShrink: 0,
                minWidth: 68,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = alpha(C.sf, 0.55);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = alpha(C.sf, 0.3);
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: C.t2,
                  fontFamily: F,
                  letterSpacing: 0.5,
                }}
              >
                {sym}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.t1,
                  fontFamily: 'var(--tf-mono)',
                  lineHeight: 1,
                }}
              >
                {formatted}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: changeColor,
                  fontFamily: 'var(--tf-mono)',
                  lineHeight: 1,
                }}
              >
                {isPositive ? '+' : ''}
                {data.change.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>

      <Divider />

      {/* ── Fear & Greed Mini ─────────────────────────────────── */}
      <FearGreedMini />

      <Divider />

      {/* ── Market Regime Badge ───────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: C.t3,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            fontFamily: F,
          }}
        >
          Regime
        </span>
        <div
          style={{
            padding: '4px 12px',
            borderRadius: 20,
            background: alpha(regimeColor, 0.12),
            border: `1px solid ${alpha(regimeColor, 0.35)}`,
            fontSize: 11,
            fontWeight: 700,
            color: regimeColor,
            fontFamily: F,
            whiteSpace: 'nowrap',
          }}
        >
          {MOCK_REGIME.label}
        </div>
      </div>

      <Divider />

      {/* ── Trending Narratives ───────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <TrendingNarratives />
      </div>
    </div>
  );
}

export default React.memo(MarketPulse);
