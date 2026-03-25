// ═══════════════════════════════════════════════════════════════════
// charEdge — Alert History Panel (Phase C3)
//
// Shows past triggered alerts with outcome badges (+5m, +15m, +1h).
// Includes filters by symbol, win/loss, and a summary row.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
import { useAlertStore } from '../../../state/useAlertStore';
import st from './AlertHistoryPanel.module.css';

function OutcomeBadge({ value, label }) {
  if (value == null) return <span className={st.outcomeNull}>{label}: —</span>;
  const isGreen = value >= 0;
  return (
    <span
      className={st.outcomeBadge}
      style={{
        color: isGreen ? '#26A69A' : '#EF5350',
        background: (isGreen ? '#26A69A' : '#EF5350') + '15',
      }}
    >
      {label}: {isGreen ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  );
}

function AlertHistoryPanel() {
  const entries = useAlertStore((s) => s.historyEntries);
  const clearHistory = useAlertStore((s) => s.clearHistory);
  const [symbolFilter, setSymbolFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('all');

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

  const stats = useMemo(() => {
    const withOutcome = entries.filter((e) => e.outcome15m != null);
    if (withOutcome.length === 0) return null;
    const wins = withOutcome.filter((e) => (e.outcome15m || 0) > 0).length;
    const avg = withOutcome.reduce((sum, e) => sum + (e.outcome15m || 0), 0) / withOutcome.length;
    return {
      total: withOutcome.length,
      winRate: ((wins / withOutcome.length) * 100).toFixed(0),
      avgOutcome: avg.toFixed(2),
    };
  }, [entries]);

  return (
    <div className={st.root}>
      <div className={st.header}>
        <span className={st.title}>📊 Alert History</span>
        <div className={st.headerRight}>
          <span className={st.entryCount}>{entries.length} entries</span>
          <button onClick={clearHistory} className={st.clearBtn}>
            Clear
          </button>
        </div>
      </div>

      <div className={st.filterRow}>
        <input
          value={symbolFilter}
          onChange={(e) => setSymbolFilter(e.target.value)}
          placeholder="Filter symbol..."
          className={`${st.input} ${st.filterInput}`}
        />
        <select
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value)}
          className={`${st.input} ${st.filterSelect}`}
        >
          <option value="all">All</option>
          <option value="winners">Winners</option>
          <option value="losers">Losers</option>
        </select>
      </div>

      {stats && (
        <div className={st.summary}>
          <span>
            Win Rate: <b className={st.summaryBold}>{stats.winRate}%</b>
          </span>
          <span>
            Avg: <b style={{ color: parseFloat(stats.avgOutcome) >= 0 ? '#26A69A' : '#EF5350' }}>{stats.avgOutcome}%</b>
          </span>
          <span>N={stats.total}</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className={st.empty}>
          <div className={st.emptyIcon}>📊</div>
          <div>No alert history yet</div>
          <div className={st.emptyHint}>Triggered alerts will appear here with outcome tracking.</div>
        </div>
      ) : (
        filtered.map((entry) => (
          <div
            key={entry.id}
            className={st.entryCard}
            style={{ '--entry-color': (entry.outcome15m || 0) >= 0 ? '#26A69A' : '#EF5350' }}
          >
            <div className={st.entryHeader}>
              <div className={st.entryLeft}>
                <span className={st.entrySymbol}>{entry.symbol}</span>
                <span className={st.entryCond}>{entry.condition.replace('_', ' ')}</span>
              </div>
              <span className={st.entryTime}>
                {new Date(entry.triggeredAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className={st.outcomeRow}>
              <span className={st.entryPrice}>@${entry.triggerPrice.toFixed(2)}</span>
              <span className={st.entryArrow}>→</span>
              <OutcomeBadge value={entry.outcome5m} label="+5m" />
              <OutcomeBadge value={entry.outcome15m} label="+15m" />
              <OutcomeBadge value={entry.outcome1h} label="+1h" />
            </div>
            {entry.note && <div className={st.entryNote}>{entry.note}</div>}
          </div>
        ))
      )}
    </div>
  );
}

export { AlertHistoryPanel };
export default React.memo(AlertHistoryPanel);
