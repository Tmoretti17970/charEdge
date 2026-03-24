// ═══════════════════════════════════════════════════════════════════
// charEdge — Mini Chart (Sprint 10)
//
// Interactive Canvas 2D chart for the detail panel. Renders either
// candlestick or line chart with:
//   - Time range selector (1D/1W/1M/3M/1Y/ALL)
//   - Hover crosshair with OHLCV tooltip
//   - Smooth gradient area fill
//   - Loading and error states
//
// Uses useHistoricalData hook for data fetching.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { C } from '../../../constants.js';
import { radii, transition } from '../../../theme/tokens.js';
import useHistoricalData from '../../../hooks/useHistoricalData.js';
import st from './MiniChart.module.css';

const ACCENT = '#6e5ce6';
const GREEN  = '#22c55e';
const RED    = '#ef4444';

// ═══════════════════════════════════════════════════════════════════
// MiniChart — Main Component
// ═══════════════════════════════════════════════════════════════════

function MiniChart({ symbol }) {
  const { candles, loading, error, timeRange, setTimeRange, timeRanges } = useHistoricalData(symbol);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const [hover, setHover] = useState(null); // { x, index, candle }
  const [chartMode, setChartMode] = useState('line'); // 'line' | 'candle'

  const CHART_HEIGHT = 180;
  const PADDING = { top: 8, right: 8, bottom: 4, left: 8 };

  // ─── Resize observer ──────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        setChartSize({ width, height: CHART_HEIGHT });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ─── Chart dimensions ─────────────────────────────────────
  const plotArea = useMemo(() => ({
    x: PADDING.left,
    y: PADDING.top,
    w: chartSize.width - PADDING.left - PADDING.right,
    h: chartSize.height - PADDING.top - PADDING.bottom,
  }), [chartSize]);

  // ─── Price range ──────────────────────────────────────────
  const priceRange = useMemo(() => {
    if (!candles || candles.length === 0) return { min: 0, max: 1 };
    let min = Infinity, max = -Infinity;
    for (const c of candles) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    }
    const margin = (max - min) * 0.05 || 1;
    return { min: min - margin, max: max + margin };
  }, [candles]);

  // ─── Scale helpers ────────────────────────────────────────
  const scaleX = useCallback((i) => {
    if (candles.length <= 1) return plotArea.x;
    return plotArea.x + (i / (candles.length - 1)) * plotArea.w;
  }, [candles, plotArea]);

  const scaleY = useCallback((price) => {
    const { min, max } = priceRange;
    const range = max - min || 1;
    return plotArea.y + plotArea.h - ((price - min) / range) * plotArea.h;
  }, [priceRange, plotArea]);

  // ─── Canvas draw ──────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !candles || candles.length === 0) return;
    if (chartSize.width === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = chartSize.width * dpr;
    canvas.height = chartSize.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, chartSize.width, chartSize.height);

    const isUp = candles[candles.length - 1].close >= candles[0].close;
    const lineColor = isUp ? GREEN : RED;

    if (chartMode === 'candle') {
      // ─── Candlestick mode ─────────────────────────────
      const barWidth = Math.max(1, (plotArea.w / candles.length) * 0.6);
      for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        const x = scaleX(i);
        const bullish = c.close >= c.open;
        const color = bullish ? GREEN : RED;

        // Wick
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, scaleY(c.high));
        ctx.lineTo(x, scaleY(c.low));
        ctx.stroke();

        // Body
        const bodyTop = scaleY(Math.max(c.open, c.close));
        const bodyBot = scaleY(Math.min(c.open, c.close));
        const bodyH = Math.max(1, bodyBot - bodyTop);
        ctx.fillStyle = color;
        ctx.fillRect(x - barWidth / 2, bodyTop, barWidth, bodyH);
      }
    } else {
      // ─── Line mode with gradient fill ──────────────────
      // Area fill
      const gradient = ctx.createLinearGradient(0, plotArea.y, 0, plotArea.y + plotArea.h);
      gradient.addColorStop(0, `${lineColor}20`);
      gradient.addColorStop(1, `${lineColor}02`);

      ctx.beginPath();
      ctx.moveTo(scaleX(0), scaleY(candles[0].close));
      for (let i = 1; i < candles.length; i++) {
        ctx.lineTo(scaleX(i), scaleY(candles[i].close));
      }
      ctx.lineTo(scaleX(candles.length - 1), plotArea.y + plotArea.h);
      ctx.lineTo(scaleX(0), plotArea.y + plotArea.h);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.moveTo(scaleX(0), scaleY(candles[0].close));
      for (let i = 1; i < candles.length; i++) {
        ctx.lineTo(scaleX(i), scaleY(candles[i].close));
      }
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // ─── Crosshair ──────────────────────────────────────
    if (hover) {
      const hx = scaleX(hover.index);
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = `${C.t3}60`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, plotArea.y);
      ctx.lineTo(hx, plotArea.y + plotArea.h);
      ctx.stroke();
      ctx.setLineDash([]);

      // Dot on line
      const hy = scaleY(hover.candle.close);
      ctx.beginPath();
      ctx.arc(hx, hy, 4, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
      ctx.strokeStyle = C.bg;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [candles, chartSize, chartMode, hover, scaleX, scaleY, plotArea]);

  // ─── Mouse handlers ───────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    if (!candles || candles.length === 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const index = Math.round(((mx - PADDING.left) / plotArea.w) * (candles.length - 1));
    const clampedIndex = Math.max(0, Math.min(candles.length - 1, index));
    setHover({ x: mx, index: clampedIndex, candle: candles[clampedIndex] });
  }, [candles, plotArea]);

  const handleMouseLeave = useCallback(() => setHover(null), []);

  // ─── Format helpers ───────────────────────────────────────
  function fmtP(val) {
    if (val == null) return '—';
    if (val >= 1000) return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (val >= 1) return `$${val.toFixed(2)}`;
    return `$${val.toFixed(4)}`;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  }

  function fmtDateShort(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div style={{ padding: '0' }}>
      {/* ─── Controls: time range + chart mode toggle ──── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 20px 4px',
          gap: 6,
        }}
      >
        {/* Time range pills */}
        <div style={{ display: 'flex', gap: 2 }}>
          {timeRanges.map((r) => (
            <button
              key={r.id}
              onClick={() => setTimeRange(r.id)}
              style={{
                padding: '3px 8px',
                borderRadius: radii.xs,
                fontSize: 9,
                fontWeight: 700,
                fontFamily: 'var(--tf-mono)',
                border: 'none',
                cursor: 'pointer',
                transition: `all ${transition.fast}`,
                background: timeRange === r.id ? `${ACCENT}18` : 'transparent',
                color: timeRange === r.id ? ACCENT : C.t3,
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Chart mode toggle */}
        <div style={{ display: 'flex', gap: 2 }}>
          {['line', 'candle'].map((mode) => (
            <button
              key={mode}
              onClick={() => setChartMode(mode)}
              style={{
                padding: '2px 6px',
                borderRadius: radii.xs,
                fontSize: 9,
                fontWeight: 600,
                fontFamily: 'var(--tf-mono)',
                border: 'none',
                cursor: 'pointer',
                transition: `all ${transition.fast}`,
                background: chartMode === mode ? `${C.bd}30` : 'transparent',
                color: chartMode === mode ? C.t1 : C.t3,
              }}
            >
              {mode === 'line' ? '━' : '┃'}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Hover OHLCV tooltip ─────────────────────── */}
      <div
        style={{
          height: 16,
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 9,
          fontFamily: 'var(--tf-mono)',
          color: C.t3,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {hover?.candle ? (
          <>
            <span>{fmtDateShort(hover.candle.time)}</span>
            <span>O {fmtP(hover.candle.open)}</span>
            <span>H {fmtP(hover.candle.high)}</span>
            <span>L {fmtP(hover.candle.low)}</span>
            <span style={{ color: hover.candle.close >= hover.candle.open ? GREEN : RED }}>
              C {fmtP(hover.candle.close)}
            </span>
          </>
        ) : candles?.length > 0 ? (
          <>
            <span>{fmtDate(candles[0].time)} — {fmtDate(candles[candles.length - 1].time)}</span>
            <span style={{ color: C.t3 }}>{candles.length} bars</span>
          </>
        ) : null}
      </div>

      {/* ─── Canvas ──────────────────────────────────── */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          height: CHART_HEIGHT,
          margin: '0 12px',
          borderRadius: radii.sm,
          overflow: 'hidden',
          background: `${C.bd}06`,
        }}
      >
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
              background: `${C.bg}cc`,
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                border: `2px solid ${C.bd}`,
                borderTop: `2px solid ${ACCENT}`,
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          </div>
        )}

        {error && !loading && candles.length === 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: C.t3,
              fontSize: 11,
              fontFamily: 'var(--tf-font)',
            }}
          >
            {error}
          </div>
        )}

        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            cursor: candles.length > 0 ? 'crosshair' : 'default',
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export { MiniChart };
export default memo(MiniChart);
