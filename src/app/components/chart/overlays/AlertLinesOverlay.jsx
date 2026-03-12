// ═══════════════════════════════════════════════════════════════════
// charEdge — Alert Lines Overlay
// Renders active price alerts as annotated dashed lines on the chart.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useMemo } from 'react';
import { F } from '../../../../constants.js';
import { useAlertStore } from '../../../../state/useAlertStore';
import { useChartBars } from '../../../hooks/useChartBars.js';
import Icon from '../../design/Icon.jsx';

function AlertLinesOverlay({ symbol, _chartHeight = 400 }) {
  const allAlerts = useAlertStore((s) => s.alerts);
  const data = useChartBars();

  // Get alerts for the current symbol — the store may use different shapes
  const alerts = useMemo(() => {
    if (!allAlerts) return [];
    // Handle both array and object-keyed shapes
    if (Array.isArray(allAlerts)) {
      return allAlerts.filter(
        (a) => a.active !== false && (a.symbol || '').toUpperCase() === symbol.toUpperCase()
      );
    }
    // Object keyed by symbol
    const list = allAlerts[symbol] || allAlerts[symbol?.toUpperCase()] || [];
    return Array.isArray(list) ? list.filter((a) => a.active !== false) : [];
  }, [allAlerts, symbol]);

  // Calculate price range from data for positioning
  const priceRange = useMemo(() => {
    if (!data?.length) return null;
    let min = Infinity, max = -Infinity;
    for (const bar of data) {
      if (bar.high > max) max = bar.high;
      if (bar.low < min) min = bar.low;
    }
    // Add 5% padding
    const padding = (max - min) * 0.05;
    return { min: min - padding, max: max + padding };
  }, [data]);

  if (!alerts.length || !priceRange) return null;

  const { min, max } = priceRange;
  const range = max - min;
  const lastClose = data?.[data.length - 1]?.close || 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 60, // leave room for price axis
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      {alerts.map((alert) => {
        const price = alert.price;
        if (price < min || price > max) return null;

        const yPercent = ((max - price) / range) * 100;
        const isAbove = price >= lastClose;
        const color = isAbove ? '#26A69A' : '#EF5350';

        return (
          <div
            key={alert.id || `${alert.price}-${alert.condition}`}
            style={{
              position: 'absolute',
              top: `${yPercent}%`,
              left: 0,
              right: 0,
              pointerEvents: 'auto',
            }}
          >
            {/* Dashed line */}
            <div
              style={{
                width: '100%',
                height: 0,
                borderTop: `1px dashed ${color}80`,
              }}
            />
            {/* Label */}
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: -10,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '1px 6px',
                borderRadius: 4,
                background: `${color}20`,
                border: `1px solid ${color}40`,
                fontSize: 9,
                fontFamily: F,
                fontWeight: 600,
                color: color,
                whiteSpace: 'nowrap',
                cursor: 'default',
              }}
              title={alert.note || `Alert: ${alert.condition} ${price}`}
            >
              <span><Icon name="bell" size={9} /></span>
              <span>{price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              {alert.note && (
                <span style={{ opacity: 0.7, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {alert.note}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default React.memo(AlertLinesOverlay);
