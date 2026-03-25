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
import { C } from '../../../constants.js';
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
    <div className={s.progressWrap}>
      <div className={s.s0}>
        <span className={s.progressLabel}>{label}</span>
        <span className={s.progressValue} style={{ color: color || barColor }}>
          {fmtD(current)} <span className={s.progressValueSub}>/ {fmtD(limit)}</span>
        </span>
      </div>
      <div className={s.barTrack}>
        <div
          className={s.barFill}
          style={{
            width: `${Math.min(100, progress)}%`,
            background: barColor,
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
            <div className={s.counterLabel}>CALENDAR</div>
            <div className={s.counterValue} style={{ color: C.t1 }}>
              Day {calendarDays} <span className={s.counterValueSub}>of {maxDays}</span>
            </div>
          </div>
        )}
        <div>
          <div className={s.counterLabel}>TRADING DAYS</div>
          <div className={s.counterValue} style={{ color: daysTraded >= minDays ? C.g : C.t1 }}>
            {daysTraded}
            {minDays > 0 && <span className={s.counterValueSub}> / {minDays} min</span>}
          </div>
        </div>
        <div className={s.counterStatus}>
          <div className={s.counterLabel}>STATUS</div>
          <div className={s.statusLabel} style={{ color: status === 'passed' ? C.g : status === 'failed' ? C.r : C.b }}>
            {status === 'passed' ? '✅ PASSED' : status === 'failed' ? '❌ FAILED' : '⏳ Active'}
          </div>
        </div>
      </div>

      {/* Mini Calendar Grid */}
      {calendarDays30.length > 0 && (
        <div className={s.s2}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className={s.calDayHeader}>
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
                className={s.calCell}
                style={{
                  background: bg,
                  border: cell.isToday ? `1px solid ${C.b}` : '1px solid transparent',
                  fontWeight: cell.isToday ? 800 : 600,
                  color,
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
      <button className={`tf-btn ${s.setupBtn}`} onClick={() => setShowSetup(true)}>
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
    <Card className={s.setupCardWrap}>
      <div className={s.s3}>
        <div className={s.setupTitle}>Select Prop Firm</div>
        <button className={`tf-btn ${s.closeBtn}`} onClick={() => setShowSetup(false)}>
          ✕
        </button>
      </div>
      {Object.entries(grouped).map(([firm, presets]) => (
        <div key={firm} className={s.firmGroup}>
          <div className={s.firmLabel}>{firmLabels[firm] || firm}</div>
          <div className={s.s4}>
            {presets.map((p) => (
              <button className={`tf-btn ${s.presetBtn}`} key={p.id} onClick={() => onSelect(p.id)}>
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
      <div className={s.setupWrap}>
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
          <div className={s.headerTitle}>🏢 {activeProfile.name}</div>
          <div className={s.headerSub}>
            {fmtD(activeProfile.accountSize)} account · Started {new Date(activeProfile.startDate).toLocaleDateString()}
          </div>
        </div>
        <button className={`tf-btn ${s.clearBtn}`} onClick={clearActive}>
          ✕ Clear
        </button>
      </div>

      {/* Fail banner */}
      {status === 'failed' && failReason && <div className={`${s.banner} ${s.bannerFail}`}>❌ {failReason}</div>}

      {/* Pass banner */}
      {status === 'passed' && (
        <div className={`${s.banner} ${s.bannerPass}`}>
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
      <div className={s.statsRow}>
        <span>
          Equity: <strong className={`${s.statVal} ${s.statT1}`}>{fmtD(evaluation.currentEquity)}</strong>
        </span>
        <span>
          High: <strong className={`${s.statVal} ${s.statGreen}`}>{fmtD(evaluation.equityHigh)}</strong>
        </span>
        <span>
          Cum P&L:{' '}
          <strong className={s.statVal} style={{ color: evaluation.cumPnl >= 0 ? C.g : C.r }}>
            {fmtD(evaluation.cumPnl)}
          </strong>
        </span>
        <span>
          Today:{' '}
          <strong
            className={s.statVal}
            style={{ color: evaluation.dailyPnl >= 0 ? C.g : evaluation.dailyPnl < 0 ? C.r : C.t3 }}
          >
            {fmtD(evaluation.dailyPnl)}
          </strong>
        </span>
      </div>

      {/* P1.6: MC Pass/Fail Prediction */}
      {prediction && !prediction.insufficient && (
        <div className={s.mcBlock}>
          <div className={s.mcTitle}>
            MONTE CARLO PREDICTION ({prediction.runs.toLocaleString()} sims · {prediction.confidence} confidence)
          </div>
          <div className={s.s7}>
            {/* Pass probability */}
            <div className={s.mcCenter}>
              <div
                className={s.mcPassRate}
                style={{ color: prediction.passRate >= 60 ? C.g : prediction.passRate >= 40 ? C.y : C.r }}
              >
                {prediction.passRate.toFixed(0)}%
              </div>
              <div className={s.mcLabel}>PASS</div>
            </div>
            {/* Fail probability */}
            <div className={s.mcCenter}>
              <div className={s.mcFailRate} style={{ color: C.r + 'cc' }}>
                {prediction.failRate.toFixed(0)}%
              </div>
              <div className={s.mcLabel}>FAIL</div>
            </div>
            {/* Visual bar */}
            <div className={s.mcBar} style={{ background: C.r + '30' }}>
              <div
                className={s.mcBarFill}
                style={{
                  width: `${prediction.passRate}%`,
                  background: C.g,
                  borderRadius: '5px 0 0 5px',
                }}
              />
              <div style={{ width: `${prediction.activeRate}%`, background: C.y }} />
            </div>
            {/* Details */}
            <div className={s.mcDetails}>
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
