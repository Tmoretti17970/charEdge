// ═══════════════════════════════════════════════════════════════════
// TradeLevelOverlay — Renders dotted horizontal lines for trade
// levels (entry, stop-loss, take-profit) on the chart.
//
// DUAL MODE:
//   1. "Entry Mode" — during trade entry workflow (pendingEntry/SL/TP)
//   2. "Position Mode" — for open paper trade positions (draggable)
//
// Uses direct DOM mutation in the RAF loop for zero-React-overhead
// position updates (no setState during pan/zoom).
//
// Drag interaction:
//   - ±8px hit zone around each line
//   - Cursor changes to ns-resize on hover
//   - While dragging: shows live price + P&L preview
//   - On drop: commits new level via paper trade store
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useChartFeaturesStore } from '../../../../state/chart/useChartFeaturesStore';
import { useChartTradeStore } from '../../../../state/chart/useChartTradeStore';
import { usePaperTradeStore } from '../../../../state/usePaperTradeStore';

const LEVEL_STYLES = {
  entry: { color: '#2196F3', label: 'Entry', dash: '6 4' },
  sl:    { color: '#EF5350', label: 'SL',    dash: '4 4' },
  tp:    { color: '#26A69A', label: 'TP',    dash: '4 4' },
};

const DRAG_HIT_ZONE = 8; // px above/below line for drag detection

function extractPrice(val) {
  if (val == null) return null;
  if (typeof val === 'object') return val.price;
  return typeof val === 'number' ? val : null;
}

function formatPrice(price) {
  if (price == null || isNaN(price)) return '—';
  if (price >= 1000) return price.toFixed(2);
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

function TradeLevelOverlay({ engineRef }) {
  const tradeMode = useChartFeaturesStore((s) => s.tradeMode);
  const pendingEntry = useChartTradeStore((s) => s.pendingEntry);
  const pendingSL = useChartTradeStore((s) => s.pendingStopLoss);
  const pendingTP = useChartTradeStore((s) => s.pendingTakeProfit);
  const tradeStep = useChartFeaturesStore((s) => s.tradeStep);
  const tradeSide = useChartFeaturesStore((s) => s.tradeSide);

  // Open positions from paper trade store
  const positions = usePaperTradeStore((s) => s.positions);

  const containerRef = useRef(null);
  const entryRef = useRef(null);
  const slRef = useRef(null);
  const tpRef = useRef(null);
  const posLinesRef = useRef(new Map()); // positionId_type → DOM element
  const rafRef = useRef(null);
  const dragRef = useRef(null); // { positionId, type, startY, startPrice, el }

  // Gather active position levels
  const positionLevels = useMemo(() => {
    const levels = [];
    for (const pos of positions) {
      levels.push({
        posId: pos.id,
        type: 'entry',
        price: pos.entryPrice,
        side: pos.side,
        symbol: pos.symbol,
      });
      if (pos.stopLoss != null) {
        levels.push({
          posId: pos.id,
          type: 'sl',
          price: pos.stopLoss,
          side: pos.side,
          symbol: pos.symbol,
          entryPrice: pos.entryPrice,
          quantity: pos.quantity,
        });
      }
      if (pos.takeProfit != null) {
        levels.push({
          posId: pos.id,
          type: 'tp',
          price: pos.takeProfit,
          side: pos.side,
          symbol: pos.symbol,
          entryPrice: pos.entryPrice,
          quantity: pos.quantity,
        });
      }
    }
    return levels;
  }, [positions]);

  // RAF loop: directly mutate DOM, no React state
  const tick = useCallback(() => {
    const eng = engineRef?.current;
    const R = eng?.state?.lastRender;

    // --- Entry mode levels ---
    const entryLevels = [
      { ref: entryRef, price: extractPrice(pendingEntry) },
      { ref: slRef, price: extractPrice(pendingSL) },
      { ref: tpRef, price: extractPrice(pendingTP) },
    ];

    if (!R || !R.mainH || !R.p2y) {
      for (const { ref } of entryLevels) {
        if (ref.current) ref.current.style.display = 'none';
      }
      for (const el of posLinesRef.current.values()) {
        if (el) el.style.display = 'none';
      }
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const p2y = R.p2y;

    // Update entry mode lines
    if (tradeMode) {
      for (const { ref, price } of entryLevels) {
        const el = ref.current;
        if (!el) continue;
        if (price == null || isNaN(price)) {
          el.style.display = 'none';
          continue;
        }
        const y = p2y(price);
        if (y < -20 || y > R.mainH + 20) {
          el.style.display = 'none';
          continue;
        }
        el.style.display = 'flex';
        el.style.top = y + 'px';
        const priceEl = el.querySelector('[data-price]');
        if (priceEl) priceEl.textContent = el.dataset.label + ' ' + formatPrice(price);
      }
    } else {
      for (const { ref } of entryLevels) {
        if (ref.current) ref.current.style.display = 'none';
      }
    }

    // Update position-level lines
    for (const level of positionLevels) {
      const key = `${level.posId}_${level.type}`;
      const el = posLinesRef.current.get(key);
      if (!el) continue;

      // If this specific line is being dragged, use the drag price instead
      const drag = dragRef.current;
      let price = level.price;
      if (drag && drag.positionId === level.posId && drag.type === level.type) {
        price = drag.currentPrice ?? price;
      }

      if (price == null || isNaN(price)) {
        el.style.display = 'none';
        continue;
      }

      const y = p2y(price);
      if (y < -20 || y > R.mainH + 20) {
        el.style.display = 'none';
        continue;
      }

      el.style.display = 'flex';
      el.style.top = y + 'px';

      // Update price text
      const priceEl = el.querySelector('[data-price]');
      if (priceEl) {
        const style = LEVEL_STYLES[level.type] || LEVEL_STYLES.entry;
        let label = style.label + ' ' + formatPrice(price);

        // Show P&L preview for SL/TP while dragging
        if (drag && drag.positionId === level.posId && drag.type === level.type && level.entryPrice) {
          const isLong = level.side === 'long';
          const pnl = isLong
            ? (price - level.entryPrice) * (level.quantity || 1)
            : (level.entryPrice - price) * (level.quantity || 1);
          const sign = pnl >= 0 ? '+' : '';
          label += ` (${sign}$${pnl.toFixed(2)})`;
        }

        priceEl.textContent = label;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [engineRef, pendingEntry, pendingSL, pendingTP, tradeMode, positionLevels]);

  useEffect(() => {
    const hasContent = tradeMode || positionLevels.length > 0;
    if (!hasContent) return;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [tradeMode, tick, positionLevels]);

  // --- Drag handlers ---
  const handlePointerDown = useCallback((e, posId, type, price) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      positionId: posId,
      type,
      startY: e.clientY,
      startPrice: price,
      currentPrice: price,
    };
    useChartTradeStore.getState().setActiveLevelDrag({ type, positionId: posId, startPrice: price });

    const handleMove = (ev) => {
      if (!dragRef.current) return;
      const eng = engineRef?.current;
      const R = eng?.state?.lastRender;
      if (!R || !R.y2p) return;

      const dy = ev.clientY - dragRef.current.startY;
      const newY = R.p2y(dragRef.current.startPrice) + dy;
      dragRef.current.currentPrice = R.y2p(newY);
    };

    const handleUp = () => {
      if (dragRef.current) {
        const newPrice = dragRef.current.currentPrice;
        const drag = dragRef.current;
        dragRef.current = null;

        // Commit the drag to the paper trade store
        const levels = {};
        if (drag.type === 'sl') levels.stopLoss = newPrice;
        if (drag.type === 'tp') levels.takeProfit = newPrice;
        usePaperTradeStore.getState().updatePositionLevels(drag.positionId, levels);

        // Sync linked alerts with new price
        import('../../../../state/useAlertStore').then(({ updatePositionAlerts }) => {
          updatePositionAlerts(drag.positionId, levels);
        }).catch(() => {}); // non-fatal

        useChartTradeStore.getState().setActiveLevelDrag(null);
      }
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [engineRef]);

  const hasEntryMode = tradeMode;
  const hasPositions = positionLevels.length > 0;

  if (!hasEntryMode && !hasPositions) return null;

  const entryLevelEntries = [
    { type: 'entry', ref: entryRef },
    { type: 'sl', ref: slRef },
    { type: 'tp', ref: tpRef },
  ];

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        pointerEvents: 'none',
        zIndex: 12,
        height: '100%',
      }}
    >
      {/* === Entry Mode Lines (during trade setup) === */}
      {entryLevelEntries.map(({ type, ref }) => {
        const style = LEVEL_STYLES[type];
        return (
          <div
            key={`entry_${type}`}
            ref={ref}
            data-label={style.label}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: -9999,
              height: 0,
              display: 'none',
              alignItems: 'center',
              willChange: 'top',
            }}
          >
            {/* Dashed line */}
            <svg
              style={{ position: 'absolute', left: 0, right: 72, top: -0.5, width: 'calc(100% - 72px)', height: 1, overflow: 'visible' }}
              preserveAspectRatio="none"
            >
              <line
                x1="0" y1="0" x2="100%" y2="0"
                stroke={style.color}
                strokeWidth="1.5"
                strokeDasharray={style.dash}
                opacity="0.85"
              />
            </svg>

            {/* Price badge on right edge */}
            <div
              style={{
                position: 'absolute',
                right: 0,
                transform: 'translateY(-50%)',
                background: style.color,
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                fontFamily: 'Inter, monospace',
                padding: '2px 6px',
                borderRadius: 3,
                whiteSpace: 'nowrap',
                letterSpacing: '0.3px',
                boxShadow: `0 1px 4px ${style.color}44`,
                width: 72,
                textAlign: 'center',
              }}
            >
              <span data-price="1">{style.label}</span>
            </div>
          </div>
        );
      })}

      {/* === Position-Level Lines (for open positions — draggable) === */}
      {positionLevels.map((level) => {
        const key = `${level.posId}_${level.type}`;
        const style = LEVEL_STYLES[level.type] || LEVEL_STYLES.entry;
        const isDraggable = level.type === 'sl' || level.type === 'tp';

        return (
          <div
            key={key}
            ref={(el) => {
              if (el) posLinesRef.current.set(key, el);
              else posLinesRef.current.delete(key);
            }}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: -9999,
              height: 0,
              display: 'none',
              alignItems: 'center',
              willChange: 'top',
            }}
          >
            {/* Dashed line */}
            <svg
              style={{ position: 'absolute', left: 0, right: 82, top: -0.5, width: 'calc(100% - 82px)', height: 1, overflow: 'visible' }}
              preserveAspectRatio="none"
            >
              <line
                x1="0" y1="0" x2="100%" y2="0"
                stroke={style.color}
                strokeWidth={level.type === 'entry' ? '1' : '1.5'}
                strokeDasharray={style.dash}
                opacity={level.type === 'entry' ? '0.5' : '0.85'}
              />
            </svg>

            {/* Drag handle zone — wider click area for dragging */}
            {isDraggable && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 82,
                  top: -DRAG_HIT_ZONE,
                  height: DRAG_HIT_ZONE * 2,
                  cursor: 'ns-resize',
                  pointerEvents: 'auto',
                  zIndex: 5,
                }}
                onPointerDown={(e) => handlePointerDown(e, level.posId, level.type, level.price)}
              />
            )}

            {/* Price tag on right edge */}
            <div
              style={{
                position: 'absolute',
                right: 0,
                transform: 'translateY(-50%)',
                background: style.color,
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                fontFamily: 'Inter, monospace',
                padding: '3px 8px',
                borderRadius: 4,
                whiteSpace: 'nowrap',
                letterSpacing: '0.3px',
                boxShadow: `0 2px 8px ${style.color}55`,
                minWidth: 80,
                textAlign: 'center',
                pointerEvents: isDraggable ? 'auto' : 'none',
                cursor: isDraggable ? 'ns-resize' : 'default',
                transition: 'box-shadow 0.15s',
              }}
              onPointerDown={isDraggable ? (e) => handlePointerDown(e, level.posId, level.type, level.price) : undefined}
            >
              <span data-price="1">{style.label} {formatPrice(level.price)}</span>
            </div>

            {/* Drag grip icon for SL/TP */}
            {isDraggable && (
              <div
                style={{
                  position: 'absolute',
                  left: 8,
                  transform: 'translateY(-50%)',
                  color: style.color,
                  fontSize: 8,
                  opacity: 0.6,
                  pointerEvents: 'none',
                  letterSpacing: 1,
                }}
              >
                ⋮⋮
              </div>
            )}
          </div>
        );
      })}

      {/* Step indicator hint (entry mode only) */}
      {tradeMode && tradeStep && tradeStep !== 'idle' && tradeStep !== 'ready' && (
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
          {tradeStep === 'entry' && 'Click chart to set entry'}
          {tradeStep === 'sl' && 'Click to set stop loss'}
          {tradeStep === 'tp' && 'Click to set take profit'}
        </div>
      )}
    </div>
  );
}

export default React.memo(TradeLevelOverlay);
