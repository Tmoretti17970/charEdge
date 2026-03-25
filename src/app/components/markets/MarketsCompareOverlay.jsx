// ═══════════════════════════════════════════════════════════════════
// charEdge — Markets Compare Overlay (Sprint 20)
//
// Slides up when 2+ symbols are selected for comparison.
// Shows normalized % performance chart + side-by-side stats.
//
// Uses canvas for the multi-line chart.
// ═══════════════════════════════════════════════════════════════════

import { memo, useRef, useEffect, useMemo, useState } from 'react';
import { C, M } from '../../../constants.js';
import { useMarketsPrefsStore } from '../../../state/useMarketsPrefsStore';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import { radii } from '../../../theme/tokens.js';

const COMPARE_COLORS = ['#6e5ce6', '#10B981', '#F59E0B', '#EC4899'];
const TIME_RANGES = ['1D', '1W', '1M', '3M', '1Y'];

function MarketsCompareOverlay() {
  const compareSymbols = useMarketsPrefsStore((s) => s.compareSymbols);
  const clearCompare = useMarketsPrefsStore((s) => s.clearCompare);
  const removeCompareSymbol = useMarketsPrefsStore((s) => s.removeCompareSymbol);
  const compareTimeRange = useMarketsPrefsStore((s) => s.compareTimeRange);
  const setCompareTimeRange = useMarketsPrefsStore((s) => s.setCompareTimeRange);
  const items = useWatchlistStore((s) => s.items);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 600, h: 250 });

  const isOpen = compareSymbols.length >= 2;

  // Resize observer
  useEffect(() => {
    if (!isOpen) return;
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setDims({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen]);

  // Get item data for compared symbols
  const symbolData = useMemo(() => {
    return compareSymbols.map((sym, i) => {
      const item = items.find((it) => it.symbol === sym);
      return {
        symbol: sym,
        color: COMPARE_COLORS[i % COMPARE_COLORS.length],
        price: item?.price ?? 0,
        change: item?.change24h ?? item?.change ?? 0,
        volume: item?.volume ?? 0,
        assetClass: item?.assetClass || 'other',
      };
    });
  }, [compareSymbols, items]);

  // Draw normalized performance lines
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = dims;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const PAD = { top: 20, right: 16, bottom: 20, left: 50 };
    const chartW = w - PAD.left - PAD.right;
    const chartH = h - PAD.top - PAD.bottom;

    // Grid
    ctx.strokeStyle = `${C.bd}15`;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (chartH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + chartW, y);
      ctx.stroke();
    }

    // Zero line
    const zeroY = PAD.top + chartH / 2;
    ctx.strokeStyle = `${C.t3}30`;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(PAD.left, zeroY);
    ctx.lineTo(PAD.left + chartW, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Y-axis labels
    ctx.font = `500 9px ${M}`;
    ctx.fillStyle = C.t3;
    ctx.textAlign = 'right';
    const maxPct = 10;
    for (let i = 0; i <= 4; i++) {
      const pct = maxPct - (2 * maxPct * i) / 4;
      const y = PAD.top + (chartH * i) / 4;
      ctx.fillText(`${pct > 0 ? '+' : ''}${pct}%`, PAD.left - 6, y + 3);
    }

    // Simulated normalized lines (one per symbol)
    const POINTS = 30;
    symbolData.forEach((sym, si) => {
      ctx.strokeStyle = sym.color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      // Generate a smooth line based on the symbol's change
      const baseChange = sym.change || 0;
      for (let p = 0; p < POINTS; p++) {
        const x = PAD.left + (chartW * p) / (POINTS - 1);
        // Simulate converging to current change
        const progress = p / (POINTS - 1);
        const noise = Math.sin(p * 0.5 + si * 2) * 1.5 * (1 - progress);
        const pct = baseChange * progress + noise;
        const clampedPct = Math.max(-maxPct, Math.min(maxPct, pct));
        const y = zeroY - (clampedPct / maxPct) * (chartH / 2);

        if (p === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Endpoint dot
      const lastX = PAD.left + chartW;
      const lastPct = Math.max(-maxPct, Math.min(maxPct, baseChange));
      const lastY = zeroY - (lastPct / maxPct) * (chartH / 2);
      ctx.fillStyle = sym.color;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [isOpen, dims, symbolData]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        borderTop: `1px solid ${C.bd}30`,
        background: `${C.bg}f0`,
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 280,
        maxHeight: '45%',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          borderBottom: `1px solid ${C.bd}15`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--tf-font)', color: C.t1 }}>Compare</span>
          {symbolData.map((sym) => (
            <span
              key={sym.symbol}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10,
                fontWeight: 600,
                fontFamily: 'var(--tf-mono)',
                color: C.t2,
                background: `${sym.color}18`,
                border: `1px solid ${sym.color}30`,
                borderRadius: 4,
                padding: '2px 8px',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: sym.color }} />
              {sym.symbol.replace('USDT', '')}
              <button
                onClick={() => removeCompareSymbol(sym.symbol)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: C.t3,
                  cursor: 'pointer',
                  fontSize: 10,
                  padding: 0,
                  marginLeft: 2,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Time range buttons */}
          {TIME_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setCompareTimeRange(r)}
              style={{
                fontSize: 9,
                fontWeight: compareTimeRange === r ? 700 : 500,
                fontFamily: 'var(--tf-mono)',
                color: compareTimeRange === r ? C.t1 : C.t3,
                background: compareTimeRange === r ? `${C.bd}20` : 'transparent',
                border: 'none',
                borderRadius: 3,
                padding: '3px 6px',
                cursor: 'pointer',
              }}
            >
              {r}
            </button>
          ))}

          <div style={{ width: 1, height: 14, background: `${C.bd}30`, margin: '0 4px' }} />

          <button
            onClick={clearCompare}
            style={{
              fontSize: 10,
              fontWeight: 600,
              fontFamily: 'var(--tf-font)',
              color: C.t3,
              background: 'transparent',
              border: `1px solid ${C.bd}30`,
              borderRadius: radii.sm,
              padding: '3px 10px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Chart + Stats */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Chart */}
        <div ref={containerRef} style={{ flex: 1, position: 'relative' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>

        {/* Stats sidebar */}
        <div
          style={{
            width: 200,
            borderLeft: `1px solid ${C.bd}15`,
            padding: '8px 12px',
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--tf-font)', color: C.t3, marginBottom: 8 }}>
            STATS
          </div>
          {symbolData.map((sym) => (
            <div key={sym.symbol} style={{ marginBottom: 10 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'var(--tf-font)',
                  color: sym.color,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: sym.color }} />
                {sym.symbol.replace('USDT', '')}
              </div>
              <div style={{ fontSize: 10, fontFamily: 'var(--tf-mono)', color: C.t2, marginTop: 2 }}>
                $
                {sym.price >= 1000
                  ? sym.price.toLocaleString('en-US', { maximumFractionDigits: 0 })
                  : sym.price >= 1
                    ? sym.price.toFixed(2)
                    : sym.price.toFixed(4)}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'var(--tf-mono)',
                  marginTop: 1,
                  color: sym.change >= 0 ? C.g : C.r,
                }}
              >
                {sym.change >= 0 ? '+' : ''}
                {sym.change.toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(MarketsCompareOverlay);
