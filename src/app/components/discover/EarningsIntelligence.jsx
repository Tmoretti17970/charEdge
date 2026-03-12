// ═══════════════════════════════════════════════════════════════════
// charEdge — Earnings Intelligence Center
//
// Sprint 4: Dedicated earnings research component.
// Features:
//   - Weekly earnings calendar with visual density
//   - Expected move & historical surprise data
//   - Options IV context
//   - Earnings reaction heatmap
//   - Watchlist-filtered view
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import { alpha } from '@/shared/colorUtils';

// ─── Mock Earnings Data ─────────────────────────────────────────

const MOCK_EARNINGS = [
  {
    symbol: 'NVDA', name: 'NVIDIA', date: '2026-02-26', time: 'AMC',
    expectedMove: '±8.2%', consensusEPS: '$5.60', previousEPS: '$5.16',
    surprise: [12.4, 8.8, 15.2, 10.6, 7.9, 22.1, 9.3, 14.5],
    reaction: [4.2, -2.1, 8.9, 3.4, -5.2, 16.4, -3.8, 6.1],
    iv: 62, ivRank: 85, sector: 'Tech',
  },
  {
    symbol: 'MSFT', name: 'Microsoft', date: '2026-02-27', time: 'AMC',
    expectedMove: '±4.5%', consensusEPS: '$2.95', previousEPS: '$2.93',
    surprise: [3.2, 1.5, 4.8, 2.1, 5.6, 3.0, 1.8, 4.2],
    reaction: [1.8, -0.5, 3.2, -1.2, 2.4, 0.8, -2.1, 1.6],
    iv: 38, ivRank: 52, sector: 'Tech',
  },
  {
    symbol: 'META', name: 'Meta Platforms', date: '2026-02-26', time: 'AMC',
    expectedMove: '±6.8%', consensusEPS: '$4.82', previousEPS: '$5.33',
    surprise: [18.5, 12.0, -5.2, 8.4, 22.3, 15.6, 10.8, -2.1],
    reaction: [12.5, 3.8, -8.4, 5.1, 20.3, -4.2, 7.6, -3.5],
    iv: 52, ivRank: 78, sector: 'Tech',
  },
  {
    symbol: 'AMZN', name: 'Amazon', date: '2026-02-28', time: 'AMC',
    expectedMove: '±5.2%', consensusEPS: '$1.15', previousEPS: '$1.00',
    surprise: [15.0, 8.5, 22.0, 12.0, -3.5, 18.0, 5.5, 10.0],
    reaction: [6.8, -2.5, 9.4, 3.2, -6.8, 7.2, -1.5, 4.8],
    iv: 45, ivRank: 65, sector: 'Tech',
  },
  {
    symbol: 'TSLA', name: 'Tesla', date: '2026-02-26', time: 'AMC',
    expectedMove: '±9.5%', consensusEPS: '$0.68', previousEPS: '$0.71',
    surprise: [-8.2, 5.5, -15.4, 12.3, -22.0, 8.8, -4.5, 18.2],
    reaction: [-12.0, 8.5, -9.2, 6.4, -14.5, 3.2, -7.8, 11.2],
    iv: 78, ivRank: 92, sector: 'Auto',
  },
  {
    symbol: 'AAPL', name: 'Apple Inc.', date: '2026-02-27', time: 'AMC',
    expectedMove: '±3.8%', consensusEPS: '$2.12', previousEPS: '$2.18',
    surprise: [2.8, 1.2, 3.5, 0.8, 4.2, 2.0, 1.5, 3.0],
    reaction: [1.2, -0.8, 2.5, 0.5, -1.8, 1.0, -0.5, 1.8],
    iv: 32, ivRank: 45, sector: 'Tech',
  },
];

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════

function EarningsIntelligence() {
  const [filter, setFilter] = useState('all'); // 'all' | 'watchlist'
  const [collapsed, setCollapsed] = useState(false);
  const watchlist = useWatchlistStore((s) => s.items);

  const earnings = useMemo(() => {
    if (filter === 'watchlist') {
      const syms = new Set(watchlist.map((w) => w.symbol));
      return MOCK_EARNINGS.filter((e) => syms.has(e.symbol));
    }
    return MOCK_EARNINGS;
  }, [filter, watchlist]);

  // Group by date
  const byDate = useMemo(() => {
    const groups = new Map();
    for (const e of earnings) {
      if (!groups.has(e.date)) groups.set(e.date, []);
      groups.get(e.date).push(e);
    }
    return groups;
  }, [earnings]);

  return (
    <div
      style={{
        background: C.bg2,
        border: `1px solid ${C.bd}`,
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="tf-btn"
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📊</span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>
            Earnings Intelligence
          </h3>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.b,
              background: alpha(C.b, 0.1),
              padding: '2px 7px',
              borderRadius: 4,
              fontFamily: M,
            }}
          >
            {earnings.length} this week
          </span>
        </div>
        <span
          style={{
            color: C.t3,
            fontSize: 11,
            transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          ▾
        </span>
      </button>

      {!collapsed && (
        <div style={{ padding: '0 20px 20px' }}>
          {/* Filter toggle */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {['all', 'watchlist'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="tf-btn"
                style={{
                  padding: '5px 12px',
                  borderRadius: 8,
                  border: `1px solid ${filter === f ? C.b : 'transparent'}`,
                  background: filter === f ? alpha(C.b, 0.08) : 'transparent',
                  color: filter === f ? C.b : C.t3,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: F,
                  textTransform: 'capitalize',
                }}
              >
                {f === 'watchlist' ? '⭐ My Watchlist' : '📋 All Earnings'}
              </button>
            ))}
          </div>

          {earnings.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: C.t3, fontSize: 12, fontFamily: F }}>
              No earnings from your watchlist this week. Switch to "All" to see all upcoming reports.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[...byDate.entries()].map(([date, items]) => (
                <div key={date}>
                  {/* Date Header */}
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: C.t3,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      fontFamily: F,
                      marginBottom: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {formatEarningsDate(date)}
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: alpha(getHeatColor(items.length), 0.15),
                        color: getHeatColor(items.length),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 9,
                        fontWeight: 700,
                        fontFamily: M,
                      }}
                    >
                      {items.length}
                    </span>
                  </div>

                  {/* Earnings Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {items.map((e) => (
                      <EarningsCard key={e.symbol} data={e} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Earnings Card
// ═══════════════════════════════════════════════════════════════════

function EarningsCard({ data }) {
  const [expanded, setExpanded] = useState(false);
  const avgSurprise = data.surprise.reduce((s, v) => s + v, 0) / data.surprise.length;
  const avgReaction = data.reaction.reduce((s, v) => s + Math.abs(v), 0) / data.reaction.length;

  return (
    <div
      style={{
        padding: '12px 14px',
        background: alpha(C.sf, 0.5),
        border: `1px solid ${alpha(C.bd, 0.5)}`,
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Main Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Symbol */}
        <div style={{ minWidth: 80 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: F }}>
            {data.symbol}
          </div>
          <div style={{ fontSize: 10, color: C.t3, fontFamily: F }}>{data.name}</div>
        </div>

        {/* Time */}
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: C.t3,
            background: alpha(C.t3, 0.1),
            padding: '2px 6px',
            borderRadius: 4,
            fontFamily: M,
          }}
        >
          {data.time}
        </div>

        {/* Expected Move */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: C.t3, fontFamily: F, marginBottom: 1 }}>Exp. Move</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.y, fontFamily: M }}>
            {data.expectedMove}
          </div>
        </div>

        {/* Consensus EPS */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: C.t3, fontFamily: F, marginBottom: 1 }}>Est. EPS</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: M }}>
            {data.consensusEPS}
          </div>
        </div>

        {/* IV Rank */}
        <div
          style={{
            textAlign: 'right',
            background: alpha(data.ivRank > 70 ? C.r : data.ivRank > 40 ? C.y : C.g, 0.08),
            padding: '4px 8px',
            borderRadius: 6,
          }}
        >
          <div style={{ fontSize: 9, color: C.t3, fontFamily: F }}>IV Rank</div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: data.ivRank > 70 ? C.r : data.ivRank > 40 ? C.y : C.g,
              fontFamily: M,
            }}
          >
            {data.ivRank}
          </div>
        </div>

        {/* Expand icon */}
        <span
          style={{
            color: C.t3,
            fontSize: 10,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
          }}
        >
          ▾
        </span>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.bd}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Surprise History */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: F, marginBottom: 6 }}>
                EPS Surprise % (Last 8 Quarters)
              </div>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 40 }}>
                {data.surprise.map((v, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${Math.min(Math.abs(v) * 2, 40)}px`,
                      background: v >= 0 ? alpha(C.g, 0.6) : alpha(C.r, 0.6),
                      borderRadius: 2,
                    }}
                    title={`Q${8 - i}: ${v > 0 ? '+' : ''}${v}%`}
                  />
                ))}
              </div>
              <div style={{ fontSize: 9, color: C.t3, fontFamily: M, marginTop: 4 }}>
                Avg surprise: <span style={{ color: avgSurprise >= 0 ? C.g : C.r }}>{avgSurprise > 0 ? '+' : ''}{avgSurprise.toFixed(1)}%</span>
              </div>
            </div>

            {/* Post-Earnings Reaction */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: F, marginBottom: 6 }}>
                Post-Earnings Reaction (Last 8)
              </div>
              <div style={{ display: 'flex', gap: 3, alignItems: 'center', height: 40 }}>
                {data.reaction.map((v, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${Math.min(Math.abs(v) * 3, 40)}px`,
                      background: v >= 0 ? alpha(C.g, 0.6) : alpha(C.r, 0.6),
                      borderRadius: 2,
                      alignSelf: v >= 0 ? 'flex-end' : 'flex-start',
                    }}
                    title={`Q${8 - i}: ${v > 0 ? '+' : ''}${v}%`}
                  />
                ))}
              </div>
              <div style={{ fontSize: 9, color: C.t3, fontFamily: M, marginTop: 4 }}>
                Avg reaction: <span style={{ color: C.t2 }}>±{avgReaction.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════

function formatEarningsDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function getHeatColor(count) {
  if (count >= 4) return C.r;
  if (count >= 2) return '#f0b64e';
  return C.g;
}

export { EarningsIntelligence };

export default React.memo(EarningsIntelligence);
