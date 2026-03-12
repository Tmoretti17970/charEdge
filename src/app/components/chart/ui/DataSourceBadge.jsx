// ═══════════════════════════════════════════════════════════════════
// charEdge — DataSourceBadge
// Shows the actual data pipeline state:
//   ● LIVE (green)   — WebSocket streaming real-time
//   ● DELAYED (blue)  — REST API data (CoinGecko, Yahoo)
//   ● SIMULATED (orange) — Demo/fallback data
//   ○ LOADING (gray)  — Fetching in progress
//
// C2.5: Stale Data Indicator
// When WS was connected but disconnected, pulses orange to indicate frozen prices.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, M } from '../../../../constants.js';

function DataSourceBadge({ isLive, wsSupported, wsStatus, dataSource, dataLoading }) {
  let label, color, pulse;

  if (dataLoading) {
    label = 'LOADING';
    color = C.t3;
    pulse = false;
  } else if (isLive) {
    label = '● LIVE';
    color = C.g;
    pulse = false;
  } else if (wsSupported && wsStatus === 'reconnecting') {
    label = '● STALE';
    color = C.y;
    pulse = true;
  } else if (dataSource === 'coingecko' || dataSource === 'cryptocompare' || dataSource === 'yahoo' || dataSource === 'binance') {
    label = '● DELAYED';
    color = C.info;
    pulse = false;
  } else if (dataSource === 'simulated' || dataSource === 'demo') {
    label = '◌ SIMULATED';
    color = C.y;
    pulse = false;
  } else if (dataSource?.includes?.(':stale')) {
    label = '● CACHED';
    color = C.p;
    pulse = false;
  } else {
    label = wsSupported ? 'CONNECTING...' : '◌ DEMO';
    color = C.t3;
    pulse = false;
  }

  return (
    <div
      style={{
        fontSize: 9,
        color: color,
        fontFamily: M,
        padding: '2px 6px',
        background: color + '15',
        borderRadius: 3,
        border: `1px solid ${color}30`,
        fontWeight: 700,
        letterSpacing: '0.5px',
        animation: pulse ? 'pulse 1.5s ease-in-out infinite' : 'none',
        flexShrink: 0,
      }}
    >
      {label}
    </div>
  );
}

export default React.memo(DataSourceBadge);
