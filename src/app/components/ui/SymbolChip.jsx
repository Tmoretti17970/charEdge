// ═══════════════════════════════════════════════════════════════════
// charEdge — SymbolChip (Phase B Sprint 7)
//
// Clickable symbol pill with ticker + mini price.
// Click navigates to Charts tab with that symbol pre-loaded.
// Glassmorphism styling with subtle hover glow.
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { C, M } from '../../../constants.js';
import { useChartStore } from '../../../state/useChartStore';
import { useUIStore } from '../../../state/useUIStore';
import { alpha } from '@/shared/colorUtils';

// ─── Simulated prices (in production, use live feed) ─────────────
const SYMBOL_PRICES = {
  ES:   { price: 5285.50, change: +0.42 },
  NQ:   { price: 18452.25, change: +0.67 },
  BTC:  { price: 68425.00, change: +2.14 },
  ETH:  { price: 3842.18, change: +1.89 },
  SOL:  { price: 148.62, change: +4.21 },
  DOGE: { price: 0.1245, change: -1.02 },
  AAPL: { price: 189.72, change: -0.31 },
  SPY:  { price: 528.45, change: +0.38 },
  UNI:  { price: 11.84, change: +6.10 },
  TSLA: { price: 196.42, change: -0.87 },
};

export default function SymbolChip({ symbol, showPrice = true, size = 'default' }) {
  const [hovered, setHovered] = useState(false);
  const setPage = useUIStore((s) => s.setPage);
  const addRecentSymbol = useUIStore((s) => s.addRecentSymbol);
  const setSymbol = useChartStore((s) => s.setSymbol);

  const upper = (symbol || '').toUpperCase();
  const data = SYMBOL_PRICES[upper];
  const changeColor = data && data.change >= 0 ? C.g : C.r;
  const isSmall = size === 'small';

  const handleClick = (e) => {
    e.stopPropagation();
    setSymbol(upper);
    if (addRecentSymbol) addRecentSymbol(upper);
    setPage('charts');
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`Open ${upper} chart`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSmall ? 4 : 6,
        padding: isSmall ? '2px 6px' : '3px 10px',
        borderRadius: isSmall ? 6 : 8,
        border: `1px solid ${hovered ? alpha(C.b, 0.4) : alpha(C.bd, 0.6)}`,
        background: hovered
          ? alpha(C.b, 0.08)
          : alpha(C.sf, 0.4),
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: hovered ? `0 0 8px ${alpha(C.b, 0.15)}` : 'none',
        verticalAlign: 'middle',
      }}
    >
      <span
        style={{
          fontSize: isSmall ? 10 : 11,
          fontWeight: 800,
          color: hovered ? C.b : C.t1,
          fontFamily: M,
          letterSpacing: 0.5,
        }}
      >
        {upper}
      </span>
      {showPrice && data && (
        <>
          <span
            style={{
              fontSize: isSmall ? 9 : 10,
              fontWeight: 600,
              color: C.t2,
              fontFamily: M,
            }}
          >
            {data.price > 1000 ? data.price.toLocaleString() : data.price.toFixed(2)}
          </span>
          <span
            style={{
              fontSize: isSmall ? 8 : 9,
              fontWeight: 700,
              color: changeColor,
              fontFamily: M,
            }}
          >
            {data.change >= 0 ? '↑' : '↓'}{Math.abs(data.change).toFixed(2)}%
          </span>
        </>
      )}
    </button>
  );
}

export { SymbolChip };
