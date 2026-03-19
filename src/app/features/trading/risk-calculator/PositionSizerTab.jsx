// ═══════════════════════════════════════════════════════════════════
// Tab 1: Position Sizer (enhanced)
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback } from 'react';
import { roundMoney } from '../../../../charting_library/model/Money.js';
import { C, M } from '@/constants.js';
import { useAnalyticsStore } from '../../../../state/useAnalyticsStore';
import { useUserStore } from '../../../../state/useUserStore';
import { fmtD } from '../../../../utils.js';
import { StatCard, AutoGrid, inputStyle } from '../../../components/ui/UIKit.jsx';
import { RiskGauge, Label, SideBtn, Warning, InfoBox, SectionLabel } from './SharedComponents.jsx';

export default function PositionSizerTab() {
    const accountSize = useUserStore((s) => s.accountSize);
    const riskPerTradeSetting = useUserStore((s) => s.riskPerTrade);
    const result = useAnalyticsStore((s) => s.result);

    const [accountBalance, setAccountBalance] = useState(accountSize || 25000);
    const [riskPercent, setRiskPercent] = useState(riskPerTradeSetting || 1);
    const [entryPrice, setEntryPrice] = useState('');
    const [stopPrice, setStopPrice] = useState('');
    const [side, setSide] = useState('long');
    const [feePct, setFeePct] = useState(0.1);

    // Multi-target
    const [targets, setTargets] = useState([{ price: '', alloc: 100 }]);

    const addTarget = useCallback(() => {
        if (targets.length >= 4) return;
        setTargets((prev) => {
            const newAlloc = Math.floor(100 / (prev.length + 1));
            const adjusted = prev.map((t) => ({ ...t, alloc: newAlloc }));
            adjusted.push({ price: '', alloc: 100 - newAlloc * prev.length });
            return adjusted;
        });
    }, [targets.length]);

    const removeTarget = useCallback((idx) => {
        setTargets((prev) => {
            const next = prev.filter((_, i) => i !== idx);
            if (next.length === 1) {
                next[0].alloc = 100;
                return next;
            }
            const each = Math.floor(100 / next.length);
            return next.map((t, i) => ({ ...t, alloc: i === next.length - 1 ? 100 - each * (next.length - 1) : each }));
        });
    }, []);

    const updateTarget = useCallback((idx, field, value) => {
        setTargets((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
    }, []);

    // Computed values
    const calc = useMemo(() => {
        const entry = parseFloat(entryPrice);
        const stop = parseFloat(stopPrice);
        const bal = parseFloat(accountBalance) || 0;
        const riskPct = parseFloat(riskPercent) || 1;
        const fee = parseFloat(feePct) || 0;

        if (!entry || !stop || entry === stop) return null;

        const riskAmount = roundMoney(bal * (riskPct / 100));
        const stopDist = roundMoney(Math.abs(entry - stop));
        const positionSize = riskAmount / stopDist;
        const shares = Math.floor(positionSize);
        const positionValue = roundMoney(shares * entry);
        const leverage = bal > 0 ? roundMoney(positionValue / bal) : 0;
        const maxLoss = roundMoney(shares * stopDist);

        // Fee calculations
        const entryFee = roundMoney(positionValue * (fee / 100));
        const exitFeeAtStop = roundMoney(shares * stop * (fee / 100));
        const totalFeesAtStop = entryFee + exitFeeAtStop;
        const netLoss = roundMoney(maxLoss + totalFeesAtStop);

        // Multi-target results
        const targetResults = targets
            .map((t) => {
                const tp = parseFloat(t.price);
                if (!tp || tp === entry) return null;
                const targetDist = side === 'long' ? tp - entry : entry - tp;
                const allocShares = Math.floor(shares * (t.alloc / 100));
                const grossPnl = roundMoney(allocShares * targetDist);
                const exitFee = roundMoney(allocShares * tp * (fee / 100));
                const partialEntryFee = roundMoney(allocShares * entry * (fee / 100));
                const netPnl = roundMoney(grossPnl - partialEntryFee - exitFee);
                const rMultiple = stopDist > 0 ? Math.abs(targetDist / stopDist) : 0;
                return {
                    price: tp,
                    shares: allocShares,
                    alloc: t.alloc,
                    grossPnl,
                    netPnl,
                    rMultiple,
                    fees: partialEntryFee + exitFee,
                };
            })
            .filter(Boolean);

        const totalGrossPnl = targetResults.reduce((s, r) => s + r.grossPnl, 0);
        const totalNetPnl = targetResults.reduce((s, r) => s + r.netPnl, 0);
        const avgRR =
            targetResults.length > 0 ? targetResults.reduce((s, r) => s + r.rMultiple * (r.alloc / 100), 0).toFixed(1) : null;

        return {
            riskAmount,
            stopDist,
            shares,
            positionValue,
            leverage,
            maxLoss,
            entryFee,
            totalFeesAtStop,
            netLoss,
            targetResults,
            totalGrossPnl,
            totalNetPnl,
            avgRR,
        };
    }, [accountBalance, riskPercent, entryPrice, stopPrice, side, feePct, targets]);

    // Kelly from analytics
    const kellySuggestion = useMemo(() => {
        if (!result) return null;
        const kellyPct = (result.kelly * 100).toFixed(1);
        const halfKelly = (result.kelly * 50).toFixed(1);
        return { full: kellyPct, half: halfKelly };
    }, [result]);

    // Risk gauge (0-10 scale)
    const riskLevel = useMemo(() => {
        const pct = parseFloat(riskPercent) || 0;
        if (pct <= 0.5) return { level: 1, color: C.g, label: 'Very Low' };
        if (pct <= 1) return { level: 2, color: C.g, label: 'Low' };
        if (pct <= 2) return { level: 4, color: '#66BB6A', label: 'Moderate' };
        if (pct <= 3) return { level: 6, color: C.y, label: 'Elevated' };
        if (pct <= 5) return { level: 8, color: '#FF9800', label: 'High' };
        return { level: 10, color: C.r, label: 'Extreme' };
    }, [riskPercent]);

    return (
        <div>
            {/* Risk Gauge */}
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
                <RiskGauge level={riskLevel.level} color={riskLevel.color} />
                <div style={{ fontSize: 10, fontWeight: 700, color: riskLevel.color, fontFamily: M, marginTop: 4 }}>
                    {riskLevel.label} Risk
                </div>
            </div>

            {/* Input Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div>
                    <Label>Account Balance</Label>
                    <input
                        aria-label="Account balance"
                        type="number"
                        value={accountBalance}
                        onChange={(e) => setAccountBalance(e.target.value)}
                        style={{ ...inputStyle, fontWeight: 700 }}
                    />
                </div>
                <div>
                    <Label>Risk % Per Trade</Label>
                    <input
                        type="number"
                        value={riskPercent}
                        onChange={(e) => setRiskPercent(e.target.value)}
                        step="0.1"
                        min="0.1"
                        max="10"
                        style={inputStyle}
                    />
                </div>
                <div>
                    <Label>Fee/Commission %</Label>
                    <input
                        type="number"
                        value={feePct}
                        onChange={(e) => setFeePct(e.target.value)}
                        step="0.01"
                        min="0"
                        max="5"
                        style={inputStyle}
                    />
                </div>
            </div>

            {/* Side Toggle */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                <SideBtn active={side === 'long'} color={C.g} onClick={() => setSide('long')}>
                    ▲ Long
                </SideBtn>
                <SideBtn active={side === 'short'} color={C.r} onClick={() => setSide('short')}>
                    ▼ Short
                </SideBtn>
            </div>

            {/* Entry + Stop */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div>
                    <Label>Entry Price</Label>
                    <input
                        type="number"
                        value={entryPrice}
                        onChange={(e) => setEntryPrice(e.target.value)}
                        placeholder="0.00"
                        style={inputStyle}
                        step="any"
                    />
                </div>
                <div>
                    <Label>Stop Loss</Label>
                    <input
                        type="number"
                        value={stopPrice}
                        onChange={(e) => setStopPrice(e.target.value)}
                        placeholder="0.00"
                        style={{ ...inputStyle, borderColor: C.r + '40' }}
                        step="any"
                    />
                </div>
            </div>

            {/* Multi-Target Section */}
            <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Label style={{ margin: 0 }}>Take Profit Targets</Label>
                    {targets.length < 4 && (
                        <button
                            className="tf-btn"
                            onClick={addTarget}
                            style={{
                                fontSize: 9,
                                padding: '2px 8px',
                                borderRadius: 4,
                                border: `1px solid ${C.bd}`,
                                background: 'transparent',
                                color: C.b,
                                cursor: 'pointer',
                                fontFamily: M,
                            }}
                        >
                            + Add TP
                        </button>
                    )}
                </div>
                {targets.map((t, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
                        <div style={{ fontSize: 9, color: C.t3, fontFamily: M, width: 28 }}>TP{i + 1}</div>
                        <input
                            type="number"
                            value={t.price}
                            onChange={(e) => updateTarget(i, 'price', e.target.value)}
                            placeholder="Price"
                            style={{ ...inputStyle, flex: 2 }}
                            step="any"
                        />
                        <input
                            type="number"
                            value={t.alloc}
                            onChange={(e) => updateTarget(i, 'alloc', parseFloat(e.target.value) || 0)}
                            style={{ ...inputStyle, flex: 1, textAlign: 'center' }}
                            min="1"
                            max="100"
                        />
                        <span style={{ fontSize: 9, color: C.t3 }}>%</span>
                        {targets.length > 1 && (
                            <button
                                className="tf-btn"
                                onClick={() => removeTarget(i)}
                                style={{
                                    fontSize: 11,
                                    color: C.r,
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '0 2px',
                                }}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Results */}
            {calc && (
                <div>
                    <SectionLabel text="Position Sizing" />
                    <AutoGrid minWidth={110} gap={6} style={{ marginBottom: 12 }}>
                        <StatCard label="Shares/Units" value={calc.shares.toLocaleString()} color={C.b} />
                        <StatCard label="Risk Amount" value={fmtD(calc.riskAmount)} color={C.r} />
                        <StatCard label="Position Value" value={fmtD(calc.positionValue)} color={C.t1} />
                        <StatCard label="Stop Distance" value={`$${calc.stopDist.toFixed(2)}`} color={C.r} />
                        <StatCard label="Leverage" value={`${calc.leverage.toFixed(1)}×`} color={calc.leverage > 3 ? C.r : C.t2} />
                        <StatCard label="Entry Fee" value={fmtD(calc.entryFee)} color={C.y} />
                        <StatCard label="Max Loss (net)" value={fmtD(-calc.netLoss)} color={C.r} />
                    </AutoGrid>

                    {/* Target Breakdown */}
                    {calc.targetResults.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                            <SectionLabel text="Target Breakdown" />
                            {calc.targetResults.map((r, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '6px 10px',
                                        background: C.sf,
                                        borderRadius: 6,
                                        marginBottom: 4,
                                        fontSize: 11,
                                        fontFamily: M,
                                    }}
                                >
                                    <span style={{ color: C.t3 }}>
                                        TP{i + 1} @ ${r.price.toFixed(2)}
                                    </span>
                                    <span style={{ color: C.t3 }}>
                                        {r.shares} shares ({r.alloc}%)
                                    </span>
                                    <span style={{ color: r.rMultiple >= 2 ? C.g : r.rMultiple >= 1 ? C.y : C.r }}>
                                        {r.rMultiple.toFixed(1)}R
                                    </span>
                                    <span style={{ color: C.g }}>{fmtD(r.netPnl)}</span>
                                </div>
                            ))}
                            {/* R:R summary bar */}
                            <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
                                <div style={{ flex: 1, background: C.r + '50' }} title="Risk" />
                                <div style={{ flex: parseFloat(calc.avgRR) || 1, background: C.g + '50' }} title="Reward" />
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: 9,
                                    color: C.t3,
                                    fontFamily: M,
                                    marginTop: 2,
                                }}
                            >
                                <span>Risk: {fmtD(calc.riskAmount)}</span>
                                <span>Avg R:R 1:{calc.avgRR}</span>
                                <span>Net PnL: {fmtD(calc.totalNetPnl)}</span>
                            </div>
                        </div>
                    )}

                    {/* Warnings */}
                    {calc.leverage > 5 && (
                        <Warning>High leverage ({calc.leverage.toFixed(1)}×). Consider reducing position size.</Warning>
                    )}
                    {riskPercent > 3 && (
                        <Warning>Risk per trade exceeds 3% — aggressive sizing may accelerate drawdowns.</Warning>
                    )}
                </div>
            )}

            {/* Kelly Suggestion */}
            {kellySuggestion && (
                <InfoBox>
                    <strong style={{ color: C.t1 }}>Kelly Criterion:</strong> Based on your trade history, optimal sizing is{' '}
                    <strong style={{ color: C.b }}>{kellySuggestion.full}%</strong> per trade. Half-Kelly (recommended):{' '}
                    <strong style={{ color: C.b }}>{kellySuggestion.half}%</strong>.
                </InfoBox>
            )}
        </div>
    );
}
