// ═══════════════════════════════════════════════════════════════════
// charEdge — Earnings Intelligence Center
// ═══════════════════════════════════════════════════════════════════

import { BarChart3, Star, List } from 'lucide-react';
import React from 'react';
import { useState, useMemo } from 'react';
import { C } from '../../../constants.js';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import st from './EarningsIntelligence.module.css';
import { alpha } from '@/shared/colorUtils';

const MOCK_EARNINGS = [
  {
    symbol: 'NVDA',
    name: 'NVIDIA',
    date: '2026-02-26',
    time: 'AMC',
    expectedMove: '±8.2%',
    consensusEPS: '$5.60',
    previousEPS: '$5.16',
    surprise: [12.4, 8.8, 15.2, 10.6, 7.9, 22.1, 9.3, 14.5],
    reaction: [4.2, -2.1, 8.9, 3.4, -5.2, 16.4, -3.8, 6.1],
    iv: 62,
    ivRank: 85,
    sector: 'Tech',
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft',
    date: '2026-02-27',
    time: 'AMC',
    expectedMove: '±4.5%',
    consensusEPS: '$2.95',
    previousEPS: '$2.93',
    surprise: [3.2, 1.5, 4.8, 2.1, 5.6, 3.0, 1.8, 4.2],
    reaction: [1.8, -0.5, 3.2, -1.2, 2.4, 0.8, -2.1, 1.6],
    iv: 38,
    ivRank: 52,
    sector: 'Tech',
  },
  {
    symbol: 'META',
    name: 'Meta Platforms',
    date: '2026-02-26',
    time: 'AMC',
    expectedMove: '±6.8%',
    consensusEPS: '$4.82',
    previousEPS: '$5.33',
    surprise: [18.5, 12.0, -5.2, 8.4, 22.3, 15.6, 10.8, -2.1],
    reaction: [12.5, 3.8, -8.4, 5.1, 20.3, -4.2, 7.6, -3.5],
    iv: 52,
    ivRank: 78,
    sector: 'Tech',
  },
  {
    symbol: 'AMZN',
    name: 'Amazon',
    date: '2026-02-28',
    time: 'AMC',
    expectedMove: '±5.2%',
    consensusEPS: '$1.15',
    previousEPS: '$1.00',
    surprise: [15.0, 8.5, 22.0, 12.0, -3.5, 18.0, 5.5, 10.0],
    reaction: [6.8, -2.5, 9.4, 3.2, -6.8, 7.2, -1.5, 4.8],
    iv: 45,
    ivRank: 65,
    sector: 'Tech',
  },
  {
    symbol: 'TSLA',
    name: 'Tesla',
    date: '2026-02-26',
    time: 'AMC',
    expectedMove: '±9.5%',
    consensusEPS: '$0.68',
    previousEPS: '$0.71',
    surprise: [-8.2, 5.5, -15.4, 12.3, -22.0, 8.8, -4.5, 18.2],
    reaction: [-12.0, 8.5, -9.2, 6.4, -14.5, 3.2, -7.8, 11.2],
    iv: 78,
    ivRank: 92,
    sector: 'Auto',
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    date: '2026-02-27',
    time: 'AMC',
    expectedMove: '±3.8%',
    consensusEPS: '$2.12',
    previousEPS: '$2.18',
    surprise: [2.8, 1.2, 3.5, 0.8, 4.2, 2.0, 1.5, 3.0],
    reaction: [1.2, -0.8, 2.5, 0.5, -1.8, 1.0, -0.5, 1.8],
    iv: 32,
    ivRank: 45,
    sector: 'Tech',
  },
];

function EarningsIntelligence() {
  const [filter, setFilter] = useState('all');
  const [collapsed, setCollapsed] = useState(false);
  const watchlist = useWatchlistStore((s) => s.items);

  const earnings = useMemo(() => {
    if (filter === 'watchlist') {
      const syms = new Set(watchlist.map((w) => w.symbol));
      return MOCK_EARNINGS.filter((e) => syms.has(e.symbol));
    }
    return MOCK_EARNINGS;
  }, [filter, watchlist]);

  const byDate = useMemo(() => {
    const groups = new Map();
    for (const e of earnings) {
      if (!groups.has(e.date)) groups.set(e.date, []);
      groups.get(e.date).push(e);
    }
    return groups;
  }, [earnings]);

  return (
    <div className={st.card} style={{ background: C.bg2, border: `1px solid ${C.bd}` }}>
      <button onClick={() => setCollapsed(!collapsed)} className={`tf-btn ${st.headerBtn}`}>
        <div className={st.headerLeft}>
          <BarChart3 size={18} className={st.headerIcon} />
          <h3 className={st.headerTitle}>Earnings Intelligence</h3>
          <span className={st.badge} style={{ color: C.b, background: alpha(C.b, 0.1) }}>
            {earnings.length} this week
          </span>
        </div>
        <span className={st.chevron} style={{ color: C.t3, transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
          ▾
        </span>
      </button>

      {!collapsed && (
        <div className={st.body}>
          <div className={st.filterRow}>
            {['all', 'watchlist'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`tf-btn ${st.filterBtn}`}
                style={{
                  border: `1px solid ${filter === f ? C.b : 'transparent'}`,
                  background: filter === f ? alpha(C.b, 0.08) : 'transparent',
                  color: filter === f ? C.b : C.t3,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {f === 'watchlist' ? (
                    <>
                      <Star size={12} /> My Watchlist
                    </>
                  ) : (
                    <>
                      <List size={12} /> All Earnings
                    </>
                  )}
                </span>
              </button>
            ))}
          </div>

          {earnings.length === 0 ? (
            <div className={st.empty} style={{ color: C.t3 }}>
              No earnings from your watchlist this week. Switch to "All" to see all upcoming reports.
            </div>
          ) : (
            <div className={st.dateGroup}>
              {[...byDate.entries()].map(([date, items]) => (
                <div key={date}>
                  <div className={st.dateHeader} style={{ color: C.t3 }}>
                    {formatEarningsDate(date)}
                    <span
                      className={st.dateBubble}
                      style={{ background: alpha(getHeatColor(items.length), 0.15), color: getHeatColor(items.length) }}
                    >
                      {items.length}
                    </span>
                  </div>
                  <div className={st.cardList}>
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

function EarningsCard({ data }) {
  const [expanded, setExpanded] = useState(false);
  const avgSurprise = data.surprise.reduce((s, v) => s + v, 0) / data.surprise.length;
  const avgReaction = data.reaction.reduce((s, v) => s + Math.abs(v), 0) / data.reaction.length;

  return (
    <div
      className={st.earningsCard}
      onClick={() => setExpanded(!expanded)}
      style={{ background: alpha(C.sf, 0.5), border: `1px solid ${alpha(C.bd, 0.5)}` }}
    >
      <div className={st.earningsMain}>
        <div className={st.symCol}>
          <div className={st.symName}>{data.symbol}</div>
          <div className={st.symSub} style={{ color: C.t3 }}>
            {data.name}
          </div>
        </div>
        <div className={st.timeBadge} style={{ color: C.t3, background: alpha(C.t3, 0.1) }}>
          {data.time}
        </div>
        <div className={st.metricCol}>
          <div className={st.metricLabel} style={{ color: C.t3 }}>
            Exp. Move
          </div>
          <div className={st.metricValue} style={{ color: C.y }}>
            {data.expectedMove}
          </div>
        </div>
        <div className={st.metricCol}>
          <div className={st.metricLabel} style={{ color: C.t3 }}>
            Est. EPS
          </div>
          <div className={st.metricValue} style={{ color: C.t1 }}>
            {data.consensusEPS}
          </div>
        </div>
        <div
          className={st.ivBox}
          style={{ background: alpha(data.ivRank > 70 ? C.r : data.ivRank > 40 ? C.y : C.g, 0.08) }}
        >
          <div className={st.ivLabel} style={{ color: C.t3 }}>
            IV Rank
          </div>
          <div className={st.ivValue} style={{ color: data.ivRank > 70 ? C.r : data.ivRank > 40 ? C.y : C.g }}>
            {data.ivRank}
          </div>
        </div>
        <span
          className={st.rowChevron}
          style={{ color: C.t3, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          ▾
        </span>
      </div>

      {expanded && (
        <div className={st.detail} style={{ borderTop: `1px solid ${C.bd}` }}>
          <div className={st.detailGrid}>
            <div>
              <div className={st.detailLabel} style={{ color: C.t3 }}>
                EPS Surprise % (Last 8 Quarters)
              </div>
              <div className={st.barChart}>
                {data.surprise.map((v, i) => (
                  <div
                    key={i}
                    className={st.bar}
                    style={{
                      height: `${Math.min(Math.abs(v) * 2, 40)}px`,
                      background: v >= 0 ? alpha(C.g, 0.6) : alpha(C.r, 0.6),
                    }}
                    title={`Q${8 - i}: ${v > 0 ? '+' : ''}${v}%`}
                  />
                ))}
              </div>
              <div className={st.avgText} style={{ color: C.t3 }}>
                Avg surprise:{' '}
                <span style={{ color: avgSurprise >= 0 ? C.g : C.r }}>
                  {avgSurprise > 0 ? '+' : ''}
                  {avgSurprise.toFixed(1)}%
                </span>
              </div>
            </div>
            <div>
              <div className={st.detailLabel} style={{ color: C.t3 }}>
                Post-Earnings Reaction (Last 8)
              </div>
              <div className={st.reactionChart}>
                {data.reaction.map((v, i) => (
                  <div
                    key={i}
                    className={st.bar}
                    style={{
                      height: `${Math.min(Math.abs(v) * 3, 40)}px`,
                      background: v >= 0 ? alpha(C.g, 0.6) : alpha(C.r, 0.6),
                      alignSelf: v >= 0 ? 'flex-end' : 'flex-start',
                    }}
                    title={`Q${8 - i}: ${v > 0 ? '+' : ''}${v}%`}
                  />
                ))}
              </div>
              <div className={st.avgText} style={{ color: C.t3 }}>
                Avg reaction: <span style={{ color: C.t2 }}>±{avgReaction.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
