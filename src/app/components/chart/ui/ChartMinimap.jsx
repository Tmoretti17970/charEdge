// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Minimap Navigator (Apple × TradingView Polish)
// Compressed overview strip for quick data navigation.
// ═══════════════════════════════════════════════════════════════════

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { C } from '../../../../constants.js';

const MINIMAP_HEIGHT = 36;

export default function ChartMinimap({ data, visibleBars = 80, scrollOffset = 0, onViewportChange }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, offset: 0 });

  const totalBars = data?.length || 0;

  // Render the minimap canvas
  const render = useCallback(() => {
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
    grad.addColorStop(0, C.b + '20');
    grad.addColorStop(1, C.b + '02');
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
    ctx.strokeStyle = C.b + '55';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Viewport rectangle
    const vBars = Math.min(visibleBars, totalBars);
    const vpRight = w - (scrollOffset / totalBars) * w;
    const vpWidth = Math.max(12, (vBars / totalBars) * w);
    const vpLeft = Math.max(0, vpRight - vpWidth);

    // Dim outside
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    const dimRadius = 4;
    if (vpLeft > 0) {
      ctx.beginPath();
      ctx.roundRect(0, 0, vpLeft, h, [dimRadius, 0, 0, dimRadius]);
      ctx.fill();
    }
    if (vpRight < w) {
      ctx.beginPath();
      ctx.roundRect(vpRight, 0, w - vpRight, h, [0, dimRadius, dimRadius, 0]);
      ctx.fill();
    }

    // Viewport border — rounded
    ctx.strokeStyle = C.b + '90';
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
  }, [data, visibleBars, scrollOffset, totalBars]);

  useEffect(() => {
    render();
    window.addEventListener('resize', render);
    return () => window.removeEventListener('resize', render);
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
