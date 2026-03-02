// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — Risk Calculator Hub
// Tabbed multi-calculator: Position Sizer, PnL, Margin, Drawdown
// ═══════════════════════════════════════════════════════════════════

import { useUserStore } from '../../../state/useUserStore.js';
import { useState, useMemo, useCallback } from 'react';
import { C, M } from '../../../constants.js';
import { useAnalyticsStore } from '../../../state/useAnalyticsStore.js';
import { StatCard, AutoGrid, inputStyle } from '../../components/ui/UIKit.jsx';
import { fmtD } from '../../../utils.js';
import { roundMoney } from '../../../charting_library/model/Money.js';

// ─── Tab Definitions ────────────────────────────────────────────
const TABS = [
  { id: 'position', label: 'Position Sizer', icon: '📏' },
  { id: 'pnl', label: 'PnL', icon: '💰' },
  { id: 'margin', label: 'Margin', icon: '⚖️' },
  { id: 'drawdown', label: 'Recovery', icon: '📉' },
];

// ═════════════════════════════════════════════════════════════════
// Main Component
// ═════════════════════════════════════════════════════════════════
export default function RiskCalculator() {
  const [activeTab, setActiveTab] = useState('position');

  return (
    <div>
      {/* Tab Bar */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          marginBottom: 16,
          background: C.bg2,
          borderRadius: 8,
          padding: 3,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className="tf-btn"
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '7px 4px',
              borderRadius: 6,
              border: 'none',
              background: activeTab === tab.id ? C.b + '22' : 'transparent',
              color: activeTab === tab.id ? C.b : C.t3,
              fontSize: 10,
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontFamily: M,
              cursor: 'pointer',
              transition: 'all 0.15s',
              borderBottom: activeTab === tab.id ? `2px solid ${C.b}` : '2px solid transparent',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ marginRight: 3 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'position' && <PositionSizerTab />}
      {activeTab === 'pnl' && <PnLCalculatorTab />}
      {activeTab === 'margin' && <MarginCalculatorTab />}
      {activeTab === 'drawdown' && <DrawdownRecoveryTab />}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Tab 1: Position Sizer (enhanced)
// ═════════════════════════════════════════════════════════════════
function PositionSizerTab() {
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

// ═════════════════════════════════════════════════════════════════
// Tab 2: PnL Calculator
// ═════════════════════════════════════════════════════════════════
function PnLCalculatorTab() {
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

// ═════════════════════════════════════════════════════════════════
// Tab 3: Margin / Leverage Calculator
// ═════════════════════════════════════════════════════════════════
function MarginCalculatorTab() {
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
    // Long: liq = entry * (1 - 1/leverage + mm%)
    // Short: liq = entry * (1 + 1/leverage - mm%)
    const liquidationPrice =
      side === 'long'
        ? roundMoney(entry * (1 - 1 / lev + mmPct / 100))
        : roundMoney(entry * (1 + 1 / lev - mmPct / 100));

    const distToLiq = Math.abs(entry - liquidationPrice);
    const distToLiqPct = ((distToLiq / entry) * 100).toFixed(2);

    // Max position for given margin
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

// ═════════════════════════════════════════════════════════════════
// Tab 4: Drawdown Recovery Calculator
// ═════════════════════════════════════════════════════════════════

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

function DrawdownRecoveryTab() {
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

// ═════════════════════════════════════════════════════════════════
// Shared Sub-components
// ═════════════════════════════════════════════════════════════════

function RiskGauge({ level, color }) {
  // Arc gauge showing risk level 0-10
  const segments = 10;
  const arcWidth = 140;
  const arcHeight = 50;

  return (
    <svg width={arcWidth} height={arcHeight + 12} viewBox={`0 0 ${arcWidth} ${arcHeight + 12}`}>
      {Array.from({ length: segments }).map((_, i) => {
        const startAngle = Math.PI + (i / segments) * Math.PI;
        const endAngle = Math.PI + ((i + 1) / segments) * Math.PI;
        const cx = arcWidth / 2;
        const cy = arcHeight + 2;
        const r = 45;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const filled = i < level;
        const segColor = i < 3 ? C.g : i < 5 ? '#66BB6A' : i < 7 ? C.y : i < 9 ? '#FF9800' : C.r;

        return (
          <path
            key={i}
            d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
            stroke={filled ? segColor : C.bd}
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
            opacity={filled ? 1 : 0.3}
          />
        );
      })}
      <text
        x={arcWidth / 2}
        y={arcHeight}
        textAnchor="middle"
        fill={color}
        fontSize="14"
        fontWeight="800"
        fontFamily={M}
      >
        {level}/10
      </text>
    </svg>
  );
}

function Label({ children, style: s }) {
  return (
    <label
      style={{
        display: 'block',
        fontSize: 10,
        fontWeight: 600,
        color: C.t3,
        marginBottom: 3,
        fontFamily: M,
        ...s,
      }}
    >
      {children}
    </label>
  );
}

function SideBtn({ children, active, color, onClick }) {
  return (
    <button
      className="tf-btn"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '6px 0',
        borderRadius: 5,
        border: `1px solid ${active ? color : C.bd}`,
        background: active ? color + '15' : 'transparent',
        color: active ? color : C.t3,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: M,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function Warning({ children }) {
  return (
    <div
      style={{
        padding: '8px 12px',
        background: C.y + '0c',
        borderLeft: `3px solid ${C.y}`,
        borderRadius: '0 6px 6px 0',
        fontSize: 11,
        color: C.y,
        fontFamily: M,
        marginBottom: 6,
      }}
    >
      ⚠ {children}
    </div>
  );
}

function InfoBox({ children }) {
  return (
    <div
      style={{
        padding: '10px 14px',
        background: C.b + '08',
        borderLeft: `3px solid ${C.b}`,
        borderRadius: '0 6px 6px 0',
        marginTop: 10,
        fontSize: 11,
        color: C.t2,
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ text }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.t3,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 8,
        fontFamily: M,
      }}
    >
      {text}
    </div>
  );
}

export { RiskCalculator };
