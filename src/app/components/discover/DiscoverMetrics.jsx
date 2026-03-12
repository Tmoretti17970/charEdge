// ═══════════════════════════════════════════════════════════════════
// charEdge — Discover Metrics Dashboard
//
// Sprint 25: Weekly engagement metrics card showing widget usage,
// tab dwell times, funnel conversions, and interaction heatmap.
// Displayed in Settings → Telemetry section.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState } from 'react';
import { C, F, M } from '../../../constants.js';
import { useDataStore } from '../../../state/useDataStore.js';
import { alpha } from '@/shared/colorUtils';

function DiscoverMetrics() {
  const [expanded, setExpanded] = useState(false);

  const tabDwellTimes = useDataStore((s) => s.tabDwellTimes);
  const getWidgetRankings = useDataStore((s) => s.getWidgetRankings);
  const getConversionRates = useDataStore((s) => s.getConversionRates);
  const getSessionDuration = useDataStore((s) => s.getSessionDuration);
  const funnelCounts = useDataStore((s) => s.funnelCounts);

  const rankings = getWidgetRankings();
  const conversions = getConversionRates();
  const sessionMs = getSessionDuration();
  const sessionMin = Math.round(sessionMs / 60000);

  const topWidgets = rankings.slice(0, 5);
  const bottomWidgets = rankings.slice(-3).reverse();

  const formatMs = (ms) => {
    if (!ms) return '0s';
    const sec = Math.round(ms / 1000);
    if (sec < 60) return `${sec}s`;
    return `${Math.round(sec / 60)}m`;
  };

  const _fmtPct = (v) => `${(v * 100).toFixed(0)}%`;

  return (
    <div
      style={{
        background: C.bg2,
        border: `1px solid ${C.bd}`,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '16px 20px',
          background: 'transparent',
          border: 'none',
          borderBottom: expanded ? `1px solid ${C.bd}` : 'none',
          cursor: 'pointer',
          color: C.t1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📊</span>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: F }}>
            Discover Engagement Metrics
          </span>
        </div>
        <span style={{ fontSize: 10, color: C.t3, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          ▼
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Session Overview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <MetricCard label="Session" value={`${sessionMin}m`} sub="total time" />
            <MetricCard label="Feed" value={formatMs(tabDwellTimes.feed)} sub="dwell time" color={C.b} />
            <MetricCard label="Intel" value={formatMs(tabDwellTimes.intel)} sub="dwell time" color={C.p} />
            <MetricCard label="More" value={formatMs(tabDwellTimes.more)} sub="dwell time" color={C.cyan} />
          </div>

          {/* Top Widgets by Engagement */}
          {topWidgets.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.t2, fontFamily: F, marginBottom: 8 }}>
                🏆 Most Engaged Widgets
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {topWidgets.map((w, i) => (
                  <div
                    key={w.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      background: alpha(C.g, 0.04 + i * 0.01),
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: F,
                    }}
                  >
                    <span style={{ color: C.t1, fontWeight: 600 }}>
                      #{i + 1} {w.id}
                    </span>
                    <span style={{ color: C.t3, fontFamily: M, fontSize: 11 }}>
                      {w.clicks} clicks · {w.impressions} views
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Least Used Widgets */}
          {bottomWidgets.length > 0 && rankings.length > 5 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.t2, fontFamily: F, marginBottom: 8 }}>
                💤 Least Engaged Widgets
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {bottomWidgets.map((w) => (
                  <div
                    key={w.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      background: alpha(C.t3, 0.04),
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: F,
                    }}
                  >
                    <span style={{ color: C.t3 }}>{w.id}</span>
                    <span style={{ color: C.t3, fontFamily: M, fontSize: 11 }}>
                      {w.clicks} clicks
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Funnel Conversion Rates */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.t2, fontFamily: F, marginBottom: 8 }}>
              📈 Funnel Conversions
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <FunnelRow
                label="Briefing read-through"
                rate={conversions.briefingReadRate}
                numerator={funnelCounts.briefingReadThroughs}
                denominator={funnelCounts.briefingViews}
              />
              <FunnelRow
                label="Screener → Chart"
                rate={conversions.screenerConversion}
                numerator={funnelCounts.screenerToChart}
                denominator={funnelCounts.screenerOpens}
              />
              <FunnelRow
                label="Alert follow-through"
                rate={conversions.alertFollowRate}
                numerator={funnelCounts.alertFollowed}
                denominator={funnelCounts.alertCreated}
              />
              <FunnelRow
                label="Copilot query rate"
                rate={conversions.copilotQueryRate}
                numerator={funnelCounts.copilotQueries}
                denominator={funnelCounts.copilotOpened}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        background: alpha(color || C.t1, 0.04),
        borderRadius: 10,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 800, color: color || C.t1, fontFamily: M }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: C.t2, fontWeight: 600, fontFamily: F, marginTop: 2 }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 9, color: C.t3, fontFamily: F, marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function FunnelRow({ label, rate, numerator, denominator }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 10px',
        background: alpha(C.t3, 0.04),
        borderRadius: 8,
        fontSize: 11,
        fontFamily: F,
      }}
    >
      <span style={{ color: C.t2 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: C.t3, fontFamily: M, fontSize: 10 }}>
          {numerator || 0}/{denominator || 0}
        </span>
        <span
          style={{
            fontWeight: 700,
            fontFamily: M,
            fontSize: 11,
            color: rate > 0.5 ? C.g : rate > 0.2 ? C.w : C.r,
          }}
        >
          {(rate * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

export { DiscoverMetrics };

export default React.memo(DiscoverMetrics);
