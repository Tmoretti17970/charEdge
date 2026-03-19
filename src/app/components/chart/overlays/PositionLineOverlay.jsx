// ═══════════════════════════════════════════════════════════════════
// charEdge — Position Line Overlay (GPU-smooth)
//
// Renders horizontal dotted entry lines + price-axis tabs for open
// positions. Uses direct DOM mutation in the RAF loop for zero-React-
// overhead position updates (no setState during pan/zoom).
//
// Re-renders through React only when positions are added/removed.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { F } from '@/constants.js';
import { useOpenPositions } from '../../../../hooks/useOpenPositions.js';
import { useChartCoreStore } from '../../../../state/chart/useChartCoreStore';

function PositionLineOverlay({ symbol, engineRef }) {
  const openPositions = useOpenPositions(symbol);
  const containerRef = useRef(null);
  // Store refs to each line's root div keyed by position id
  const lineRefsMap = useRef(new Map());

  // Memoize position IDs so React only re-renders when positions change
  const positionIds = useMemo(
    () => openPositions.map((p) => p.id).join(','),
    [openPositions],
  );

  // RAF loop: mutate DOM directly — no React state updates
  const rafRef = useRef(null);
  const stableFrames = useRef(0);

  const tick = useCallback(() => {
    const eng = engineRef?.current;
    const R = eng?.state?.lastRender;
    if (!R || !R.mainH || !R.p2y) {
      stableFrames.current = 0;
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    // Wait for price axis to stabilize before showing lines (prevents ghost lines during init)
    if (stableFrames.current < 10) {
      stableFrames.current++;
      // Hide all lines while stabilizing
      for (const pos of openPositions) {
        const el = lineRefsMap.current.get(pos.id);
        if (el) el.style.display = 'none';
      }
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const p2y = R.p2y;
    const aggregatedPrice = useChartCoreStore.getState().aggregatedPrice || 0;

    for (const pos of openPositions) {
      const el = lineRefsMap.current.get(pos.id);
      if (!el) continue;

      const entryPrice = pos.entry;
      if (!entryPrice || isNaN(entryPrice)) {
        el.style.display = 'none';
        continue;
      }

      const y = p2y(entryPrice);
      if (y < -30 || y > R.mainH + 30) {
        el.style.display = 'none';
        continue;
      }

      el.style.display = '';
      el.style.top = y + 'px';

      // Update P&L label
      const plEl = el.querySelector('[data-pl]');
      if (plEl && aggregatedPrice > 0) {
        const isLong = pos.side !== 'short';
        const priceDiff = aggregatedPrice - entryPrice;
        const unrealizedPL = priceDiff * (isLong ? 1 : -1);
        const isProfit = unrealizedPL >= 0;
        const fmtPL =
          (isProfit ? '+' : '') +
          unrealizedPL.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        plEl.textContent = fmtPL;
        plEl.style.color = isProfit ? '#d4ffee' : '#ffe0de';
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [engineRef, openPositions]);

  useEffect(() => {
    if (!openPositions.length) return;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [openPositions, tick]);

  if (!openPositions.length) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 55,
      }}
    >
      {openPositions.map((pos) => {
        const isLong = pos.side !== 'short';
        const lineColor = isLong ? '#26A69A' : '#EF5350';
        const sideLabel = isLong ? 'LONG' : 'SHORT';
        const fmtEntry = (pos.entry || 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

        return (
          <div
            key={pos.id}
            ref={(el) => {
              if (el) lineRefsMap.current.set(pos.id, el);
              else lineRefsMap.current.delete(pos.id);
            }}
            style={{
              position: 'absolute',
              top: -9999, // off-screen until RAF positions it
              left: 0,
              right: 0,
              height: 0,
              willChange: 'top',
            }}
          >
            {/* Dotted entry line */}
            <div
              style={{
                width: '100%',
                height: 0,
                borderTop: `1px dashed ${lineColor}90`,
              }}
            />

            {/* Left label */}
            <div
              style={{
                position: 'absolute',
                left: 8,
                top: -9,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '1px 8px',
                borderRadius: 4,
                background: `${lineColor}18`,
                border: `1px solid ${lineColor}35`,
                fontSize: 9,
                fontFamily: F,
                fontWeight: 700,
                color: lineColor,
                whiteSpace: 'nowrap',
                letterSpacing: '0.03em',
                pointerEvents: 'auto',
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: lineColor,
                  boxShadow: `0 0 4px ${lineColor}80`,
                  animation: 'tfPulse 2s ease-in-out infinite',
                }}
              />
              {sideLabel} @ {fmtEntry}
            </div>

            {/* Right price-axis tab */}
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: -12,
                display: 'flex',
                alignItems: 'center',
                gap: 0,
                pointerEvents: 'auto',
              }}
            >
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: '6px solid transparent',
                  borderBottom: '6px solid transparent',
                  borderRight: `6px solid ${lineColor}`,
                  opacity: 0.9,
                }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '2px 8px',
                  background: lineColor,
                  color: '#fff',
                  fontSize: 9,
                  fontFamily: F,
                  fontWeight: 700,
                  borderRadius: '0 3px 3px 0',
                  whiteSpace: 'nowrap',
                  minWidth: 60,
                  justifyContent: 'center',
                  boxShadow: `0 1px 4px ${lineColor}40`,
                }}
              >
                <span>{fmtEntry}</span>
                <span
                  data-pl="1"
                  style={{
                    padding: '0 4px',
                    borderRadius: 3,
                    background: 'rgba(255,255,255,0.2)',
                    color: '#d4ffee',
                    fontSize: 8,
                    fontWeight: 800,
                  }}
                >
                  +0.00
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default React.memo(PositionLineOverlay);
