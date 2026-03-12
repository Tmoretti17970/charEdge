// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Prop Firm Widget (Sprint 5)
//
// P1.2: Real-time progress bars (daily loss, drawdown, profit target)
// P1.4: Evaluation day counter with pass/fail calendar
//
// Renders inline on DashboardPage when a prop firm profile is active.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useMemo, useState } from 'react';
import { C, F, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { usePropFirmStore, computeEvaluation, PRESETS } from '../../../state/usePropFirmStore.js';
import { fmtD } from '../../../utils.js';
import { mcPropFirmPredict } from '../../features/analytics/analyticsFast.js';
import { Card } from '../ui/UIKit.jsx';
import s from './PropFirmWidget.module.css';

// ─── Progress Bar Component ───────────────────────────────────────

function ProgressBar({ label, current, limit, progress, color, inverse }) {
  // inverse = true means progress TOWARD the limit is bad (daily loss, drawdown)
  const barColor = inverse
    ? progress > 80
      ? C.r
      : progress > 50
        ? C.y
        : C.g
    : progress > 80
      ? C.g
      : progress > 50
        ? C.y
        : C.t3;

  return (
    <div style={{ marginBottom: 10 }}>
      <div className={s.s0}>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.t3, fontFamily: M, textTransform: 'uppercase' }}>
          {label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: M, color: color || barColor }}>
          {fmtD(current)} <span style={{ color: C.t3, fontWeight: 400 }}>/ {fmtD(limit)}</span>
        </span>
      </div>
      <div style={{ height: 6, background: C.bg2, borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, progress)}%`,
            background: barColor,
            borderRadius: 3,
            transition: 'width 0.3s, background 0.3s',
          }}
        />
      </div>
    </div>
  );
}

// ─── P1.4: Day Counter + Mini Calendar ────────────────────────────

function DayCounter({ profile, evaluation }) {
  const { calendarDays, daysTraded, dailyPnlByDate, status } = evaluation;
  const maxDays = profile.evaluationDays;
  const minDays = profile.minTradingDays;
  const startDateNum = profile.startDate ? new Date(profile.startDate).getTime() : null;

  // Build mini calendar (last 30 days or evaluation period)
  const calendarDays30 = useMemo(() => {
    if (!startDateNum) return [];
    const startDate = new Date(startDateNum);
    const cells = [];
    const dayCount = Math.min(maxDays || 30, 42); // Max 6 weeks
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const pnl = dailyPnlByDate[key] || null;
      const isToday = key === new Date().toISOString().slice(0, 10);
      const isFuture = d > new Date();
      cells.push({ date: key, day: d.getDate(), pnl, isToday, isFuture, traded: pnl !== null });
    }
    return cells;
  }, [startDateNum, maxDays, dailyPnlByDate]);

  return (
    <div>
      {/* Day Counter */}
      <div className={s.s1}>
        {maxDays > 0 && (
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, fontFamily: M }}>CALENDAR</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.t1 }}>
              Day {calendarDays} <span style={{ fontSize: 12, color: C.t3, fontWeight: 400 }}>of {maxDays}</span>
            </div>
          </div>
        )}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, fontFamily: M }}>TRADING DAYS</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: daysTraded >= minDays ? C.g : C.t1 }}>
            {daysTraded}
            {minDays > 0 && <span style={{ fontSize: 12, color: C.t3, fontWeight: 400 }}> / {minDays} min</span>}
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, fontFamily: M }}>STATUS</div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              textTransform: 'uppercase',
              color: status === 'passed' ? C.g : status === 'failed' ? C.r : C.b,
            }}
          >
            {status === 'passed' ? '✅ PASSED' : status === 'failed' ? '❌ FAILED' : '⏳ Active'}
          </div>
        </div>
      </div>

      {/* Mini Calendar Grid */}
      {calendarDays30.length > 0 && (
        <div
          className={s.s2}
        >
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div
              key={i}
              style={{ fontSize: 8, fontWeight: 700, color: C.t3, textAlign: 'center', fontFamily: M, padding: 2 }}
            >
              {d}
            </div>
          ))}
          {/* Pad to start on correct day */}
          {startDateNum && Array.from({ length: new Date(startDateNum).getDay() }, (_, i) => <div key={`pad-${i}`} />)}
          {calendarDays30.map((cell) => {
            let bg = 'transparent';
            let color = C.t3;
            if (cell.isFuture) {
              bg = C.bg2 + '40';
              color = C.t3 + '60';
            } else if (cell.traded) {
              bg = cell.pnl >= 0 ? C.g + '25' : C.r + '25';
              color = cell.pnl >= 0 ? C.g : C.r;
            } else if (!cell.isFuture) {
              bg = C.bg2;
            }

            return (
              <div
                key={cell.date}
                title={cell.traded ? `${cell.date}: ${fmtD(cell.pnl)}` : cell.date}
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 3,
                  background: bg,
                  border: cell.isToday ? `1px solid ${C.b}` : '1px solid transparent',
                  fontSize: 9,
                  fontWeight: cell.isToday ? 800 : 600,
                  color,
                  fontFamily: M,
                }}
              >
                {cell.day}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Setup Selector (shown when no active profile) ────────────────

function PropFirmSetup({ onSelect }) {
  const [showSetup, setShowSetup] = useState(false);

  if (!showSetup) {
    return (
      <button
        className="tf-btn"
        onClick={() => setShowSetup(true)}
        style={{
          width: '100%',
          padding: '10px 16px',
          borderRadius: 8,
          border: `1px dashed ${C.bd}`,
          background: 'transparent',
          color: C.t3,
          fontSize: 12,
          fontFamily: F,
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = C.p;
          e.currentTarget.style.color = C.p;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = C.bd;
          e.currentTarget.style.color = C.t3;
        }}
      >
        🏢 Track Prop Firm Evaluation
      </button>
    );
  }

  const grouped = {};
  for (const [id, p] of Object.entries(PRESETS)) {
    const firm = p.firmId;
    if (!grouped[firm]) grouped[firm] = [];
    grouped[firm].push({ id, ...p });
  }

  const firmLabels = { ftmo: 'FTMO', topstep: 'Topstep', apex: 'Apex', myfundedfx: 'MyFundedFX' };

  return (
    <Card style={{ padding: 14 }}>
      <div className={s.s3}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.t1 }}>Select Prop Firm</div>
        <button
          className="tf-btn"
          onClick={() => setShowSetup(false)}
          style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', fontSize: 14, padding: 4 }}
        >
          ✕
        </button>
      </div>
      {Object.entries(grouped).map(([firm, presets]) => (
        <div key={firm} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, fontFamily: M, marginBottom: 4 }}>
            {firmLabels[firm] || firm}
          </div>
          <div className={s.s4}>
            {presets.map((p) => (
              <button
                className="tf-btn"
                key={p.id}
                onClick={() => onSelect(p.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: `1px solid ${C.bd}`,
                  background: C.sf,
                  color: C.t1,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: F,
                  cursor: 'pointer',
                  transition: 'all 0.1s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = C.p;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = C.bd;
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </Card>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────

function PropFirmWidget() {
  const trades = useJournalStore((s) => s.trades);
  const activeProfile = usePropFirmStore((s) => s.activeProfile);
  const createFromPreset = usePropFirmStore((s) => s.createFromPreset);
  const clearActive = usePropFirmStore((s) => s.clearActive);

  const evaluation = useMemo(() => {
    if (!activeProfile) return null;
    return computeEvaluation(trades, activeProfile);
  }, [trades, activeProfile]);

  // P1.6: Monte Carlo pass/fail prediction
  const prediction = useMemo(() => {
    if (!activeProfile || !evaluation || evaluation.status !== 'active') return null;
    // Build daily P&L array from evaluation
    const dailyPnls = Object.values(evaluation.dailyPnlByDate || {});
    if (dailyPnls.length < 3) return null;
    return mcPropFirmPredict(dailyPnls, evaluation, activeProfile, 5000);
  }, [activeProfile, evaluation]);

  // No active profile — show setup prompt
  if (!activeProfile || !evaluation) {
    return (
      <div style={{ marginBottom: 16 }}>
        <PropFirmSetup onSelect={(presetId) => createFromPreset(presetId)} />
      </div>
    );
  }

  const { status, failReason } = evaluation;
  const borderColor = status === 'passed' ? C.g : status === 'failed' ? C.r : C.p;

  return (
    <Card style={{ padding: 16, marginBottom: 16, borderLeft: `3px solid ${borderColor}` }}>
      {/* Header */}
      <div className={s.s5}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>🏢 {activeProfile.name}</div>
          <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
            {fmtD(activeProfile.accountSize)} account · Started {new Date(activeProfile.startDate).toLocaleDateString()}
          </div>
        </div>
        <button
          className="tf-btn"
          onClick={clearActive}
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            border: `1px solid ${C.bd}`,
            background: 'transparent',
            color: C.t3,
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          ✕ Clear
        </button>
      </div>

      {/* Fail banner */}
      {status === 'failed' && failReason && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            background: C.r + '12',
            borderLeft: `3px solid ${C.r}`,
            fontSize: 11,
            color: C.r,
            fontFamily: M,
            marginBottom: 12,
          }}
        >
          ❌ {failReason}
        </div>
      )}

      {/* Pass banner */}
      {status === 'passed' && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            background: C.g + '12',
            borderLeft: `3px solid ${C.g}`,
            fontSize: 11,
            color: C.g,
            fontFamily: M,
            marginBottom: 12,
          }}
        >
          ✅ Evaluation passed! Profit target reached with {evaluation.daysTraded} trading days.
        </div>
      )}

      {/* P1.2: Progress Bars */}
      <div className={s.s6}>
        <div>
          {/* Profit Target */}
          <ProgressBar
            label="Profit Target"
            current={Math.max(0, evaluation.cumPnl)}
            limit={evaluation.targetAbs}
            progress={evaluation.targetProgress}
            inverse={false}
          />

          {/* Daily Loss */}
          {evaluation.dailyLimitAbs > 0 && (
            <ProgressBar
              label="Today's Loss Limit"
              current={Math.abs(Math.min(0, evaluation.dailyPnl))}
              limit={evaluation.dailyLimitAbs}
              progress={evaluation.dailyProgress}
              inverse={true}
            />
          )}

          {/* Trailing Drawdown */}
          <ProgressBar
            label={activeProfile.trailingDD ? 'Trailing Drawdown' : 'Max Drawdown'}
            current={evaluation.trailingDD}
            limit={evaluation.maxDDAbs}
            progress={evaluation.ddProgress}
            inverse={true}
          />
        </div>

        {/* P1.4: Day Counter + Calendar */}
        <DayCounter profile={activeProfile} evaluation={evaluation} />
      </div>

      {/* Quick stats row */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          fontSize: 11,
          fontFamily: M,
          color: C.t3,
          borderTop: `1px solid ${C.bd}`,
          paddingTop: 10,
        }}
      >
        <span>
          Equity: <strong style={{ color: C.t1 }}>{fmtD(evaluation.currentEquity)}</strong>
        </span>
        <span>
          High: <strong style={{ color: C.g }}>{fmtD(evaluation.equityHigh)}</strong>
        </span>
        <span>
          Cum P&L: <strong style={{ color: evaluation.cumPnl >= 0 ? C.g : C.r }}>{fmtD(evaluation.cumPnl)}</strong>
        </span>
        <span>
          Today:{' '}
          <strong style={{ color: evaluation.dailyPnl >= 0 ? C.g : evaluation.dailyPnl < 0 ? C.r : C.t3 }}>
            {fmtD(evaluation.dailyPnl)}
          </strong>
        </span>
      </div>

      {/* P1.6: MC Pass/Fail Prediction */}
      {prediction && !prediction.insufficient && (
        <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 6, background: C.bg2 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, fontFamily: M, marginBottom: 6 }}>
            MONTE CARLO PREDICTION ({prediction.runs.toLocaleString()} sims · {prediction.confidence} confidence)
          </div>
          <div className={s.s7}>
            {/* Pass probability */}
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: prediction.passRate >= 60 ? C.g : prediction.passRate >= 40 ? C.y : C.r,
                }}
              >
                {prediction.passRate.toFixed(0)}%
              </div>
              <div style={{ fontSize: 9, color: C.t3, fontFamily: M }}>PASS</div>
            </div>
            {/* Fail probability */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.r + 'cc' }}>{prediction.failRate.toFixed(0)}%</div>
              <div style={{ fontSize: 9, color: C.t3, fontFamily: M }}>FAIL</div>
            </div>
            {/* Visual bar */}
            <div
              style={{
                flex: 1,
                height: 10,
                borderRadius: 5,
                background: C.r + '30',
                overflow: 'hidden',
                display: 'flex',
              }}
            >
              <div
                style={{
                  width: `${prediction.passRate}%`,
                  background: C.g,
                  borderRadius: '5px 0 0 5px',
                  transition: 'width 0.3s',
                }}
              />
              <div style={{ width: `${prediction.activeRate}%`, background: C.y }} />
            </div>
            {/* Details */}
            <div style={{ fontSize: 10, fontFamily: M, color: C.t3, whiteSpace: 'nowrap' }}>
              {prediction.avgDaysToPass > 0 && <div>~{prediction.avgDaysToPass}d to pass</div>}
              <div>P50: {fmtD(prediction.p50)}</div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export { PropFirmSetup, ProgressBar, DayCounter };

export default React.memo(PropFirmWidget);
