// ═══════════════════════════════════════════════════════════════════
// charEdge — Ghost Box Tooltip (Task 4.8.2)
//
// Hover tooltip showing trade details when cursor is over a Ghost Box.
// Glass-panel styling, positioned near cursor.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, F, M } from '../../../constants.js';

/**
 * @param {Object} props
 * @param {Object} props.trade - Trade data from GhostBoxRenderer.hitTest()
 * @param {number} props.x - Cursor X position
 * @param {number} props.y - Cursor Y position
 */
function GhostBoxTooltip({ trade, x, y }) {
    if (!trade) return null;

    const pnl = trade.pnl ?? 0;
    const isWin = pnl > 0;
    const pnlColor = isWin ? '#22c55e' : pnl < 0 ? '#ef4444' : C.t3;
    const pnlSign = pnl >= 0 ? '+' : '';

    // Position tooltip avoiding edge overflow
    const tooltipStyle = {
        position: 'fixed',
        left: x + 16,
        top: y - 10,
        minWidth: 200,
        maxWidth: 280,
        zIndex: 10000,
        background: 'rgba(15, 15, 20, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
        pointerEvents: 'none',
        animation: 'scaleInSm 0.15s ease-out',
        fontFamily: F,
    };

    const labelStyle = {
        fontSize: 10,
        color: C.t3,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginTop: 6,
    };

    const valueStyle = {
        fontSize: 13,
        color: C.t1,
        fontWeight: 500,
    };

    return (
        <div style={tooltipStyle}>
            {/* P&L Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: pnlColor, fontFamily: M }}>
                    {pnlSign}${Math.abs(pnl).toFixed(2)}
                </span>
                {trade.rMultiple != null && (
                    <span style={{
                        fontSize: 11,
                        color: isWin ? '#22c55e' : '#ef4444',
                        background: isWin ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontWeight: 600,
                        fontFamily: M,
                    }}>
                        {trade.rMultiple >= 0 ? '+' : ''}{trade.rMultiple.toFixed(1)}R
                    </span>
                )}
            </div>

            {/* Side & Setup */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: trade.side === 'short' ? '#ef4444' : '#22c55e',
                    textTransform: 'uppercase',
                }}>
                    {trade.side || 'long'}
                </span>
                {trade.setup && (
                    <span style={{ fontSize: 11, color: C.t2 }}>
                        {trade.setup}
                    </span>
                )}
            </div>

            {/* Prices */}
            <div style={labelStyle}>Entry / Exit</div>
            <div style={{ ...valueStyle, fontFamily: M }}>
                {trade.entryPrice?.toFixed(2)} → {trade.exitPrice?.toFixed(2)}
            </div>

            {/* Emotion */}
            {trade.emotion && (
                <>
                    <div style={labelStyle}>Emotion</div>
                    <div style={valueStyle}>{trade.emotion}</div>
                </>
            )}

            {/* Notes (truncated) */}
            {trade.notes && (
                <>
                    <div style={labelStyle}>Notes</div>
                    <div style={{ ...valueStyle, fontSize: 11, opacity: 0.8 }}>
                        {trade.notes.length > 80 ? trade.notes.slice(0, 80) + '…' : trade.notes}
                    </div>
                </>
            )}

            {/* Tags */}
            {trade.tags && trade.tags.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                    {trade.tags.slice(0, 5).map((tag) => (
                        <span
                            key={tag}
                            style={{
                                fontSize: 9,
                                color: C.t2,
                                background: 'rgba(255, 255, 255, 0.06)',
                                padding: '1px 6px',
                                borderRadius: 3,
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                            }}
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

export default React.memo(GhostBoxTooltip);
