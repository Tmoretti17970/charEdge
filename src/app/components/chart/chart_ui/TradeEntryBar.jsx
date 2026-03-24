// ═══════════════════════════════════════════════════════════════════
// charEdge v10.6 — Trade Entry Bar
// Sprint 10 C10.6: Toolbar strip shown during trade entry mode.
// Shows current step, side toggle, level readouts, and actions.
// ═══════════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { calcRiskReward, calcPositionSize } from '../../../../state/chart/tradeSlice';
import Icon from '../../design/Icon.jsx';
import { useChartFeaturesStore } from '../../../../state/chart/useChartFeaturesStore';
import { useChartTradeStore } from '../../../../state/chart/useChartTradeStore';
import s from './TradeEntryBar.module.css';

const STEPS = [
  { id: 'entry', label: '1. Entry', icon: 'pin' },
  { id: 'sl', label: '2. Stop Loss', icon: 'stop-loss' },
  { id: 'tp', label: '3. Target', icon: 'target' },
  { id: 'ready', label: 'Ready', icon: 'check' },
];

export default function TradeEntryBar() {
  const tradeMode = useChartFeaturesStore((st) => st.tradeMode);
  const tradeStep = useChartFeaturesStore((st) => st.tradeStep);
  const tradeSide = useChartFeaturesStore((st) => st.tradeSide);
  const pendingEntry = useChartTradeStore((st) => st.pendingEntry);
  const pendingSL = useChartTradeStore((st) => st.pendingStopLoss);
  const pendingTP = useChartTradeStore((st) => st.pendingTakeProfit);
  const setTradeSide = useChartTradeStore((st) => st.setTradeSide);
  const exitTradeMode = useChartFeaturesStore((st) => st.exitTradeMode);
  const riskAmount = useChartTradeStore((st) => st.riskAmount);

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
    <div className={s.bar}>
      {/* Side toggle */}
      <div className={s.sideGroup}>
        {['long', 'short'].map((side) => (
          <button
            className={s.sideBtn}
            key={side}
            onClick={() => setTradeSide(side)}
            data-active={tradeSide === side || undefined}
            data-side={side}
          >
            <Icon name={side === 'long' ? 'long' : 'short'} size={9} /> {side}
          </button>
        ))}
      </div>

      <div className={s.divider} />

      {/* Step indicators */}
      {STEPS.map((step, i) => {
        const isCurrent = step.id === tradeStep;
        const isDone = STEPS.findIndex((st) => st.id === tradeStep) > i;
        const state = isCurrent ? 'current' : isDone ? 'done' : undefined;
        return (
          <div key={step.id} className={s.stepChip} data-state={state}>
            <span className={s.stepIcon}>
              {isDone ? <Icon name="check" size={10} /> : <Icon name={step.icon} size={10} />}
            </span>
            <span className={s.stepLabel} data-state={state}>
              {step.label}
            </span>
          </div>
        );
      })}

      <div className={s.divider} />

      {/* Level readouts */}
      <LevelChip label="E" value={pendingEntry?.price} color="var(--tf-info)" />
      <LevelChip label="SL" value={pendingSL?.price} color="var(--tf-red)" />
      <LevelChip label="TP" value={pendingTP?.price} color="var(--tf-green)" />

      {/* R:R display */}
      {rr?.rr > 0 && (
        <>
          <div className={s.divider} />
          <span
            className={s.rrValue}
            data-quality={rr.rr >= 2 ? 'good' : rr.rr >= 1 ? 'neutral' : 'bad'}
          >
            {rr.rr}R
          </span>
        </>
      )}

      {/* Position size */}
      {pos?.shares > 0 && (
        <span className={s.posInfo}>
          {pos.shares}sh · ${pos.actualRisk} risk
        </span>
      )}

      {/* Spacer */}
      <div className={s.spacer} />

      {/* Instruction */}
      <span className={s.hint}>
        {tradeStep === 'entry' && 'Click chart to set entry price'}
        {tradeStep === 'sl' && 'Click chart to set stop loss'}
        {tradeStep === 'tp' && 'Click chart to set target (or skip)'}
        {tradeStep === 'ready' && 'Ready — open Quick Journal to log'}
      </span>

      {/* Skip TP */}
      {tradeStep === 'tp' && (
        <button
          className={s.skipBtn}
          onClick={() => useChartTradeStore.getState().setTP(pendingEntry?.price, 0)}
        >
          Skip TP
        </button>
      )}

      {/* Exit */}
      <button className={s.cancelBtn} onClick={exitTradeMode}>
        ✕ Cancel
      </button>
    </div>
  );
}

function LevelChip({ label, value, color }) {
  return (
    <span
      className={s.levelChip}
      style={{ '--level-color': color }}
      data-has-value={!!value}
    >
      {label}: {value ? value.toFixed(2) : '—'}
    </span>
  );
}
