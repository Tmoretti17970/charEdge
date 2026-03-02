// ═══════════════════════════════════════════════════════════════════
// charEdge — Data Source Badge
// Shows the active data source: LIVE, RELAY, ORACLE, DELAYED, CACHED, NO DATA
// ═══════════════════════════════════════════════════════════════════

import React from 'react';

const BADGE_CONFIG = {
  // Direct exchange WebSocket (lowest latency)
  binance:    { label: 'LIVE',    color: 'var(--tf-green)',  bg: 'rgba(45, 212, 160, 0.12)',  pulse: true },
  kraken:     { label: 'LIVE',    color: 'var(--tf-green)',  bg: 'rgba(45, 212, 160, 0.12)',  pulse: true },
  bybit:      { label: 'LIVE',    color: 'var(--tf-green)',  bg: 'rgba(45, 212, 160, 0.12)',  pulse: true },
  okx:        { label: 'LIVE',    color: 'var(--tf-green)',  bg: 'rgba(45, 212, 160, 0.12)',  pulse: true },
  coinbase:   { label: 'LIVE',    color: 'var(--tf-green)',  bg: 'rgba(45, 212, 160, 0.12)',  pulse: true },
  polygon:    { label: 'LIVE',    color: 'var(--tf-green)',  bg: 'rgba(45, 212, 160, 0.12)',  pulse: true },
  live:       { label: 'LIVE',    color: 'var(--tf-green)',  bg: 'rgba(45, 212, 160, 0.12)',  pulse: true },

  // P2P relay from peer
  relay:      { label: 'RELAY',   color: '#5c9cf5',         bg: 'rgba(92, 156, 245, 0.12)',  pulse: true },

  // Pyth oracle feed
  oracle:     { label: 'ORACLE',  color: '#a78bfa',         bg: 'rgba(167, 139, 250, 0.12)', pulse: true },
  pyth:       { label: 'ORACLE',  color: '#a78bfa',         bg: 'rgba(167, 139, 250, 0.12)', pulse: true },

  // REST polling / delayed data
  delayed:    { label: 'DELAYED', color: 'var(--tf-yellow)', bg: 'rgba(240, 182, 78, 0.12)',  pulse: false },
  alphavantage: { label: 'DELAYED', color: 'var(--tf-yellow)', bg: 'rgba(240, 182, 78, 0.12)', pulse: false },

  // Stale / cached data
  cached:     { label: 'CACHED',  color: '#f0a050',         bg: 'rgba(240, 160, 80, 0.12)',  pulse: false },
  'binance:stale': { label: 'CACHED', color: '#f0a050',     bg: 'rgba(240, 160, 80, 0.12)',  pulse: false },
  'polygon:stale': { label: 'CACHED', color: '#f0a050',     bg: 'rgba(240, 160, 80, 0.12)',  pulse: false },

  // Simulated / demo
  simulated:  { label: 'DEMO',    color: 'var(--tf-yellow)', bg: 'rgba(240, 182, 78, 0.12)',  pulse: false },

  // No data
  no_data:    { label: 'NO DATA', color: 'var(--tf-red)',    bg: 'rgba(242, 92, 92, 0.12)',   pulse: false },
  none:       { label: 'NO DATA', color: 'var(--tf-red)',    bg: 'rgba(242, 92, 92, 0.12)',   pulse: false },
};

const badgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 7px',
  borderRadius: 9999,
  fontSize: 9,
  fontWeight: 700,
  fontFamily: 'var(--tf-mono)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  lineHeight: 1.3,
  whiteSpace: 'nowrap',
  transition: 'opacity 0.15s ease',
};

const dotStyle = {
  width: 5,
  height: 5,
  borderRadius: '50%',
  flexShrink: 0,
};

/**
 * Data source badge for chart status bar.
 * @param {{ source: string, confidence?: number }} props
 */
export default function DataSourceBadge({ source, confidence }) {
  if (!source) return null;

  const config = BADGE_CONFIG[source] || BADGE_CONFIG.no_data;
  const isOracle = config.label === 'ORACLE';

  // Format confidence for display: e.g. 15.20 → "±15.20"
  const confDisplay = isOracle && typeof confidence === 'number' && confidence > 0
    ? `±${confidence < 1 ? confidence.toFixed(4) : confidence.toFixed(2)}`
    : null;

  return (
    <span
      style={{
        ...badgeStyle,
        color: config.color,
        background: config.bg,
      }}
      title={`Data source: ${source}${confDisplay ? ` (confidence: ${confDisplay})` : ''}`}
    >
      <span
        style={{
          ...dotStyle,
          background: config.color,
          boxShadow: config.pulse ? `0 0 4px ${config.color}` : 'none',
          animation: config.pulse ? 'pulse 2s ease-in-out infinite' : 'none',
        }}
      />
      {config.label}
      {confDisplay && (
        <span style={{ opacity: 0.7, fontSize: 8, marginLeft: 2 }}>
          {confDisplay}
        </span>
      )}
    </span>
  );
}
