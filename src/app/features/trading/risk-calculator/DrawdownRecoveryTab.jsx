// ═══════════════════════════════════════════════════════════════════
// Tab 4: Drawdown Recovery Calculator
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { C, M } from '../../../../constants.js';
import { useAnalyticsStore } from '../../../../state/useAnalyticsStore';
import { inputStyle } from '../../../components/ui/UIKit.jsx';
import { Label, SectionLabel, InfoBox } from './SharedComponents.jsx';

const DRAWDOWN_TABLE = [
    { dd: 5, recovery: 5.26 },
    { dd: 10, recovery: 11.11 },
    { dd: 15, recovery: 17.65 },
    { dd: 20, recovery: 25.0 },
    { dd: 25, recovery: 33.33 },
    { dd: 30, recovery: 42.86 },
    { dd: 40, recovery: 66.67 },
    { dd: 50, recovery: 100.0 },
    { dd: 60, recovery: 150.0 },
    { dd: 70, recovery: 233.33 },
    { dd: 80, recovery: 400.0 },
    { dd: 90, recovery: 900.0 },
];

export default function DrawdownRecoveryTab() {
    const result = useAnalyticsStore((s) => s.result);
    const [customDd, setCustomDd] = useState('');

    const customRecovery = useMemo(() => {
        const dd = parseFloat(customDd);
        if (!dd || dd <= 0 || dd >= 100) return null;
        const remaining = 1 - dd / 100;
        const recovery = (1 / remaining - 1) * 100;
        return recovery;
    }, [customDd]);

    // Recovery timeline estimate from analytics
    const recoveryEstimate = useMemo(() => {
        if (!result || !customRecovery) return null;
        const dd = parseFloat(customDd);
        if (!dd) return null;
        const avgWinPct = result.avgWin && result.avgLoss ? (result.avgWin / (result.avgWin + result.avgLoss)) * 100 : null;
        if (!avgWinPct || !result.winRate) return null;
        const expectedPctPerTrade = (result.winRate * avgWinPct - (1 - result.winRate) * (100 - avgWinPct)) / 100;
        if (expectedPctPerTrade <= 0) return null;
        const tradesNeeded = Math.ceil(customRecovery / (expectedPctPerTrade * 100));
        return { tradesNeeded, expectedPctPerTrade: (expectedPctPerTrade * 100).toFixed(2) };
    }, [result, customRecovery, customDd]);

    return (
        <div>
            {/* Custom Drawdown Input */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                    <Label>Drawdown %</Label>
                    <input
                        type="number"
                        value={customDd}
                        onChange={(e) => setCustomDd(e.target.value)}
                        placeholder="e.g. 25"
                        min="0.1"
                        max="99.9"
                        step="0.1"
                        style={inputStyle}
                    />
                </div>
                {customRecovery != null && (
                    <div
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            background: C.r + '0a',
                            borderLeft: `3px solid ${C.r}`,
                            borderRadius: '0 6px 6px 0',
                            textAlign: 'center',
                        }}
                    >
                        <div style={{ fontSize: 9, color: C.t3, fontFamily: M }}>Required to Recover</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: C.r, fontFamily: M }}>
                            +{customRecovery.toFixed(1)}%
                        </div>
                    </div>
                )}
            </div>

            {/* Recovery Estimate */}
            {recoveryEstimate && (
                <InfoBox>
                    Based on your avg expected return of{' '}
                    <strong style={{ color: C.b }}>{recoveryEstimate.expectedPctPerTrade}%</strong> per trade, recovery from a{' '}
                    {customDd}% drawdown would take approximately{' '}
                    <strong style={{ color: C.b }}>{recoveryEstimate.tradesNeeded}</strong> trades.
                </InfoBox>
            )}

            {/* Drawdown Recovery Table */}
            <SectionLabel text="Drawdown Recovery Reference" />
            <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.bd}` }}>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        padding: '6px 10px',
                        background: C.sf,
                        fontSize: 9,
                        fontWeight: 700,
                        color: C.t3,
                        fontFamily: M,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                    }}
                >
                    <span>Drawdown</span>
                    <span>Recovery Needed</span>
                    <span>Difficulty</span>
                </div>
                {DRAWDOWN_TABLE.map((row, i) => {
                    const difficulty =
                        row.recovery <= 25
                            ? 'Easy'
                            : row.recovery <= 50
                                ? 'Moderate'
                                : row.recovery <= 100
                                    ? 'Hard'
                                    : row.recovery <= 200
                                        ? 'Very Hard'
                                        : 'Near Impossible';
                    const diffColor = row.recovery <= 25 ? C.g : row.recovery <= 50 ? C.y : row.recovery <= 100 ? '#FF9800' : C.r;

                    return (
                        <div
                            key={i}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr 1fr',
                                padding: '5px 10px',
                                fontSize: 11,
                                fontFamily: M,
                                background: i % 2 === 0 ? 'transparent' : C.sf + '40',
                                borderTop: `1px solid ${C.bd}40`,
                            }}
                        >
                            <span style={{ color: C.t2 }}>-{row.dd}%</span>
                            <span style={{ color: diffColor, fontWeight: 600 }}>+{row.recovery.toFixed(1)}%</span>
                            <span style={{ color: diffColor, fontSize: 9 }}>{difficulty}</span>
                        </div>
                    );
                })}
            </div>

            {/* Visual curve */}
            <div style={{ marginTop: 12, padding: '10px 14px', background: C.sf, borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginBottom: 8 }}>Recovery Curve (non-linear)</div>
                <div style={{ display: 'flex', gap: 2, height: 60, alignItems: 'flex-end' }}>
                    {DRAWDOWN_TABLE.map((row, i) => {
                        const barH = Math.min(60, (row.recovery / 900) * 60);
                        const color = row.recovery <= 25 ? C.g : row.recovery <= 50 ? C.y : row.recovery <= 100 ? '#FF9800' : C.r;
                        return (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div
                                    style={{
                                        width: '100%',
                                        height: barH,
                                        background: color + '60',
                                        borderRadius: '3px 3px 0 0',
                                        border: `1px solid ${color}40`,
                                    }}
                                    title={`-${row.dd}% → +${row.recovery.toFixed(0)}%`}
                                />
                                <div style={{ fontSize: 7, color: C.t3, marginTop: 2 }}>{row.dd}%</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
