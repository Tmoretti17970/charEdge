// ═══════════════════════════════════════════════════════════════════
// charEdge — Tops Heat Map View
//
// Canvas-rendered treemap for the Top discovery tab.
// Adapted from MarketsHeatMap to work with TopMarketsStore data.
// Tile size = market cap or volume, color = 24h % change.
// ═══════════════════════════════════════════════════════════════════

import { memo, useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { C } from '../../../constants.js';
import useTopMarketsStore from '../../../state/useTopMarketsStore.js';

// ─── Squarified Treemap Layout ──────────────────────────────────

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

      let currentWorst = 0;
      const currentLen = (rowWeight / totalRemaining) * (isWide ? cw : ch);
      for (const item of row) {
        const itemFrac = item.weight / rowWeight;
        const itemLen = itemFrac * side;
        const aspect = Math.max(currentLen / itemLen, itemLen / currentLen);
        currentWorst = Math.max(currentWorst, aspect);
      }

      if (worstAspect < currentWorst) {
        row.push(remaining[i]);
        rowWeight = testWeight;
      } else {
        break;
      }
    }

    const rowLen = (rowWeight / totalRemaining) * (isWide ? cw : ch);
    let offset = 0;
    for (const item of row) {
      const frac = item.weight / rowWeight;
      const itemLen = frac * side;
      if (isWide) {
        rects.push({ ...item, x: cx, y: cy + offset, w: rowLen, h: itemLen });
      } else {
        rects.push({ ...item, x: cx + offset, y: cy, w: itemLen, h: rowLen });
      }
      offset += itemLen;
    }

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

// ─── Color mapping ──────────────────────────────────────────────

function changeToColor(pct) {
  if (pct == null) return 'rgba(100, 100, 120, 0.6)';
  const clamped = Math.max(-10, Math.min(10, pct));
  if (clamped >= 0) {
    const t = clamped / 10;
    const r = Math.round(20 + (52 - 20) * (1 - t));
    const g = Math.round(80 + (199 - 80) * t);
    const b = Math.round(60 + (89 - 60) * (1 - t));
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const t = Math.abs(clamped) / 10;
    const r = Math.round(80 + (255 - 80) * t);
    const g = Math.round(60 + (59 - 60) * (1 - t));
    const b = Math.round(60 + (48 - 60) * (1 - t));
    return `rgb(${r}, ${g}, ${b})`;
  }
}

// ─── Main Component ─────────────────────────────────────────────

export default memo(function TopsHeatMap() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [dims, setDims] = useState({ w: 800, h: 500 });

  const markets = useTopMarketsStore((s) => s.markets);
  const assetClassFilter = useTopMarketsStore((s) => s.assetClassFilter);
  const topicFilter = useTopMarketsStore((s) => s.topicFilter);
  const searchQuery = useTopMarketsStore((s) => s.searchQuery);

  const filtered = useMemo(
    () => useTopMarketsStore.getState().getFilteredMarkets(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- store slices as deps to trigger recalc
    [markets, assetClassFilter, topicFilter, searchQuery],
  );

  const treeData = useMemo(() => {
    return filtered
      .filter((m) => (m.marketCap || m.volume24h) > 0)
      .slice(0, 100)
      .map((m) => ({
        ...m,
        weight: m.marketCap || m.volume24h || 1,
      }))
      .sort((a, b) => b.weight - a.weight);
  }, [filtered]);

  const rects = useMemo(() => {
    if (treeData.length === 0) return [];
    return squarify(treeData, 2, 2, dims.w - 4, dims.h - 4);
  }, [treeData, dims]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDims({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || rects.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dims.w * dpr;
    canvas.height = dims.h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, dims.w, dims.h);

    // Draw tiles
    for (const rect of rects) {
      const gap = 1.5;
      const rx = rect.x + gap;
      const ry = rect.y + gap;
      const rw = rect.w - gap * 2;
      const rh = rect.h - gap * 2;
      if (rw < 2 || rh < 2) continue;

      const radius = Math.min(6, rw / 4, rh / 4);

      // Rounded rect
      ctx.beginPath();
      ctx.moveTo(rx + radius, ry);
      ctx.lineTo(rx + rw - radius, ry);
      ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius);
      ctx.lineTo(rx + rw, ry + rh - radius);
      ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh);
      ctx.lineTo(rx + radius, ry + rh);
      ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius);
      ctx.lineTo(rx, ry + radius);
      ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
      ctx.closePath();

      ctx.fillStyle = changeToColor(rect.change24h);
      ctx.fill();

      // Hover highlight
      if (hover && hover.id === rect.id) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Labels (only if tile is large enough)
      if (rw > 40 && rh > 24) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        const symbolSize = Math.min(13, Math.max(9, rw / 8));
        ctx.font = `700 ${symbolSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(rect.symbol, rx + rw / 2, ry + rh / 2 - 2);

        if (rh > 38 && rect.change24h != null) {
          const sign = rect.change24h >= 0 ? '+' : '';
          ctx.font = `600 ${Math.max(8, symbolSize - 2)}px -apple-system, sans-serif`;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.fillText(`${sign}${rect.change24h.toFixed(1)}%`, rx + rw / 2, ry + rh / 2 + symbolSize);
        }
      }
    }
  }, [rects, dims, hover]);

  // Mouse tracking
  const handleMouseMove = useCallback(
    (e) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const bound = canvas.getBoundingClientRect();
      const mx = e.clientX - bound.left;
      const my = e.clientY - bound.top;
      const found = rects.find((r) => mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h);
      setHover(found || null);
    },
    [rects],
  );

  if (treeData.length === 0) {
    return (
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: C.t3, fontSize: 13 }}
      >
        No market data for heatmap
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ flex: 1, position: 'relative', minHeight: 300 }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', cursor: hover ? 'pointer' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      />
      {/* Tooltip */}
      {hover && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 16px',
            borderRadius: 12,
            background: 'var(--tf-glass-3)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--tf-bd)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{hover.symbol}</span>
          <span style={{ fontSize: 12, color: C.t2 }}>{hover.name}</span>
          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--tf-mono)', color: C.t1 }}>
            ${hover.price?.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </span>
          {hover.change24h != null && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'var(--tf-mono)',
                color: hover.change24h >= 0 ? 'var(--tf-green, #34C759)' : 'var(--tf-red, #FF3B30)',
              }}
            >
              {hover.change24h >= 0 ? '+' : ''}
              {hover.change24h.toFixed(2)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
});
