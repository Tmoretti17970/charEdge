// ═══════════════════════════════════════════════════════════════════
// charEdge — Technical Signals Compact
//
// Compact technical pattern widget for the Intel Signals section.
// Shows top 5 detected chart patterns with confidence bars.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, F } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';

// ─── Mock Data ──────────────────────────────────────────────────
const MOCK_PATTERNS = [
  { id: 1, symbol: 'NVDA', pattern: 'Bull Flag', timeframe: '4H', signal: 'Bullish', confidence: 87 },
  { id: 2, symbol: 'BTC', pattern: 'Cup & Handle', timeframe: '1D', signal: 'Bullish', confidence: 82 },
  { id: 3, symbol: 'TSLA', pattern: 'Head & Shoulders', timeframe: '4H', signal: 'Bearish', confidence: 78 },
  { id: 4, symbol: 'AAPL', pattern: 'Double Bottom', timeframe: '1D', signal: 'Bullish', confidence: 75 },
  { id: 5, symbol: 'SPY', pattern: 'Ascending Triangle', timeframe: '1H', signal: 'Bullish', confidence: 71 },
];

// ─── Component ──────────────────────────────────────────────────
function TechnicalSignalsCompact() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {MOCK_PATTERNS.map((p) => {
        const isBull = p.signal === 'Bullish';
        const tint = isBull ? C.g : C.r;

        return (
          <div
            key={p.id}
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
              transition: 'background 0.15s ease',
            }}
          >
            {/* Symbol */}
            <span style={{ fontWeight: 700, minWidth: 40, color: C.t1, flexShrink: 0 }}>{p.symbol}</span>

            {/* Pattern name */}
            <span
              style={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: 600,
                fontSize: 11,
                color: C.t2,
              }}
            >
              {p.pattern}
            </span>

            {/* Timeframe */}
            <span
              style={{
                padding: '1px 5px',
                borderRadius: 4,
                background: alpha(C.sf, 0.6),
                color: C.t3,
                fontSize: 10,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {p.timeframe}
            </span>

            {/* Signal */}
            <span
              style={{
                fontWeight: 600,
                fontSize: 11,
                minWidth: 48,
                color: tint,
                flexShrink: 0,
              }}
            >
              {p.signal}
            </span>

            {/* Confidence bar + % */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                minWidth: 64,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  background: alpha(tint, 0.15),
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${p.confidence}%`,
                    height: '100%',
                    borderRadius: 2,
                    background: tint,
                  }}
                />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: tint, minWidth: 22 }}>{p.confidence}%</span>
            </div>
          </div>
        );
      })}

      {/* Footer link */}
      <div style={{ textAlign: 'right', paddingTop: 6 }}>
        <span
          style={{
            fontSize: 11,
            fontFamily: F,
            fontWeight: 600,
            color: C.b,
            cursor: 'pointer',
            opacity: 0.85,
          }}
        >
          View all patterns &rarr;
        </span>
      </div>
    </div>
  );
}

export default React.memo(TechnicalSignalsCompact);
