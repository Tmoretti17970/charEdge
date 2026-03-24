// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart HUD System (Sprint 14)
// Managed overlay for indicator legends, trade P&L, status info.
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { useEffect, useRef } from 'react';
import { C } from '@/constants.js';
import h from './ChartHUD.module.css';
import { updateFaviconBadge, resetFavicon } from '@/app/misc/faviconBadge';
import { useChartToolsStore } from '../../../../state/chart/useChartToolsStore';
import { useChartFeaturesStore } from '../../../../state/chart/useChartFeaturesStore';
import { useChartCoreStore } from '../../../../state/chart/useChartCoreStore';
import { wsService } from '@/data/WebSocketService';

// Phase 3 Task #50: Connection status pill
const STATUS_CONFIG = {
  connected:    { dot: '🟢', label: 'Live',       bg: 'rgba(45, 212, 160, 0.08)', border: 'rgba(45, 212, 160, 0.15)' },
  connecting:   { dot: '🟡', label: 'Connecting',  bg: 'rgba(240, 182, 78, 0.08)', border: 'rgba(240, 182, 78, 0.15)' },
  reconnecting: { dot: '🟡', label: 'Reconnecting',bg: 'rgba(240, 182, 78, 0.08)', border: 'rgba(240, 182, 78, 0.15)' },
  disconnected: { dot: '🔴', label: 'Offline',     bg: 'rgba(242, 92, 92, 0.08)',  border: 'rgba(242, 92, 92, 0.15)' },
};

function ChartHUD({ _symbol, _timeframe, lastPrice, data }) {
  const indicators = useChartToolsStore((s) => s.indicators);
  const drawings = useChartToolsStore((s) => s.drawings);
  const replayMode = useChartFeaturesStore((s) => s.replayMode);
  const isLive = useChartCoreStore((s) => s.source !== 'simulated');

  // Item 37: HUD is always visible — no auto-fade
  const hudRef = useRef(null);

  const priceChange = data?.length >= 2
    ? data[data.length - 1].close - data[data.length - 2].close
    : 0;
  const priceChangePercent = data?.length >= 2 && data[data.length - 2].close
    ? ((priceChange / data[data.length - 2].close) * 100)
    : 0;
  const isPositive = priceChange >= 0;

  // ── Favicon price badge — peripheral awareness ────────────
  useEffect(() => {
    if (lastPrice != null && isLive) {
      updateFaviconBadge(priceChangePercent);
    }
    return () => resetFavicon();
  }, [priceChangePercent, lastPrice, isLive]);

  return (
    <div
      ref={hudRef}
      className="tf-chart-hud"
    >
      {/* Top-left: Symbol + Price badge */}
      <div className={h.topLeft}>
        {/* Live dot removed — status shown via header ● LIVE badge */}

        {/* Price change pill */}
        {lastPrice != null && (
          <div
            className={h.pricePill}
            data-positive={isPositive ? 'true' : 'false'}
          >
            <span
              className={h.priceChange}
              data-positive={isPositive ? 'true' : 'false'}
            >
              {isPositive ? '+' : ''}{priceChange.toFixed(2)}
            </span>
            <span
              className={h.pricePercent}
              data-positive={isPositive ? 'true' : 'false'}
            >
              ({isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%)
            </span>
          </div>
        )}
      </div>

      {/* Phase 3 Task #50: Connection status pill */}
      <div className={h.statusWrap}>
        {(() => {
          const st = STATUS_CONFIG[wsService.status] || STATUS_CONFIG.disconnected;
          return (
            <div
              className={h.statusPill}
              style={{ '--status-bg': st.bg, '--status-border': st.border }}
            >
              <span className={h.statusDot}>{st.dot}</span>
              {st.label}
            </div>
          );
        })()}
      </div>

      {/* Bottom-left: Active indicators count + drawings count */}
      <div className={h.bottomLeft}>
        {indicators.length > 0 && (
          <div className={h.badge}>
            {indicators.length} indicator{indicators.length !== 1 ? 's' : ''}
          </div>
        )}
        {drawings.length > 0 && (
          <div className={h.badge}>
            {drawings.length} drawing{drawings.length !== 1 ? 's' : ''}
          </div>
        )}
        {replayMode && (
          <div className={h.replayBadge}>
            ⏪ REPLAY
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(ChartHUD);
