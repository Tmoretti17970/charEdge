// ═══════════════════════════════════════════════════════════════════
// charEdge — Markets Heat Map View (Sprint 18)
//
// Canvas-rendered treemap:
//   - Tile size  = volume (or marketCap)
//   - Tile color = % change (green positive, red negative)
//   - Click tile → opens detail panel
//   - Hover      → highlight border + tooltip
//
// Uses squarified treemap algorithm for balanced rectangle layout.
// ═══════════════════════════════════════════════════════════════════

import { memo, useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import useWatchlistStreaming from '../../../hooks/useWatchlistStreaming.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { useMarketsPrefsStore } from '../../../state/useMarketsPrefsStore';
import { useWatchlistStore, enrichWithTradeStats } from '../../../state/useWatchlistStore.js';

// ─── Squarified Treemap Layout ────────────────────────────────

function squarify(data, x, y, w, h) {
  const rects = [];
  if (!data.length || w <= 0 || h <= 0) return rects;

  const total = data.reduce((s, d) => s + d.weight, 0);
  if (total <= 0) return rects;

  let remaining = [...data];
  let cx = x,
    cy = y,
    cw = w,
    ch = h;

  while (remaining.length > 0) {
    const isWide = cw >= ch;
    const side = isWide ? ch : cw;
    const totalRemaining = remaining.reduce((s, d) => s + d.weight, 0);

    const row = [remaining[0]];
    let rowWeight = remaining[0].weight;
    for (let i = 1; i < remaining.length; i++) {
      const testWeight = rowWeight + remaining[i].weight;
      const rowLen = (testWeight / totalRemaining) * (isWide ? cw : ch);
      let worstAspect = 0;

      for (const item of [...row, remaining[i]]) {
        const itemFrac = item.weight / testWeight;
        const itemLen = itemFrac * side;
        const aspect = Math.max(rowLen / itemLen, itemLen / rowLen);
        worstAspect = Math.max(worstAspect, aspect);
      }

      // Check if previous best was better
      const rowLenPrev = (rowWeight / totalRemaining) * (isWide ? cw : ch);
      let prevWorst = 0;
      for (const item of row) {
        const itemFrac = item.weight / rowWeight;
        const itemLen = itemFrac * side;
        const aspect = Math.max(rowLenPrev / itemLen, itemLen / rowLenPrev);
        prevWorst = Math.max(prevWorst, aspect);
      }

      if (worstAspect > prevWorst && row.length > 0) break;

      row.push(remaining[i]);
      rowWeight += remaining[i].weight;
    }

    // Lay out this row
    const rowLen = (rowWeight / totalRemaining) * (isWide ? cw : ch);
    let offset = 0;

    for (const item of row) {
      const frac = item.weight / rowWeight;
      const itemSize = frac * side;

      if (isWide) {
        rects.push({
          ...item,
          rx: cx,
          ry: cy + offset,
          rw: rowLen,
          rh: itemSize,
        });
      } else {
        rects.push({
          ...item,
          rx: cx + offset,
          ry: cy,
          rw: itemSize,
          rh: rowLen,
        });
      }
      offset += itemSize;
    }

    // Shrink remaining space
    if (isWide) {
      cx += rowLen;
      cw -= rowLen;
    } else {
      cy += rowLen;
      ch -= rowLen;
    }

    remaining = remaining.slice(row.length);
  }

  return rects;
}

// ─── Color helpers ────────────────────────────────────────────

function changeToColor(change) {
  if (change == null || isNaN(change)) return '#555';
  const clamped = Math.max(-10, Math.min(10, change));
  const t = (clamped + 10) / 20; // 0=deep red, 0.5=neutral, 1=deep green

  if (t < 0.5) {
    const r = Math.round(180 + (1 - t * 2) * 75);
    const g = Math.round(50 + t * 2 * 60);
    const b = Math.round(50 + t * 2 * 30);
    return `rgb(${r},${g},${b})`;
  } else {
    const factor = (t - 0.5) * 2;
    const r = Math.round(80 - factor * 40);
    const g = Math.round(110 + factor * 100);
    const b = Math.round(80 - factor * 30);
    return `rgb(${r},${g},${b})`;
  }
}

function changeToTextColor(change) {
  if (change == null || isNaN(change)) return '#aaa';
  const abs = Math.abs(change);
  return abs > 3 ? '#fff' : '#eee';
}

// ─── Main Component ──────────────────────────────────────────

function MarketsHeatMap() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [dims, setDims] = useState({ w: 800, h: 500 });
  const rectsRef = useRef([]);

  const items = useWatchlistStore((s) => s.items);
  const trades = useJournalStore((s) => s.trades);
  const setSelectedSymbol = useMarketsPrefsStore((s) => s.setSelectedSymbol);
  const heatmapSizeBy = useMarketsPrefsStore((s) => s.heatmapSizeBy);
  const assetClassFilters = useMarketsPrefsStore((s) => s.assetClassFilters);

  const symbols = useMemo(() => items.map((i) => i.symbol), [items]);
  const { prices } = useWatchlistStreaming(symbols, symbols.length > 0);
  const enriched = enrichWithTradeStats(items, trades);
  const filtered = useMemo(() => {
    if (assetClassFilters.length === 0) return enriched;
    return enriched.filter((item) => assetClassFilters.includes(item.assetClass));
  }, [enriched, assetClassFilters]);

  // ─── Resize observer ─────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setDims({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ─── Compute treemap layout ──────────────────────────────
  const rects = useMemo(() => {
    const data = filtered
      .map((item) => {
        // Merge live streaming data with static watchlist item
        const live = prices[item.symbol] || prices[item.symbol + 'USDT'] || {};
        const change = live.changePercent ?? live.change ?? item.change24h ?? item.change ?? 0;
        const price = live.price ?? item.price ?? 0;
        const volume = live.volume ?? item.volume ?? 1;
        return {
          symbol: item.symbol?.replace('USDT', '') || '?',
          fullSymbol: item.symbol,
          change,
          price,
          volume,
          marketCap: item.marketCap ?? volume,
          weight: Math.max(heatmapSizeBy === 'marketCap' ? (item.marketCap ?? volume) : volume, 0.01),
        };
      })
      .sort((a, b) => b.weight - a.weight);

    const PAD = 2;
    return squarify(data, PAD, PAD, dims.w - PAD * 2, dims.h - PAD * 2);
  }, [filtered, dims, heatmapSizeBy, prices]);

  rectsRef.current = rects;

  // ─── Draw canvas ─────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = dims.w * dpr;
    canvas.height = dims.h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, dims.w, dims.h);

    const GAP = 2;

    for (const r of rects) {
      const x = r.rx + GAP / 2;
      const y = r.ry + GAP / 2;
      const w = r.rw - GAP;
      const h = r.rh - GAP;
      if (w < 1 || h < 1) continue;

      // Tile background
      ctx.fillStyle = changeToColor(r.change);
      ctx.beginPath();
      const rad = Math.min(6, w / 4, h / 4);
      ctx.roundRect(x, y, w, h, rad);
      ctx.fill();

      // Hover highlight
      if (hovered === r.fullSymbol) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Label (only if tile big enough)
      if (w > 36 && h > 24) {
        const fontSize = Math.min(14, Math.max(9, w / 6));
        ctx.font = `800 ${fontSize}px ${F}`;
        ctx.fillStyle = changeToTextColor(r.change);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const label = r.symbol;
        const changeLabel = `${r.change >= 0 ? '+' : ''}${r.change.toFixed(1)}%`;

        if (h > 40) {
          ctx.fillText(label, x + w / 2, y + h / 2 - fontSize * 0.5);
          ctx.font = `600 ${Math.max(8, fontSize - 2)}px ${M}`;
          ctx.fillStyle = `${changeToTextColor(r.change)}cc`;
          ctx.fillText(changeLabel, x + w / 2, y + h / 2 + fontSize * 0.6);
        } else {
          ctx.fillText(`${label} ${changeLabel}`, x + w / 2, y + h / 2);
        }
      }
    }
  }, [rects, hovered, dims]);

  // ─── Mouse interaction ───────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const hit = rectsRef.current.find((r) => mx >= r.rx && mx <= r.rx + r.rw && my >= r.ry && my <= r.ry + r.rh);
    setHovered(hit ? hit.fullSymbol : null);
    canvas.style.cursor = hit ? 'pointer' : 'default';
  }, []);

  const handleClick = useCallback(
    (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const hit = rectsRef.current.find((r) => mx >= r.rx && mx <= r.rx + r.rw && my >= r.ry && my <= r.ry + r.rh);
      if (hit) setSelectedSymbol(hit.fullSymbol);
    },
    [setSelectedSymbol],
  );

  // ─── Tooltip ─────────────────────────────────────────────
  const hoveredRect = hovered ? rects.find((r) => r.fullSymbol === hovered) : null;

  return (
    <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
        onClick={handleClick}
      />

      {/* Tooltip */}
      {hoveredRect && (
        <div
          style={{
            position: 'absolute',
            top: Math.min(hoveredRect.ry + 8, dims.h - 70),
            left: Math.min(hoveredRect.rx + hoveredRect.rw / 2, dims.w - 130),
            transform: 'translateX(-50%)',
            background: `${C.bg}ee`,
            border: `1px solid ${C.bd}40`,
            borderRadius: 8,
            padding: '8px 12px',
            pointerEvents: 'none',
            zIndex: 10,
            backdropFilter: 'blur(12px)',
            minWidth: 120,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, fontFamily: 'var(--tf-font)', color: C.t1 }}>
            {hoveredRect.symbol}
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--tf-mono)', color: C.t2, marginTop: 2 }}>
            $
            {hoveredRect.price >= 1000
              ? hoveredRect.price.toLocaleString('en-US', { maximumFractionDigits: 0 })
              : hoveredRect.price >= 1
                ? hoveredRect.price.toFixed(2)
                : hoveredRect.price.toFixed(4)}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'var(--tf-mono)',
              marginTop: 2,
              color: hoveredRect.change >= 0 ? C.g : C.r,
            }}
          >
            {hoveredRect.change >= 0 ? '+' : ''}
            {hoveredRect.change.toFixed(2)}%
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(MarketsHeatMap);
