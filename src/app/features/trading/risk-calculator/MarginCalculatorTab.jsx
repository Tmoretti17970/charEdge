// ═══════════════════════════════════════════════════════════════════
// Tab 3: Margin / Leverage Calculator
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { roundMoney } from '../../../../charting_library/model/Money.js';
import { C, M } from '@/constants.js';
import { fmtD } from '../../../../utils.js';
import { StatCard, AutoGrid, inputStyle } from '../../../components/ui/UIKit.jsx';
import { Label, SideBtn, Warning } from './SharedComponents.jsx';

export default function MarginCalculatorTab() {
    const [positionSize, setPositionSize] = useState('');
    const [entryPrice, setEntryPrice] = useState('');
    const [leverage, setLeverage] = useState(10);
    const [side, setSide] = useState('long');
    const [maintenanceMarginPct, setMaintenanceMarginPct] = useState(0.5);

    const calc = useMemo(() => {
        const size = parseFloat(positionSize);
        const entry = parseFloat(entryPrice);
        const lev = parseFloat(leverage) || 1;
        const mmPct = parseFloat(maintenanceMarginPct) || 0.5;

        if (!size || !entry || size <= 0 || entry <= 0) return null;

        const positionValue = roundMoney(size * entry);
        const requiredMargin = roundMoney(positionValue / lev);
        const maintenanceMargin = roundMoney(positionValue * (mmPct / 100));

        // Liquidation price
        const liquidationPrice =
            side === 'long'
                ? roundMoney(entry * (1 - 1 / lev + mmPct / 100))
                : roundMoney(entry * (1 + 1 / lev - mmPct / 100));

        const distToLiq = Math.abs(entry - liquidationPrice);
        const distToLiqPct = ((distToLiq / entry) * 100).toFixed(2);

        const maxPositionValue = roundMoney(requiredMargin * lev);
        const maxQty = Math.floor(maxPositionValue / entry);

        return {
            positionValue,
            requiredMargin,
            maintenanceMargin,
            liquidationPrice,
            distToLiq,
            distToLiqPct,
            maxPositionValue,
            maxQty,
        };
    }, [positionSize, entryPrice, leverage, side, maintenanceMarginPct]);

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
                    <Label>Quantity</Label>
                    <input
                        type="number"
                        value={positionSize}
                        onChange={(e) => setPositionSize(e.target.value)}
                        placeholder="100"
                        style={inputStyle}
                        step="any"
                    />
                </div>
                <div>
                    <Label>Leverage</Label>
                    <input
                        type="number"
                        value={leverage}
                        onChange={(e) => setLeverage(e.target.value)}
                        min="1"
                        max="200"
                        style={inputStyle}
                    />
                </div>
                <div>
                    <Label>Maintenance Margin %</Label>
                    <input
                        type="number"
                        value={maintenanceMarginPct}
                        onChange={(e) => setMaintenanceMarginPct(e.target.value)}
                        step="0.1"
                        min="0"
                        max="10"
                        style={inputStyle}
                    />
                </div>
            </div>

            {/* Leverage slider */}
            <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Label>Leverage: {leverage}×</Label>
                    <span style={{ fontSize: 9, color: leverage > 50 ? C.r : leverage > 20 ? C.y : C.g, fontFamily: M }}>
                        {leverage <= 5 ? 'Safe' : leverage <= 20 ? 'Moderate' : leverage <= 50 ? 'High' : 'Extreme'}
                    </span>
                </div>
                <input
                    type="range"
                    value={leverage}
                    onChange={(e) => setLeverage(e.target.value)}
                    min="1"
                    max="125"
                    style={{ width: '100%', accentColor: C.b }}
                />
            </div>

            {calc && (
                <div>
                    <AutoGrid minWidth={120} gap={6} style={{ marginBottom: 12 }}>
                        <StatCard label="Position Value" value={fmtD(calc.positionValue)} color={C.t1} />
                        <StatCard label="Required Margin" value={fmtD(calc.requiredMargin)} color={C.b} />
                        <StatCard label="Maint. Margin" value={fmtD(calc.maintenanceMargin)} color={C.y} />
                        <StatCard label="Max Qty" value={calc.maxQty.toLocaleString()} color={C.t2} />
                    </AutoGrid>

                    {/* Liquidation Warning */}
                    <div
                        style={{
                            padding: '10px 14px',
                            background: C.r + '0a',
                            borderLeft: `3px solid ${C.r}`,
                            borderRadius: '0 6px 6px 0',
                            marginBottom: 8,
                        }}
                    >
                        <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginBottom: 4 }}>Estimated Liquidation Price</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: C.r, fontFamily: M }}>
                            ${calc.liquidationPrice.toFixed(2)}
                        </div>
                        <div style={{ fontSize: 10, color: C.t3, fontFamily: M, marginTop: 2 }}>
                            {calc.distToLiqPct}% from entry (${calc.distToLiq.toFixed(2)} distance)
                        </div>
                    </div>

                    {leverage > 50 && <Warning>Leverage above 50× carries extreme liquidation risk. Use with caution.</Warning>}
                </div>
            )}
        </div>
    );
}
