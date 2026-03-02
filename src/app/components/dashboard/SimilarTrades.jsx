// ═══════════════════════════════════════════════════════════════════
// charEdge — Similar Trades Suggestion Engine
//
// When viewing or adding a trade, this component finds historically
// similar trades by matching on symbol, side, time-of-day, and
// playbook, then displays average outcome and win rate to help
// the trader make informed decisions.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { C, F, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore.js';

/**
 * Find trades similar to the target criteria.
 * Similarity is scored by: exact symbol match, same side, same
 * playbook, and same time-of-day bucket.
 */
function findSimilar(trades, criteria, maxResults = 5) {
  const { symbol, side, playbook, date } = criteria;
  if (!symbol && !side) return [];

  const targetHour = date ? new Date(date).getHours() : null;
  const timeBucket = targetHour !== null
    ? (targetHour < 10 ? 'pre-market' : targetHour < 12 ? 'morning' : targetHour < 15 ? 'afternoon' : 'close')
    : null;

  const scored = [];

  for (const t of trades) {
    // Skip the target trade itself (by id if available)
    if (criteria.id && t.id === criteria.id) continue;

    let score = 0;

    // Symbol match (strongest signal)
    if (symbol && t.symbol?.toUpperCase() === symbol.toUpperCase()) score += 4;

    // Side match
    if (side && t.side === side) score += 2;

    // Playbook match
    if (playbook && t.playbook === playbook) score += 3;

    // Time-of-day match
    if (timeBucket && t.date) {
      const h = new Date(t.date).getHours();
      const tBucket = h < 10 ? 'pre-market' : h < 12 ? 'morning' : h < 15 ? 'afternoon' : 'close';
      if (tBucket === timeBucket) score += 1;
    }

    if (score >= 3) {
      scored.push({ trade: t, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}

/**
 * Compute aggregate stats from similar trades.
 */
function aggregateStats(matches) {
  if (!matches.length) return null;
  let total = 0, wins = 0, count = matches.length;
  for (const m of matches) {
    const pnl = m.trade.pnl || 0;
    total += pnl;
    if (pnl > 0) wins++;
  }
  return {
    avgPnl: total / count,
    winRate: (wins / count) * 100,
    totalPnl: total,
    count,
    wins,
    losses: count - wins,
  };
}

/**
 * SimilarTrades — Displays historically similar trades.
 *
 * @param {Object} props
 * @param {Object} props.criteria - { symbol, side, playbook, date, id }
 * @param {boolean} [props.compact] - Compact mode for inline widgets
 */
export default function SimilarTrades({ criteria, compact = false }) {
  const allTrades = useJournalStore((s) => s.trades);
  const [showAll, setShowAll] = useState(false);

  const { matches, stats } = useMemo(() => {
    if (!criteria) return { matches: [], stats: null };
    const m = findSimilar(allTrades, criteria, showAll ? 20 : 5);
    const s = aggregateStats(m);
    return { matches: m, stats: s };
  }, [allTrades, criteria, showAll]);

  if (!criteria || !stats || stats.count < 2) return null;

  const pnlColor = stats.avgPnl >= 0 ? C.g : C.r;

  if (compact) {
    return (
      <div
        style={{
          padding: '10px 14px',
          borderRadius: 10,
          background: C.sf2,
          border: `1px solid ${C.bd}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span style={{ fontSize: 16 }}>🔍</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, fontFamily: F, color: C.t2 }}>
            {stats.count} similar trades found
          </div>
          <div style={{ fontSize: 10, fontFamily: M, color: C.t3 }}>
            <span style={{ color: pnlColor, fontWeight: 600 }}>
              Avg: {stats.avgPnl >= 0 ? '+' : ''}${stats.avgPnl.toFixed(2)}
            </span>
            {' · '}
            <span>{stats.winRate.toFixed(0)}% win rate</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: 12,
        background: C.sf,
        border: `1px solid ${C.bd}`,
        overflow: 'hidden',
        marginBottom: 16,
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${C.bd}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🔍</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: F, color: C.t1 }}>
              Similar Trades
            </div>
            <div style={{ fontSize: 10, fontFamily: M, color: C.t3 }}>
              {stats.count} matches · {criteria.symbol?.toUpperCase()} {criteria.side}
            </div>
          </div>
        </div>

        {/* Aggregate badge */}
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          padding: '4px 10px', borderRadius: 8,
          background: pnlColor + '10',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: M, color: pnlColor }}>
            {stats.avgPnl >= 0 ? '+' : ''}${stats.avgPnl.toFixed(2)}
          </span>
          <span style={{ fontSize: 10, fontFamily: M, color: C.t3 }}>avg</span>
          <span style={{ fontSize: 10, fontFamily: M, color: C.t3 }}>·</span>
          <span style={{ fontSize: 10, fontFamily: M, color: stats.winRate >= 55 ? C.g : stats.winRate < 45 ? C.r : C.t2 }}>
            {stats.winRate.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Trade list */}
      <div style={{ padding: '4px 0' }}>
        {matches.map((m, i) => {
          const t = m.trade;
          const pnl = t.pnl || 0;
          return (
            <div
              key={t.id || i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 16px',
                borderBottom: i < matches.length - 1 ? `1px solid ${C.bd}30` : 'none',
                fontSize: 11,
                fontFamily: M,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  color: t.side === 'long' ? C.g : C.r,
                  textTransform: 'uppercase',
                  minWidth: 36,
                }}>
                  {t.side}
                </span>
                <span style={{ fontWeight: 600, color: C.t1 }}>{t.symbol}</span>
                <span style={{ color: C.t3 }}>
                  {t.date ? new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                </span>
                {t.playbook && (
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 4,
                    background: C.b + '12', color: C.b,
                  }}>
                    {t.playbook}
                  </span>
                )}
              </div>
              <span style={{
                fontWeight: 700,
                color: pnl >= 0 ? C.g : C.r,
              }}>
                {pnl >= 0 ? '+' : ''}${Math.abs(pnl).toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Show more */}
      {stats.count >= 5 && (
        <div
          onClick={() => setShowAll((v) => !v)}
          style={{
            padding: '8px 16px',
            borderTop: `1px solid ${C.bd}`,
            fontSize: 11, fontWeight: 600, fontFamily: F,
            color: C.b, cursor: 'pointer', textAlign: 'center',
          }}
        >
          {showAll ? 'Show less' : `View all similar trades →`}
        </div>
      )}
    </div>
  );
}

export { findSimilar, aggregateStats };
