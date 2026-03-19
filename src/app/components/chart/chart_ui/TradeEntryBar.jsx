// ═══════════════════════════════════════════════════════════════════
// charEdge v10.6 — Trade Entry Bar
// Sprint 10 C10.6: Toolbar strip shown during trade entry mode.
// Shows current step, side toggle, level readouts, and actions.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { C, M } from '@/constants.js';
import { calcRiskReward, calcPositionSize } from '../../../../state/chart/tradeSlice';
import Icon from '../../design/Icon.jsx';
import { useChartFeaturesStore } from '../../../../state/chart/useChartFeaturesStore';
import { useChartTradeStore } from '../../../../state/chart/useChartTradeStore';

const STEPS = [
  { id: 'entry', label: '1. Entry', icon: 'pin' },
  { id: 'sl', label: '2. Stop Loss', icon: 'stop-loss' },
  { id: 'tp', label: '3. Target', icon: 'target' },
  { id: 'ready', label: 'Ready', icon: 'check' },
];

export default function TradeEntryBar() {
  const tradeMode = useChartFeaturesStore((s) => s.tradeMode);
  const tradeStep = useChartFeaturesStore((s) => s.tradeStep);
  const tradeSide = useChartFeaturesStore((s) => s.tradeSide);
  const pendingEntry = useChartTradeStore((s) => s.pendingEntry);
  const pendingSL = useChartTradeStore((s) => s.pendingStopLoss);
  const pendingTP = useChartTradeStore((s) => s.pendingTakeProfit);
  const setTradeSide = useChartTradeStore((s) => s.setTradeSide);
  const exitTradeMode = useChartFeaturesStore((s) => s.exitTradeMode);
  const riskAmount = useChartTradeStore((s) => s.riskAmount);

  const rr = useMemo(
    () => calcRiskReward(pendingEntry?.price, pendingSL?.price, pendingTP?.price, tradeSide),
    [pendingEntry, pendingSL, pendingTP, tradeSide],
  );

  const pos = useMemo(
    () => calcPositionSize(riskAmount, pendingEntry?.price, pendingSL?.price),
    [riskAmount, pendingEntry, pendingSL],
  );

  if (!tradeMode) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 12px',
        background: C.bg2,
        borderBottom: `1px solid ${C.bd}`,
        flexWrap: 'wrap',
        minHeight: 36,
      }}
    >
      {/* Side toggle */}
      <div style={{ display: 'flex', gap: 2 }}>
        {['long', 'short'].map((s) => (
          <button
            className="tf-btn"
            key={s}
            onClick={() => setTradeSide(s)}
            style={{
              padding: '3px 10px',
              fontSize: 9,
              fontWeight: 800,
              borderRadius: 4,
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontFamily: M,
              border: `1px solid ${tradeSide === s ? (s === 'long' ? C.g : C.r) : C.bd}`,
              background: tradeSide === s ? (s === 'long' ? C.g + '15' : C.r + '15') : 'transparent',
              color: tradeSide === s ? (s === 'long' ? C.g : C.r) : C.t3,
            }}
          >
            <Icon name={s === 'long' ? 'long' : 'short'} size={9} /> {s}
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 20, background: C.bd }} />

      {/* Step indicators */}
      {STEPS.map((step, i) => {
        const isCurrent = step.id === tradeStep;
        const isDone = STEPS.findIndex((s) => s.id === tradeStep) > i;
        return (
          <div
            key={step.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              padding: '2px 6px',
              borderRadius: 4,
              background: isCurrent ? C.b + '15' : isDone ? C.g + '08' : 'transparent',
              border: `1px solid ${isCurrent ? C.b + '40' : isDone ? C.g + '20' : 'transparent'}`,
            }}
          >
            <span style={{ fontSize: 10 }}>{isDone ? <Icon name="check" size={10} color={C.g} /> : <Icon name={step.icon} size={10} />}</span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                fontFamily: M,
                color: isCurrent ? C.b : isDone ? C.g : C.t3,
              }}
            >
              {step.label}
            </span>
          </div>
        );
      })}

      <div style={{ width: 1, height: 20, background: C.bd }} />

      {/* Level readouts */}
      <LevelChip label="E" value={pendingEntry?.price} color={C.info} />
      <LevelChip label="SL" value={pendingSL?.price} color={C.r} />
      <LevelChip label="TP" value={pendingTP?.price} color={C.g} />

      {/* R:R display */}
      {rr?.rr > 0 && (
        <>
          <div style={{ width: 1, height: 20, background: C.bd }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              fontFamily: M,
              color: rr.rr >= 2 ? C.g : rr.rr >= 1 ? C.y : C.r,
            }}
          >
            {rr.rr}R
          </span>
        </>
      )}

      {/* Position size */}
      {pos?.shares > 0 && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            fontFamily: M,
            color: C.t2,
          }}
        >
          {pos.shares}sh · ${pos.actualRisk} risk
        </span>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Instruction */}
      <span style={{ fontSize: 9, color: C.t3, fontFamily: M, fontStyle: 'italic' }}>
        {tradeStep === 'entry' && 'Click chart to set entry price'}
        {tradeStep === 'sl' && 'Click chart to set stop loss'}
        {tradeStep === 'tp' && 'Click chart to set target (or skip)'}
        {tradeStep === 'ready' && 'Ready — open Quick Journal to log'}
      </span>

      {/* Skip TP */}
      {tradeStep === 'tp' && (
        <button
          className="tf-btn"
          onClick={() => useChartTradeStore.getState().setTP(pendingEntry?.price, 0)}
          style={{
            padding: '2px 8px',
            fontSize: 9,
            fontWeight: 600,
            borderRadius: 3,
            border: `1px solid ${C.bd}`,
            background: 'transparent',
            color: C.t3,
            cursor: 'pointer',
            fontFamily: M,
          }}
        >
          Skip TP
        </button>
      )}

      {/* Exit */}
      <button
        className="tf-btn"
        onClick={exitTradeMode}
        style={{
          padding: '3px 10px',
          fontSize: 9,
          fontWeight: 700,
          borderRadius: 4,
          border: `1px solid ${C.r}30`,
          background: C.r + '10',
          color: C.r,
          cursor: 'pointer',
          fontFamily: M,
        }}
      >
        ✕ Cancel
      </button>
    </div>
  );
}

function LevelChip({ label, value, color }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        fontFamily: M,
        padding: '1px 5px',
        borderRadius: 3,
        background: value ? color + '12' : 'transparent',
        color: value ? color : C.t3,
      }}
    >
      {label}: {value ? value.toFixed(2) : '—'}
    </span>
  );
}
