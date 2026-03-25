// ═══════════════════════════════════════════════════════════════════
// charEdge — Volatility Dashboard & VIX Intelligence
//
// Sprint 12: Volatility regime monitor for risk management.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState } from 'react';
import { C } from '../../../constants.js';
import s from './VolatilityDashboard.module.css';
import { alpha } from '@/shared/colorUtils';

const VIX_CURRENT = 18.4;
const VIX_CHANGE = -1.2;

const REGIME = VIX_CURRENT < 15 ? 'low' : VIX_CURRENT < 20 ? 'normal' : VIX_CURRENT < 30 ? 'elevated' : 'extreme';
const REGIME_META = {
  low: {
    label: 'Low Vol',
    color: C.g,
    icon: '🟢',
    tip: 'Complacency — good for selling premium. Watch for vol expansion.',
  },
  normal: { label: 'Normal', color: '#f0b64e', icon: '🟡', tip: 'Standard conditions. Balanced approach to sizing.' },
  elevated: { label: 'Elevated', color: '#e8642c', icon: '🟠', tip: 'Reduce size. Focus on defined-risk trades.' },
  extreme: { label: 'Extreme', color: C.r, icon: '🔴', tip: 'Crisis mode. Small size only. Hedge existing positions.' },
};

// VIX term structure (mock)
const TERM_STRUCTURE = [
  { label: 'Spot', value: 18.4 },
  { label: '1M', value: 19.2 },
  { label: '2M', value: 20.1 },
  { label: '3M', value: 20.8 },
  { label: '4M', value: 21.2 },
  { label: '5M', value: 21.5 },
  { label: '6M', value: 21.8 },
];

const isContango = TERM_STRUCTURE[1].value > TERM_STRUCTURE[0].value;

// Per-symbol vol data
const SYMBOL_VOL = [
  { symbol: 'NVDA', iv: 58, hv: 42, ivRank: 72, regime: 'elevated', alert: 'IV expansion +12% this week' },
  { symbol: 'TSLA', iv: 65, hv: 55, ivRank: 85, regime: 'elevated', alert: 'Pre-earnings IV crush expected' },
  { symbol: 'AAPL', iv: 22, hv: 18, ivRank: 35, regime: 'low', alert: null },
  { symbol: 'SPY', iv: 16, hv: 14, ivRank: 28, regime: 'low', alert: null },
  { symbol: 'META', iv: 38, hv: 30, ivRank: 52, regime: 'normal', alert: 'Bollinger squeeze forming' },
  { symbol: 'AMZN', iv: 32, hv: 28, ivRank: 45, regime: 'normal', alert: null },
];

const SIZING_RULES = {
  low: { maxPct: 2.0, tip: 'Standard position sizes. Consider selling premium.' },
  normal: { maxPct: 1.5, tip: 'Slightly reduced sizing. Monitor for regime shifts.' },
  elevated: { maxPct: 1.0, tip: 'Cut position sizes by 50%. Use defined-risk trades.' },
  extreme: { maxPct: 0.5, tip: 'Minimum sizing only. Prioritize capital preservation.' },
};

function VolatilityDashboard() {
  const [collapsed, setCollapsed] = useState(false);

  const regimeMeta = REGIME_META[REGIME];
  const sizing = SIZING_RULES[REGIME];
  const tsMax = Math.max(...TERM_STRUCTURE.map((t) => t.value));
  const tsMin = Math.min(...TERM_STRUCTURE.map((t) => t.value));

  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 16, overflow: 'hidden' }}>
      <button onClick={() => setCollapsed(!collapsed)} className={`tf-btn ${s.s0}`}>
        <div className={s.s1}>
          <span style={{ fontSize: 18 }}>📉</span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)' }}>
            Volatility Dashboard
          </h3>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: regimeMeta.color,
              background: alpha(regimeMeta.color, 0.1),
              padding: '2px 7px',
              borderRadius: 4,
              fontFamily: 'var(--tf-mono)',
            }}
          >
            {regimeMeta.icon} VIX {VIX_CURRENT}
          </span>
        </div>
        <span
          style={{
            color: C.t3,
            fontSize: 11,
            transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          ▾
        </span>
      </button>

      {!collapsed && (
        <div style={{ padding: '0 20px 20px' }}>
          {/* VIX Hero */}
          <div className={s.s2}>
            {/* Current VIX */}
            <div
              style={{
                padding: '14px 16px',
                background: alpha(regimeMeta.color, 0.06),
                border: `1px solid ${alpha(regimeMeta.color, 0.15)}`,
                borderRadius: 10,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 9, color: C.t3, fontFamily: 'var(--tf-font)', marginBottom: 2 }}>VIX Index</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: regimeMeta.color, fontFamily: 'var(--tf-mono)' }}>
                {VIX_CURRENT}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: VIX_CHANGE < 0 ? C.g : C.r,
                  fontFamily: 'var(--tf-mono)',
                }}
              >
                {VIX_CHANGE > 0 ? '+' : ''}
                {VIX_CHANGE}
              </div>
            </div>

            {/* Regime */}
            <div
              style={{
                padding: '14px 16px',
                background: alpha(C.sf, 0.5),
                border: `1px solid ${alpha(C.bd, 0.5)}`,
                borderRadius: 10,
              }}
            >
              <div style={{ fontSize: 9, color: C.t3, fontFamily: 'var(--tf-font)', marginBottom: 2 }}>Regime</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: regimeMeta.color, fontFamily: 'var(--tf-font)' }}>
                {regimeMeta.label}
              </div>
              <div style={{ fontSize: 9, color: C.t2, fontFamily: 'var(--tf-font)', marginTop: 4, lineHeight: 1.4 }}>
                {regimeMeta.tip}
              </div>
            </div>

            {/* Position Sizing */}
            <div
              style={{
                padding: '14px 16px',
                background: alpha(C.sf, 0.5),
                border: `1px solid ${alpha(C.bd, 0.5)}`,
                borderRadius: 10,
              }}
            >
              <div style={{ fontSize: 9, color: C.t3, fontFamily: 'var(--tf-font)', marginBottom: 2 }}>
                Suggested Max Size
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-mono)' }}>
                {sizing.maxPct}%
              </div>
              <div style={{ fontSize: 9, color: C.t2, fontFamily: 'var(--tf-font)', marginTop: 4, lineHeight: 1.4 }}>
                {sizing.tip}
              </div>
            </div>
          </div>

          {/* Term Structure */}
          <div style={{ marginBottom: 16 }}>
            <div className={s.s3}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.t3,
                  fontFamily: 'var(--tf-font)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                VIX Term Structure
              </div>
              <span
                style={{ fontSize: 10, fontWeight: 600, color: isContango ? C.g : C.r, fontFamily: 'var(--tf-font)' }}
              >
                {isContango ? '📈 Contango (Normal)' : '📉 Backwardation (Fear)'}
              </span>
            </div>
            <div className={s.s4}>
              {TERM_STRUCTURE.map((t, i) => {
                const pct = ((t.value - tsMin) / (tsMax - tsMin)) * 100;
                return (
                  <div key={i} className={s.s5}>
                    <span style={{ fontSize: 9, color: C.t2, fontFamily: 'var(--tf-mono)' }}>{t.value}</span>
                    <div
                      style={{
                        width: '100%',
                        height: `${Math.max(pct, 10)}%`,
                        background: `linear-gradient(180deg, ${alpha(i === 0 ? regimeMeta.color : C.t3, 0.6)}, ${alpha(i === 0 ? regimeMeta.color : C.t3, 0.2)})`,
                        borderRadius: 3,
                      }}
                    />
                    <span style={{ fontSize: 8, color: C.t3, fontFamily: 'var(--tf-mono)' }}>{t.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-Symbol IV vs HV */}
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.t3,
              fontFamily: 'var(--tf-font)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            Symbol Volatility
          </div>
          <div className={s.s6}>
            {SYMBOL_VOL.map((sv) => {
              const rm = REGIME_META[sv.regime];
              const ivOverHv = sv.iv > sv.hv;
              return (
                <div
                  key={sv.symbol}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    background: alpha(C.sf, 0.5),
                    border: `1px solid ${alpha(C.bd, 0.3)}`,
                    borderRadius: 8,
                  }}
                >
                  <span
                    style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)', minWidth: 45 }}
                  >
                    {sv.symbol}
                  </span>
                  <div className={s.s7}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: C.t3, fontFamily: 'var(--tf-font)' }}>IV</div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: ivOverHv ? C.y : C.g,
                          fontFamily: 'var(--tf-mono)',
                        }}
                      >
                        {sv.iv}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, color: C.t3 }}>vs</span>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: C.t3, fontFamily: 'var(--tf-font)' }}>HV</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.t2, fontFamily: 'var(--tf-mono)' }}>
                        {sv.hv}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: C.t3, fontFamily: 'var(--tf-font)' }}>IV Rank</div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: sv.ivRank > 70 ? C.r : sv.ivRank > 40 ? C.y : C.g,
                        fontFamily: 'var(--tf-mono)',
                      }}
                    >
                      {sv.ivRank}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      color: rm.color,
                      background: alpha(rm.color, 0.1),
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontFamily: 'var(--tf-font)',
                    }}
                  >
                    {rm.label}
                  </span>
                  {sv.alert && (
                    <span
                      style={{ fontSize: 9, color: C.y, fontFamily: 'var(--tf-font)', fontWeight: 600, maxWidth: 150 }}
                    >
                      ⚡ {sv.alert}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export { VolatilityDashboard };

export default React.memo(VolatilityDashboard);
