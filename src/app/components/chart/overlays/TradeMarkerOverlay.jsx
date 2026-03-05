// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade Marker Overlay (Sprint 2: Chart↔Journal Link)
//
// Floating panel that appears when navigating from the journal to a
// specific trade on the chart. Shows trade details (side, P&L,
// entry/exit) and provides a link back to the journal.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, F, M } from '../../../../constants.js';

const SIDE_COLORS = { long: '#26A69A', short: '#EF5350' };

export default function TradeMarkerOverlay({ trade, onDismiss, onViewJournal }) {
  if (!trade) return null;

  const isWin = (trade.pnl || 0) > 0;
  const sideColor = SIDE_COLORS[trade.side] || C.t3;
  const pnlColor = isWin ? '#10B981' : '#EF4444';
  const pnl = trade.pnl || 0;
  const pnlStr = `${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toFixed(2)}`;

  return (
    <div
      role="dialog"
      aria-label="Trade details overlay"
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 50,
        background: `${C.bg2 || '#111827'}e6`,
        backdropFilter: 'blur(12px)',
        border: `1px solid ${C.bd || '#1F2937'}`,
        borderRadius: 12,
        padding: '14px 16px',
        minWidth: 220,
        maxWidth: 280,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'scaleInSm 0.25s ease-out',
        fontFamily: F,
      }}
    >
      {/* Header: Symbol + Side Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.t1 || '#F9FAFB' }}>
            {trade.symbol || 'Trade'}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: '#fff',
              background: sideColor,
              padding: '2px 6px',
              borderRadius: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {trade.side || '—'}
          </span>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss trade overlay"
          style={{
            background: 'none',
            border: 'none',
            color: C.t3 || '#9CA3AF',
            cursor: 'pointer',
            fontSize: 16,
            padding: '0 2px',
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* P&L Pill */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: `${pnlColor}18`,
          border: `1px solid ${pnlColor}40`,
          borderRadius: 8,
          padding: '5px 10px',
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 800, color: pnlColor, fontFamily: M, fontVariantNumeric: 'tabular-nums' }}>
          {pnlStr}
        </span>
      </div>

      {/* Entry / Exit Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        {trade.entry != null && (
          <div style={{ background: `${C.bd || '#1F2937'}30`, borderRadius: 6, padding: '5px 8px' }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: C.t3 || '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Entry
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 || '#F9FAFB', fontFamily: M }}>
              ${Number(trade.entry).toFixed(2)}
            </div>
          </div>
        )}
        {trade.exit != null && (
          <div style={{ background: `${C.bd || '#1F2937'}30`, borderRadius: 6, padding: '5px 8px' }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: C.t3 || '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Exit
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 || '#F9FAFB', fontFamily: M }}>
              ${Number(trade.exit).toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Date */}
      {trade.date && (
        <div style={{ fontSize: 10, color: C.t3 || '#9CA3AF', marginBottom: 10, fontFamily: M }}>
          {new Date(trade.date).toLocaleString()}
        </div>
      )}

      {/* View in Journal Button */}
      <button
        onClick={() => onViewJournal?.(trade)}
        className="tf-btn"
        style={{
          width: '100%',
          padding: '7px 0',
          background: `${C.b || '#00D4AA'}20`,
          border: `1px solid ${C.b || '#00D4AA'}40`,
          borderRadius: 6,
          color: C.b || '#00D4AA',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: F,
          transition: 'all 0.15s',
        }}
      >
        📓 View in Journal
      </button>

    </div>
  );
}
