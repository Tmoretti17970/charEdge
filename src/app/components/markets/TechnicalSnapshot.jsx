// ═══════════════════════════════════════════════════════════════════
// charEdge — Technical Snapshot (Sprint 11)
//
// Compact technical analysis summary for the detail panel.
// Computes key metrics from kline OHLCV data:
//   - RSI (14-period)
//   - SMA 20 / SMA 50 position
//   - ATR (14-period)
//   - 24h range (high/low)
//   - Volume trend
//   - Overall signal (Bullish / Bearish / Neutral)
//
// Self-contained — no dependency on FeatureExtractor or charting
// engine. Reads the same kline data from useHistoricalData.
// ═══════════════════════════════════════════════════════════════════

import { memo, useMemo } from 'react';
import { C } from '../../../constants.js';
import { radii, transition } from '../../../theme/tokens.js';
import useHistoricalData from '../../../hooks/useHistoricalData.js';
import st from './TechnicalSnapshot.module.css';

const ACCENT = '#6e5ce6';
const GREEN  = '#22c55e';
const RED    = '#ef4444';
const AMBER  = '#f59e0b';

// ═══════════════════════════════════════════════════════════════════
// Lightweight indicator calculations
// ═══════════════════════════════════════════════════════════════════

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcSMA(closes, period) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / period;
}

function calcATR(candles, period = 14) {
  if (candles.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prevC = candles[i - 1].close;
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - prevC), Math.abs(c.low - prevC)));
  }
  const recent = trs.slice(-period);
  return recent.reduce((s, v) => s + v, 0) / recent.length;
}

function calcVolumeTrend(candles, window = 10) {
  if (candles.length < window * 2) return 'n/a';
  const recent = candles.slice(-window);
  const prior  = candles.slice(-(window * 2), -window);
  const recentAvg = recent.reduce((s, c) => s + c.volume, 0) / window;
  const priorAvg  = prior.reduce((s, c) => s + c.volume, 0)  / window;
  if (priorAvg === 0) return 'n/a';
  const pct = ((recentAvg - priorAvg) / priorAvg) * 100;
  if (pct > 20) return 'rising';
  if (pct < -20) return 'falling';
  return 'stable';
}

// ═══════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════

function TechnicalSnapshot({ symbol }) {
  const { candles, loading } = useHistoricalData(symbol);

  const metrics = useMemo(() => {
    if (!candles || candles.length < 30) return null;

    const closes = candles.map((c) => c.close);
    const last = closes[closes.length - 1];
    const rsi = calcRSI(closes);
    const sma20 = calcSMA(closes, 20);
    const sma50 = calcSMA(closes, 50);
    const atr = calcATR(candles);
    const volTrend = calcVolumeTrend(candles);

    // 24h range from recent candles
    const recent24 = candles.slice(-24);
    const high24 = Math.max(...recent24.map((c) => c.high));
    const low24  = Math.min(...recent24.map((c) => c.low));
    const rangePos = high24 !== low24 ? ((last - low24) / (high24 - low24)) * 100 : 50;

    // Overall signal
    let signals = 0;
    if (rsi != null) { if (rsi > 60) signals++; else if (rsi < 40) signals--; }
    if (sma20 != null && last > sma20) signals++; else if (sma20 != null) signals--;
    if (sma50 != null && last > sma50) signals++; else if (sma50 != null) signals--;
    if (volTrend === 'rising') signals++;

    const overallSignal = signals >= 2 ? 'Bullish' : signals <= -2 ? 'Bearish' : 'Neutral';
    const signalColor = overallSignal === 'Bullish' ? GREEN : overallSignal === 'Bearish' ? RED : AMBER;

    return {
      rsi, sma20, sma50, atr, volTrend, high24, low24, rangePos, last,
      overallSignal, signalColor,
    };
  }, [candles]);

  if (loading && !metrics) {
    return (
      <div style={{ padding: '12px 20px', color: C.t3, fontSize: 11, fontFamily: 'var(--tf-font)' }}>
        Computing technicals…
      </div>
    );
  }

  if (!metrics) {
    return (
      <div style={{ padding: '12px 20px', color: C.t3, fontSize: 11, fontFamily: 'var(--tf-font)' }}>
        Insufficient data for technical analysis
      </div>
    );
  }

  const fmtP = (v) => {
    if (v == null) return '—';
    if (v >= 1000) return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (v >= 1) return v.toFixed(2);
    return v.toFixed(4);
  };

  const rsiColor = metrics.rsi > 70 ? RED : metrics.rsi < 30 ? GREEN : C.t1;
  const rsiLabel = metrics.rsi > 70 ? 'Overbought' : metrics.rsi < 30 ? 'Oversold' : 'Neutral';

  return (
    <div style={{ padding: '4px 20px 8px' }}>
      {/* ─── Overall signal badge ──────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: radii.xs,
            background: `${metrics.signalColor}12`,
            border: `1px solid ${metrics.signalColor}25`,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: metrics.signalColor,
              boxShadow: `0 0 6px ${metrics.signalColor}40`,
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'var(--tf-mono)',
              color: metrics.signalColor,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {metrics.overallSignal}
          </span>
        </div>
      </div>

      {/* ─── Metrics grid ──────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px 12px',
        }}
      >
        <MetricRow label="RSI (14)" value={metrics.rsi?.toFixed(1)} color={rsiColor} sub={rsiLabel} />
        <MetricRow label="SMA 20" value={`$${fmtP(metrics.sma20)}`} color={metrics.last > metrics.sma20 ? GREEN : RED} sub={metrics.last > metrics.sma20 ? 'Above' : 'Below'} />
        <MetricRow label="SMA 50" value={metrics.sma50 ? `$${fmtP(metrics.sma50)}` : '—'} color={metrics.sma50 ? (metrics.last > metrics.sma50 ? GREEN : RED) : C.t3} sub={metrics.sma50 ? (metrics.last > metrics.sma50 ? 'Above' : 'Below') : 'N/A'} />
        <MetricRow label="ATR (14)" value={metrics.atr ? `$${fmtP(metrics.atr)}` : '—'} color={C.t1} sub={metrics.atr ? `${((metrics.atr / metrics.last) * 100).toFixed(2)}%` : ''} />
        <MetricRow label="Volume" value={metrics.volTrend} color={metrics.volTrend === 'rising' ? GREEN : metrics.volTrend === 'falling' ? RED : C.t2} sub="vs prior" />
      </div>

      {/* ─── 24h Range Bar ─────────────────────────── */}
      <div style={{ marginTop: 10 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 3,
            fontSize: 9,
            fontFamily: 'var(--tf-mono)',
            color: C.t3,
          }}
        >
          <span>${fmtP(metrics.low24)}</span>
          <span style={{ color: C.t2, fontWeight: 600 }}>24h Range</span>
          <span>${fmtP(metrics.high24)}</span>
        </div>
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: `${C.bd}20`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${Math.max(2, Math.min(98, metrics.rangePos))}%`,
              borderRadius: 2,
              background: `linear-gradient(90deg, ${RED}, ${AMBER}, ${GREEN})`,
              transition: `width ${transition.base}`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Metric Row ─────────────────────────────────────────────

function MetricRow({ label, value, color, sub }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '3px 0',
        borderBottom: `1px solid ${C.bd}08`,
      }}
    >
      <span style={{ fontSize: 9, color: C.t3, fontFamily: 'var(--tf-mono)', fontWeight: 500 }}>
        {label}
      </span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--tf-mono)', color, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </span>
        {sub && (
          <span style={{ fontSize: 8, color: C.t3, fontFamily: 'var(--tf-mono)', marginLeft: 4 }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

export { TechnicalSnapshot };
export default memo(TechnicalSnapshot);
