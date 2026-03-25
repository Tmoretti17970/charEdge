// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — Futures Analytics Dashboard
//
// Real-time derived analytics for ES, NQ, CL, GC futures.
// Shows VWAP deviation, cumulative delta, ATR, RSI, and signals.
//
// Legal: "Proprietary Analytics — Not a Data Feed"
// All values are derived computations, not raw exchange data.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { futuresDerivedAdapter } from '../../../../data/adapters/FuturesDerivedAdapter.js';
import s from './FuturesAnalytics.module.css';
import { C } from '@/constants.js';

// ─── Constants ──────────────────────────────────────────────────

const INSTRUMENTS = [
  { symbol: 'ES', name: 'E-mini S&P 500', color: null }, // uses C.g at render time
  { symbol: 'NQ', name: 'E-mini Nasdaq', color: '#5c9cf5' },
  { symbol: 'CL', name: 'Crude Oil', color: '#e8642c' },
  { symbol: 'GC', name: 'Gold', color: '#f0b64e' },
];

/** Resolve instrument color lazily — avoids TDZ when C is in another chunk */
function getInstrumentColor(inst) {
  return inst.color || C.g;
}

// ─── Sub-Components ─────────────────────────────────────────────

function SignalBadge({ direction, confidence }) {
  const config = {
    bullish: { bg: 'rgba(45,212,160,0.15)', color: C.g, icon: '▲', label: 'Bullish' },
    bearish: { bg: 'rgba(232,100,44,0.15)', color: '#e8642c', icon: '▼', label: 'Bearish' },
    neutral: { bg: 'rgba(255,255,255,0.04)', color: C.t3, icon: '—', label: 'Neutral' },
  }[direction] || { bg: 'rgba(255,255,255,0.04)', color: C.t3, icon: '—', label: '—' };

  return (
    <div className={s.badge} style={{ '--badge-bg': config.bg, '--badge-color': config.color }}>
      <span className={s.badgeIcon}>{config.icon}</span>
      <span className={s.badgeLabel}>{config.label}</span>
      <span className={s.badgeConf}>{(confidence * 100).toFixed(0)}%</span>
    </div>
  );
}

function MetricCell({ label, value, suffix = '', color, small = false }) {
  return (
    <div className={s.metricCell} data-small={small}>
      <span className={s.metricLabel}>{label}</span>
      <span className={s.metricValue} data-small={small} style={color ? { '--metric-color': color } : undefined}>
        {value}
        {suffix && <span className={s.metricSuffix}>{suffix}</span>}
      </span>
    </div>
  );
}

function VWAPBar({ deviation, aboveVwap }) {
  const clamped = Math.max(-2, Math.min(2, deviation));
  const pct = ((clamped + 2) / 4) * 100;
  const color = aboveVwap ? C.g : '#e8642c';

  return (
    <div className={s.vwapWrap} style={{ '--vwap-color': color }}>
      <div className={s.vwapLabel}>VWAP DEV</div>
      <div className={s.vwapTrack}>
        <div className={s.vwapCenter} />
        <div
          className={s.vwapIndicator}
          style={{
            left: pct < 50 ? `${pct}%` : '50%',
            width: `${Math.abs(pct - 50)}%`,
          }}
        />
      </div>
      <div className={s.vwapValue}>
        {deviation >= 0 ? '+' : ''}
        {deviation.toFixed(3)}%
      </div>
    </div>
  );
}

function DeltaGauge({ delta, direction }) {
  const color = direction === 'positive' ? C.g : '#e8642c';
  return <MetricCell label="Cum. Delta" value={delta >= 0 ? `+${delta.toFixed(0)}` : delta.toFixed(0)} color={color} />;
}

function RSIGauge({ rsi, zone }) {
  const color = zone === 'overbought' ? '#e8642c' : zone === 'oversold' ? C.g : C.t1;
  return <MetricCell label="RSI" value={rsi.toFixed(1)} color={color} />;
}

// ─── Instrument Card ────────────────────────────────────────────

function InstrumentCard({ instrument, analytics }) {
  const color = getInstrumentColor(instrument);
  if (!analytics) {
    return (
      <div className={s.card} data-waiting="true" style={{ '--inst-color': color }}>
        <div className={s.cardHeader}>
          <div className={s.cardHeaderLeft}>
            <div className={s.cardDot} />
            <span className={s.cardSymbol}>{instrument.symbol}</span>
            <span className={s.cardName}>{instrument.name}</span>
          </div>
        </div>
        <span className={s.cardWaiting}>Waiting for bridge...</span>
      </div>
    );
  }

  return (
    <div className={s.card} style={{ '--inst-color': color }}>
      <div className={s.cardHeader}>
        <div className={s.cardHeaderLeft}>
          <div className={s.cardDot} />
          <span className={s.cardSymbol}>{instrument.symbol}</span>
          <span className={s.cardName}>{instrument.name}</span>
        </div>
        <SignalBadge direction={analytics.signal_direction} confidence={analytics.signal_confidence} />
      </div>

      <div className={s.metricsGrid}>
        <VWAPBar deviation={analytics.vwap_deviation_pct} aboveVwap={analytics.above_vwap} />
        <DeltaGauge delta={analytics.cumulative_delta} direction={analytics.delta_direction} />
        <RSIGauge rsi={analytics.rsi} zone={analytics.rsi_zone} />
        <MetricCell label="ATR Dev" value={analytics.vwap_deviation_atr} suffix="σ" />
      </div>

      <div className={s.secondaryRow}>
        <MetricCell label="Window Δ" value={analytics.windowed_delta?.toFixed(0) || '0'} small />
        <MetricCell label="Vol Ratio" value={analytics.volume_ratio?.toFixed(2) || '0'} suffix="B/S" small />
        <MetricCell label="ATR" value={analytics.atr_value?.toFixed(2) || '0'} small />
        <MetricCell label="Ticks" value={analytics.total_ticks || 0} small />
      </div>
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────

export default function FuturesAnalytics({ onClose }) {
  const [connected, setConnected] = useState(false);
  const [analytics, setAnalytics] = useState({});

  useEffect(() => {
    // Auto-connect on mount
    futuresDerivedAdapter.connect();

    const unsubs = [];

    // Subscribe to connection status
    unsubs.push(futuresDerivedAdapter.onStatus(setConnected));

    // Subscribe to each instrument
    for (const inst of INSTRUMENTS) {
      unsubs.push(
        futuresDerivedAdapter.subscribe(inst.symbol, (data) => {
          setAnalytics((prev) => ({ ...prev, [inst.symbol]: data }));
        }),
      );
    }

    return () => {
      unsubs.forEach((fn) => fn());
      // Don't disconnect on unmount — bridge stays alive
    };
  }, []);

  return (
    <div className={`tf-fade-in ${s.panel}`}>
      {/* Header */}
      <div className={s.panelHeader}>
        <div className={s.panelHeaderLeft}>
          <span className={s.panelTitle}>Futures Analytics</span>
          <div className={s.statusDot} data-live={connected} />
          <span className={s.statusLabel}>{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
        {onClose && (
          <button onClick={onClose} className={s.closeBtn}>
            ×
          </button>
        )}
      </div>

      {/* Legal Notice */}
      <div className={s.legal}>
        <span className={s.legalText}>PROPRIETARY ANALYTICS — NOT A DATA FEED</span>
      </div>

      {/* Instrument Cards */}
      <div className={s.cards}>
        {INSTRUMENTS.map((inst) => (
          <InstrumentCard key={inst.symbol} instrument={inst} analytics={analytics[inst.symbol]} />
        ))}
      </div>

      {/* Footer */}
      {!connected && (
        <div className={s.footer}>
          <span className={s.footerText}>Start the Broker Bridge to see live analytics:</span>
          <code className={s.footerCode}>python bridge.py</code>
        </div>
      )}
    </div>
  );
}
