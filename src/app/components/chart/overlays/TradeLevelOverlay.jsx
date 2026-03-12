// ═══════════════════════════════════════════════════════════════════
// TradeLevelOverlay — Renders dotted horizontal lines for pending
// trade levels (entry, stop-loss, take-profit) on the chart.
// Reads directly from useChartStore and positions via the engine's
// lastRender coordinate system.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback } from 'react';
import { useChartFeaturesStore } from '../../../../state/chart/useChartFeaturesStore';
import { useChartTradeStore } from '../../../../state/chart/useChartTradeStore';

const LEVEL_STYLES = {
  entry: { color: '#2196F3', label: 'Entry', dash: '6 4' },
  sl:    { color: '#EF5350', label: 'SL',    dash: '4 4' },
  tp:    { color: '#26A69A', label: 'TP',    dash: '4 4' },
};

function extractPrice(val) {
  if (val == null) return null;
  if (typeof val === 'object') return val.price;
  return typeof val === 'number' ? val : null;
}

function TradeLevelOverlay({ engineRef }) {
  const tradeMode = useChartFeaturesStore((s) => s.tradeMode);
  const pendingEntry = useChartTradeStore((s) => s.pendingEntry);
  const pendingSL = useChartTradeStore((s) => s.pendingStopLoss);
  const pendingTP = useChartTradeStore((s) => s.pendingTakeProfit);
  const tradeStep = useChartFeaturesStore((s) => s.tradeStep);
  const tradeSide = useChartFeaturesStore((s) => s.tradeSide);

  const [lines, setLines] = useState([]);

  const updatePositions = useCallback(() => {
    const eng = engineRef?.current;
    if (!eng || !tradeMode) {
      setLines([]);
      return;
    }

    const R = eng.state?.lastRender;
    if (!R || !R.mainH || !R.p2y) return;

    // Use the canonical priceToY from the render pipeline — guarantees
    // SL/TP lines stay pixel-aligned with the chart under all transforms
    // (pan, zoom, log scale, percent scale). The previous custom formula
    // double-applied priceScroll since yMin/yMax already include it.
    const p2y = R.p2y;

    const newLines = [];

    const levels = [
      { type: 'entry', price: extractPrice(pendingEntry) },
      { type: 'sl', price: extractPrice(pendingSL) },
      { type: 'tp', price: extractPrice(pendingTP) },
    ];

    for (const { type, price } of levels) {
      if (price == null || isNaN(price)) continue;
      const y = p2y(price);
      if (y < -20 || y > R.mainH + 20) continue; // Off-screen
      const style = LEVEL_STYLES[type];
      newLines.push({ type, price, y, ...style });
    }

    setLines(newLines);
  }, [engineRef, tradeMode, pendingEntry, pendingSL, pendingTP]);

  // Poll engine coordinates every animation frame when in trade mode
  useEffect(() => {
    if (!tradeMode) {
      setLines([]);
      return;
    }
    let running = true;
    const tick = () => {
      if (!running) return;
      updatePositions();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { running = false; };
  }, [tradeMode, updatePositions]);

  if (!tradeMode || lines.length === 0) return null;

  // Determine which step hint to show
  const stepHints = {
    entry: 'Click chart to set entry',
    sl: 'Click to set stop loss',
    tp: 'Click to set take profit',
    ready: 'Trade ready — review & confirm',
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: lines[0] ? undefined : 0,
        pointerEvents: 'none',
        zIndex: 12,
      }}
    >
      {lines.map(({ type, price, y, color, label, dash }) => (
        <div
          key={type}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: y,
            height: 0,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {/* Dashed line */}
          <svg
            style={{ position: 'absolute', left: 0, right: 72, top: -0.5, width: 'calc(100% - 72px)', height: 1, overflow: 'visible' }}
            preserveAspectRatio="none"
          >
            <line
              x1="0" y1="0" x2="100%" y2="0"
              stroke={color}
              strokeWidth="1.5"
              strokeDasharray={dash}
              opacity="0.85"
            />
          </svg>

          {/* Price badge on right edge */}
          <div
            style={{
              position: 'absolute',
              right: 0,
              transform: 'translateY(-50%)',
              background: color,
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'Inter, monospace',
              padding: '2px 6px',
              borderRadius: 3,
              whiteSpace: 'nowrap',
              letterSpacing: '0.3px',
              boxShadow: `0 1px 4px ${color}44`,
              width: 72,
              textAlign: 'center',
            }}
          >
            {label} {price.toFixed(2)}
          </div>
        </div>
      ))}

      {/* Step indicator hint */}
      {tradeStep && tradeStep !== 'idle' && tradeStep !== 'ready' && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            background: tradeSide === 'long'
              ? 'rgba(38, 166, 154, 0.85)'
              : 'rgba(239, 83, 80, 0.85)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'Inter, Arial, sans-serif',
            padding: '4px 14px',
            borderRadius: 12,
            backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            zIndex: 20,
          }}
        >
          {stepHints[tradeStep] || ''}
        </div>
      )}
    </div>
  );
}

export default React.memo(TradeLevelOverlay);
