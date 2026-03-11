import { useMemo } from 'react';
import { C, F, M } from '../../../../constants.js';
import { calcRiskReward, calcPositionSize } from '../../../../state/chart/tradeSlice';
import { useChartStore } from '../../../../state/useChartStore';
import { useLayoutStore } from '../../../../state/useLayoutStore';

export default function PositionSizer() {
  const closePanel = useLayoutStore((s) => s.closePanel);
  const accountSize = useChartStore((s) => s.accountSize) ?? 25000;
  const riskPercent = useChartStore((s) => s.riskPercent) ?? 1;
  const riskAmount = useChartStore((s) => s.riskAmount) ?? (accountSize * (riskPercent / 100));
  const riskMode = useChartStore((s) => s.riskMode) ?? 'percent';
  const setAccountSize = useChartStore((s) => s.setAccountSize) ?? (() => {});
  const setRiskPercent = useChartStore((s) => s.setRiskPercent) ?? (() => {});
  const setRiskAmount = useChartStore((s) => s.setRiskAmount) ?? (() => {});
  const setRiskMode = useChartStore((s) => s.setRiskMode) ?? (() => {});
  const pendingEntry = useChartStore((s) => s.pendingEntry);
  const pendingSL = useChartStore((s) => s.pendingSL ?? s.pendingStopLoss);
  const pendingTP = useChartStore((s) => s.pendingTP ?? s.pendingTakeProfit);
  const tradeSide = useChartStore((s) => s.tradeSide);

  const entry = pendingEntry?.price ?? pendingEntry;
  const sl = pendingSL?.price ?? pendingSL;
  const tp = pendingTP?.price ?? pendingTP;

  const rr = useMemo(() => calcRiskReward(entry, sl, tp, tradeSide), [entry, sl, tp, tradeSide]);
  const pos = useMemo(() => calcPositionSize(accountSize, riskPercent, entry, sl), [accountSize, riskPercent, entry, sl]);

  // Derived values for display
  const riskPerUnit = entry && sl ? Math.abs(entry - sl) : 0;
  const notionalValue = pos && entry ? pos * entry : 0;
  const actualRiskValue = pos && riskPerUnit ? pos * riskPerUnit : 0;

  return (
    <div>
      {/* Account + Risk */}
      <div style={{ padding: '0' }}>
        <Row label="Account">
          <NumberInput value={accountSize} onChange={setAccountSize} prefix="$" step={1000} />
        </Row>

        <Row label="Risk Mode">
          <div style={{ display: 'flex', gap: 2 }}>
            {['percent', 'fixed'].map((m) => (
              <button
                className="tf-btn"
                key={m}
                onClick={() => setRiskMode(m)}
                style={{
                  flex: 1,
                  padding: '3px 0',
                  fontSize: 9,
                  fontWeight: 700,
                  borderRadius: 3,
                  border: `1px solid ${riskMode === m ? C.b : C.bd}`,
                  background: riskMode === m ? C.b + '15' : 'transparent',
                  color: riskMode === m ? C.b : C.t3,
                  cursor: 'pointer',
                  fontFamily: M,
                }}
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

        <div style={{ height: 1, background: C.bd, margin: '6px 0' }} />

        {/* Calculated risk amount */}
        <Row label="Risk Amount">
          <span style={{ fontSize: 11, fontWeight: 700, color: C.r, fontFamily: M }}>${(riskAmount ?? 0).toFixed(0)}</span>
        </Row>

        {/* Levels display */}
        <div style={{ height: 1, background: C.bd, margin: '6px 0' }} />

        <Row label="Entry">
          <LevelDisplay value={entry} color={C.info} />
        </Row>
        <Row label="Stop Loss">
          <LevelDisplay value={sl} color={C.r} />
        </Row>
        <Row label="Target">
          <LevelDisplay value={tp} color={C.g} />
        </Row>

        {/* Computed results */}
        {pos != null && (
          <>
            <div style={{ height: 1, background: C.bd, margin: '6px 0' }} />
            <Row label="Position Size">
              <span style={{ fontSize: 12, fontWeight: 800, color: C.t1, fontFamily: M }}>{pos} shares</span>
            </Row>
            <Row label="Notional">
              <span style={{ fontSize: 10, color: C.t2, fontFamily: M }}>${notionalValue.toLocaleString()}</span>
            </Row>
            <Row label="Risk/Share">
              <span style={{ fontSize: 10, color: C.r, fontFamily: M }}>${riskPerUnit.toFixed(2)}</span>
            </Row>
            <Row label="Actual Risk">
              <span style={{ fontSize: 10, color: C.r, fontFamily: M }}>${actualRiskValue.toFixed(0)}</span>
            </Row>
          </>
        )}

        {rr != null && isFinite(rr) && (
          <>
            <div style={{ height: 1, background: C.bd, margin: '6px 0' }} />
            <Row label="R:R Ratio">
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  fontFamily: M,
                  color: rr >= 2 ? C.g : rr >= 1 ? C.y : C.r,
                }}
              >
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
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '3px 0',
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 600, color: C.t3, fontFamily: M }}>{label}</span>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, prefix, suffix, step = 1, min, max }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {prefix && <span style={{ fontSize: 9, color: C.t3, fontFamily: M }}>{prefix}</span>}
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
        style={{
          width: 70,
          padding: '2px 6px',
          fontSize: 10,
          borderRadius: 3,
          border: `1px solid ${C.bd}`,
          background: C.sf,
          color: C.t1,
          fontFamily: M,
          outline: 'none',
          textAlign: 'right',
        }}
      />
      {suffix && <span style={{ fontSize: 9, color: C.t3, fontFamily: M }}>{suffix}</span>}
    </div>
  );
}

function LevelDisplay({ value, color }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        fontFamily: M,
        color: value ? color : C.t3,
      }}
    >
      {value ? `$${value.toFixed(2)}` : '—'}
    </span>
  );
}
