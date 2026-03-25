import { useMemo } from 'react';
import { calcRiskReward, calcPositionSize } from '../../../../state/chart/tradeSlice';
import { useChartFeaturesStore } from '../../../../state/chart/useChartFeaturesStore';
import { useChartTradeStore } from '../../../../state/chart/useChartTradeStore';
import s from './PositionSizer.module.css';

export default function PositionSizer() {
  const accountSize = useChartTradeStore((st) => st.accountSize) ?? 25000;
  const riskPercent = useChartTradeStore((st) => st.riskPercent) ?? 1;
  const riskAmount = useChartTradeStore((st) => st.riskAmount) ?? accountSize * (riskPercent / 100);
  const riskMode = useChartTradeStore((st) => st.riskMode) ?? 'percent';
  const setAccountSize = useChartTradeStore((st) => st.setAccountSize) ?? (() => {});
  const setRiskPercent = useChartTradeStore((st) => st.setRiskPercent) ?? (() => {});
  const setRiskAmount = useChartTradeStore((st) => st.setRiskAmount) ?? (() => {});
  const setRiskMode = useChartTradeStore((st) => st.setRiskMode) ?? (() => {});
  const pendingEntry = useChartTradeStore((st) => st.pendingEntry);
  const pendingSL = useChartTradeStore((st) => st.pendingSL ?? st.pendingStopLoss);
  const pendingTP = useChartTradeStore((st) => st.pendingTP ?? st.pendingTakeProfit);
  const tradeSide = useChartFeaturesStore((st) => st.tradeSide);

  const entry = pendingEntry?.price ?? pendingEntry;
  const sl = pendingSL?.price ?? pendingSL;
  const tp = pendingTP?.price ?? pendingTP;

  const rr = useMemo(() => calcRiskReward(entry, sl, tp, tradeSide), [entry, sl, tp, tradeSide]);
  const pos = useMemo(
    () => calcPositionSize(accountSize, riskPercent, entry, sl),
    [accountSize, riskPercent, entry, sl],
  );

  // Derived values for display
  const riskPerUnit = entry && sl ? Math.abs(entry - sl) : 0;
  const notionalValue = pos && entry ? pos * entry : 0;
  const actualRiskValue = pos && riskPerUnit ? pos * riskPerUnit : 0;

  return (
    <div>
      {/* Account + Risk */}
      <div>
        <Row label="Account">
          <NumberInput value={accountSize} onChange={setAccountSize} prefix="$" step={1000} />
        </Row>

        <Row label="Risk Mode">
          <div className={s.riskModeGroup}>
            {['percent', 'fixed'].map((m) => (
              <button
                className={s.riskModeBtn}
                key={m}
                onClick={() => setRiskMode(m)}
                data-active={riskMode === m || undefined}
              >
                {m === 'percent' ? '%' : '$'}
              </button>
            ))}
          </div>
        </Row>

        {riskMode === 'percent' ? (
          <Row label="Risk %">
            <NumberInput value={riskPercent} onChange={setRiskPercent} suffix="%" step={0.25} min={0.1} max={10} />
          </Row>
        ) : (
          <Row label="Risk $">
            <NumberInput value={riskAmount} onChange={setRiskAmount} prefix="$" step={50} min={10} />
          </Row>
        )}

        <div className={s.divider} />

        {/* Calculated risk amount */}
        <Row label="Risk Amount">
          <span className={s.riskValue}>${(riskAmount ?? 0).toFixed(0)}</span>
        </Row>

        {/* Levels display */}
        <div className={s.divider} />

        <Row label="Entry">
          <LevelDisplay value={entry} color="var(--tf-info)" />
        </Row>
        <Row label="Stop Loss">
          <LevelDisplay value={sl} color="var(--tf-red)" />
        </Row>
        <Row label="Target">
          <LevelDisplay value={tp} color="var(--tf-green)" />
        </Row>

        {/* Computed results */}
        {pos != null && (
          <>
            <div className={s.divider} />
            <Row label="Position Size">
              <span className={s.positionSize}>{pos} shares</span>
            </Row>
            <Row label="Notional">
              <span className={s.notionalValue}>${notionalValue.toLocaleString()}</span>
            </Row>
            <Row label="Risk/Share">
              <span className={s.riskPerShare}>${riskPerUnit.toFixed(2)}</span>
            </Row>
            <Row label="Actual Risk">
              <span className={s.riskPerShare}>${actualRiskValue.toFixed(0)}</span>
            </Row>
          </>
        )}

        {rr != null && isFinite(rr) && (
          <>
            <div className={s.divider} />
            <Row label="R:R Ratio">
              <span className={s.rrRatio} data-quality={rr >= 2 ? 'good' : rr >= 1 ? 'neutral' : 'bad'}>
                {rr > 0 ? `${rr}:1` : '—'}
              </span>
            </Row>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function Row({ label, children }) {
  return (
    <div className={s.row}>
      <span className={s.rowLabel}>{label}</span>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, prefix, suffix, step = 1, min, max }) {
  return (
    <div className={s.numberInputWrap}>
      {prefix && <span className={s.numberInputAffix}>{prefix}</span>}
      <input
        type="number"
        value={value}
        onChange={(e) => {
          let v = Number(e.target.value);
          if (min != null) v = Math.max(min, v);
          if (max != null) v = Math.min(max, v);
          onChange(v);
        }}
        step={step}
        className={s.numberInput}
      />
      {suffix && <span className={s.numberInputAffix}>{suffix}</span>}
    </div>
  );
}

function LevelDisplay({ value, color }) {
  return (
    <span className={s.levelValue} style={value ? { color } : undefined} data-empty={!value || undefined}>
      {value ? `$${value.toFixed(2)}` : '—'}
    </span>
  );
}
