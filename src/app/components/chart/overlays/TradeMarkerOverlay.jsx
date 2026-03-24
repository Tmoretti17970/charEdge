// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade Marker Overlay (Sprint 2: Chart↔Journal Link)
//
// Floating panel that appears when navigating from the journal to a
// specific trade on the chart. Shows trade details (side, P&L,
// entry/exit) and provides a link back to the journal.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import s from './TradeMarkerOverlay.module.css';

function TradeMarkerOverlay({ trade, onDismiss, onViewJournal }) {
  if (!trade) return null;

  const isWin = (trade.pnl || 0) > 0;
  const pnl = trade.pnl || 0;
  const pnlStr = `${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toFixed(2)}`;

  return (
    <div
      role="dialog"
      aria-label="Trade details overlay"
      className={s.overlay}
    >
      {/* Header: Symbol + Side Badge */}
      <div className={s.header}>
        <div className={s.headerLeft}>
          <span className={s.symbol}>
            {trade.symbol || 'Trade'}
          </span>
          <span className={s.sideBadge} data-side={trade.side || undefined}>
            {trade.side || '—'}
          </span>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss trade overlay"
          className={s.dismissBtn}
        >
          ✕
        </button>
      </div>

      {/* P&L Pill */}
      <div className={s.pnlPill} data-win={isWin}>
        <span className={s.pnlValue} data-win={isWin}>
          {pnlStr}
        </span>
      </div>

      {/* Entry / Exit Info */}
      <div className={s.levelsGrid}>
        {trade.entry != null && (
          <div className={s.levelCard}>
            <div className={s.levelLabel}>Entry</div>
            <div className={s.levelPrice}>${Number(trade.entry).toFixed(2)}</div>
          </div>
        )}
        {trade.exit != null && (
          <div className={s.levelCard}>
            <div className={s.levelLabel}>Exit</div>
            <div className={s.levelPrice}>${Number(trade.exit).toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* Date */}
      {trade.date && (
        <div className={s.tradeDate}>
          {new Date(trade.date).toLocaleString()}
        </div>
      )}

      {/* View in Journal Button */}
      <button
        onClick={() => onViewJournal?.(trade)}
        className={s.journalBtn}
      >
        📓 View in Journal
      </button>

    </div>
  );
}

export default React.memo(TradeMarkerOverlay);
