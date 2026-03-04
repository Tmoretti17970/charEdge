// ═══════════════════════════════════════════════════════════════════
// charEdge v13 — Derivatives Dashboard Panel
//
// Real-time crypto derivatives analytics from free Binance Futures
// data. Displays: Open Interest, Funding Rate, Long/Short Ratio,
// Liquidations feed, and Taker Buy/Sell Volume.
//
// Usage:
//   <DerivativesDashboard symbol="BTCUSDT" />
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '../../../utils/logger.ts';
import { C, F, M } from '../../../constants.js';
import { binanceFuturesAdapter } from '../../../data/adapters/BinanceFuturesAdapter.js';

// ─── Formatters ────────────────────────────────────────────────

function fmtNum(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(decimals);
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(4) + '%';
}

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── Metric Card ───────────────────────────────────────────────

function MetricCard({ label, value, sub, color, icon }) {
  return (
    <div style={{
      background: C.sf,
      border: `1px solid ${C.bd}`,
      borderRadius: 10,
      padding: '12px 14px',
      flex: 1,
      minWidth: 120,
    }}>
      <div style={{ fontSize: 10, color: C.t3, fontFamily: F, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
        {icon && <span style={{ marginRight: 4 }}>{icon}</span>}
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: M, color: color || C.t1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: C.t3, fontFamily: F, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Funding Pill ──────────────────────────────────────────────

function FundingPill({ rate }) {
  if (!rate) return null;
  const color = rate > 0 ? C.g : rate < 0 ? C.r : C.t3;
  const label = rate > 0 ? 'Longs Pay' : rate < 0 ? 'Shorts Pay' : 'Neutral';

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 8px',
      borderRadius: 6,
      background: `${color}15`,
      border: `1px solid ${color}30`,
      fontSize: 10,
      fontWeight: 600,
      fontFamily: M,
      color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {label}
    </span>
  );
}

// ─── Mini Sparkline ────────────────────────────────────────────

function Sparkline({ data, width = 100, height = 28, color = C.b }) {
  if (!data?.length || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Liquidation Feed ──────────────────────────────────────────

function LiquidationFeed({ liquidations }) {
  if (!liquidations?.length) {
    return (
      <div style={{ fontSize: 11, color: C.t3, fontFamily: F, textAlign: 'center', padding: 16 }}>
        Waiting for liquidation events…
      </div>
    );
  }

  return (
    <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {liquidations.slice(-15).reverse().map((liq, i) => (
        <div key={liq.time + '-' + i} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          borderRadius: 6,
          background: i === 0 ? `${liq.type === 'long_liquidation' ? C.r : C.g}08` : 'transparent',
          fontSize: 11,
          fontFamily: M,
        }}>
          <span style={{ fontSize: 14 }}>{liq.type === 'long_liquidation' ? '🔴' : '🟢'}</span>
          <span style={{ color: C.t1, fontWeight: 600, width: 80 }}>{liq.symbol?.replace('USDT', '')}</span>
          <span style={{ color: liq.type === 'long_liquidation' ? C.r : C.g, width: 50 }}>
            {liq.type === 'long_liquidation' ? 'LONG' : 'SHORT'}
          </span>
          <span style={{ color: C.t1, flex: 1 }}>${fmtNum(liq.quantityUsd)}</span>
          <span style={{ color: C.t3, fontSize: 10 }}>{fmtTime(liq.time)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────

export default function DerivativesDashboard({ symbol = 'BTCUSDT' }) {
  const [snapshot, setSnapshot] = useState(null);
  const [oiHistory, setOiHistory] = useState([]);
  const [fundingHistory, setFundingHistory] = useState([]);
  const [lsrHistory, setLsrHistory] = useState([]);
  const [liquidations, setLiquidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const liqRef = useRef(liquidations);
  liqRef.current = liquidations;

  // Fetch snapshot + history on mount / symbol change
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [snap, oiHist, fundHist, lsr] = await Promise.all([
        binanceFuturesAdapter.fetchDerivativesSnapshot(symbol),
        binanceFuturesAdapter.fetchOpenInterestHistory(symbol, '1h', 24),
        binanceFuturesAdapter.fetchFundingRate(symbol, 20),
        binanceFuturesAdapter.fetchLongShortRatio(symbol, '1h', 24),
      ]);
      setSnapshot(snap);
      setOiHistory(oiHist.map(d => d.oi));
      setFundingHistory(fundHist.map(d => d.fundingRate * 100));
      setLsrHistory(lsr.map(d => d.longShortRatio));
    } catch (err) {
      logger.data.warn('[DerivativesDashboard] Fetch failed:', err);
    }
    setLoading(false);
  }, [symbol]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  // Subscribe to liquidation stream
  useEffect(() => {
    const unsub = binanceFuturesAdapter.subscribeLiquidations((liq) => {
      setLiquidations(prev => [...prev.slice(-50), liq]);
    });
    return unsub;
  }, []);

  const oi = snapshot?.openInterest;
  const funding = snapshot?.funding;
  const lsr = snapshot?.longShortRatio;
  const mark = snapshot?.markPrice;
  const taker = snapshot?.takerVolume;

  return (
    <div style={{
      padding: 16,
      fontFamily: F,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      height: '100%',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.t1 }}>
            📊 Derivatives — {symbol.replace('USDT', '')}
          </div>
          <div style={{ fontSize: 10, color: C.t3, marginTop: 2 }}>
            Free Binance Futures data · No API key required
          </div>
        </div>
        <button
          onClick={fetchData}
          style={{
            fontSize: 10, padding: '5px 10px', borderRadius: 6,
            border: `1px solid ${C.bd}`, background: C.sf, color: C.t2,
            cursor: 'pointer', fontFamily: M,
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {loading && !snapshot ? (
        <div style={{ textAlign: 'center', padding: 32, color: C.t3 }}>Loading derivatives data…</div>
      ) : (
        <>
          {/* KPI Row */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <MetricCard
              label="Open Interest"
              value={fmtNum(oi?.openInterest)}
              sub={`≈ $${fmtNum(oi?.openInterest * (mark?.markPrice || 0))}`}
              icon="📈"
              color={C.b}
            />
            <MetricCard
              label="Funding Rate"
              value={fmtPct(funding?.ratePct)}
              sub={funding?.sentiment}
              icon="💸"
              color={funding?.rate > 0 ? C.g : funding?.rate < 0 ? C.r : C.t2}
            />
            <MetricCard
              label="Mark Price"
              value={mark?.markPrice ? `$${fmtNum(mark.markPrice)}` : '—'}
              sub={mark?.indexPrice ? `Index: $${fmtNum(mark.indexPrice)}` : null}
              icon="🎯"
            />
          </div>

          {/* L/S Ratio + Taker Volume */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <MetricCard
              label="Long/Short Ratio"
              value={lsr?.longShortRatio?.toFixed(2) || '—'}
              sub={lsr ? `L: ${lsr.longPct}% · S: ${lsr.shortPct}%` : null}
              icon="⚖️"
              color={lsr?.longShortRatio > 1 ? C.g : C.r}
            />
            <MetricCard
              label="Taker B/S Ratio"
              value={taker?.buySellRatio?.toFixed(2) || '—'}
              sub={taker?.buySellRatio > 1 ? 'Buyers aggressive' : 'Sellers aggressive'}
              icon="🔄"
              color={taker?.buySellRatio > 1 ? C.g : C.r}
            />
            <div style={{
              background: C.sf,
              border: `1px solid ${C.bd}`,
              borderRadius: 10,
              padding: '12px 14px',
              flex: 1,
              minWidth: 120,
            }}>
              <div style={{ fontSize: 10, color: C.t3, fontFamily: F, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                Funding <FundingPill rate={funding?.rate} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Sparkline data={fundingHistory} width={90} height={24} color={C.y} />
                <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>20 periods</span>
              </div>
            </div>
          </div>

          {/* Sparklines Row */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{
              background: C.sf, border: `1px solid ${C.bd}`, borderRadius: 10, padding: '10px 14px', flex: 1,
            }}>
              <div style={{ fontSize: 10, color: C.t3, fontFamily: F, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
                Open Interest Trend (24h)
              </div>
              <Sparkline data={oiHistory} width={200} height={32} color={C.b} />
            </div>
            <div style={{
              background: C.sf, border: `1px solid ${C.bd}`, borderRadius: 10, padding: '10px 14px', flex: 1,
            }}>
              <div style={{ fontSize: 10, color: C.t3, fontFamily: F, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
                Long/Short Ratio (24h)
              </div>
              <Sparkline data={lsrHistory} width={200} height={32} color={C.cyan} />
            </div>
          </div>

          {/* Liquidation Feed */}
          <div style={{
            background: C.sf,
            border: `1px solid ${C.bd}`,
            borderRadius: 10,
            padding: '12px 14px',
          }}>
            <div style={{ fontSize: 10, color: C.t3, fontFamily: F, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              🔥 Live Liquidations
            </div>
            <LiquidationFeed liquidations={liquidations} />
          </div>
        </>
      )}
    </div>
  );
}
