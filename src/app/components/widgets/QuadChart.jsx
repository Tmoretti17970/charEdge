// ═══════════════════════════════════════════════════════════════════
// charEdge — Multi-Chart View (Upgraded)
// Uses full ChartEngineWidget per pane for indicators, drawings, etc.
// Supports 1×1, 2×1, 1×2, 2×2 layouts with crosshair sync.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, memo, Suspense, useCallback } from 'react';
import { C, F, M, TFS } from '../../../constants.js';
import { fetchOHLC } from '../../../data/FetchService.ts';
import ChartEngineWidget from '../../components/chart/core/ChartEngineWidget.jsx';

const DEFAULT_QUADS = [
  { symbol: 'BTC', tf: '1h' },
  { symbol: 'ETH', tf: '1h' },
  { symbol: 'SOL', tf: '1h' },
  { symbol: 'DOGE', tf: '1h' },
];

// Grid config per layout mode
const LAYOUT_CONFIG = {
  '1x1': { cols: '1fr', rows: '1fr', count: 1 },
  '2x1': { cols: '1fr 1fr', rows: '1fr', count: 2 },
  '1x2': { cols: '1fr', rows: '1fr 1fr', count: 2 },
  '2x2': { cols: '1fr 1fr', rows: '1fr 1fr', count: 4 },
};

const QuadChart = memo(function QuadChart({ initialQuads = DEFAULT_QUADS, layoutMode = '2x2' }) {
  const [quads, setQuads] = useState(initialQuads);
  const config = LAYOUT_CONFIG[layoutMode] || LAYOUT_CONFIG['2x2'];

  const updateQuad = useCallback((idx, updates) => {
    setQuads((q) => q.map((quad, i) => (i === idx ? { ...quad, ...updates } : quad)));
  }, []);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: config.cols,
        gridTemplateRows: config.rows,
        gap: 1,
        background: C.bd,
        width: '100%',
        height: '100%',
      }}
    >
      {quads.slice(0, config.count).map((quad, i) => (
        <MultiChartPane
          key={`${i}-${quad.symbol}`}
          paneId={i}
          symbol={quad.symbol}
          tf={quad.tf}
          onSymbolChange={(s) => updateQuad(i, { symbol: s })}
          onTfChange={(t) => updateQuad(i, { tf: t })}
        />
      ))}
    </div>
  );
});

// ─── Full-Engine Chart Pane ─────────────────────────────────────

const MultiChartPane = memo(function MultiChartPane({ paneId, symbol, tf, onSymbolChange, onTfChange }) {
  const [editing, setEditing] = useState(false);
  const [symInput, setSymInput] = useState(symbol);
  const [lastPrice, setLastPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(0);
  const engineRef = useRef(null);

  // Track data for price display
  const handleCrosshairMove = useCallback((e) => {
    if (e?.close) {
      setLastPrice(e.close);
    }
  }, []);

  // Update price when engine reports data
  const handleEngineReady = useCallback((eng) => {
    engineRef.current = eng;
    // Read last bar price
    if (eng?.bars?.length) {
      const last = eng.bars[eng.bars.length - 1];
      const prev = eng.bars.length > 1 ? eng.bars[eng.bars.length - 2] : null;
      setLastPrice(last.close);
      setPriceChange(prev ? ((last.close - prev.close) / prev.close * 100) : 0);
    }
  }, []);

  const handleSymSubmit = (e) => {
    e?.preventDefault();
    const newSym = symInput.trim().toUpperCase();
    if (newSym && newSym !== symbol) {
      onSymbolChange(newSym);
    }
    setEditing(false);
  };

  // Keep symInput in sync when symbol prop changes
  useEffect(() => {
    setSymInput(symbol);
  }, [symbol]);

  return (
    <div style={{
      background: C.bg,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Compact Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '3px 8px', height: 28,
        borderBottom: `1px solid ${C.bd}50`,
        flexShrink: 0,
        background: `${C.sf}60`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {editing ? (
            <form onSubmit={handleSymSubmit} style={{ display: 'flex' }}>
              <input
                value={symInput}
                onChange={(e) => setSymInput(e.target.value.toUpperCase())}
                onBlur={handleSymSubmit}
                autoFocus
                style={{
                  width: 60, padding: '2px 4px',
                  border: `1px solid ${C.b}`, borderRadius: 4,
                  background: C.sf, color: C.t1,
                  fontSize: 11, fontWeight: 800, fontFamily: M,
                  outline: 'none', textAlign: 'center',
                }}
              />
            </form>
          ) : (
            <span
              onClick={() => { setSymInput(symbol); setEditing(true); }}
              style={{
                fontSize: 12, fontWeight: 800, fontFamily: M,
                color: C.t1, cursor: 'pointer',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = C.b}
              onMouseLeave={(e) => e.currentTarget.style.color = C.t1}
            >
              {symbol}
            </span>
          )}
          {lastPrice != null && (
            <span style={{
              fontSize: 10, fontWeight: 700, fontFamily: M,
              color: priceChange >= 0 ? C.g : C.r,
            }}>
              {lastPrice >= 1000 ? lastPrice.toFixed(0) : lastPrice.toFixed(2)}
              <span style={{ fontSize: 8, marginLeft: 3, opacity: 0.7 }}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            </span>
          )}
        </div>

        {/* TF selector */}
        <div style={{ display: 'flex', gap: 1 }}>
          {TFS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTfChange(t.id)}
              style={{
                padding: '1px 5px', borderRadius: 3,
                border: 'none',
                background: tf === t.id ? `${C.b}25` : 'transparent',
                color: tf === t.id ? C.b : C.t3,
                fontSize: 9, fontWeight: 700, fontFamily: M,
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Full Chart Engine */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <ChartEngineWidget
          height="100%"
          width="100%"
          compact={true}
          showVolume={true}
          overrideSymbol={symbol}
          overrideTf={tf}
          onCrosshairMove={handleCrosshairMove}
          onEngineReady={handleEngineReady}
        />
      </div>
    </div>
  );
});

export default QuadChart;
export { QuadChart };
