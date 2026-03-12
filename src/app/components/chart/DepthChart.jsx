// ═══════════════════════════════════════════════════════════════════
// charEdge — DepthChart
// Visual depth chart (cumulative bid/ask walls) — Webull-style.
// Renders stacked area chart of order book depth.
// ═══════════════════════════════════════════════════════════════════

import { useRef, useEffect, useCallback } from 'react';
import { C, F } from '../../../constants.js';
import { useChartCoreStore } from '../../../state/chart/useChartCoreStore';

const BID_COLOR = '#26A69A';
const ASK_COLOR = '#EF5350';
const BID_FILL = 'rgba(38, 166, 154, 0.15)';
const ASK_FILL = 'rgba(239, 83, 80, 0.15)';

// Generate simulated depth data (in production, this would use real order book)
function generateDepthData(currentPrice, levels = 40) {
  const bids = [];
  const asks = [];
  const spread = currentPrice * 0.0001;

  let bidCum = 0;
  let askCum = 0;
  for (let i = 0; i < levels; i++) {
    const bidPrice = currentPrice - spread * (i + 1) * (1 + Math.random() * 0.5);
    const askPrice = currentPrice + spread * (i + 1) * (1 + Math.random() * 0.5);
    bidCum += (Math.random() * 5 + 0.5) * (1 + i * 0.1);
    askCum += (Math.random() * 5 + 0.5) * (1 + i * 0.1);
    bids.push({ price: bidPrice, cumulative: bidCum });
    asks.push({ price: askPrice, cumulative: askCum });
  }
  return { bids, asks };
}

export default function DepthChart({ symbol = '', height = 180, onClose }) {
  const canvasRef = useRef(null);
  const dataRef = useRef(null);

  // Read current price from the store's aggregated price (TickerPlant)
  // Note: s.data no longer exists in the store (Sprint 3: metadata only)
  const currentPrice = useChartCoreStore((s) => s.aggregatedPrice) || 0;

  // Regenerate depth data periodically
  useEffect(() => {
    function update() {
      if (currentPrice > 0) {
        dataRef.current = generateDepthData(currentPrice);
      }
    }
    update();
    const iv = setInterval(update, 2000);
    return () => clearInterval(iv);
  }, [currentPrice]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dataRef.current) return;
    const ctx = canvas.getContext('2d');
    const pr = devicePixelRatio || 1;
    const w = canvas.parentElement.clientWidth;
    const h = height;
    canvas.width = Math.round(w * pr);
    canvas.height = Math.round(h * pr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(pr, pr);

    const { bids, asks } = dataRef.current;
    if (!bids.length || !asks.length) return;

    // Background
    ctx.fillStyle = C.bg || '#131722';
    ctx.fillRect(0, 0, w, h);

    const maxCum = Math.max(bids[bids.length - 1].cumulative, asks[asks.length - 1].cumulative);
    const midX = w / 2;
    const chartH = h - 24;
    const chartTop = 4;

    // Price range
    const minPrice = bids[bids.length - 1].price;
    const maxPrice = asks[asks.length - 1].price;
    const pRange = maxPrice - minPrice;

    const p2x = (price) => ((price - minPrice) / pRange) * w;
    const v2y = (cum) => chartTop + chartH - (cum / maxCum) * chartH;

    // Draw bid area
    ctx.beginPath();
    ctx.moveTo(midX, chartTop + chartH);
    for (let i = 0; i < bids.length; i++) {
      const x = p2x(bids[i].price);
      const y = v2y(bids[i].cumulative);
      if (i === 0) ctx.lineTo(x, chartTop + chartH);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(p2x(bids[bids.length - 1].price), chartTop + chartH);
    ctx.closePath();
    ctx.fillStyle = BID_FILL;
    ctx.fill();
    ctx.strokeStyle = BID_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < bids.length; i++) {
      const x = p2x(bids[i].price);
      const y = v2y(bids[i].cumulative);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw ask area
    ctx.beginPath();
    ctx.moveTo(midX, chartTop + chartH);
    for (let i = 0; i < asks.length; i++) {
      const x = p2x(asks[i].price);
      const y = v2y(asks[i].cumulative);
      if (i === 0) ctx.lineTo(x, chartTop + chartH);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(p2x(asks[asks.length - 1].price), chartTop + chartH);
    ctx.closePath();
    ctx.fillStyle = ASK_FILL;
    ctx.fill();
    ctx.strokeStyle = ASK_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < asks.length; i++) {
      const x = p2x(asks[i].price);
      const y = v2y(asks[i].cumulative);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Center price line
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(midX, 0);
    ctx.lineTo(midX, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // Price label
    ctx.font = `bold 11px ${F}`;
    ctx.fillStyle = '#D1D4DC';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 }), midX, h - 2);

    // Bid/Ask labels
    ctx.font = `10px ${F}`;
    ctx.fillStyle = BID_COLOR;
    ctx.textAlign = 'left';
    ctx.fillText('BIDS', 8, 14);
    ctx.fillStyle = ASK_COLOR;
    ctx.textAlign = 'right';
    ctx.fillText('ASKS', w - 8, 14);
  }, [currentPrice, height]);

  useEffect(() => {
    draw();
    const iv = setInterval(draw, 2000);
    const ro = new ResizeObserver(draw);
    if (canvasRef.current?.parentElement) ro.observe(canvasRef.current.parentElement);
    return () => { clearInterval(iv); ro.disconnect(); };
  }, [draw]);

  return (
    <div style={{
      borderTop: `1px solid ${C.bd}`,
      background: C.bg,
      flexShrink: 0,
      position: 'relative',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 10px',
        borderBottom: `1px solid ${C.bd}`,
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: F, letterSpacing: '0.5px' }}>
          DEPTH CHART — {symbol}
        </span>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', fontSize: 14 }}>×</button>
        )}
      </div>
      <div style={{ position: 'relative', width: '100%', height }}>
        <canvas ref={canvasRef} style={{ display: 'block' }} />
      </div>
    </div>
  );
}
