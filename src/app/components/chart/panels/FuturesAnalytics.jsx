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
import { C, F } from '../../../../constants.js';
import { futuresDerivedAdapter } from '../../../../data/adapters/FuturesDerivedAdapter.js';

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
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 6,
        background: config.bg,
        fontFamily: F,
        fontSize: 11,
      }}
    >
      <span style={{ color: config.color, fontWeight: 700 }}>{config.icon}</span>
      <span style={{ color: config.color, fontWeight: 600 }}>{config.label}</span>
      <span style={{ color: C.t3, fontSize: 9, marginLeft: 2 }}>{(confidence * 100).toFixed(0)}%</span>
    </div>
  );
}

function MetricCell({ label, value, suffix = '', color, small = false }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        padding: small ? '2px 0' : '4px 0',
      }}
    >
      <span style={{ fontSize: 9, color: C.t3, fontFamily: F, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: small ? 12 : 14,
          fontWeight: 600,
          fontFamily: F,
          fontVariantNumeric: 'tabular-nums',
          color: color || C.t1,
        }}
      >
        {value}
        {suffix && <span style={{ fontSize: 9, color: C.t3, marginLeft: 2 }}>{suffix}</span>}
      </span>
    </div>
  );
}

function VWAPBar({ deviation, aboveVwap }) {
  const clamped = Math.max(-2, Math.min(2, deviation));
  const pct = ((clamped + 2) / 4) * 100;
  const color = aboveVwap ? C.g : '#e8642c';

  return (
    <div style={{ flex: 1, minWidth: 60 }}>
      <div style={{ fontSize: 9, color: C.t3, fontFamily: F, marginBottom: 2 }}>VWAP DEV</div>
      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: 'rgba(255,255,255,0.06)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Center line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '50%',
            width: 1,
            background: 'rgba(255,255,255,0.15)',
          }}
        />
        {/* Deviation indicator */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: pct < 50 ? `${pct}%` : '50%',
            width: `${Math.abs(pct - 50)}%`,
            background: color,
            borderRadius: 2,
            transition: 'all 0.3s ease',
          }}
        />
      </div>
      <div style={{ fontSize: 10, fontFamily: F, color, fontWeight: 600, marginTop: 2 }}>
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
      <div
        style={{
          padding: 12,
          borderRadius: 8,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          opacity: 0.5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, opacity: 0.4 }} />
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: F, color: C.t1 }}>{instrument.symbol}</span>
          <span style={{ fontSize: 10, color: C.t3 }}>{instrument.name}</span>
        </div>
        <span style={{ fontSize: 11, color: C.t3, fontFamily: F }}>Waiting for bridge...</span>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: color,
              boxShadow: `0 0 6px ${color}40`,
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: F, color: C.t1 }}>{instrument.symbol}</span>
          <span style={{ fontSize: 10, color: C.t3 }}>{instrument.name}</span>
        </div>
        <SignalBadge direction={analytics.signal_direction} confidence={analytics.signal_confidence} />
      </div>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
        <VWAPBar deviation={analytics.vwap_deviation_pct} aboveVwap={analytics.above_vwap} />
        <DeltaGauge delta={analytics.cumulative_delta} direction={analytics.delta_direction} />
        <RSIGauge rsi={analytics.rsi} zone={analytics.rsi_zone} />
        <MetricCell label="ATR Dev" value={analytics.vwap_deviation_atr} suffix="σ" />
      </div>

      {/* Secondary Row */}
      <div style={{ display: 'flex', gap: 12, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 6 }}>
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
    <div
      className="tf-fade-in"
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        width: 420,
        maxHeight: 'calc(100% - 16px)',
        overflowY: 'auto',
        background: C.bg2 || C.bg,
        border: `1px solid ${C.bd}`,
        borderRadius: 12,
        zIndex: 200,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: `1px solid ${C.bd}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: F, color: C.t1 }}>Futures Analytics</span>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: connected ? C.g : '#e8642c',
              boxShadow: connected ? '0 0 6px rgba(45,212,160,0.5)' : 'none',
            }}
          />
          <span style={{ fontSize: 9, color: C.t3, fontFamily: F }}>{connected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: C.t3,
              cursor: 'pointer',
              fontSize: 16,
              padding: '2px 4px',
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Legal Notice */}
      <div
        style={{
          padding: '4px 14px',
          background: 'rgba(255,255,255,0.02)',
          borderBottom: `1px solid ${C.bd}`,
        }}
      >
        <span style={{ fontSize: 8, color: C.t3, fontFamily: F, letterSpacing: '0.5px' }}>
          PROPRIETARY ANALYTICS — NOT A DATA FEED
        </span>
      </div>

      {/* Instrument Cards */}
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {INSTRUMENTS.map((inst) => (
          <InstrumentCard key={inst.symbol} instrument={inst} analytics={analytics[inst.symbol]} />
        ))}
      </div>

      {/* Footer */}
      {!connected && (
        <div
          style={{
            padding: '8px 14px',
            borderTop: `1px solid ${C.bd}`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 10, color: C.t3, fontFamily: F }}>
            Start the Broker Bridge to see live analytics:
          </span>
          <code
            style={{
              fontSize: 9,
              fontFamily: 'monospace',
              padding: '2px 6px',
              borderRadius: 4,
              background: 'rgba(255,255,255,0.04)',
              color: '#5c9cf5',
            }}
          >
            python bridge.py
          </code>
        </div>
      )}
    </div>
  );
}
