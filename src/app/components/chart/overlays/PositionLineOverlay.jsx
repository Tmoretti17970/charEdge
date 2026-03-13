// ═══════════════════════════════════════════════════════════════════
// charEdge — Position Line Overlay
//
// Renders horizontal dotted entry lines + price-axis tabs for open
// positions. Follows the AlertLinesOverlay pattern (CSS-positioned
// React overlay on top of the chart canvas).
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useMemo } from 'react';
import { F } from '../../../../constants.js';
import { useOpenPositions } from '../../../../hooks/useOpenPositions.js';
import { useChartCoreStore } from '../../../../state/chart/useChartCoreStore';
import { useChartBars } from '../../../hooks/useChartBars.js';

function PositionLineOverlay({ symbol }) {
  const data = useChartBars();
  const openPositions = useOpenPositions(symbol);
  const aggregatedPrice = useChartCoreStore((s) => s.aggregatedPrice);

  // Compute visible price range from bar data
  const priceRange = useMemo(() => {
    if (!data?.length) return null;
    let min = Infinity,
      max = -Infinity;
    for (const bar of data) {
      if (bar.high > max) max = bar.high;
      if (bar.low < min) min = bar.low;
    }
    const padding = (max - min) * 0.05;
    return { min: min - padding, max: max + padding };
  }, [data]);

  if (!openPositions.length || !priceRange) return null;

  const { min, max } = priceRange;
  const range = max - min;
  const currentPrice = aggregatedPrice || data?.[data.length - 1]?.close || 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 55, // above alert lines (50), below trade pills (80)
      }}
    >
      {openPositions.map((pos) => {
        const entryPrice = pos.entry;
        if (!entryPrice || entryPrice < min || entryPrice > max) return null;

        const yPercent = ((max - entryPrice) / range) * 100;
        const isLong = pos.side !== 'short';
        const lineColor = isLong ? '#26A69A' : '#EF5350';

        // Compute unrealized P&L
        const priceDiff = currentPrice - entryPrice;
        const unrealizedPL = priceDiff * (isLong ? 1 : -1);
        const isProfit = unrealizedPL >= 0;
        const _plColor = isProfit ? '#26A69A' : '#EF5350';

        const fmtEntry = entryPrice.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const fmtPL =
          (isProfit ? '+' : '') +
          unrealizedPL.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        const sideLabel = isLong ? 'LONG' : 'SHORT';

        return (
          <div
            key={pos.id}
            style={{
              position: 'absolute',
              top: `${yPercent}%`,
              left: 0,
              right: 0,
            }}
          >
            {/* ── Dotted entry line ── */}
            <div
              style={{
                width: '100%',
                height: 0,
                borderTop: `1px dashed ${lineColor}90`,
              }}
            />

            {/* ── Left label: LONG/SHORT @ price ── */}
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

            {/* ── Right price-axis tab: entry price + live P&L ── */}
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
              {/* Notch arrow pointing left */}
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
              {/* Tab body */}
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
                  style={{
                    padding: '0 4px',
                    borderRadius: 3,
                    background: 'rgba(255,255,255,0.2)',
                    color: isProfit ? '#d4ffee' : '#ffe0de',
                    fontSize: 8,
                    fontWeight: 800,
                  }}
                >
                  {fmtPL}
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
