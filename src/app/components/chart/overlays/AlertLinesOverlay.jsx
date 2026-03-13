// ═══════════════════════════════════════════════════════════════════
// charEdge — Alert Lines Overlay (Phase B4 Visual Upgrade)
// Renders active price alerts as annotated lines on the chart.
// Line style varies by proximity to current price:
//   • urgent  (≤0.5%): solid 2px, pulsing label
//   • warning (≤2%):   dashed 1.5px, orange accent
//   • info    (>2%):   dotted 1px, subtle gray
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useMemo } from 'react';
import { F, M } from '../../../../constants.js';
import { useAlertStore } from '../../../../state/useAlertStore';
import { useChartBars } from '../../../hooks/useChartBars.js';
import Icon from '../../design/Icon.jsx';

// ─── Severity tiers ─────────────────────────────────────────────

function getSeverity(alertPrice, currentPrice) {
  if (!currentPrice || currentPrice === 0) return 'info';
  const pct = Math.abs((alertPrice - currentPrice) / currentPrice) * 100;
  if (pct <= 0.5) return 'urgent';
  if (pct <= 2.0) return 'warning';
  return 'info';
}

const SEVERITY_STYLES = {
  urgent: {
    border: (color) => `2px solid ${color}`,
    labelBg: (color) => `${color}30`,
    labelBorder: (color) => `${color}70`,
    opacity: 1,
    animation: 'alertPulse 2s ease-in-out infinite',
  },
  warning: {
    border: (color) => `1.5px dashed ${color}A0`,
    labelBg: (color) => `${color}20`,
    labelBorder: (color) => `${color}50`,
    opacity: 0.85,
    animation: 'none',
  },
  info: {
    border: (_color) => '1px dotted rgba(255,255,255,0.15)',
    labelBg: () => 'rgba(255,255,255,0.05)',
    labelBorder: () => 'rgba(255,255,255,0.1)',
    opacity: 0.5,
    animation: 'none',
  },
};

// Severity → base color override
function getSeverityColor(severity, isAbove) {
  if (severity === 'urgent') return isAbove ? '#26A69A' : '#EF5350';
  if (severity === 'warning') return '#FF9800';
  return '#787B86';
}

function AlertLinesOverlay({ symbol, _chartHeight = 400 }) {
  const allAlerts = useAlertStore((s) => s.alerts);
  const data = useChartBars();

  // Get alerts for the current symbol
  const alerts = useMemo(() => {
    if (!allAlerts) return [];
    if (Array.isArray(allAlerts)) {
      return allAlerts.filter(
        (a) => a.active !== false && (a.symbol || '').toUpperCase() === symbol.toUpperCase()
      );
    }
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
        right: 60,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      {/* CSS keyframes for urgent pulse */}
      <style>{`
        @keyframes alertPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {alerts.map((alert) => {
        const price = alert.price;
        if (price < min || price > max) return null;

        const yPercent = ((max - price) / range) * 100;
        const isAbove = price >= lastClose;
        const severity = getSeverity(price, lastClose);
        const color = getSeverityColor(severity, isAbove);
        const styles = SEVERITY_STYLES[severity];

        const distPct = lastClose > 0
          ? Math.abs((price - lastClose) / lastClose * 100).toFixed(1)
          : '?';

        return (
          <div
            key={alert.id || `${alert.price}-${alert.condition}`}
            style={{
              position: 'absolute',
              top: `${yPercent}%`,
              left: 0,
              right: 0,
              pointerEvents: 'auto',
              opacity: styles.opacity,
            }}
          >
            {/* Line */}
            <div
              style={{
                width: '100%',
                height: 0,
                borderTop: styles.border(color),
              }}
            />
            {/* Label */}
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: -11,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 4,
                background: styles.labelBg(color),
                border: `1px solid ${styles.labelBorder(color)}`,
                fontSize: 9,
                fontFamily: F,
                fontWeight: 600,
                color: color,
                whiteSpace: 'nowrap',
                cursor: 'default',
                animation: styles.animation,
                transition: 'all 0.3s ease',
              }}
              title={`${alert.note || `Alert: ${alert.condition} ${price}`}\n${distPct}% from current price`}
            >
              <span><Icon name="bell" size={9} /></span>
              <span style={{ fontFamily: M }}>{price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              {severity === 'urgent' && (
                <span style={{ fontSize: 7, opacity: 0.8, letterSpacing: '0.03em' }}>⚠ {distPct}%</span>
              )}
              {severity === 'warning' && (
                <span style={{ fontSize: 7, opacity: 0.7 }}>{distPct}%</span>
              )}
              {alert.note && (
                <span style={{ opacity: 0.7, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {alert.note}
                </span>
              )}
              {alert.expiresAt && (
                <span style={{ fontSize: 7, opacity: 0.5 }}>⏰</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default React.memo(AlertLinesOverlay);
