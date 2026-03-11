// ═══════════════════════════════════════════════════════════════════
// WorkspaceLayout — Mini Panels
// Lightweight sidebar panels for workspace docking.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { C, F, M } from '../../../constants.js';
import ComparePanel from '../../components/panels/ComparePanel.jsx';
import InsightsPanel from '../../components/panels/InsightsPanel.jsx';

// ─── JournalMini ────────────────────────────────────────────────

export function JournalMini() {
    const [trades, setTrades] = useState([]);

    useEffect(() => {
        let unsub = null;
        let mounted = true;

        import('../../../state/useJournalStore.js').then(({ useJournalStore: useTradeStore }) => {
            if (!mounted) return;
            setTrades(useTradeStore.getState().trades?.slice(-20) || []);
            unsub = useTradeStore.subscribe((state) => {
                if (mounted) setTrades(state.trades?.slice(-20) || []);
            });
        });

        return () => {
            mounted = false;
            if (unsub) unsub();
        };
    }, []);

    return (
        <div
            style={{
                height: '100%',
                overflow: 'auto',
                padding: 8,
                fontFamily: F,
                background: C.bg,
                color: C.t2,
                fontSize: 12,
            }}
        >
            <div style={{ fontWeight: 600, color: C.t1, marginBottom: 8, fontSize: 13 }}>Recent Trades</div>
            {trades.length === 0 ? (
                <div style={{ color: C.t3, fontStyle: 'italic' }}>No trades yet</div>
            ) : (
                trades
                    .slice()
                    .reverse()
                    .map((t, i) => (
                        <div
                            key={t.id || i}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '5px 6px',
                                borderBottom: `1px solid ${C.bd}`,
                                fontSize: 11,
                            }}
                        >
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ fontFamily: M, fontWeight: 600, color: C.t1 }}>{t.symbol}</span>
                                <span style={{ color: t.side === 'long' ? C.g : C.r, fontSize: 10 }}>
                                    {t.side === 'long' ? '▲' : '▼'} {t.side}
                                </span>
                            </div>
                            <span
                                style={{
                                    fontFamily: M,
                                    color: (t.pnl || 0) >= 0 ? C.g : C.r,
                                    fontWeight: 500,
                                }}
                            >
                                {(t.pnl || 0) >= 0 ? '+' : ''}
                                {(t.pnl || 0).toFixed(2)}
                            </span>
                        </div>
                    ))
            )}
        </div>
    );
}

// ─── AnalyticsMini ──────────────────────────────────────────────

export function AnalyticsMini() {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        let unsub = null;
        let mounted = true;

        import('../../../state/useAnalyticsStore.js').then(({ useAnalyticsStore }) => {
            if (!mounted) return;
            setStats(useAnalyticsStore.getState().result);
            unsub = useAnalyticsStore.subscribe((state) => {
                if (mounted) setStats(state.result);
            });
        });

        return () => {
            mounted = false;
            if (unsub) unsub();
        };
    }, []);

    const d = stats;
    return (
        <div
            style={{
                height: '100%',
                overflow: 'auto',
                padding: 10,
                fontFamily: F,
                background: C.bg,
                color: C.t2,
                fontSize: 12,
            }}
        >
            <div style={{ fontWeight: 600, color: C.t1, marginBottom: 10, fontSize: 13 }}>Key Stats</div>
            {!d ? (
                <div style={{ color: C.t3, fontStyle: 'italic' }}>Run analytics first</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                        ['Total P&L', d.totalPnl, true],
                        ['Win Rate', d.winRate ? `${(d.winRate * 100).toFixed(1)}%` : '—'],
                        ['Trades', d.totalTrades],
                        ['Profit Factor', d.profitFactor?.toFixed(2)],
                        ['Avg Win', d.avgWin, true],
                        ['Avg Loss', d.avgLoss, true],
                        ['Best', d.bestTrade, true],
                        ['Worst', d.worstTrade, true],
                    ].map(([label, val, isPnl], i) => (
                        <div
                            key={i}
                            style={{
                                background: C.sf,
                                borderRadius: 6,
                                padding: '6px 8px',
                            }}
                        >
                            <div style={{ fontSize: 10, color: C.t3, marginBottom: 2 }}>{label}</div>
                            <div
                                style={{
                                    fontFamily: M,
                                    fontWeight: 600,
                                    fontSize: 13,
                                    color: isPnl ? ((val || 0) >= 0 ? C.g : C.r) : C.t1,
                                }}
                            >
                                {isPnl ? `$${(val || 0).toFixed(2)}` : (val ?? '—')}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── InsightsPanelWrapper ───────────────────────────────────────

export function InsightsPanelWrapper() {
    const [trades, setTrades] = useState([]);

    useEffect(() => {
        let unsub = null;
        let mounted = true;

        import('../../../state/useJournalStore.js').then(({ useJournalStore: useTradeStore }) => {
            if (!mounted) return;
            setTrades(useTradeStore.getState().trades || []);
            unsub = useTradeStore.subscribe((state) => {
                if (mounted) setTrades(state.trades || []);
            });
        });

        return () => {
            mounted = false;
            if (unsub) unsub();
        };
    }, []);

    return <InsightsPanel trades={trades} />;
}

// ─── ComparePanelWrapper ────────────────────────────────────────

export function ComparePanelWrapper() {
    const [trades, setTrades] = useState([]);

    useEffect(() => {
        let unsub = null;
        let mounted = true;

        import('../../../state/useJournalStore.js').then(({ useJournalStore: useTradeStore }) => {
            if (!mounted) return;
            setTrades(useTradeStore.getState().trades || []);
            unsub = useTradeStore.subscribe((state) => {
                if (mounted) setTrades(state.trades || []);
            });
        });

        return () => {
            mounted = false;
            if (unsub) unsub();
        };
    }, []);

    return <ComparePanel trades={trades} />;
}
