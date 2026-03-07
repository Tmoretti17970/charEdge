// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Minimap Navigator (Apple × TradingView Polish)
// Compressed overview strip with year labels, live beacon, and
// gradient fog-of-war for quick data navigation.
// ═══════════════════════════════════════════════════════════════════

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { C } from '../../../../constants.js';
import { alpha } from '../../../../utils/colorUtils.js';

const MINIMAP_HEIGHT = 36;

// ─── Year/Month Label Helpers ──────────────────────────────────

/** Scan data for year/month boundaries and return label positions */
function computeTimeLabels(data, canvasWidth) {
  if (!data?.length) return [];
  const labels = [];
  const barW = canvasWidth / data.length;
  let lastYear = -1;
  let lastMonth = -1;

  for (let i = 0; i < data.length; i++) {
    const ts = data[i].t || data[i].time;
    if (!ts) continue;
    const d = new Date(ts);
    const year = d.getFullYear();
    const month = d.getMonth();

    if (year !== lastYear) {
      labels.push({ x: i * barW, text: String(year), isYear: true });
      lastYear = year;
      lastMonth = month;
    } else if (month !== lastMonth) {
      // Only show month labels if there's enough room (>40px apart)
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const prev = labels.length > 0 ? labels[labels.length - 1].x : -Infinity;
      const px = i * barW;
      if (px - prev > 40) {
        labels.push({ x: px, text: monthNames[month], isYear: false });
      }
      lastMonth = month;
    }
  }
  return labels;
}

export default function ChartMinimap({ data, visibleBars = 80, scrollOffset = 0, onViewportChange }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, offset: 0 });
  const beaconPhase = useRef(0);
  const rafId = useRef(null);

  const totalBars = data?.length || 0;

  // Render the minimap canvas (accepts optional beacon alpha for animation)
  const render = useCallback((beaconAlpha = 1) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !data?.length) return;

    const rect = container.getBoundingClientRect();
    const pr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = MINIMAP_HEIGHT;

    canvas.width = w * pr;
    canvas.height = h * pr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(pr, pr);

    // Background — transparent to let CSS handle it
    ctx.clearRect(0, 0, w, h);

    // Find price range
    let minP = Infinity, maxP = -Infinity;
    for (const b of data) {
      if (b.low < minP) minP = b.low;
      if (b.high > maxP) maxP = b.high;
    }
    const range = maxP - minP || 1;
    const barW = w / data.length;
    const padY = 6;

    // Draw smooth area chart of close prices
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < data.length; i++) {
      const x = i * barW;
      const y = h - ((data[i].close - minP) / range) * (h - padY * 2) - padY;
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        // Smooth curve between points for Apple-like feel
        const prevX = (i - 1) * barW;
        const cpx = (prevX + x) / 2;
        const prevY = h - ((data[i - 1].close - minP) / range) * (h - padY * 2) - padY;
        ctx.quadraticCurveTo(cpx, prevY, x, y);
      }
    }
    ctx.lineTo(w, h);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, alpha(C.b, 0.13));
    grad.addColorStop(1, alpha(C.b, 0.01));
    ctx.fillStyle = grad;
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = i * barW;
      const y = h - ((data[i].close - minP) / range) * (h - padY * 2) - padY;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = (i - 1) * barW;
        const cpx = (prevX + x) / 2;
        const prevY = h - ((data[i - 1].close - minP) / range) * (h - padY * 2) - padY;
        ctx.quadraticCurveTo(cpx, prevY, x, y);
      }
    }
    ctx.strokeStyle = alpha(C.b, 0.33);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // ─── Year/Month Labels ───────────────────────────────────────
    const labels = computeTimeLabels(data, w);
    for (const lbl of labels) {
      ctx.save();
      ctx.font = lbl.isYear
        ? 'bold 8px Inter, system-ui, sans-serif'
        : '7px Inter, system-ui, sans-serif';
      ctx.fillStyle = lbl.isYear ? alpha(C.b, 0.6) : alpha(C.b, 0.35);
      ctx.textBaseline = 'bottom';
      ctx.fillText(lbl.text, lbl.x + 2, h - 1);
      // Year tick mark
      if (lbl.isYear) {
        ctx.strokeStyle = alpha(C.b, 0.25);
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(lbl.x, 0);
        ctx.lineTo(lbl.x, h);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Viewport rectangle
    const vBars = Math.min(visibleBars, totalBars);
    const vpRight = w - (scrollOffset / totalBars) * w;
    const vpWidth = Math.max(12, (vBars / totalBars) * w);
    const vpLeft = Math.max(0, vpRight - vpWidth);

    // ─── Fog-of-War (gradient dim) ──────────────────────────────
    // Left fog: opaque at x=0, fading to transparent near viewport
    if (vpLeft > 0) {
      const fogL = ctx.createLinearGradient(0, 0, vpLeft, 0);
      fogL.addColorStop(0, 'rgba(0,0,0,0.55)');
      fogL.addColorStop(0.7, 'rgba(0,0,0,0.4)');
      fogL.addColorStop(1, 'rgba(0,0,0,0.05)');
      ctx.fillStyle = fogL;
      ctx.beginPath();
      ctx.roundRect(0, 0, vpLeft, h, [4, 0, 0, 4]);
      ctx.fill();
    }
    // Right fog: transparent near viewport, opaque at x=w
    if (vpRight < w) {
      const fogR = ctx.createLinearGradient(vpRight, 0, w, 0);
      fogR.addColorStop(0, 'rgba(0,0,0,0.05)');
      fogR.addColorStop(0.3, 'rgba(0,0,0,0.4)');
      fogR.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = fogR;
      ctx.beginPath();
      ctx.roundRect(vpRight, 0, w - vpRight, h, [0, 4, 4, 0]);
      ctx.fill();
    }

    // Viewport border — rounded
    ctx.strokeStyle = alpha(C.b, 0.56);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(vpLeft + 0.5, 1, Math.min(vpWidth, w - vpLeft) - 1, h - 2, 4);
    ctx.stroke();

    // Frosted handles (pill-style)
    ctx.fillStyle = C.b;
    ctx.globalAlpha = 0.7;
    const handleW = 4;
    const handleH = 12;
    const hy = (h - handleH) / 2;
    // Left handle
    ctx.beginPath();
    ctx.roundRect(vpLeft + 1, hy, handleW, handleH, 2);
    ctx.fill();
    // Right handle
    ctx.beginPath();
    ctx.roundRect(Math.min(vpRight, w) - handleW - 1, hy, handleW, handleH, 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // ─── Live-Candle Beacon ──────────────────────────────────────
    // Pulsing dot at the rightmost (newest) candle position
    const lastIdx = data.length - 1;
    const beaconX = lastIdx * barW;
    const beaconY = h - ((data[lastIdx].close - minP) / range) * (h - padY * 2) - padY;

    // Outer glow
    ctx.save();
    ctx.globalAlpha = beaconAlpha * 0.25;
    ctx.fillStyle = C.b;
    ctx.beginPath();
    ctx.arc(beaconX, beaconY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Inner dot
    ctx.globalAlpha = beaconAlpha;
    ctx.fillStyle = C.b;
    ctx.beginPath();
    ctx.arc(beaconX, beaconY, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, [data, visibleBars, scrollOffset, totalBars]);

  // Beacon animation loop — pulse the live dot
  useEffect(() => {
    let active = true;
    const animate = () => {
      if (!active) return;
      beaconPhase.current += 0.04;
      const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(beaconPhase.current));
      render(pulse);
      rafId.current = requestAnimationFrame(animate);
    };
    rafId.current = requestAnimationFrame(animate);
    return () => {
      active = false;
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [render]);

  useEffect(() => {
    const onResize = () => render();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [render]);

  // Mouse interaction — drag viewport
  const handleMouseDown = useCallback(
    (e) => {
      if (!containerRef.current || !totalBars) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const w = rect.width;

      const vBars = Math.min(visibleBars, totalBars);
      const vpRight = w - (scrollOffset / totalBars) * w;
      const vpWidth = Math.max(12, (vBars / totalBars) * w);
      const vpLeft = Math.max(0, vpRight - vpWidth);

      if (mx >= vpLeft && mx <= vpRight) {
        // Drag viewport
        setDragging(true);
        dragStart.current = { x: e.clientX, offset: scrollOffset };
      } else {
        // Click to jump
        const frac = mx / w;
        const centerIdx = Math.floor(frac * totalBars);
        const newOffset = Math.max(0, Math.min(totalBars - centerIdx - Math.floor(vBars / 2), totalBars - vBars));
        if (onViewportChange) onViewportChange({ scrollOffset: Math.max(0, newOffset) });
      }
    },
    [totalBars, visibleBars, scrollOffset, onViewportChange],
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!dragging || !containerRef.current || !totalBars) return;
      const w = containerRef.current.getBoundingClientRect().width;
      const dx = e.clientX - dragStart.current.x;
      const dBars = Math.round(-(dx / w) * totalBars);
      const vBars = Math.min(visibleBars, totalBars);
      const newOffset = Math.max(0, Math.min(dragStart.current.offset + dBars, totalBars - vBars));
      if (onViewportChange) onViewportChange({ scrollOffset: newOffset });
    },
    [dragging, totalBars, visibleBars, onViewportChange],
  );

  const handleMouseUp = useCallback(() => setDragging(false), []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  if (!data?.length) return null;

  return (
    <div
      ref={containerRef}
      className="tf-chart-minimap"
      onMouseDown={handleMouseDown}
      style={{
        height: MINIMAP_HEIGHT,
        cursor: dragging ? 'grabbing' : 'pointer',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: MINIMAP_HEIGHT }} />
    </div>
  );
}
