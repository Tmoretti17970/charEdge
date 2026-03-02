// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Single-Pass Analytics Engine (Phase 4)
//
// Replaces multi-pass analytics.js. Iterates trades ONCE to accumulate
// all metrics simultaneously. Eliminates:
//   - 2× filter() for winners/losers
//   - 2× sort() + forEach() for streak tracking
//   - 1× map() for pnl array
//   - 5× forEach() for breakdowns (day/hour/strategy/emotion/daily)
//
// v10.1: Uses integer-cent accumulation (Money.js) to eliminate
//        floating-point drift over large trade datasets.
//
// Designed to run in a Web Worker.
// ═══════════════════════════════════════════════════════════════════

import { SCALE } from '../../../charting_library/model/Money.js';

const FIAT = SCALE.FIAT; // 100 — used for integer accumulation
const toC = (v) => Math.round((v || 0) * FIAT); // float → cents
const fromC = (c) => c / FIAT; // cents → float

const MIN_SAMPLES = {
  kelly: 10,
  sharpe: 20,
  sortino: 20,
  monteCarlo: 30,
  correlation: 10,
};

/**
 * Single-pass analytics engine.
 * One iteration through trades, then derived metrics.
 *
 * @param {Object[]} trades
 * @param {Object} [settings={}]
 * @returns {Object|null}
 */
function computeFast(trades, settings = {}) {
  if (!trades?.length) return null;
  if (!settings || typeof settings !== 'object') settings = {};

  const warnings = [];
  const n = trades.length;

  // ─── Accumulators (filled in single pass) ───────────────────
  // Integer-cent accumulation eliminates floating-point drift.
  // All *Cents variables are integers; converted to float at output.
  let totalPnlCents = 0,
    totalFeesCents = 0;
  let winCount = 0,
    lossCount = 0;
  let winSumCents = 0,
    lossSumCents = 0;
  let bestTradeCents = -Infinity,
    worstTradeCents = Infinity;
  let rSum = 0,
    rCount = 0;
  let ruleBreaks = 0;

  // Pnl array for Kelly/Monte Carlo (reuse single allocation)
  const pnls = new Float64Array(n);

  // Daily aggregation map (integer cents)
  const dailyMap = {};

  // Breakdown maps (integer cents for pnl)
  const dayBuckets = Array.from({ length: 7 }, (_, i) => ({
    name: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i],
    pnlCents: 0,
    count: 0,
    wins: 0,
  }));
  const hourBuckets = Array.from({ length: 24 }, (_, i) => ({
    hour: i + ':00',
    pnlCents: 0,
    count: 0,
  }));
  const strategyMap = {};
  const emotionMap = {};
  const symbolMap = {}; // J2.1
  const tagMap = {}; // J3.2
  const assetClassMap = {}; // J2.2
  const durations = []; // J2.3: hold durations in minutes
  const durationPnls = []; // J2.3: paired P&L for duration correlation
  // J2.4: playbook × day-of-week matrix
  const playbookDayMap = {};

  // J3.1: Day vs Hour Profit Heatmap Matrix
  const dayHourMatrix = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ pnlCents: 0, count: 0, wins: 0 }))
  ); // { playbook: { 0: {pnl,count}, 1: {...}, ... } }

  // Pre-sort index for streak computation
  // Build [index, dateStr] pairs and sort once
  const sortedIdxs = Array.from({ length: n }, (_, i) => i);
  sortedIdxs.sort((a, b) => trades[a].date.localeCompare(trades[b].date));

  // ─── SINGLE PASS ────────────────────────────────────────────
  for (let i = 0; i < n; i++) {
    const t = trades[i];
    const pnl = t.pnl;
    const pnlC = toC(pnl); // integer cents — no drift

    // Core accumulators (integer)
    totalPnlCents += pnlC;
    totalFeesCents += toC(t.fees);
    pnls[i] = pnl; // Float64Array for Monte Carlo (drift-tolerant)

    if (pnlC > 0) {
      winCount++;
      winSumCents += pnlC;
      if (pnlC > bestTradeCents) bestTradeCents = pnlC;
    } else if (pnlC < 0) {
      lossCount++;
      lossSumCents += pnlC; // negative
      if (pnlC < worstTradeCents) worstTradeCents = pnlC;
    }

    // R-Multiple
    if (t.rMultiple != null && t.rMultiple !== '' && !isNaN(t.rMultiple)) {
      rSum += t.rMultiple;
      rCount++;
    }

    // Rule compliance
    if (!t.followedRules) ruleBreaks++;

    // Daily P&L aggregation (integer cents)
    const dateKey = t.date.slice(0, 10);
    dailyMap[dateKey] = (dailyMap[dateKey] || 0) + pnlC;

    // Day-of-week
    const dow = new Date(t.date).getDay();
    dayBuckets[dow].pnlCents += pnlC;
    dayBuckets[dow].count++;
    if (pnlC > 0) dayBuckets[dow].wins++;

    // Hour-of-day
    const hour = new Date(t.date).getHours();
    hourBuckets[hour].pnlCents += pnlC;
    hourBuckets[hour].count++;

    // J3.1 Matrix population
    dayHourMatrix[dow][hour].pnlCents += pnlC;
    dayHourMatrix[dow][hour].count++;
    if (pnlC > 0) dayHourMatrix[dow][hour].wins++;

    // Strategy/Playbook
    const rawPb = t.playbook || 'untagged';
    const stKey = rawPb.toLowerCase();
    if (!strategyMap[stKey]) strategyMap[stKey] = { name: rawPb, pnlCents: 0, count: 0, wins: 0 };
    strategyMap[stKey].pnlCents += pnlC;
    strategyMap[stKey].count++;
    if (pnlC > 0) strategyMap[stKey].wins++;

    // Emotion
    const emKey = t.emotion || 'untagged';
    if (!emotionMap[emKey]) emotionMap[emKey] = { pnlCents: 0, count: 0, wins: 0 };
    emotionMap[emKey].pnlCents += pnlC;
    emotionMap[emKey].count++;
    if (pnlC > 0) emotionMap[emKey].wins++;

    // J2.1: Symbol breakdown
    const symKey = (t.symbol || 'unknown').toUpperCase();
    if (!symbolMap[symKey]) symbolMap[symKey] = { pnlCents: 0, count: 0, wins: 0, rSum: 0, rCount: 0 };
    symbolMap[symKey].pnlCents += pnlC;
    symbolMap[symKey].count++;
    if (pnlC > 0) symbolMap[symKey].wins++;
    if (t.rMultiple != null && !isNaN(t.rMultiple)) {
      symbolMap[symKey].rSum += t.rMultiple;
      symbolMap[symKey].rCount++;
    }

    // J2.2: Asset class breakdown
    const acKey = t.assetClass || 'untagged';
    if (!assetClassMap[acKey]) assetClassMap[acKey] = { pnlCents: 0, count: 0, wins: 0, rSum: 0, rCount: 0 };
    assetClassMap[acKey].pnlCents += pnlC;
    assetClassMap[acKey].count++;
    if (pnlC > 0) assetClassMap[acKey].wins++;
    if (t.rMultiple != null && !isNaN(t.rMultiple)) {
      assetClassMap[acKey].rSum += t.rMultiple;
      assetClassMap[acKey].rCount++;
    }

    // J3.2: Tag Correlation
    if (Array.isArray(t.tags) && t.tags.length > 0) {
      t.tags.forEach(tag => {
        const normalizeTag = tag.toLowerCase().trim();
        if (!normalizeTag) return;
        if (!tagMap[normalizeTag]) {
          tagMap[normalizeTag] = { name: tag, pnlCents: 0, count: 0, wins: 0, rSum: 0, rCount: 0 };
        }
        tagMap[normalizeTag].pnlCents += pnlC;
        tagMap[normalizeTag].count++;
        if (pnlC > 0) tagMap[normalizeTag].wins++;
        if (t.rMultiple != null && !isNaN(t.rMultiple)) {
          tagMap[normalizeTag].rSum += t.rMultiple;
          tagMap[normalizeTag].rCount++;
        }
      });
    }

    // J2.3: Time-in-trade duration (minutes)
    if (t.closeDate && t.date) {
      const openMs = new Date(t.date).getTime();
      const closeMs = new Date(t.closeDate).getTime();
      if (closeMs > openMs) {
        const durationMin = (closeMs - openMs) / 60000;
        durations.push(durationMin);
        durationPnls.push(pnl);
      }
    }

    // J2.4: Playbook × Day-of-Week correlation
    const pbKey = t.playbook || 'untagged';
    if (!playbookDayMap[pbKey]) {
      playbookDayMap[pbKey] = {};
      for (let d = 0; d < 7; d++) playbookDayMap[pbKey][d] = { pnlCents: 0, count: 0, wins: 0 };
    }
    playbookDayMap[pbKey][dow].pnlCents += pnlC;
    playbookDayMap[pbKey][dow].count++;
    if (pnlC > 0) playbookDayMap[pbKey][dow].wins++;
  }

  // ─── Streaks & Tilt (single pass over sorted indices) ──────────────
  let bestStreak = 0,
    worstStreak = 0;
  let curWin = 0,
    curLoss = 0;

  // Sprint 4: "Tilt" / Revenge Trade Detector
  let tiltTradesCount = 0;
  let tiltPnlCents = 0;
  let lastLossEndTimeMs = 0;

  for (let i = 0; i < n; i++) {
    const t = trades[sortedIdxs[i]];
    const pnl = t.pnl;
    const pnlC = toC(pnl);

    const openMs = new Date(t.date).getTime();

    // Tilt Detection: Trade opened within 15 minutes (900,000 ms) of a recent loss ending
    if (lastLossEndTimeMs > 0 && openMs > lastLossEndTimeMs && (openMs - lastLossEndTimeMs) <= 15 * 60 * 1000) {
      tiltTradesCount++;
      tiltPnlCents += pnlC;
    }

    if (pnl > 0) {
      curWin++;
      curLoss = 0;
      if (curWin > bestStreak) bestStreak = curWin;
    } else if (pnl < 0) {
      curLoss++;
      curWin = 0;
      if (curLoss > worstStreak) worstStreak = curLoss;

      // Record when this loss ended, or started if closeDate is missing
      lastLossEndTimeMs = t.closeDate ? new Date(t.closeDate).getTime() : openMs;
    } else {
      curWin = 0;
      curLoss = 0;
    }
  }

  // ─── Derived Metrics (cents → dollars at output boundary) ──
  const totalPnl = fromC(totalPnlCents);
  const totalFees = fromC(totalFeesCents);
  const winSum = fromC(winSumCents);
  const lossSum = fromC(lossSumCents);

  const winRate = (winCount / n) * 100;
  const avgWin = winCount > 0 ? winSum / winCount : 0;
  const avgLoss = lossCount > 0 ? Math.abs(lossSum) / lossCount : 0;
  const rr = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
  const pf = lossSum !== 0 ? winSum / Math.abs(lossSum) : winSum > 0 ? Infinity : 0;

  // Expectancy
  const winRate01 = winCount / n;
  const lossRate01 = 1 - winRate01;
  const expectancy = winRate01 * avgWin - lossRate01 * avgLoss;
  const expectancyR = avgLoss > 0 ? expectancy / avgLoss : expectancy > 0 ? Infinity : 0;

  // Kelly: f* = μ / σ²
  const meanPnl = totalPnl / n;
  let varPnl = 0;
  for (let i = 0; i < n; i++) {
    varPnl += (pnls[i] - meanPnl) ** 2;
  }
  varPnl = n > 1 ? varPnl / (n - 1) : 0;
  const kelly = varPnl > 0 ? Math.max(0, Math.min(1, meanPnl / varPnl)) : 0;

  if (n < MIN_SAMPLES.kelly) {
    warnings.push({
      metric: 'kelly',
      message: `Kelly based on ${n} trades (${MIN_SAMPLES.kelly}+ recommended for reliability)`,
    });
  }

  // ─── Daily Stats (Sharpe, Sortino, Equity, Drawdown) ────────
  // dailyMap stores cents — convert to dollars for statistical calculations
  const dailyEntries = Object.entries(dailyMap).sort((a, b) => a[0].localeCompare(b[0]));
  const numDays = dailyEntries.length;
  const dailyPnls = dailyEntries.map(([, cents]) => fromC(cents));

  let dailyMean = 0;
  for (let i = 0; i < numDays; i++) dailyMean += dailyPnls[i];
  dailyMean = numDays > 0 ? dailyMean / numDays : 0;

  let dailyVar = 0;
  for (let i = 0; i < numDays; i++) dailyVar += (dailyPnls[i] - dailyMean) ** 2;
  const dailyStd = numDays > 1 ? Math.sqrt(dailyVar / (numDays - 1)) : 0;

  const Rf = Number(settings.riskFreeRate) || 0;
  const dailyRf = Rf / 252;
  const sharpe = dailyStd > 0 ? ((dailyMean - dailyRf) / dailyStd) * Math.sqrt(Math.min(252, numDays)) : 0;

  if (numDays < MIN_SAMPLES.sharpe) {
    warnings.push({
      metric: 'sharpe',
      message: `Sharpe based on ${numDays} trading days (${MIN_SAMPLES.sharpe}+ recommended)`,
    });
  }

  // Sortino
  let downVar = 0,
    downCount = 0;
  for (let i = 0; i < numDays; i++) {
    if (dailyPnls[i] < dailyRf) {
      downVar += (dailyPnls[i] - dailyRf) ** 2;
      downCount++;
    }
  }
  const dDev = downCount > 1 ? Math.sqrt(downVar / downCount) : 0;
  const sortino = dDev > 0 ? ((dailyMean - dailyRf) / dDev) * Math.sqrt(Math.min(252, numDays)) : 0;

  if (numDays < MIN_SAMPLES.sortino) {
    warnings.push({
      metric: 'sortino',
      message: `Sortino based on ${numDays} trading days (${MIN_SAMPLES.sortino}+ recommended)`,
    });
  }

  const accountProxy = settings.accountSize || Math.max(1000, Math.abs(totalPnl) + avgLoss * 20);

  // Equity curve + max drawdown
  let peak = 0,
    maxDd = 0,
    cum = 0;
  const eq = dailyEntries.map(([date, _cents], idx) => {
    const dailyPnl = dailyPnls[idx]; // already converted to dollars
    cum += dailyPnl;
    if (cum > peak) peak = cum;
    const peakEq = accountProxy + peak;
    const currentEq = accountProxy + cum;
    const dd = peakEq > 0 ? ((peakEq - currentEq) / peakEq) * 100 : 0;
    if (dd > maxDd) maxDd = dd;
    return { date, pnl: cum, daily: dailyPnl, dd };
  });

  // ─── Monte Carlo Risk of Ruin ──────────────────────────────
  const MC_RUNS = settings.mcRuns ?? 2000;
  const SEQ_LEN = settings.mcSeqLen || 100;
  const RUIN_DD = settings.ruinDdThreshold || 0.3;

  let ruinCount = 0;
  if (MC_RUNS > 0) {
    for (let run = 0; run < MC_RUNS; run++) {
      let equity = accountProxy,
        eqPeak = accountProxy,
        ruined = false;
      for (let j = 0; j < SEQ_LEN; j++) {
        equity += pnls[Math.floor(Math.random() * n)];
        if (equity > eqPeak) eqPeak = equity;
        if (equity <= 0 || (eqPeak > 0 && (eqPeak - equity) / eqPeak >= RUIN_DD)) {
          ruined = true;
          break;
        }
      }
      if (ruined) ruinCount++;
    }
  }
  const ror = MC_RUNS > 0 ? (ruinCount / MC_RUNS) * 100 : 0;

  if (n < MIN_SAMPLES.monteCarlo) {
    warnings.push({
      metric: 'monteCarlo',
      message: `Monte Carlo based on ${n} trades (${MIN_SAMPLES.monteCarlo}+ recommended)`,
    });
  }

  // ─── Extremes (cents → dollars) ─────────────────────────────
  const lw = bestTradeCents === -Infinity ? 0 : fromC(bestTradeCents);
  const ll = worstTradeCents === Infinity ? 0 : fromC(worstTradeCents);

  // ─── R-Multiple ────────────────────────────────────────────
  const avgR = rCount > 0 ? rSum / rCount : 0;

  // ─── Consecutive Loss Probability ──────────────────────────
  const consLoss3 = Math.pow(lossRate01, 3) * 100;
  const consLoss5 = Math.pow(lossRate01, 5) * 100;

  // ─── H2.2: Calmar Ratio ─────────────────────────────────────
  // Calmar = annualized return % / max drawdown %
  const annualizedReturnPct = numDays > 0
    ? (totalPnl / accountProxy) * (252 / numDays) * 100
    : 0;
  const calmar = maxDd > 0 ? annualizedReturnPct / maxDd : (totalPnl > 0 ? Infinity : 0);

  // ─── H2.2: Recovery Factor ──────────────────────────────────
  // Recovery = total P&L / max drawdown in dollars
  const maxDdDollars = accountProxy * (maxDd / 100);
  const recoveryFactor = maxDdDollars > 0 ? totalPnl / maxDdDollars : (totalPnl > 0 ? Infinity : 0);

  // ─── H2.2: R-Multiple Distribution ──────────────────────────
  const rDistribution = computeRDistribution(trades);

  // ─── H2.2: Emotion → P&L Correlation ────────────────────────
  const emotionCorrelation = computeEmotionCorrelation(trades);

  // ─── H2.2: Streak Impact Analysis ──────────────────────────
  const streakImpact = computeStreakImpact(trades, sortedIdxs);

  // ─── Insights ──────────────────────────────────────────────
  const ins = [];
  if (expectancy > 0)
    ins.push({ t: 'positive', x: `Positive expectancy: $${expectancy.toFixed(0)} per trade. Your system has edge.` });
  else if (expectancy < 0)
    ins.push({ t: 'warning', x: `Negative expectancy: $${expectancy.toFixed(0)} per trade. Review your strategy.` });
  if (kelly > 0.01)
    ins.push({ t: 'positive', x: `Continuous Kelly: ${(kelly * 100).toFixed(1)}% (return-to-variance ratio).` });
  if (ror < 5) ins.push({ t: 'positive', x: `MC Ruin (2K sims): ${ror.toFixed(1)}% at 30% DD. Sustainable.` });
  else if (ror > 30) ins.push({ t: 'warning', x: `MC Ruin (2K sims): ${ror.toFixed(1)}%. Reduce size.` });
  if (Rf > 0) ins.push({ t: 'info', x: `Sharpe/Sortino adjusted for Rf=${(Rf * 100).toFixed(1)}%.` });
  if (winRate < 45) ins.push({ t: 'warning', x: `Win rate ${winRate.toFixed(1)}% — need higher R:R.` });
  if (winRate > 65) ins.push({ t: 'positive', x: `Strong ${winRate.toFixed(1)}% win rate.` });
  if (rr > 2.5 && rr !== Infinity) ins.push({ t: 'positive', x: `Excellent ${rr.toFixed(2)}:1 reward/risk.` });
  if (Math.abs(worstStreak) >= 4)
    ins.push({ t: 'warning', x: `${Math.abs(worstStreak)}-trade losing streak. Review risk management.` });
  if (!ins.length) ins.push({ t: 'info', x: 'Import more trades for deeper insights.' });

  // ─── Return ────────────────────────────────────────────────
  // Shape matches analytics.js exactly for backward compatibility.
  // Breakdown maps converted from integer cents → float dollars at output boundary.
  const byDay = dayBuckets.map((b) => ({ name: b.name, pnl: fromC(b.pnlCents), count: b.count, wins: b.wins }));
  const byH = hourBuckets.map((b) => ({ hour: b.hour, pnl: fromC(b.pnlCents), count: b.count }));
  const bySt = {};
  for (const [k, v] of Object.entries(strategyMap)) {
    bySt[v.name] = { pnl: fromC(v.pnlCents), count: v.count, wins: v.wins };
  }
  const byEmo = {};
  for (const [k, v] of Object.entries(emotionMap)) {
    byEmo[k] = { pnl: fromC(v.pnlCents), count: v.count, wins: v.wins };
  }

  // J2.1: Performance by Symbol
  const bySym = {};
  for (const [k, v] of Object.entries(symbolMap)) {
    bySym[k] = {
      pnl: fromC(v.pnlCents),
      count: v.count,
      wins: v.wins,
      winRate: v.count > 0 ? (v.wins / v.count) * 100 : 0,
      avgR: v.rCount > 0 ? v.rSum / v.rCount : 0,
    };
  }

  // J2.2: Performance by Asset Class
  const byAC = {};
  for (const [k, v] of Object.entries(assetClassMap)) {
    byAC[k] = {
      pnl: fromC(v.pnlCents),
      count: v.count,
      wins: v.wins,
      winRate: v.count > 0 ? (v.wins / v.count) * 100 : 0,
      avgR: v.rCount > 0 ? v.rSum / v.rCount : 0,
    };
  }

  // J3.2: Performance by Tag
  const byTag = {};
  for (const [k, v] of Object.entries(tagMap)) {
    byTag[k] = {
      name: v.name,
      pnl: fromC(v.pnlCents),
      count: v.count,
      wins: v.wins,
      winRate: v.count > 0 ? (v.wins / v.count) * 100 : 0,
      avgR: v.rCount > 0 ? v.rSum / v.rCount : 0,
    };
  }

  // J2.5: Rolling Performance Windows (7d, 30d, 90d)
  // Uses dailyEntries (sorted by date) to compute windowed metrics
  const rollingWindows = computeRollingWindows(dailyEntries, dailyPnls);

  // J2.3: Duration Analysis
  const durationStats = computeDurationStats(durations, durationPnls);

  // J2.4: Playbook × Day Correlation Matrix
  const corrMatrix = {};
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (const [pb, days] of Object.entries(playbookDayMap)) {
    corrMatrix[pb] = {};
    for (let d = 0; d < 7; d++) {
      const cell = days[d];
      corrMatrix[pb][dayNames[d]] = {
        pnl: fromC(cell.pnlCents),
        count: cell.count,
        wins: cell.wins,
        winRate: cell.count > 0 ? (cell.wins / cell.count) * 100 : 0,
      };
    }
  }

  return {
    totalPnl,
    totalFees,
    winRate,
    avgWin,
    avgLoss,
    rr,
    pf,
    sharpe,
    sortino,
    maxDd: maxDd,
    expectancy,
    expectancyR,
    kelly,
    ror,
    eq,
    byDay,
    byH,
    bySt,
    byEmo,
    bySym, // J2.1
    byAC, // J2.2
    byTag, // J3.2
    rolling: rollingWindows, // J2.5
    duration: durationStats, // J2.3
    playbookDayCorr: corrMatrix, // J2.4
    dayHourMatrix,
    best: bestStreak,
    worst: worstStreak,
    bestStreak,
    worstStreak,
    tiltTradesCount,
    tiltPnl: fromC(tiltPnlCents),
    lw,
    ll,
    avgR,
    ruleBreaks,
    consLoss3,
    consLoss5,
    insights: ins,
    warnings,
    tradeCount: n,
    winCount,
    lossCount,
    // H2.2: Deep Analytics v2
    calmar,
    recoveryFactor,
    rDistribution,
    avgHoldTime: durationStats.avgMinutes,
    emotionCorrelation,
    streakImpact,
  };
}

/**
 * J2.3: Time-in-Trade Duration Analysis
 * Bins trades by hold duration and computes P&L correlation.
 *
 * @param {number[]} durations - hold durations in minutes
 * @param {number[]} pnls - paired P&L values
 * @returns {Object}
 */
function computeDurationStats(durations, pnls) {
  if (!durations.length) return { avgMinutes: 0, medianMinutes: 0, buckets: [], correlation: 0, count: 0 };

  const n = durations.length;

  // Average and median
  const sorted = [...durations].sort((a, b) => a - b);
  const sum = durations.reduce((s, d) => s + d, 0);
  const avg = sum / n;
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

  // Duration buckets
  const BINS = [
    { label: '< 5m', min: 0, max: 5 },
    { label: '5–15m', min: 5, max: 15 },
    { label: '15–30m', min: 15, max: 30 },
    { label: '30–60m', min: 30, max: 60 },
    { label: '1–4h', min: 60, max: 240 },
    { label: '4h–1d', min: 240, max: 1440 },
    { label: '1d+', min: 1440, max: Infinity },
  ];

  const buckets = BINS.map((b) => ({ label: b.label, pnl: 0, count: 0, wins: 0, avgPnl: 0 }));

  for (let i = 0; i < n; i++) {
    const d = durations[i];
    const p = pnls[i];
    for (let j = 0; j < BINS.length; j++) {
      if (d >= BINS[j].min && d < BINS[j].max) {
        buckets[j].pnl += p;
        buckets[j].count++;
        if (p > 0) buckets[j].wins++;
        break;
      }
    }
  }

  for (const b of buckets) {
    b.avgPnl = b.count > 0 ? b.pnl / b.count : 0;
    b.winRate = b.count > 0 ? (b.wins / b.count) * 100 : 0;
  }

  // Pearson correlation between duration and P&L
  let correlation = 0;
  if (n >= 5) {
    const meanD = sum / n;
    const meanP = pnls.reduce((s, p) => s + p, 0) / n;
    let cov = 0,
      varD = 0,
      varP = 0;
    for (let i = 0; i < n; i++) {
      const dd = durations[i] - meanD;
      const dp = pnls[i] - meanP;
      cov += dd * dp;
      varD += dd * dd;
      varP += dp * dp;
    }
    const denom = Math.sqrt(varD * varP);
    correlation = denom > 0 ? cov / denom : 0;
  }

  return { avgMinutes: avg, medianMinutes: median, buckets, correlation, count: n };
}

/**
 * J2.5: Rolling Performance Windows
 * Compute 7-day, 30-day, 90-day rolling metrics from daily P&L data.
 * Returns { '7d': {...}, '30d': {...}, '90d': {...} }
 *
 * @param {Array} dailyEntries - sorted [date, cents] pairs
 * @param {number[]} dailyPnls - daily P&L in dollars (same order)
 * @returns {Object}
 */
function computeRollingWindows(dailyEntries, dailyPnls) {
  const windows = {};
  const PERIODS = { '7d': 7, '30d': 30, '90d': 90 };

  for (const [label, days] of Object.entries(PERIODS)) {
    if (dailyPnls.length < 2) {
      windows[label] = { pnl: 0, winRate: 0, expectancy: 0, sharpe: 0, trades: 0, days: 0 };
      continue;
    }

    // Take the last N days
    const slice = dailyPnls.slice(-days);
    const n = slice.length;
    if (n === 0) {
      windows[label] = { pnl: 0, winRate: 0, expectancy: 0, sharpe: 0, trades: 0, days: 0 };
      continue;
    }

    let sum = 0,
      wins = 0;
    for (let i = 0; i < n; i++) {
      sum += slice[i];
      if (slice[i] > 0) wins++;
    }

    const mean = sum / n;
    let variance = 0;
    for (let i = 0; i < n; i++) variance += (slice[i] - mean) ** 2;
    const std = n > 1 ? Math.sqrt(variance / (n - 1)) : 0;

    const winRate = (wins / n) * 100;
    const sharpe = std > 0 ? (mean / std) * Math.sqrt(Math.min(252, n)) : 0;

    // Expectancy: average win * win% - average loss * loss%
    let winSum = 0,
      lossSum = 0,
      lossCount = 0;
    for (let i = 0; i < n; i++) {
      if (slice[i] > 0) winSum += slice[i];
      else if (slice[i] < 0) {
        lossSum += Math.abs(slice[i]);
        lossCount++;
      }
    }
    const avgWin = wins > 0 ? winSum / wins : 0;
    const avgLoss = lossCount > 0 ? lossSum / lossCount : 0;
    const expectancy = (wins / n) * avgWin - (lossCount / n) * avgLoss;

    windows[label] = {
      pnl: sum,
      winRate,
      expectancy,
      sharpe,
      days: n,
    };
  }

  return windows;
}

export { computeFast, MIN_SAMPLES, mcPropFirmPredict, computeRDistribution, computeEmotionCorrelation, computeStreakImpact };
export default computeFast;

// ─── H2.2: R-Multiple Distribution ─────────────────────────────

/**
 * Compute R-multiple distribution histogram with summary stats.
 * @param {Object[]} trades
 * @returns {{ buckets: Object[], mean: number, median: number, stdDev: number, count: number }}
 */
function computeRDistribution(trades) {
  const rValues = trades
    .map((t) => t.rMultiple)
    .filter((r) => r != null && isFinite(r));

  if (rValues.length < 2) {
    return { buckets: [], mean: 0, median: 0, stdDev: 0, count: 0 };
  }

  const n = rValues.length;
  const sorted = [...rValues].sort((a, b) => a - b);

  // Stats
  const sum = rValues.reduce((s, r) => s + r, 0);
  const mean = sum / n;
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  let variance = 0;
  for (let i = 0; i < n; i++) variance += (rValues[i] - mean) ** 2;
  const stdDev = n > 1 ? Math.sqrt(variance / (n - 1)) : 0;

  // Histogram: -4R to +4R in 0.5R steps
  const bucketSize = 0.5;
  const minR = -4;
  const maxR = 4;
  const buckets = [];

  for (let r = minR; r < maxR; r += bucketSize) {
    const label = r === 0 ? '0R' : `${r >= 0 ? '+' : ''}${r.toFixed(1)}R`;
    const count = rValues.filter((v) => v >= r && v < r + bucketSize).length;
    buckets.push({ label, r, count });
  }

  // Overflow buckets
  const belowCount = rValues.filter((v) => v < minR).length;
  const aboveCount = rValues.filter((v) => v >= maxR).length;
  if (belowCount > 0) buckets.unshift({ label: `<${minR}R`, r: minR - 1, count: belowCount });
  if (aboveCount > 0) buckets.push({ label: `>${maxR}R`, r: maxR, count: aboveCount });

  return { buckets, mean, median, stdDev, count: n };
}

// ─── H2.2: Emotion → P&L Correlation ───────────────────────────

/**
 * Compute Pearson correlation between emotion sentiment and P&L.
 * Maps emotions to a numeric sentiment scale:
 *   negative emotions → -1, neutral → 0, positive → +1
 * @param {Object[]} trades
 * @returns {{ pearsonR: number, sampleSize: number, emotions: Object }}
 */
function computeEmotionCorrelation(trades) {
  const SENTIMENT = {
    // Negative
    anxious: -1, fearful: -1, frustrated: -1, angry: -1, revenge: -1,
    fomo: -1, greedy: -1, stressed: -1, panicked: -1, impatient: -1,
    // Neutral
    neutral: 0, calm: 0, bored: 0, indifferent: 0, untagged: 0,
    // Positive
    confident: 1, focused: 1, disciplined: 1, patient: 1, euphoric: 0.5,
    optimistic: 1, satisfied: 1,
  };

  const pairs = [];
  const emotionPnl = {};

  for (const t of trades) {
    const emo = (t.emotion || 'untagged').toLowerCase().trim();
    const sentiment = SENTIMENT[emo];
    if (sentiment == null || !isFinite(t.pnl)) continue;

    pairs.push({ sentiment, pnl: t.pnl });

    if (!emotionPnl[emo]) emotionPnl[emo] = { pnl: 0, count: 0, avgPnl: 0 };
    emotionPnl[emo].pnl += t.pnl;
    emotionPnl[emo].count++;
  }

  // Finalize avgPnl
  for (const emo of Object.keys(emotionPnl)) {
    emotionPnl[emo].avgPnl = emotionPnl[emo].count > 0
      ? emotionPnl[emo].pnl / emotionPnl[emo].count
      : 0;
  }

  // Pearson r
  const n = pairs.length;
  if (n < 5) return { pearsonR: 0, sampleSize: n, emotions: emotionPnl };

  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += pairs[i].sentiment;
    sumY += pairs[i].pnl;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let cov = 0, varX = 0, varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = pairs[i].sentiment - meanX;
    const dy = pairs[i].pnl - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  const denom = Math.sqrt(varX * varY);
  const pearsonR = denom > 0 ? cov / denom : 0;

  return { pearsonR, sampleSize: n, emotions: emotionPnl };
}

// ─── H2.2: Streak Impact Analysis ──────────────────────────────

/**
 * Analyze P&L during consecutive win/loss streaks vs baseline.
 * @param {Object[]} trades
 * @param {number[]} sortedIdxs - Pre-sorted trade indices by date
 * @returns {{ avgPnlDuringWinStreak: number, avgPnlDuringLossStreak: number, avgPnlBaseline: number, streakSensitivity: number }}
 */
function computeStreakImpact(trades, sortedIdxs) {
  const n = trades.length;
  if (n < 3) {
    return { avgPnlDuringWinStreak: 0, avgPnlDuringLossStreak: 0, avgPnlBaseline: 0, streakSensitivity: 0 };
  }

  // Tag each trade: is it part of a streak of 2+ consecutive same-direction trades?
  const sorted = sortedIdxs.map((i) => trades[i]);
  const pnls = sorted.map((t) => t.pnl);
  const signs = pnls.map((p) => (p > 0 ? 1 : p < 0 ? -1 : 0));

  // Build streak lengths using forward/backward pass
  const streakLen = new Array(n).fill(1);
  for (let i = 1; i < n; i++) {
    if (signs[i] !== 0 && signs[i] === signs[i - 1]) {
      streakLen[i] = streakLen[i - 1] + 1;
    }
  }
  // Backfill: all members of a streak get the full streak length
  for (let i = n - 2; i >= 0; i--) {
    if (signs[i] !== 0 && signs[i] === signs[i + 1]) {
      streakLen[i] = Math.max(streakLen[i], streakLen[i + 1]);
    }
  }

  let winStreakSum = 0, winStreakCount = 0;
  let lossStreakSum = 0, lossStreakCount = 0;
  let totalSum = 0;

  for (let i = 0; i < n; i++) {
    totalSum += pnls[i];
    if (streakLen[i] >= 2) {
      if (signs[i] > 0) {
        winStreakSum += pnls[i];
        winStreakCount++;
      } else if (signs[i] < 0) {
        lossStreakSum += pnls[i];
        lossStreakCount++;
      }
    }
  }

  const avgPnlBaseline = n > 0 ? totalSum / n : 0;
  const avgPnlDuringWinStreak = winStreakCount > 0 ? winStreakSum / winStreakCount : 0;
  const avgPnlDuringLossStreak = lossStreakCount > 0 ? lossStreakSum / lossStreakCount : 0;

  // Streak sensitivity: how much worse/better are streak trades vs baseline
  const streakSensitivity = avgPnlBaseline !== 0
    ? ((avgPnlDuringWinStreak - avgPnlDuringLossStreak) / Math.abs(avgPnlBaseline))
    : 0;

  return { avgPnlDuringWinStreak, avgPnlDuringLossStreak, avgPnlBaseline, streakSensitivity };
}

// ─── P1.6: Monte Carlo Prop Firm Pass/Fail Prediction ──────────

/**
 * Given current evaluation state + historical trade P&Ls,
 * simulate remaining trading days to estimate probability
 * of passing or failing the prop firm evaluation.
 *
 * @param {number[]} pnls - Historical daily P&L values
 * @param {Object} evalState - From computeEvaluation()
 * @param {Object} profile - Active prop firm profile
 * @param {number} [runs=5000] - Number of simulations
 * @returns {Object} Prediction results
 */
function mcPropFirmPredict(pnls, evalState, profile, runs = 5000) {
  if (!pnls?.length || pnls.length < 3 || !evalState || !profile) {
    return {
      passRate: 0,
      failRate: 0,
      activeRate: 0,
      runs: 0,
      confidence: 'low',
      avgDaysToPass: 0,
      medianFinalPnl: 0,
      pnlDistribution: [],
      insufficient: true,
    };
  }

  const currentPnl = evalState.cumPnl || 0;
  const _currentDD = evalState.trailingDD || 0;
  const currentEquity = evalState.currentEquity || profile.accountSize;
  const equityHigh = evalState.equityHigh || profile.accountSize;
  const daysTraded = evalState.daysTraded || 0;
  const calendarDays = evalState.calendarDays || 0;

  // Resolve limits to absolutes
  const dailyLimitAbs =
    profile.dailyLossType === 'pct' ? profile.accountSize * (profile.dailyLossLimit / 100) : profile.dailyLossLimit;
  const maxDDAbs =
    profile.maxDrawdownType === 'pct' ? profile.accountSize * (profile.maxDrawdown / 100) : profile.maxDrawdown;
  const targetAbs =
    profile.profitTargetType === 'pct' ? profile.accountSize * (profile.profitTarget / 100) : profile.profitTarget;

  // Remaining days to simulate
  const maxRemaining = profile.evaluationDays > 0 ? Math.max(1, profile.evaluationDays - calendarDays) : 60; // Default 60 remaining if unlimited
  const _minDaysNeeded = Math.max(0, (profile.minTradingDays || 0) - daysTraded);

  // Filter non-zero P&Ls for sampling
  const nonZeroPnls = pnls.filter((p) => p !== 0);
  if (nonZeroPnls.length < 2) {
    return {
      passRate: 0,
      failRate: 0,
      activeRate: 0,
      runs: 0,
      confidence: 'low',
      avgDaysToPass: 0,
      medianFinalPnl: 0,
      pnlDistribution: [],
      insufficient: true,
    };
  }

  let passCount = 0;
  let failCount = 0;
  let activeCount = 0;
  let totalDaysToPass = 0;
  const finalPnls = [];

  for (let r = 0; r < runs; r++) {
    let simPnl = currentPnl;
    let simEquity = currentEquity;
    let simHigh = equityHigh;
    let simDaysTraded = daysTraded;
    let passed = false;
    let failed = false;
    let daysToPass = 0;

    for (let day = 0; day < maxRemaining; day++) {
      // ~70% chance of trading on any given day (weekdays, etc.)
      if (Math.random() < 0.3) continue;

      // Sample a random daily P&L from history
      const dayPnl = nonZeroPnls[Math.floor(Math.random() * nonZeroPnls.length)];

      simPnl += dayPnl;
      simEquity += dayPnl;
      simDaysTraded++;

      // Update equity high (trailing DD)
      if (simEquity > simHigh) simHigh = simEquity;

      // Check daily loss breach
      if (dailyLimitAbs > 0 && dayPnl < 0 && Math.abs(dayPnl) >= dailyLimitAbs) {
        failed = true;
        break;
      }

      // Check drawdown breach
      const dd = profile.trailingDD ? simHigh - simEquity : profile.accountSize - simEquity;
      if (maxDDAbs > 0 && dd >= maxDDAbs) {
        failed = true;
        break;
      }

      // Check target reached
      if (targetAbs > 0 && simPnl >= targetAbs && simDaysTraded >= (profile.minTradingDays || 0)) {
        passed = true;
        daysToPass = day + 1;
        break;
      }
    }

    if (passed) {
      passCount++;
      totalDaysToPass += daysToPass;
    } else if (failed) {
      failCount++;
    } else {
      activeCount++; // Didn't pass or fail within remaining days
    }
    finalPnls.push(simPnl);
  }

  // Build P&L distribution (10 buckets)
  finalPnls.sort((a, b) => a - b);
  const buckets = 10;
  const pnlDistribution = [];
  for (let i = 0; i < buckets; i++) {
    const idx = Math.floor((i / buckets) * finalPnls.length);
    pnlDistribution.push(finalPnls[idx]);
  }

  const passRate = (passCount / runs) * 100;
  const failRate = (failCount / runs) * 100;
  const activeRate = (activeCount / runs) * 100;
  const avgDaysToPass = passCount > 0 ? Math.round(totalDaysToPass / passCount) : 0;
  const medianFinalPnl = finalPnls[Math.floor(finalPnls.length / 2)];

  // Confidence level based on sample size
  const confidence = nonZeroPnls.length >= 30 ? 'high' : nonZeroPnls.length >= 15 ? 'medium' : 'low';

  return {
    passRate: Math.round(passRate * 10) / 10,
    failRate: Math.round(failRate * 10) / 10,
    activeRate: Math.round(activeRate * 10) / 10,
    runs,
    confidence,
    avgDaysToPass,
    medianFinalPnl: Math.round(medianFinalPnl),
    pnlDistribution,
    insufficient: false,
    p10: finalPnls[Math.floor(finalPnls.length * 0.1)],
    p25: finalPnls[Math.floor(finalPnls.length * 0.25)],
    p50: medianFinalPnl,
    p75: finalPnls[Math.floor(finalPnls.length * 0.75)],
    p90: finalPnls[Math.floor(finalPnls.length * 0.9)],
  };
}

/**
 * Sprint 4: Automated Trade Grading (A+, B, C, F)
 * Analyzes R-Multiple, Playbook Adherence, and Result to assign a grade.
 */
export function gradeTrade(t) {
  if (!t) return { grade: '?', score: 0 };

  // Rule breaking is an automatic F
  if (t.followedRules === false) return { grade: 'F', score: 0 };

  if (t.rMultiple != null && !isNaN(t.rMultiple)) {
    const r = Number(t.rMultiple);
    if (r >= 2) return { grade: 'A+', score: 5 };
    if (r >= 1) return { grade: 'A', score: 4 };
    if (r >= 0) return { grade: 'B', score: 3 };
    if (r >= -1) return { grade: 'C', score: 2 };
    if (r >= -1.5) return { grade: 'D', score: 1 };
    return { grade: 'F', score: 0 };
  }

  // Fallback heuristics if no R-multiple
  if (t.pnl > 0) return { grade: 'B', score: 3 };
  if (t.pnl === 0) return { grade: 'C', score: 2 };
  if (t.pnl < 0) return { grade: 'D', score: 1 };

  return { grade: '?', score: 0 };
}
