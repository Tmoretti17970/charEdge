// ═══════════════════════════════════════════════════════════════════
// charEdge — DrawingEngine: Snap & Smart Guides Sub-Module
// Pure helper functions for magnet snap, angle snap, and smart guides.
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute adaptive round-number snap levels for a given price.
 * @param {number} price
 * @returns {Array<{price: number, label: string}>}
 */
export function getRoundPriceLevels(price) {
  const absP = Math.abs(price);
  let intervals;
  if (absP >= 10000)      intervals = [10000, 5000, 1000, 500];
  else if (absP >= 1000)  intervals = [1000, 500, 100, 50];
  else if (absP >= 100)   intervals = [100, 50, 25, 10];
  else if (absP >= 10)    intervals = [10, 5, 1, 0.5];
  else if (absP >= 1)     intervals = [1, 0.5, 0.25, 0.1];
  else                    intervals = [0.1, 0.05, 0.01, 0.005];

  const levels = [];
  for (const iv of intervals) {
    const rounded = Math.round(price / iv) * iv;
    for (const r of [rounded - iv, rounded, rounded + iv]) {
      if (r > 0 && Math.abs(r - price) < absP * 0.03) {
        levels.push({ price: r, label: `$${formatRound(r)}` });
      }
    }
  }
  return levels;
}

/** Format a round number for display */
export function formatRound(n) {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1)    return n.toFixed(n % 1 === 0 ? 0 : 2);
  return n.toPrecision(3);
}

/**
 * Apply angle snapping when Shift is held during trendline creation.
 * Locks to 0°, 15°, 30°, 45°, 60°, 75°, 90° increments.
 * @param {boolean} enabled  - Whether angle snap is active
 * @param {{x:number,y:number}|null} startPx
 * @param {number} endX
 * @param {number} endY
 * @returns {{x:number,y:number}}
 */
export function applyAngleSnap(enabled, startPx, endX, endY) {
  if (!enabled || !startPx) return { x: endX, y: endY };
  const dx = endX - startPx.x;
  const dy = endY - startPx.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 5) return { x: endX, y: endY };

  const angle = Math.atan2(dy, dx);
  const snapAngles = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, -15, -30, -45, -60, -75, -90, -105, -120, -135, -150, -165];
  const degAngle = (angle * 180) / Math.PI;
  let closest = 0, minDiff = 360;
  for (const sa of snapAngles) {
    const diff = Math.abs(degAngle - sa);
    if (diff < minDiff) { minDiff = diff; closest = sa; }
  }
  const radSnapped = (closest * Math.PI) / 180;
  return {
    x: startPx.x + dist * Math.cos(radSnapped),
    y: startPx.y + dist * Math.sin(radSnapped),
  };
}

/**
 * Get smart guide alignment lines for a cursor position.
 * @param {boolean} enabled
 * @param {number} x  cursor CSS x
 * @param {number} y  cursor CSS y
 * @param {Array} drawings
 * @param {object|null} activeDrawing
 * @param {Function} anchorToPixel
 * @returns {Array<{type:string, x?:number, y?:number, fromX?:number, toX?:number, fromY?:number, toY?:number}>}
 */
export function getSmartGuides(enabled, x, y, drawings, activeDrawing, anchorToPixel) {
  if (!enabled) return [];
  const guides = [];
  const threshold = 4;
  for (const d of drawings) {
    if (d === activeDrawing || !d.visible) continue;
    for (const pt of d.points || []) {
      const px = anchorToPixel(pt);
      if (!px) continue;
      if (Math.abs(y - px.y) < threshold) {
        guides.push({ type: 'horizontal', y: px.y, fromX: Math.min(x, px.x) - 20, toX: Math.max(x, px.x) + 20 });
      }
      if (Math.abs(x - px.x) < threshold) {
        guides.push({ type: 'vertical', x: px.x, fromY: Math.min(y, px.y) - 20, toY: Math.max(y, px.y) + 20 });
      }
    }
  }
  return guides;
}

/**
 * Run the full magnet snap pipeline.
 * @param {object} ctx  Snap context
 * @param {number} ctx.x  Cursor CSS x
 * @param {number} ctx.y  Cursor CSS y
 * @param {number} ctx.price  Raw cursor price
 * @param {number} ctx.time  Raw cursor time
 * @param {number} ctx.snapStrength  Pixel radius
 * @param {Function|null} ctx.magnetSnap  External OHLC magnet snap callback
 * @param {Array} ctx.drawings
 * @param {object|null} ctx.activeDrawing
 * @param {Function} ctx.anchorToPixel
 * @param {Function|null} ctx.priceToPixel
 * @param {Array} ctx.indicatorData
 * @param {number} ctx.hoverBarIdx
 * @param {Array} ctx.gridTicks
 * @returns {{ price: number, time: number, snapInfo: object|null }}
 */
export function doMagnetSnap(ctx) {
  const { x, y, price, time, snapStrength, magnetSnap, drawings, activeDrawing, anchorToPixel, priceToPixel, indicatorData, hoverBarIdx, gridTicks, visibleBars } = ctx;

  if (!magnetSnap && snapStrength <= 0) return { price, time, snapInfo: null };

  const candidates = [];

  // 0. Pixel-radius OHLC bar scan (D1.1) — highest priority
  if (visibleBars && visibleBars.length > 0 && priceToPixel) {
    const SCAN_RADIUS = 15;
    for (const bar of visibleBars) {
      const barX = bar.x;
      if (Math.abs(x - barX) > SCAN_RADIUS) continue;
      const ohlcEntries = [
        { key: 'open',  price: bar.open,  py: bar.openY  ?? priceToPixel(bar.open) },
        { key: 'high',  price: bar.high,  py: bar.highY  ?? priceToPixel(bar.high) },
        { key: 'low',   price: bar.low,   py: bar.lowY   ?? priceToPixel(bar.low) },
        { key: 'close', price: bar.close, py: bar.closeY ?? priceToPixel(bar.close) },
      ];
      for (const entry of ohlcEntries) {
        const dist2d = Math.sqrt((x - barX) ** 2 + (y - entry.py) ** 2);
        if (dist2d < SCAN_RADIUS) {
          // D1.2: High/Low get 0.8× distance multiplier (win tiebreaks)
          const adjustedDist = (entry.key === 'high' || entry.key === 'low') ? dist2d * 0.8 : dist2d;
          candidates.push({
            price: entry.price, time: bar.time || time,
            label: entry.key.toUpperCase(), type: 'ohlc-scan',
            priority: 0, dist: adjustedDist,
          });
        }
      }
    }
  }

  // 1. External OHLC snap
  if (magnetSnap) {
    const ext = magnetSnap(price, time);
    if (ext && (ext.price !== price || ext.time !== time)) {
      const py = priceToPixel ? Math.abs(y - priceToPixel(ext.price)) : 0;
      candidates.push({ price: ext.price, time: ext.time, label: ext.label || 'OHLC', type: 'ohlc', priority: 1, dist: py });
    }
  }

  // 2. Drawing endpoints
  for (const d of drawings) {
    if (d === activeDrawing || !d.visible) continue;
    for (const pt of d.points || []) {
      const px = anchorToPixel(pt);
      if (!px) continue;
      const dist = Math.sqrt((x - px.x) ** 2 + (y - px.y) ** 2);
      if (dist < snapStrength) {
        candidates.push({ price: pt.price, time: pt.time, label: 'Drawing', type: 'drawing', priority: 2, dist });
      }
    }
  }

  // 3. H-line levels
  for (const d of drawings) {
    if (d === activeDrawing || !d.visible) continue;
    if ((d.type === 'hline' || d.type === 'hray') && d.points?.[0]) {
      const py = priceToPixel ? priceToPixel(d.points[0].price) : null;
      if (py !== null && Math.abs(y - py) < snapStrength) {
        candidates.push({ price: d.points[0].price, time, label: 'H-Line', type: 'drawing', priority: 3, dist: Math.abs(y - py) });
      }
    }
  }

  // 4. Round prices
  if (priceToPixel) {
    for (const lvl of getRoundPriceLevels(price)) {
      const py = priceToPixel(lvl.price);
      const dist = Math.abs(y - py);
      if (dist < snapStrength * 0.8) {
        candidates.push({ price: lvl.price, time, label: lvl.label, type: 'round', priority: 4, dist });
      }
    }
  }

  // 5. Indicator values
  if (indicatorData.length > 0 && hoverBarIdx >= 0 && priceToPixel) {
    for (const ind of indicatorData) {
      for (const out of ind.outputs || []) {
        const vals = out.values;
        if (!vals || hoverBarIdx >= vals.length) continue;
        const val = vals[hoverBarIdx];
        if (isNaN(val) || val == null) continue;
        const py = priceToPixel(val);
        const dist = Math.abs(y - py);
        if (dist < snapStrength) {
          candidates.push({ price: val, time, label: ind.label || out.key, type: 'indicator', priority: 5, dist });
        }
      }
    }
  }

  // 6. Grid ticks
  if (gridTicks.length > 0 && priceToPixel) {
    for (const tick of gridTicks) {
      const py = priceToPixel(tick);
      const dist = Math.abs(y - py);
      if (dist < snapStrength * 0.6) {
        candidates.push({ price: tick, time, label: 'Grid', type: 'grid', priority: 6, dist });
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => (a.dist || 0) - (b.dist || 0) || a.priority - b.priority);
    const best = candidates[0];
    return {
      price: best.price,
      time: best.time,
      snapInfo: { x, y, label: best.label, type: best.type || 'ohlc', price: best.price, time: best.time },
    };
  }

  return { price, time, snapInfo: null };
}
