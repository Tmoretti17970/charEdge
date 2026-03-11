// ═══════════════════════════════════════════════════════════════════
// Tab 2: PnL Calculator
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { roundMoney } from '../../../../charting_library/model/Money.js';
import { C, M } from '../../../../constants.js';
import { fmtD } from '../../../../utils.js';
import { StatCard, AutoGrid, inputStyle } from '../../../components/ui/UIKit.jsx';
import { Label, SideBtn } from './SharedComponents.jsx';

export default function PnLCalculatorTab() {
    const [entryPrice, setEntryPrice] = useState('');
    const [exitPrice, setExitPrice] = useState('');
    const [quantity, setQuantity] = useState('');
    const [feePct, setFeePct] = useState(0.1);
    const [side, setSide] = useState('long');

    const calc = useMemo(() => {
        const entry = parseFloat(entryPrice);
        const exit = parseFloat(exitPrice);
        const qty = parseFloat(quantity);
        const fee = parseFloat(feePct) || 0;

        if (!entry || !exit || !qty || entry <= 0) return null;

        const direction = side === 'long' ? 1 : -1;
        const grossPnl = roundMoney(direction * (exit - entry) * qty);
        const entryFee = roundMoney(entry * qty * (fee / 100));
        const exitFee = roundMoney(exit * qty * (fee / 100));
        const totalFees = roundMoney(entryFee + exitFee);
        const netPnl = roundMoney(grossPnl - totalFees);
        const roi = (netPnl / (entry * qty)) * 100;
        const positionValue = roundMoney(entry * qty);

        // Break-even price (including fees)
        const feeMultiplier = fee / 100;
        const breakEven =
            side === 'long' ? roundMoney(entry * (1 + 2 * feeMultiplier)) : roundMoney(entry * (1 - 2 * feeMultiplier));

        return {
            grossPnl,
            netPnl,
            totalFees,
            entryFee,
            exitFee,
            roi,
            positionValue,
            breakEven,
            isProfit: netPnl > 0,
        };
    }, [entryPrice, exitPrice, quantity, feePct, side]);

    return (
        <div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                <SideBtn active={side === 'long'} color={C.g} onClick={() => setSide('long')}>
                    ▲ Long
                </SideBtn>
                <SideBtn active={side === 'short'} color={C.r} onClick={() => setSide('short')}>
                    ▼ Short
                </SideBtn>
            </div>

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
                    <Label>Exit Price</Label>
                    <input
                        type="number"
                        value={exitPrice}
                        onChange={(e) => setExitPrice(e.target.value)}
                        placeholder="0.00"
                        style={inputStyle}
                        step="any"
                    />
                </div>
                <div>
                    <Label>Quantity</Label>
                    <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="100"
                        style={inputStyle}
                        step="any"
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

            {calc && (
                <div>
                    <AutoGrid minWidth={120} gap={6} style={{ marginBottom: 12 }}>
                        <StatCard label="Gross P&L" value={fmtD(calc.grossPnl)} color={calc.grossPnl >= 0 ? C.g : C.r} />
                        <StatCard label="Net P&L" value={fmtD(calc.netPnl)} color={calc.isProfit ? C.g : C.r} />
                        <StatCard label="ROI" value={`${calc.roi.toFixed(2)}%`} color={calc.isProfit ? C.g : C.r} />
                        <StatCard label="Total Fees" value={fmtD(calc.totalFees)} color={C.y} />
                        <StatCard label="Position Value" value={fmtD(calc.positionValue)} color={C.t1} />
                        <StatCard label="Break-Even" value={`$${calc.breakEven.toFixed(2)}`} color={C.b} />
                    </AutoGrid>

                    {/* PnL Visual */}
                    <div
                        style={{
                            padding: '12px 16px',
                            borderRadius: 8,
                            background: calc.isProfit ? C.g + '0a' : C.r + '0a',
                            borderLeft: `3px solid ${calc.isProfit ? C.g : C.r}`,
                            textAlign: 'center',
                        }}
                    >
                        <div style={{ fontSize: 24, fontWeight: 800, color: calc.isProfit ? C.g : C.r, fontFamily: M }}>
                            {calc.isProfit ? '+' : ''}
                            {fmtD(calc.netPnl)}
                        </div>
                        <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>
                            {calc.isProfit ? '✓ Profitable' : '✗ Loss'} after {fmtD(calc.totalFees)} in fees
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
