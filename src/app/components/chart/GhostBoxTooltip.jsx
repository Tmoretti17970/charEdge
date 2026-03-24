// ═══════════════════════════════════════════════════════════════════
// charEdge — Ghost Box Tooltip (Task 4.8.2)
//
// Hover tooltip showing trade details when cursor is over a Ghost Box.
// Glass-panel styling, positioned near cursor.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import s from './GhostBoxTooltip.module.css';

function GhostBoxTooltip({ trade, x, y }) {
    if (!trade) return null;

    const pnl = trade.pnl ?? 0;
    const isWin = pnl > 0;
    const pnlColor = isWin ? 'var(--tf-green)' : pnl < 0 ? 'var(--tf-red)' : 'var(--tf-t3)';
    const pnlSign = pnl >= 0 ? '+' : '';

    return (
        <div className={s.tooltip} style={{ left: x + 16, top: y - 10 }}>
            <div className={s.pnlRow}>
                <span className={s.pnlValue} style={{ color: pnlColor }}>
                    {pnlSign}${Math.abs(pnl).toFixed(2)}
                </span>
                {trade.rMultiple != null && (
                    <span className={s.rBadge} data-win={isWin}>
                        {trade.rMultiple >= 0 ? '+' : ''}{trade.rMultiple.toFixed(1)}R
                    </span>
                )}
            </div>
            <div className={s.sideRow}>
                <span className={s.sideLabel} data-side={trade.side || 'long'}>{trade.side || 'long'}</span>
                {trade.setup && <span className={s.setupLabel}>{trade.setup}</span>}
            </div>
            <div className={s.label}>Entry / Exit</div>
            <div className={s.priceValue}>{trade.entryPrice?.toFixed(2)} → {trade.exitPrice?.toFixed(2)}</div>
            {trade.emotion && (<><div className={s.label}>Emotion</div><div className={s.value}>{trade.emotion}</div></>)}
            {trade.notes && (<><div className={s.label}>Notes</div><div className={s.noteValue}>{trade.notes.length > 80 ? trade.notes.slice(0, 80) + '…' : trade.notes}</div></>)}
            {trade.tags && trade.tags.length > 0 && (
                <div className={s.tagsRow}>
                    {trade.tags.slice(0, 5).map((tag) => <span key={tag} className={s.tag}>{tag}</span>)}
                </div>
            )}
        </div>
    );
}

export default React.memo(GhostBoxTooltip);
