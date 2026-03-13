// ═══════════════════════════════════════════════════════════════════
// charEdge — Alert History Panel (Phase C3)
//
// Shows past triggered alerts with outcome badges (+5m, +15m, +1h).
// Includes filters by symbol, win/loss, and a summary row.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { useAlertHistory } from '../../../state/useAlertHistory';

function OutcomeBadge({ value, label }) {
  if (value == null) return <span style={{ fontSize: 8, color: C.t3 + '50', fontFamily: M }}>{label}: —</span>;
  const isGreen = value >= 0;
  return (
    <span
      style={{
        fontSize: 8,
        fontFamily: M,
        fontWeight: 700,
        color: isGreen ? '#26A69A' : '#EF5350',
        background: (isGreen ? '#26A69A' : '#EF5350') + '15',
        padding: '1px 4px',
        borderRadius: 3,
      }}
    >
      {label}: {isGreen ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

function AlertHistoryPanel() {
  const entries = useAlertHistory((s) => s.entries);
  const clearHistory = useAlertHistory((s) => s.clear);
  const [symbolFilter, setSymbolFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('all'); // 'all' | 'winners' | 'losers'

  const filtered = useMemo(() => {
    let list = entries;
    if (symbolFilter) {
      list = list.filter((e) => e.symbol.toUpperCase().includes(symbolFilter.toUpperCase()));
    }
    if (outcomeFilter === 'winners') {
      list = list.filter((e) => (e.outcome5m || e.outcome15m || e.outcome1h || 0) > 0);
    } else if (outcomeFilter === 'losers') {
      list = list.filter((e) => (e.outcome5m || e.outcome15m || e.outcome1h || 0) < 0);
    }
    return list;
  }, [entries, symbolFilter, outcomeFilter]);

  // Summary stats
  const stats = useMemo(() => {
    const withOutcome = entries.filter((e) => e.outcome15m != null);
    if (withOutcome.length === 0) return null;
    const wins = withOutcome.filter((e) => (e.outcome15m || 0) > 0).length;
    const avg = withOutcome.reduce((sum, e) => sum + (e.outcome15m || 0), 0) / withOutcome.length;
    return { total: withOutcome.length, winRate: (wins / withOutcome.length * 100).toFixed(0), avgOutcome: avg.toFixed(2) };
  }, [entries]);

  const inputStyle = {
    background: C.sf,
    border: `1px solid ${C.bd}`,
    color: C.t1,
    borderRadius: 4,
    padding: '3px 6px',
    fontFamily: M,
    fontSize: 10,
    outline: 'none',
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 12, fontFamily: F, background: C.bg, color: C.t2 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>📊 Alert History</span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>{entries.length} entries</span>
          <button
            onClick={clearHistory}
            style={{ background: 'none', border: 'none', color: C.t3, fontSize: 10, cursor: 'pointer', padding: '2px 4px' }}
          >Clear</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <input
          value={symbolFilter}
          onChange={(e) => setSymbolFilter(e.target.value)}
          placeholder="Filter symbol..."
          style={{ ...inputStyle, flex: 1 }}
        />
        <select
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
        >
          <option value="all">All</option>
          <option value="winners">Winners</option>
          <option value="losers">Losers</option>
        </select>
      </div>

      {/* Summary */}
      {stats && (
        <div style={{
          display: 'flex', gap: 12, padding: '6px 8px', background: C.sf, borderRadius: 6,
          marginBottom: 10, fontSize: 10, fontFamily: M, color: C.t2, justifyContent: 'center',
        }}>
          <span>Win Rate: <b style={{ color: C.t1 }}>{stats.winRate}%</b></span>
          <span>Avg: <b style={{ color: parseFloat(stats.avgOutcome) >= 0 ? '#26A69A' : '#EF5350' }}>{stats.avgOutcome}%</b></span>
          <span>N={stats.total}</span>
        </div>
      )}

      {/* Entries */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 12px', color: C.t3, fontSize: 12 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
          <div>No alert history yet</div>
          <div style={{ fontSize: 10, marginTop: 4, lineHeight: 1.5 }}>
            Triggered alerts will appear here with outcome tracking.
          </div>
        </div>
      ) : (
        filtered.map((entry) => (
          <div
            key={entry.id}
            style={{
              padding: '6px 8px', background: C.sf, borderRadius: 6, marginBottom: 3,
              borderLeft: `3px solid ${(entry.outcome15m || 0) >= 0 ? '#26A69A' : '#EF5350'}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontFamily: M, fontWeight: 700, fontSize: 12, color: C.t1 }}>{entry.symbol}</span>
                <span style={{ fontSize: 9, color: C.t3 }}>{entry.condition.replace('_', ' ')}</span>
              </div>
              <span style={{ fontSize: 8, color: C.t3, fontFamily: M }}>
                {new Date(entry.triggeredAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 3, alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontFamily: M, color: C.b }}>
                @${entry.triggerPrice.toFixed(2)}
              </span>
              <span style={{ fontSize: 8, color: C.t3 }}>→</span>
              <OutcomeBadge value={entry.outcome5m} label="+5m" />
              <OutcomeBadge value={entry.outcome15m} label="+15m" />
              <OutcomeBadge value={entry.outcome1h} label="+1h" />
            </div>
            {entry.note && (
              <div style={{ fontSize: 8, color: C.t3, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.note}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export { AlertHistoryPanel };
export default React.memo(AlertHistoryPanel);
