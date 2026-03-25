// ═══════════════════════════════════════════════════════════════════
// charEdge — Trending Narratives (Compact Pill Row)
//
// Horizontal scrollable row of narrative pills for Market Pulse.
// Adapted from quarantined TrendingNarratives. Hover shows tokens.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState } from 'react';
import { C, F } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';

// ─── Mock Data ───────────────────────────────────────────────────
const MOCK_NARRATIVES = [
  { id: 'ai', name: 'AI Agents', metric: '+145%', trend: 'up', active: true, tokens: ['FET', 'AGIX', 'TAO'] },
  { id: 'rates', name: 'Rate Cuts', metric: '+110%', trend: 'up', active: true, tokens: ['GOLD', 'TLT', 'SPY'] },
  { id: 'l2', name: 'Ethereum L2s', metric: '+82%', trend: 'up', active: false, tokens: ['ARB', 'OP', 'STRK'] },
  { id: 'defi', name: 'DeFi Revival', metric: '+67%', trend: 'up', active: false, tokens: ['UNI', 'AAVE', 'MKR'] },
  { id: 'meme', name: 'Meme Coins', metric: '+54%', trend: 'up', active: false, tokens: ['DOGE', 'SHIB', 'PEPE'] },
];

// ─── Single Pill ─────────────────────────────────────────────────
function NarrativePill({ narrative }) {
  const [hovered, setHovered] = useState(false);
  const isUp = narrative.trend === 'up';
  const trendColor = isUp ? C.g : C.r;

  return (
    <div
      style={{ position: 'relative', flexShrink: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 20,
          background: narrative.active ? alpha(trendColor, 0.12) : alpha(C.sf, 0.5),
          border: `1px solid ${narrative.active ? alpha(trendColor, 0.3) : alpha(C.bd, 0.6)}`,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: narrative.active ? `0 0 8px ${alpha(trendColor, 0.15)}` : 'none',
          whiteSpace: 'nowrap',
          ...(hovered ? { background: alpha(trendColor, 0.18), borderColor: alpha(trendColor, 0.4) } : {}),
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.t1,
            fontFamily: F,
          }}
        >
          {narrative.name}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: trendColor,
            fontFamily: 'var(--tf-mono)',
          }}
        >
          {narrative.metric}
        </span>
      </div>

      {/* Hover tooltip — associated tokens */}
      {hovered && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: 4,
            padding: '4px 8px',
            borderRadius: 6,
            background: C.bg,
            border: `1px solid ${C.bd}`,
            boxShadow: `0 4px 12px ${alpha('#000', 0.4)}`,
            whiteSpace: 'nowrap',
            zIndex: 100,
            display: 'flex',
            gap: 4,
            alignItems: 'center',
          }}
        >
          {narrative.tokens.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: C.t2,
                background: alpha(C.sf, 0.6),
                padding: '2px 5px',
                borderRadius: 4,
                fontFamily: 'var(--tf-mono)',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TrendingNarratives Component
// ═══════════════════════════════════════════════════════════════════

function TrendingNarratives() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'none' /* Firefox */,
        msOverflowStyle: 'none' /* IE/Edge */,
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 2,
      }}
      /* Hide scrollbar for Chrome/Safari via inline pseudo — handled by parent */
    >
      {/* Section label */}
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: C.t3,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          fontFamily: F,
          flexShrink: 0,
          marginRight: 2,
        }}
      >
        Trending
      </span>

      {MOCK_NARRATIVES.map((narrative) => (
        <NarrativePill key={narrative.id} narrative={narrative} />
      ))}
    </div>
  );
}

export default React.memo(TrendingNarratives);
