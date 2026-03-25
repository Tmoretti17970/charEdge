// ═══════════════════════════════════════════════════════════════════
// charEdge — Liquidation Compact
//
// Compact liquidation feed for the Intel Signals section.
// Shows a long/short ratio bar plus top 6 recent liquidations.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, F } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';

// ─── Mock Data ──────────────────────────────────────────────────
const MOCK_LIQUIDATIONS = [
  { id: 1, time: '14:30', pair: 'BTCUSDT', side: 'LONG', amount: 2340000, price: 69420, exchange: 'Binance' },
  { id: 2, time: '14:27', pair: 'ETHUSDT', side: 'SHORT', amount: 890000, price: 3520, exchange: 'Bybit' },
  { id: 3, time: '14:25', pair: 'SOLUSDT', side: 'LONG', amount: 1560000, price: 148.5, exchange: 'OKX' },
  { id: 4, time: '14:22', pair: 'BTCUSDT', side: 'LONG', amount: 5200000, price: 69100, exchange: 'Binance' },
  { id: 5, time: '14:17', pair: 'DOGEUSDT', side: 'SHORT', amount: 420000, price: 0.182, exchange: 'Bybit' },
  { id: 6, time: '14:14', pair: 'XRPUSDT', side: 'LONG', amount: 780000, price: 2.14, exchange: 'Binance' },
];

// ─── Helpers ────────────────────────────────────────────────────
function fmtAmount(n) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

// ─── Derived stats ──────────────────────────────────────────────
const totalLongs = MOCK_LIQUIDATIONS.filter((l) => l.side === 'LONG').reduce((s, l) => s + l.amount, 0);
const totalShorts = MOCK_LIQUIDATIONS.filter((l) => l.side === 'SHORT').reduce((s, l) => s + l.amount, 0);
const total = totalLongs + totalShorts;
const longPct = total > 0 ? Math.round((totalLongs / total) * 100) : 50;

// ─── Component ──────────────────────────────────────────────────
function LiquidationCompact() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Summary bar — longs vs shorts */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: '6px 10px 8px',
          borderRadius: 8,
          background: alpha(C.sf, 0.5),
          marginBottom: 2,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: F,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          <span style={{ color: C.g }}>
            Longs {fmtAmount(totalLongs)} ({longPct}%)
          </span>
          <span style={{ color: C.r }}>
            Shorts {fmtAmount(totalShorts)} ({100 - longPct}%)
          </span>
        </div>
        <div style={{ height: 4, display: 'flex', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${longPct}%`, background: C.g, transition: 'width 0.5s' }} />
          <div style={{ flex: 1, background: C.r }} />
        </div>
      </div>

      {/* Liquidation rows */}
      {MOCK_LIQUIDATIONS.map((l) => {
        const isLong = l.side === 'LONG';
        const tint = isLong ? C.g : C.r;
        const symbol = l.pair.replace('USDT', '');

        return (
          <div
            key={l.id}
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
            {/* Time */}
            <span style={{ color: C.t3, fontSize: 11, minWidth: 36, flexShrink: 0 }}>{l.time}</span>

            {/* Pair */}
            <span style={{ fontWeight: 700, minWidth: 42, flexShrink: 0 }}>{symbol}</span>

            {/* Side badge */}
            <span
              style={{
                padding: '1px 6px',
                borderRadius: 8,
                background: alpha(tint, 0.12),
                color: tint,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 0.5,
                lineHeight: '16px',
                flexShrink: 0,
                textTransform: 'uppercase',
                minWidth: 36,
                textAlign: 'center',
              }}
            >
              {l.side}
            </span>

            {/* Amount */}
            <span style={{ fontWeight: 600, flex: 1, textAlign: 'right' }}>{fmtAmount(l.amount)}</span>

            {/* Price */}
            <span style={{ color: C.t2, fontSize: 11, minWidth: 52, textAlign: 'right', flexShrink: 0 }}>
              @{l.price >= 1000 ? `${(l.price / 1000).toFixed(1)}K` : l.price}
            </span>

            {/* Exchange badge */}
            <span
              style={{
                padding: '1px 5px',
                borderRadius: 4,
                background: alpha(C.t3, 0.1),
                color: C.t3,
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: 0.3,
                flexShrink: 0,
                minWidth: 40,
                textAlign: 'center',
              }}
            >
              {l.exchange}
            </span>
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
          View all liquidations &rarr;
        </span>
      </div>
    </div>
  );
}

export default React.memo(LiquidationCompact);
