// ═══════════════════════════════════════════════════════════════════
// charEdge v13 — Order Flow Panel
//
// Compact panel that displays real-time order flow analytics:
//   • Delta bars (per-candle buy/sell imbalance)
//   • CVD sparkline (cumulative volume delta)
//   • Large trade alerts
//   • Aggressor ratio gauge
//   • Tick speed indicator
//
// Usage:
//   <OrderFlowPanel symbol="BTCUSDT" />
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { C, F, M } from '../../../constants.js';
import { orderFlowBridge } from '../../../data/engine/orderflow/OrderFlowBridge.js';
import { orderFlowEngine } from '../../../data/engine/orderflow/OrderFlowEngine';

// ─── Formatters ────────────────────────────────────────────────

function fmtNum(n) {
  if (n == null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(2);
}

function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── Mini Bar Chart ────────────────────────────────────────────

function DeltaBars({ deltas, width = 200, height = 36 }) {
  if (!deltas?.length) return null;
  const max = Math.max(...deltas.map(d => Math.abs(d.delta || 0)), 1);
  const barW = Math.max(2, width / deltas.length - 1);

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {deltas.map((d, i) => {
        const val = d.delta || 0;
        const h = (Math.abs(val) / max) * (height / 2 - 1);
        const y = val >= 0 ? height / 2 - h : height / 2;
        const fill = val >= 0 ? C.g : C.r;
        return <rect key={i} x={i * (barW + 1)} y={y} width={barW} height={Math.max(1, h)} fill={fill} rx={1} opacity={0.8} />;
      })}
      <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={C.bd} strokeWidth={0.5} />
    </svg>
  );
}

// ─── CVD Sparkline ─────────────────────────────────────────────

function CVDLine({ cvdData, width = 200, height = 28 }) {
  if (!cvdData?.length || cvdData.length < 2) return null;

  const values = cvdData.map(d => d.cvd || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const trend = values[values.length - 1] >= values[0];

  const points = values.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="cvdGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={trend ? C.g : C.r} stopOpacity={0.3} />
          <stop offset="100%" stopColor={trend ? C.g : C.r} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill="url(#cvdGrad)"
      />
      <polyline points={points} fill="none" stroke={trend ? C.g : C.r} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Aggressor Gauge ───────────────────────────────────────────

function AggressorGauge({ ratio }) {
  const buyPct = ratio != null ? Math.round(ratio * 100) : 50;
  const sellPct = 100 - buyPct;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
      <span style={{ fontSize: 10, fontFamily: M, color: C.g, fontWeight: 700, width: 30 }}>{buyPct}%</span>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: C.r, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          width: `${buyPct}%`,
          height: '100%',
          borderRadius: 3,
          background: C.g,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <span style={{ fontSize: 10, fontFamily: M, color: C.r, fontWeight: 700, width: 30, textAlign: 'right' }}>{sellPct}%</span>
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────

export default function OrderFlowPanel({ symbol = 'BTCUSDT' }) {
  const [stats, setStats] = useState(null);
  const [deltas, setDeltas] = useState([]);
  const [cvd, setCvd] = useState([]);
  const [largeTrades, setLargeTrades] = useState([]);
  const [connected, setConnected] = useState(false);
  const intervalRef = useRef(null);

  // Connect to order flow on mount
  useEffect(() => {
    const upper = symbol.toUpperCase();

    if (!orderFlowBridge.isConnected(upper)) {
      orderFlowBridge.connect(upper);
    }
    setConnected(true);

    // Poll engine stats at 2Hz
    intervalRef.current = setInterval(() => {
      const s = orderFlowEngine.getStats(upper);
      setStats(s);
      setDeltas(orderFlowEngine.getDeltas(upper, '1m') || []);
      setCvd(orderFlowEngine.getCVD(upper) || []);
      setLargeTrades(orderFlowEngine.getLargeTrades(upper) || []);
    }, 500);

    return () => {
      clearInterval(intervalRef.current);
    };
  }, [symbol]);

  const tickSpeed = stats?.tickSpeed || 0;
  const aggressorBuyPct = stats?.aggressorRatio?.buyPct || 50;

  return (
    <div style={{
      padding: 14,
      fontFamily: F,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      height: '100%',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>
            ⚡ Order Flow — {symbol.replace('USDT', '')}
          </div>
          <div style={{ fontSize: 10, color: C.t3, marginTop: 1 }}>
            {connected ? '🟢 Live' : '⚪ Disconnected'} · {tickSpeed.toFixed(1)} ticks/s
          </div>
        </div>
        <div style={{
          padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
          fontFamily: M, background: `${C.b}15`, color: C.b,
        }}>
          {stats?.totalTicks?.toLocaleString() || 0} ticks
        </div>
      </div>

      {/* Aggressor Ratio */}
      <div style={{
        background: C.sf, border: `1px solid ${C.bd}`, borderRadius: 10, padding: '10px 12px',
      }}>
        <div style={{ fontSize: 10, color: C.t3, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
          Aggressor Ratio (Buy vs Sell)
        </div>
        <AggressorGauge ratio={aggressorBuyPct / 100} />
      </div>

      {/* Delta Bars */}
      <div style={{
        background: C.sf, border: `1px solid ${C.bd}`, borderRadius: 10, padding: '10px 12px',
      }}>
        <div style={{ fontSize: 10, color: C.t3, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
          Delta (1m candles)
        </div>
        <DeltaBars deltas={deltas} width={280} height={36} />
      </div>

      {/* CVD */}
      <div style={{
        background: C.sf, border: `1px solid ${C.bd}`, borderRadius: 10, padding: '10px 12px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 10, color: C.t3, fontWeight: 600, textTransform: 'uppercase' }}>
            CVD (Cumulative Volume Delta)
          </div>
          {cvd.length > 0 && (
            <span style={{
              fontSize: 11, fontFamily: M, fontWeight: 700,
              color: cvd[cvd.length - 1]?.cvd >= 0 ? C.g : C.r,
            }}>
              {fmtNum(cvd[cvd.length - 1]?.cvd)}
            </span>
          )}
        </div>
        <CVDLine cvdData={cvd} width={280} height={32} />
      </div>

      {/* Large Trade Alerts */}
      <div style={{
        background: C.sf, border: `1px solid ${C.bd}`, borderRadius: 10, padding: '10px 12px',
      }}>
        <div style={{ fontSize: 10, color: C.t3, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
          🐋 Large Trades ({largeTrades.length})
        </div>
        {largeTrades.length === 0 ? (
          <div style={{ fontSize: 11, color: C.t3, textAlign: 'center', padding: 8 }}>
            Watching for whale activity…
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 120, overflowY: 'auto' }}>
            {largeTrades.slice(-10).reverse().map((t, i) => (
              <div key={t.time + '-' + i} style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontFamily: M,
                padding: '3px 6px', borderRadius: 4,
                background: i === 0 ? `${t.side === 'buy' ? C.g : C.r}08` : 'transparent',
              }}>
                <span style={{ fontSize: 12 }}>{t.side === 'buy' ? '🟢' : '🔴'}</span>
                <span style={{ color: C.t1, fontWeight: 600 }}>{fmtNum(t.volume)}</span>
                <span style={{ color: C.t3 }}>@</span>
                <span style={{ color: C.t1 }}>${fmtNum(t.price)}</span>
                <span style={{
                  color: C.y, fontSize: 9, padding: '1px 4px',
                  borderRadius: 3, background: `${C.y}15`,
                }}>
                  {t.sigma?.toFixed(1)}σ
                </span>
                <span style={{ color: C.t3, marginLeft: 'auto', fontSize: 9 }}>{fmtTime(t.time)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clusters */}
      {(stats?.clusters?.length > 0) && (
        <div style={{
          background: C.sf, border: `1px solid ${C.bd}`, borderRadius: 10, padding: '10px 12px',
        }}>
          <div style={{ fontSize: 10, color: C.t3, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
            🏗️ Trade Clusters
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {stats.clusters.slice(-5).reverse().map((cl, i) => (
              <div key={cl.startTime + '-' + i} style={{
                display: 'flex', gap: 8, fontSize: 10, fontFamily: M, color: C.t2,
              }}>
                <span style={{ fontWeight: 600, color: C.t1 }}>${fmtNum(cl.avgPrice)}</span>
                <span>×{cl.count} trades</span>
                <span>({fmtNum(cl.totalVolume)} vol)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
