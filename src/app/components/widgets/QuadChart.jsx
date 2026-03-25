// ═══════════════════════════════════════════════════════════════════
// charEdge — Multi-Chart View (Sprint 6 Enhanced)
// Uses full ChartEngineWidget per pane for indicators, drawings, etc.
// Supports 1×1, 2×1, 1×2, 2×2 layouts with crosshair sync.
//
// Sprint 6 Task 6.1:
//   - Crosshair sync across all visible charts
//   - Layout config exposed for workspace persistence
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { C, M, TFS } from '../../../constants.js';
import ChartEngineWidget from '../../components/chart/core/ChartEngineWidget.jsx';

const DEFAULT_QUADS = [
  { symbol: 'BTC', tf: '1h' },
  { symbol: 'ETH', tf: '1h' },
  { symbol: 'SOL', tf: '1h' },
  { symbol: 'DOGE', tf: '1h' },
  { symbol: 'SPY', tf: '1h' },
  { symbol: 'NQ', tf: '1h' },
  { symbol: 'AAPL', tf: '1h' },
  { symbol: 'ES', tf: '1h' },
];

// Grid config per layout mode
const LAYOUT_CONFIG = {
  '1x1': { cols: '1fr', rows: '1fr', count: 1, label: '1' },
  '2x1': { cols: '1fr 1fr', rows: '1fr', count: 2, label: '2H' },
  '1x2': { cols: '1fr', rows: '1fr 1fr', count: 2, label: '2V' },
  '3x1': { cols: '1fr 1fr 1fr', rows: '1fr', count: 3, label: '3' },
  '1x3': { cols: '1fr', rows: '1fr 1fr 1fr', count: 3, label: '3V' },
  '2x2': { cols: '1fr 1fr', rows: '1fr 1fr', count: 4, label: '4' },
  '2x3': { cols: '1fr 1fr', rows: '1fr 1fr 1fr', count: 6, label: '6' },
  '4x2': { cols: '1fr 1fr 1fr 1fr', rows: '1fr 1fr', count: 8, label: '8' },
  '3x3': { cols: '1fr 1fr 1fr', rows: '1fr 1fr 1fr', count: 9, label: '9' },
};

const QuadChart = memo(function QuadChart({ initialQuads = DEFAULT_QUADS, layoutMode = '2x2', onConfigChange }) {
  const [quads, setQuads] = useState(initialQuads);
  const config = LAYOUT_CONFIG[layoutMode] || LAYOUT_CONFIG['2x2'];

  // Sprint 6 Task 6.1.2: Shared crosshair timestamp for sync across charts
  const [crosshairTime, setCrosshairTime] = useState(null);
  const [crosshairSourcePane, setCrosshairSourcePane] = useState(-1);

  const updateQuad = useCallback(
    (idx, updates) => {
      setQuads((q) => {
        const next = q.map((quad, i) => (i === idx ? { ...quad, ...updates } : quad));
        // Sprint 6 Task 6.1.5: Notify parent for workspace persistence
        onConfigChange?.({ layout: layoutMode, panels: next });
        return next;
      });
    },
    [layoutMode, onConfigChange],
  );

  // Sprint 6 Task 6.1.2: Crosshair move handler — lifted to parent
  const handleCrosshairSync = useCallback((paneIdx, time) => {
    setCrosshairTime(time);
    setCrosshairSourcePane(paneIdx);
  }, []);

  const handleCrosshairLeave = useCallback(() => {
    setCrosshairTime(null);
    setCrosshairSourcePane(-1);
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
          crosshairTime={crosshairSourcePane !== i ? crosshairTime : null}
          onCrosshairSync={(time) => handleCrosshairSync(i, time)}
          onCrosshairLeave={handleCrosshairLeave}
        />
      ))}
    </div>
  );
});

// ─── Full-Engine Chart Pane ─────────────────────────────────────

const MultiChartPane = memo(function MultiChartPane({
  _paneId,
  symbol,
  tf,
  onSymbolChange,
  onTfChange,
  crosshairTime,
  onCrosshairSync,
  onCrosshairLeave,
}) {
  const [editing, setEditing] = useState(false);
  const [symInput, setSymInput] = useState(symbol);
  const [lastPrice, setLastPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(0);
  const engineRef = useRef(null);

  // Sprint 6 Task 6.1.2: Forward crosshair events to parent for sync
  const handleCrosshairMove = useCallback(
    (e) => {
      if (e?.close) {
        setLastPrice(e.close);
      }
      if (e?.time && onCrosshairSync) {
        onCrosshairSync(e.time);
      }
    },
    [onCrosshairSync],
  );

  // Update price when engine reports data
  const handleEngineReady = useCallback((eng) => {
    engineRef.current = eng;
    // Read last bar price
    if (eng?.bars?.length) {
      const last = eng.bars[eng.bars.length - 1];
      const prev = eng.bars.length > 1 ? eng.bars[eng.bars.length - 2] : null;
      setLastPrice(last.close);
      setPriceChange(prev ? ((last.close - prev.close) / prev.close) * 100 : 0);
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
    <div
      style={{
        background: C.bg,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
      onMouseLeave={onCrosshairLeave}
    >
      {/* Compact Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '3px 8px',
          height: 28,
          borderBottom: `1px solid ${C.bd}50`,
          flexShrink: 0,
          background: `${C.sf}60`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {editing ? (
            <form onSubmit={handleSymSubmit} style={{ display: 'flex' }}>
              <input
                value={symInput}
                onChange={(e) => setSymInput(e.target.value.toUpperCase())}
                onBlur={handleSymSubmit}
                autoFocus
                style={{
                  width: 60,
                  padding: '2px 4px',
                  border: `1px solid ${C.b}`,
                  borderRadius: 4,
                  background: C.sf,
                  color: C.t1,
                  fontSize: 11,
                  fontWeight: 800,
                  fontFamily: M,
                  outline: 'none',
                  textAlign: 'center',
                }}
              />
            </form>
          ) : (
            <span
              onClick={() => {
                setSymInput(symbol);
                setEditing(true);
              }}
              style={{
                fontSize: 12,
                fontWeight: 800,
                fontFamily: M,
                color: C.t1,
                cursor: 'pointer',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.b)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.t1)}
            >
              {symbol}
            </span>
          )}
          {lastPrice != null && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                fontFamily: M,
                color: priceChange >= 0 ? C.g : C.r,
              }}
            >
              {lastPrice >= 1000 ? lastPrice.toFixed(0) : lastPrice.toFixed(2)}
              <span style={{ fontSize: 8, marginLeft: 3, opacity: 0.7 }}>
                {priceChange >= 0 ? '+' : ''}
                {priceChange.toFixed(2)}%
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
                padding: '1px 5px',
                borderRadius: 3,
                border: 'none',
                background: tf === t.id ? `${C.b}25` : 'transparent',
                color: tf === t.id ? C.b : C.t3,
                fontSize: 9,
                fontWeight: 700,
                fontFamily: M,
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
          crosshairSyncTime={crosshairTime}
        />

        {/* Sprint 6 Task 6.1.2: Synced crosshair line from other panes */}
        {crosshairTime != null && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 1,
              background: `${C.t3}60`,
              pointerEvents: 'none',
              zIndex: 10,
              // The crosshair position is approximate — engine calculates x from timestamp
              // This overlay is a visual indicator; the engine's own crosshairSyncTime
              // prop handles precise positioning
            }}
          />
        )}
      </div>
    </div>
  );
});

export default QuadChart;
export { QuadChart, LAYOUT_CONFIG };
