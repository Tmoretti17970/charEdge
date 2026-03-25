// ═══════════════════════════════════════════════════════════════════
// charEdge — Prediction Markets Widget (Intel Tab)
//
// Compact grid showing prediction market probabilities.
// All mock data for now — 6 items in a 2x3 grid layout.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import { C, F } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';

// ─── Mock Prediction Data (fallback) ────────────────────────────

const MOCK_PREDICTIONS = [
  { id: 1, event: 'Fed Rate Cut by June', prob: 72, change: 3 },
  { id: 2, event: 'BTC > $100K by Q3', prob: 45, change: -2 },
  { id: 3, event: 'Recession 2026', prob: 18, change: 1 },
  { id: 4, event: 'S&P > 6000 EOY', prob: 61, change: 5 },
  { id: 5, event: 'NVDA Beats Earnings', prob: 78, change: 8 },
  { id: 6, event: 'China Tariff Increase', prob: 42, change: 12 },
];

const MANIFOLD_URL = 'https://api.manifold.markets/v0/search-markets?term=finance&sort=liquidity&limit=6';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch prediction markets from Manifold Markets free API.
 * Maps API response to component data shape.
 */
async function fetchPredictions() {
  const resp = await fetch(MANIFOLD_URL);
  if (!resp.ok) throw new Error(`Manifold API ${resp.status}`);
  const markets = await resp.json();
  if (!Array.isArray(markets) || markets.length === 0) {
    throw new Error('Empty response');
  }
  return markets.map((m, i) => ({
    id: m.id || i + 1,
    event: m.question || m.title || 'Unknown market',
    prob: Math.round((m.probability ?? 0.5) * 100),
    change: 0, // Manifold search endpoint doesn't provide 24h delta
  }));
}

// ─── CSS-based Mini Sparkline ───────────────────────────────────

function MiniSparkline({ prob, change }) {
  // Generate a simple visual indicator based on probability and change
  const isPositive = change > 0;
  const color = isPositive ? C.g : C.r;
  const barCount = 5;

  // Create a simple bar pattern that visually implies trend
  const heights = [];
  for (let i = 0; i < barCount; i++) {
    const base = prob * 0.3;
    const trend = isPositive ? i * 3 : (barCount - 1 - i) * 3;
    heights.push(Math.min(18, Math.max(3, base * 0.15 + trend)));
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 1,
        height: 18,
      }}
    >
      {heights.map((h, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: h,
            borderRadius: 1,
            background: i === barCount - 1 ? color : alpha(color, 0.25 + (i / barCount) * 0.5),
          }}
        />
      ))}
    </div>
  );
}

// ─── Prediction Card Item ───────────────────────────────────────

function PredictionItem({ item }) {
  const isPositive = item.change > 0;
  const changeColor = isPositive ? C.g : C.r;
  const changeSign = isPositive ? '+' : '';

  // Color the probability based on how high it is
  const probColor = item.prob >= 70 ? C.g : item.prob >= 40 ? C.b : C.r;

  return (
    <div
      role="listitem"
      aria-label={`${item.event}: ${item.prob}% probability, ${item.change >= 0 ? 'up' : 'down'} ${Math.abs(item.change)}% in 24 hours`}
      style={{
        padding: '12px 14px',
        borderRadius: 10,
        background: alpha(C.sf, 0.4),
        border: `1px solid ${alpha(C.bd, 0.6)}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'all 0.15s ease',
      }}
    >
      {/* Event Name */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: C.t2,
          fontFamily: F,
          lineHeight: 1.3,
          minHeight: 28,
        }}
      >
        {item.event}
      </div>

      {/* Probability + Sparkline Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          {/* Large Probability */}
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: probColor,
              fontFamily: F,
              lineHeight: 1,
            }}
          >
            {item.prob}%
          </span>
        </div>
        <MiniSparkline prob={item.prob} change={item.change} />
      </div>

      {/* 24h Change */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: changeColor,
          fontFamily: F,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
        }}
      >
        <span>
          {changeSign}
          {item.change}%
        </span>
        <span style={{ color: C.t3, fontWeight: 400 }}>24h</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════

function PredictionMarkets() {
  const [predictions, setPredictions] = useState(MOCK_PREDICTIONS);
  const [isLive, setIsLive] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchPredictions();
        if (!cancelled) {
          setPredictions(data);
          setIsLive(true);
        }
      } catch (_err) {
        // eslint-disable-next-line no-console
        console.warn('[PredictionMarkets] Fetch failed, using mock data', _err);
        if (!cancelled) {
          setPredictions(MOCK_PREDICTIONS);
          setIsLive(false);
        }
      }
    }

    load();
    intervalRef.current = setInterval(load, REFRESH_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div
      style={{
        background: C.bg2,
        borderRadius: 14,
        border: `1px solid ${C.bd}`,
        overflow: 'hidden',
      }}
    >
      {/* ─── Header ────────────────────────────────────────────── */}
      <div
        style={{
          padding: '16px 20px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: C.t1,
            fontFamily: F,
          }}
        >
          Prediction Markets
        </span>
        <span
          style={{
            padding: '2px 7px',
            borderRadius: 6,
            background: alpha(C.b, 0.15),
            color: C.b,
            fontSize: 9,
            fontWeight: 700,
            fontFamily: F,
            letterSpacing: 0.5,
          }}
        >
          {isLive ? 'LIVE' : 'DEMO'}
        </span>
      </div>

      {/* ─── Prediction Grid (2 columns, 3 rows) ──────────────── */}
      <div
        role="list"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          padding: '0 16px 16px',
        }}
      >
        {predictions.map((item) => (
          <PredictionItem key={item.id} item={item} />
        ))}
      </div>

      {/* ─── Attribution ───────────────────────────────────────── */}
      <div
        style={{
          padding: '10px 20px',
          borderTop: `1px solid ${alpha(C.bd, 0.5)}`,
          textAlign: 'center',
        }}
      >
        <span
          style={{
            fontSize: 9,
            color: C.t3,
            fontFamily: F,
            fontWeight: 500,
          }}
        >
          {isLive ? 'Powered by Manifold Markets' : 'Powered by prediction markets'}
        </span>
      </div>
    </div>
  );
}

export default React.memo(PredictionMarkets);
