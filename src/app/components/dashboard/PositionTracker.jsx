// ═══════════════════════════════════════════════════════════════════
// charEdge — Position Tracker Widget (Phase 8 Sprint 8.11)
//
// Dashboard widget showing real-time open positions with
// unrealized P&L, color-coded indicators, and expand-to-detail.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
import { C, F, M, GLASS } from '../../../constants.js';
import { getOpenPositions, updateWithPrices, computeExposure } from '../../../data/PositionEngine.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { Card } from '../ui/UIKit.jsx';
import { alpha } from '@/shared/colorUtils';

function PositionRow({ position, expanded, onToggle }) {
  const pnlColor = position.unrealizedPnl > 0 ? C.g : position.unrealizedPnl < 0 ? C.r : C.t3;
  const dirIcon = position.direction === 'long' ? '↑' : '↓';

  return (
    <div>
      <div
        onClick={onToggle}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 50px 60px 70px 70px 80px',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: `1px solid ${alpha(C.bd, 0.15)}`,
          cursor: 'pointer',
          transition: 'background 0.1s',
          fontSize: 11,
          fontFamily: M,
        }}
      >
        {/* Symbol */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: position.direction === 'long' ? C.g : C.r, fontWeight: 700, fontSize: 10 }}>
            {dirIcon}
          </span>
          <span style={{ fontWeight: 700, color: C.t1, fontFamily: F }}>{position.symbol}</span>
        </div>

        {/* Side */}
        <span
          style={{
            fontSize: 8,
            fontWeight: 700,
            color: position.direction === 'long' ? C.g : C.r,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {position.direction}
        </span>

        {/* Size */}
        <span style={{ color: C.t2, textAlign: 'right' }}>
          {Math.abs(position.size).toFixed(position.size < 10 ? 4 : 2)}
        </span>

        {/* Avg Entry */}
        <span style={{ color: C.t2, textAlign: 'right' }}>${position.avgEntry.toFixed(2)}</span>

        {/* Current */}
        <span style={{ color: C.t1, textAlign: 'right', fontWeight: 600 }}>
          {position.currentPrice > 0 ? `$${position.currentPrice.toFixed(2)}` : '—'}
        </span>

        {/* Unrealized P&L */}
        <span style={{ color: pnlColor, textAlign: 'right', fontWeight: 700 }}>
          {position.unrealizedPnl >= 0 ? '+' : ''}
          {position.unrealizedPnl.toFixed(2)}
        </span>
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div
          style={{
            padding: '8px 12px 10px',
            background: alpha(C.sf, 0.3),
            borderBottom: `1px solid ${alpha(C.bd, 0.15)}`,
          }}
        >
          <div style={{ display: 'flex', gap: 16, fontSize: 10, color: C.t3, fontFamily: M }}>
            <span>
              Cost Basis: <strong style={{ color: C.t2 }}>${position.costBasis?.toFixed(2) || '—'}</strong>
            </span>
            <span>
              Realized P&L:{' '}
              <strong style={{ color: position.realizedPnl >= 0 ? C.g : C.r }}>
                ${position.realizedPnl?.toFixed(2) || '0.00'}
              </strong>
            </span>
            <span>
              Fills: <strong style={{ color: C.t2 }}>{position.fills?.length || 0}</strong>
            </span>
          </div>
          {position.fills && position.fills.length > 0 && (
            <div style={{ marginTop: 6, maxHeight: 100, overflowY: 'auto' }}>
              {position.fills.slice(-5).map((fill, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 9,
                    color: C.t3,
                    padding: '2px 0',
                    fontFamily: M,
                  }}
                >
                  <span>{new Date(fill.date).toLocaleDateString()}</span>
                  <span style={{ color: fill.side === 'buy' || fill.side === 'long' ? C.g : C.r, fontWeight: 600 }}>
                    {fill.side?.toUpperCase()} {fill.quantity}
                  </span>
                  <span>${fill.price?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PositionTracker() {
  const trades = useJournalStore((s) => s.trades);
  const [expandedSymbol, setExpandedSymbol] = useState(null);

  const positions = useMemo(() => {
    const open = getOpenPositions(trades);
    // TODO: Subscribe to WebSocket for real-time prices
    return updateWithPrices(open, {});
  }, [trades]);

  const exposure = useMemo(() => computeExposure(positions), [positions]);

  if (positions.length === 0) {
    return (
      <Card style={{ padding: 16, textAlign: 'center', background: GLASS.subtle }}>
        <div style={{ fontSize: 24, marginBottom: 6 }}>📊</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.t2, fontFamily: F }}>No Open Positions</div>
        <div style={{ fontSize: 10, color: C.t3, marginTop: 2, fontFamily: F }}>
          Your realized positions will appear here
        </div>
      </Card>
    );
  }

  const totalUnrealized = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: F, margin: 0 }}>📊 Open Positions</h2>
        <div style={{ fontSize: 10, fontFamily: M, color: C.t3 }}>
          {positions.length} position{positions.length > 1 ? 's' : ''}
        </div>
      </div>

      <Card style={{ overflow: 'hidden', background: GLASS.subtle }}>
        {/* Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 50px 60px 70px 70px 80px',
            padding: '6px 12px',
            fontSize: 9,
            fontWeight: 700,
            color: C.t3,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            fontFamily: F,
            borderBottom: `1px solid ${alpha(C.bd, 0.2)}`,
          }}
        >
          <span>Symbol</span>
          <span>Side</span>
          <span style={{ textAlign: 'right' }}>Size</span>
          <span style={{ textAlign: 'right' }}>Avg Entry</span>
          <span style={{ textAlign: 'right' }}>Current</span>
          <span style={{ textAlign: 'right' }}>Unreal. P&L</span>
        </div>

        {/* Rows */}
        {positions.map((pos) => (
          <PositionRow
            key={pos.symbol}
            position={pos}
            expanded={expandedSymbol === pos.symbol}
            onToggle={() => setExpandedSymbol(expandedSymbol === pos.symbol ? null : pos.symbol)}
          />
        ))}

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 12px',
            fontSize: 10,
            fontFamily: M,
            borderTop: `1px solid ${alpha(C.bd, 0.2)}`,
          }}
        >
          <span style={{ color: C.t3 }}>
            Net Exposure: <strong style={{ color: C.t2 }}>${exposure.netExposure.toFixed(0)}</strong>
          </span>
          <span style={{ color: totalUnrealized >= 0 ? C.g : C.r, fontWeight: 700 }}>
            Total: {totalUnrealized >= 0 ? '+' : ''}
            {totalUnrealized.toFixed(2)}
          </span>
        </div>
      </Card>
    </div>
  );
}

export default React.memo(PositionTracker);
