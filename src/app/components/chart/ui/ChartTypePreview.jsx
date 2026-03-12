// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Type Preview Grid
// Visual mini-canvas thumbnails for chart type selection
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useRef, useEffect, useState } from 'react';
import { C, F, CHART_TYPES } from '../../../../constants.js';

// Draw a small preview chart on a mini canvas
function drawMiniChart(canvas, typeId, colors) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const pr = window.devicePixelRatio || 1;

  ctx.clearRect(0, 0, w, h);

  // Generate sample data
  const bars = 12;
  const prices = [];
  let p = 50;
  for (let i = 0; i < bars; i++) {
    const o = p;
    const c = p + (Math.sin(i * 0.8 + typeId.length) * 8);
    const hi = Math.max(o, c) + Math.abs(Math.cos(i)) * 5;
    const lo = Math.min(o, c) - Math.abs(Math.sin(i * 1.3)) * 5;
    prices.push({ o, h: hi, l: lo, c });
    p = c;
  }

  const allValues = prices.flatMap(b => [b.h, b.l]);
  const yMin = Math.min(...allValues) - 2;
  const yMax = Math.max(...allValues) + 2;
  const yRange = yMax - yMin;
  const barW = (w - 8) / bars;
  const py = (v) => 4 + ((yMax - v) / yRange) * (h - 8);

  const bullColor = colors?.[0] || '#26A69A';
  const bearColor = colors?.[1] || '#EF5350';

  switch (typeId) {
    case 'line':
      ctx.beginPath();
      ctx.strokeStyle = bullColor;
      ctx.lineWidth = 1.5 * pr;
      prices.forEach((b, i) => {
        const x = 4 + i * barW + barW / 2;
        i === 0 ? ctx.moveTo(x, py(b.c)) : ctx.lineTo(x, py(b.c));
      });
      ctx.stroke();
      break;

    case 'area':
      ctx.beginPath();
      prices.forEach((b, i) => {
        const x = 4 + i * barW + barW / 2;
        i === 0 ? ctx.moveTo(x, py(b.c)) : ctx.lineTo(x, py(b.c));
      });
      ctx.strokeStyle = bullColor;
      ctx.lineWidth = 1.2 * pr;
      ctx.stroke();
      ctx.lineTo(4 + (bars - 1) * barW + barW / 2, h);
      ctx.lineTo(4 + barW / 2, h);
      ctx.closePath();
      ctx.fillStyle = bullColor + '20';
      ctx.fill();
      break;

    case 'baseline': {
      const mid = (yMax + yMin) / 2;
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, py(mid));
      ctx.lineTo(w, py(mid));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      prices.forEach((b, i) => {
        const x = 4 + i * barW + barW / 2;
        i === 0 ? ctx.moveTo(x, py(b.c)) : ctx.lineTo(x, py(b.c));
      });
      ctx.strokeStyle = bullColor;
      ctx.lineWidth = 1.2 * pr;
      ctx.stroke();
      break;
    }

    default: // candles, hollow, ohlc, heikin-ashi etc.
      prices.forEach((b, i) => {
        const x = 4 + i * barW + barW / 2;
        const isUp = b.c >= b.o;
        ctx.fillStyle = isUp ? bullColor : bearColor;
        // Wick
        ctx.fillRect(x - 0.5, py(b.h), 1, py(b.l) - py(b.h));
        // Body
        const bodyTop = py(Math.max(b.o, b.c));
        const bodyH = Math.max(1, py(Math.min(b.o, b.c)) - bodyTop);
        const bw = Math.max(2, barW * 0.6);
        if (typeId === 'hollow' && isUp) {
          ctx.strokeStyle = bullColor;
          ctx.lineWidth = 0.8;
          ctx.strokeRect(x - bw / 2, bodyTop, bw, bodyH);
        } else {
          ctx.fillRect(x - bw / 2, bodyTop, bw, bodyH);
        }
      });
      break;
  }
}

function MiniPreview({ type, isActive, isHovered, onClick, onHover, onLeave, colors }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pr = window.devicePixelRatio || 1;
    canvas.width = 80 * pr;
    canvas.height = 48 * pr;
    canvas.style.width = '80px';
    canvas.style.height = '48px';
    const ctx = canvas.getContext('2d');
    ctx.scale(pr, pr);
    drawMiniChart(canvas, type.engineId || type.id, colors);
  }, [type, colors]);

  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        padding: '8px 6px 6px',
        borderRadius: 10,
        border: isActive
          ? `1.5px solid ${C.b}`
          : isHovered
            ? '1.5px solid rgba(255,255,255,0.15)'
            : '1.5px solid rgba(255,255,255,0.06)',
        background: isActive
          ? C.b + '14'
          : isHovered
            ? 'rgba(255,255,255,0.05)'
            : 'rgba(255,255,255,0.02)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        minWidth: 0,
      }}
    >
      <canvas ref={canvasRef} style={{ borderRadius: 4 }} />
      <span style={{
        fontSize: 10, fontWeight: isActive ? 600 : 500, fontFamily: F,
        color: isActive ? C.b : isHovered ? C.t1 : C.t3,
        letterSpacing: '0.2px',
        whiteSpace: 'nowrap',
        transition: 'color 0.15s ease',
      }}>{type.label}</span>
    </button>
  );
}

function ChartTypePreview({ currentType, onSelect }) {
  const appearance = { upColor: '#26A69A', downColor: '#EF5350' };
  const [hoveredId, setHoveredId] = useState(null);

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 'calc(100% + 4px)',
        left: 0,
        zIndex: 100,
        background: 'rgba(14, 16, 22, 0.95)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 14,
        padding: 10,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        animation: 'tfDropdownIn 0.15s ease',
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 6,
        minWidth: 480,
      }}
    >
      {CHART_TYPES.map((ct) => (
        <MiniPreview
          key={ct.id}
          type={ct}
          isActive={(ct.engineId || ct.id) === currentType}
          isHovered={hoveredId === ct.id}
          onClick={() => onSelect(ct.engineId || ct.id)}
          onHover={() => setHoveredId(ct.id)}
          onLeave={() => setHoveredId(null)}
          colors={[appearance.upColor, appearance.downColor]}
        />
      ))}
    </div>
  );
}

export default React.memo(ChartTypePreview);
