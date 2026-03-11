// ═══════════════════════════════════════════════════════════════════
// charEdge — HUD Bar (Heads-Up Display)
//
// Always-visible at dashboard top: Account Equity, Open Risk %, Market Bias.
// Uses backdrop-filter: blur(16px) for frosted glass effect.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useRef, useState, useEffect } from 'react';
import { C, M, GLASS } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { useUserStore } from '../../../state/useUserStore';
import { fmtD } from '../../../utils.js';

// ─── Risk level logic ────────────────────────────────────────────

function computeRiskLevel(trades, dailyLossLimit) {
    if (!trades.length) return { level: 'LOW', color: C.g };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTrades = trades.filter((t) => t.date && new Date(t.date) >= today);
    const todayPnl = todayTrades.reduce((s, t) => s + (t.pnl || 0), 0);
    const limitUsed = dailyLossLimit > 0
        ? Math.min(100, Math.round(Math.abs(Math.min(0, todayPnl)) / dailyLossLimit * 100))
        : 0;
    if (limitUsed >= 75) return { level: 'HIGH', color: C.r };
    if (limitUsed >= 40) return { level: 'MED', color: C.y };
    return { level: 'LOW', color: C.g };
}

function computeBias(trades) {
    if (!trades.length) return { label: 'Neutral', color: C.t3 };
    const recent = trades.slice(-10);
    const longs = recent.filter((t) => t.side === 'long').length;
    const shorts = recent.filter((t) => t.side === 'short').length;
    if (longs > shorts + 2) return { label: '↑ Bullish', color: C.g };
    if (shorts > longs + 2) return { label: '↓ Bearish', color: C.r };
    return { label: '→ Neutral', color: C.t3 };
}

// ─── Component ───────────────────────────────────────────────────

export default function HUDBar() {
    const trades = useJournalStore((s) => s.trades);
    const accountSize = useUserStore((s) => s.accountSize) || 0;
    const dailyLossLimit = useUserStore((s) => s.dailyLossLimit) || 0;

    const metrics = useMemo(() => {
        const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0);
        const equity = accountSize > 0 ? accountSize + totalPnl : totalPnl;
        const risk = computeRiskLevel(trades, dailyLossLimit);
        const bias = computeBias(trades);
        return { equity, totalPnl, risk, bias };
    }, [trades, accountSize, dailyLossLimit]);

    return (
        <div
            style={{
                position: 'sticky',
                top: 0,
                zIndex: 'var(--tf-z-sidebar)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 20,
                padding: '6px 16px',
                marginBottom: 12,
                background: GLASS.subtle,
                backdropFilter: GLASS.blurMd,
                WebkitBackdropFilter: GLASS.blurMd,
                borderBottom: GLASS.border,
                borderRadius: '0 0 10px 10px',
                fontFamily: M,
                fontSize: 11,
                transition: 'all 0.3s ease',
            }}
        >
            {/* Account Equity */}
            <HudItem
                label="Equity"
                value={accountSize > 0 ? fmtD(metrics.equity) : fmtD(metrics.totalPnl)}
                color={metrics.totalPnl >= 0 ? C.g : C.r}
                prevValueRef="equity"
                currentValue={metrics.equity}
            />

            {/* Divider */}
            <div style={{ width: 1, height: 16, background: C.bd + '30' }} />

            {/* Open Risk */}
            <HudItem label="Risk" value={metrics.risk.level} color={metrics.risk.color} />

            {/* Divider */}
            <div style={{ width: 1, height: 16, background: C.bd + '30' }} />

            {/* Market Bias */}
            <HudItem label="Bias" value={metrics.bias.label} color={metrics.bias.color} />
        </div>
    );
}

// ─── Sub-Component (Trend Arrows) ────────────────────────────────

function HudItem({ label, value, color, currentValue, _prevValueRef }) {
    const prev = useRef(currentValue);
    const [trend, setTrend] = useState(null);

    useEffect(() => {
        if (currentValue != null && prev.current != null) {
            if (currentValue > prev.current) setTrend('▲');
            else if (currentValue < prev.current) setTrend('▼');
            else setTrend(null);
        }
        prev.current = currentValue;
    }, [currentValue]);

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: C.t3, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {label}
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
                {value}
            </span>
            {/* Trend Arrow */}
            {trend && (
                <span
                    style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: trend === '▲' ? C.g : C.r,
                        opacity: 0.8,
                        transition: 'all 0.2s ease',
                    }}
                >
                    {trend}
                </span>
            )}
        </div>
    );
}
