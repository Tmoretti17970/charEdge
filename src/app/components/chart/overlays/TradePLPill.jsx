// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade P/L Summary Pill
// Floating pill showing aggregate trade stats when trade markers visible.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
import { C, F } from '../../../../constants.js';

/**
 * Compute aggregate trade stats from an array of trades.
 */
export function computeTradeStats(trades) {
  if (!trades || !trades.length) return null;

  let totalPL = 0;
  let wins = 0;
  let losses = 0;
  let bestTrade = -Infinity;
  let worstTrade = Infinity;

  trades.forEach((t) => {
    const pl = t.pnl ?? t.pl ?? t.profit ?? 0;
    totalPL += pl;
    if (pl >= 0) wins++;
    else losses++;
    if (pl > bestTrade) bestTrade = pl;
    if (pl < worstTrade) worstTrade = pl;
  });

  return {
    count: trades.length,
    totalPL: Math.round(totalPL * 100) / 100,
    wins,
    losses,
    winRate: trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0,
    bestTrade: bestTrade === -Infinity ? 0 : Math.round(bestTrade * 100) / 100,
    worstTrade: worstTrade === Infinity ? 0 : Math.round(worstTrade * 100) / 100,
    avgPL: trades.length > 0 ? Math.round((totalPL / trades.length) * 100) / 100 : 0,
  };
}

export default function TradePLPill({ trades }) {
  const [expanded, setExpanded] = useState(false);

  const stats = useMemo(() => computeTradeStats(trades), [trades]);

  if (!stats || stats.count === 0) return null;

  const isPositive = stats.totalPL >= 0;
  const pillColor = isPositive ? '#26A69A' : '#EF5350';

  return (
    <div
      style={{
        position: 'absolute',
        top: 42,
        right: 12,
        zIndex: 80,
        fontFamily: F,
        userSelect: 'none',
      }}
    >
      {/* Pill */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 16,
          border: `1px solid ${pillColor}40`,
          background: `${pillColor}12`,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          color: pillColor,
          fontFamily: F,
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: `0 2px 8px ${pillColor}20`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.03)';
          e.currentTarget.style.boxShadow = `0 4px 12px ${pillColor}30`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = `0 2px 8px ${pillColor}20`;
        }}
      >
        <span style={{ fontSize: 12 }}>{isPositive ? '▲' : '▼'}</span>
        <span>{isPositive ? '+' : ''}{stats.totalPL.toLocaleString()}</span>
        <span style={{ opacity: 0.6, fontWeight: 500 }}>
          ({stats.count} trade{stats.count !== 1 ? 's' : ''})
        </span>
        <span style={{
          fontSize: 8, color: C.t3, transition: 'transform 0.15s',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>▼</span>
      </button>

      {/* Expanded breakdown */}
      {expanded && (
        <div
          className="tf-fade-in"
          style={{
            marginTop: 6,
            padding: 12,
            background: `${C.sf2}F5`,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid ${C.bd}`,
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            minWidth: 180,
            animation: 'tfDropdownIn 0.15s ease-out',
          }}
        >
          <div style={{
            fontSize: 9, fontWeight: 700, color: C.t3,
            letterSpacing: '0.5px', marginBottom: 8,
          }}>
            TRADE SUMMARY
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <StatItem label="Win Rate" value={`${stats.winRate}%`} color={stats.winRate >= 50 ? '#26A69A' : '#EF5350'} />
            <StatItem label="Avg P/L" value={stats.avgPL >= 0 ? `+${stats.avgPL}` : stats.avgPL} color={stats.avgPL >= 0 ? '#26A69A' : '#EF5350'} />
            <StatItem label="Wins" value={stats.wins} color="#26A69A" />
            <StatItem label="Losses" value={stats.losses} color="#EF5350" />
            <StatItem label="Best" value={stats.bestTrade >= 0 ? `+${stats.bestTrade}` : stats.bestTrade} color="#26A69A" />
            <StatItem label="Worst" value={stats.worstTrade >= 0 ? `+${stats.worstTrade}` : stats.worstTrade} color="#EF5350" />
          </div>
        </div>
      )}
    </div>
  );
}

function StatItem({ label, value, color }) {
  return (
    <div style={{
      padding: '4px 6px',
      borderRadius: 6,
      background: `${color}08`,
    }}>
      <div style={{ fontSize: 9, color: C.t3, marginBottom: 1, fontFamily: F }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color, fontFamily: F }}>{value}</div>
    </div>
  );
}
