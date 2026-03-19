// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart HUD System (Sprint 14)
// Managed overlay for indicator legends, trade P&L, status info.
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { useEffect, useRef } from 'react';
import { C } from '../../../../constants.js';
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
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px',
              borderRadius: 8,
              background: isPositive
                ? 'rgba(45, 212, 160, 0.08)'
                : 'rgba(242, 92, 92, 0.08)',
              border: `1px solid ${isPositive ? 'rgba(45, 212, 160, 0.15)' : 'rgba(242, 92, 92, 0.15)'}`,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "'JetBrains Mono', monospace",
                fontVariantNumeric: 'tabular-nums',
                color: isPositive ? C.g : C.r,
              }}
            >
              {isPositive ? '+' : ''}{priceChange.toFixed(2)}
            </span>
            <span
              style={{
                fontSize: 10,
                color: isPositive ? C.g : C.r,
                opacity: 0.7,
              }}
            >
              ({isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%)
            </span>
          </div>
        )}
      </div>

      {/* Phase 3 Task #50: Connection status pill */}
      <div style={{
        position: 'absolute',
        top: 4,
        right: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        {(() => {
          const st = STATUS_CONFIG[wsService.status] || STATUS_CONFIG.disconnected;
          return (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 7px',
                borderRadius: 6,
                background: st.bg,
                border: `1px solid ${st.border}`,
                fontSize: 9,
                fontWeight: 600,
                color: C.t2,
                letterSpacing: '0.02em',
              }}
            >
              <span style={{ fontSize: 6 }}>{st.dot}</span>
              {st.label}
            </div>
          );
        })()}
      </div>

      {/* Bottom-left: Active indicators count + drawings count */}
      <div className={h.bottomLeft}>
        {indicators.length > 0 && (
          <div
            style={{
              fontSize: 10,
              color: C.t3,
              padding: '2px 6px',
              borderRadius: 6,
              background: 'rgba(22, 24, 29, 0.6)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            {indicators.length} indicator{indicators.length !== 1 ? 's' : ''}
          </div>
        )}
        {drawings.length > 0 && (
          <div
            style={{
              fontSize: 10,
              color: C.t3,
              padding: '2px 6px',
              borderRadius: 6,
              background: 'rgba(22, 24, 29, 0.6)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            {drawings.length} drawing{drawings.length !== 1 ? 's' : ''}
          </div>
        )}
        {replayMode && (
          <div
            style={{
              fontSize: 10,
              color: C.y,
              padding: '2px 6px',
              borderRadius: 6,
              background: 'rgba(240, 182, 78, 0.08)',
              border: '1px solid rgba(240, 182, 78, 0.15)',
              fontWeight: 600,
            }}
          >
            ⏪ REPLAY
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(ChartHUD);
