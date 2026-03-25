// ═══════════════════════════════════════════════════════════════════
// charEdge v15 — Cross-Exchange Intelligence Panel
//
// Dashboard aggregating data across Binance + Bybit:
//   • OI comparison (side-by-side with delta)
//   • Funding rate matrix heatmap
//   • Unified liquidation feed (both exchanges)
//   • Cross-exchange spread (from ArbitrageMonitor)
//   • OI Divergence detector
//   • Funding rate alerts
//
// Usage:
//   <CrossExchangePanel symbol="BTCUSDT" />
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { binanceFuturesAdapter } from '../../../data/adapters/BinanceFuturesAdapter.js';
import { bybitFuturesAdapter } from '../../../data/adapters/BybitFuturesAdapter.js';
import { fundingScanner } from '../../../data/engine/market/FundingArbitrageScanner.js';
import s from './CrossExchangePanel.module.css';
import { logger } from '@/observability/logger';

// ─── Formatters ────────────────────────────────────────────────

function fmtNum(n) {
  if (n == null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(2);
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(4) + '%';
}

function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── Card Wrapper ──────────────────────────────────────────────

const cardStyle = {
  background: 'var(--tf-sf, #1a1d26)',
  border: '1px solid var(--tf-bd, #2a2d36)',
  borderRadius: 10,
  padding: '10px 12px',
};

const labelStyle = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  color: 'var(--tf-t3, #888)',
  marginBottom: 6,
  letterSpacing: '0.5px',
};

// ─── Funding Heatmap Cell ──────────────────────────────────────

function FundingCell({ rate, label }) {
  const absRate = Math.abs(rate || 0);
  let bg = 'transparent';
  let color = 'var(--tf-t3, #888)';

  if (absRate >= 0.001) {
    bg = rate > 0 ? '#ef444430' : '#22c55e30'; // Extreme
    color = rate > 0 ? '#ef4444' : '#22c55e';
  } else if (absRate >= 0.0005) {
    bg = rate > 0 ? '#f59e0b20' : '#5c9cf520'; // Elevated
    color = rate > 0 ? '#f59e0b' : '#5c9cf5';
  } else {
    color = 'var(--tf-t2, #ccc)';
  }

  return (
    <div
      style={{
        background: bg,
        borderRadius: 6,
        padding: '4px 8px',
        textAlign: 'center',
        minWidth: 60,
        fontFamily: 'var(--tf-mono)',
        fontSize: 11,
        fontWeight: 600,
        color,
      }}
    >
      <div className={s.s0}>{label}</div>
      {fmtPct((rate || 0) * 100)}
    </div>
  );
}

// ─── OI Comparison Bar ─────────────────────────────────────────

function OIBar({ binanceOI, bybitOI }) {
  const total = (binanceOI || 0) + (bybitOI || 0);
  const binPct = total > 0 ? (binanceOI / total) * 100 : 50;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          fontFamily: 'var(--tf-mono)',
          color: 'var(--tf-t2, #ccc)',
          marginBottom: 4,
        }}
      >
        <span style={{ color: '#f0b90b' }}>Binance · {fmtNum(binanceOI)}</span>
        <span style={{ color: '#6366f1' }}>Bybit · {fmtNum(bybitOI)}</span>
      </div>
      <div className={s.s1}>
        <div
          style={{
            width: `${binPct}%`,
            height: '100%',
            borderRadius: 4,
            background: 'linear-gradient(90deg, #f0b90b, #f59e0b)',
            transition: 'width 0.5s ease',
          }}
        />
      </div>
    </div>
  );
}

// ─── Liquidation Row ───────────────────────────────────────────

function LiquidationRow({ liq }) {
  const isLong = liq.side === 'sell' || liq.type === 'long_liquidation';
  const value = (liq.price || 0) * (liq.quantity || liq.qty || 0);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 10,
        fontFamily: 'var(--tf-mono)',
        padding: '3px 6px',
        borderRadius: 4,
        background: value > 100000 ? `${isLong ? '#ef4444' : '#22c55e'}08` : 'transparent',
      }}
    >
      <span style={{ fontSize: 12 }}>{isLong ? '🔴' : '🟢'}</span>
      <span className={s.s2}>{fmtNum(value)}</span>
      <span className={s.s3}>{liq.exchange === 'bybit' ? 'Bybit' : 'Binance'}</span>
      <span className={s.s4}>@${fmtNum(liq.price)}</span>
      <span className={s.s5}>{fmtTime(liq.time || liq.timestamp)}</span>
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────

function CrossExchangePanel({ symbol = 'BTCUSDT' }) {
  const [binanceData, setBinanceData] = useState(null);
  const [bybitData, setBybitData] = useState(null);
  const [oiDivergence, setOiDivergence] = useState(null);
  const [fundingAlert, setFundingAlert] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [liquidations, setLiquidations] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const unsubs = useRef([]);

  // Fetch derivatives data
  const fetchExchangeData = useCallback(async () => {
    const upper = (symbol || '').toUpperCase();
    try {
      const [bSnap, byOI, byFunding, oiDiv, fundAlert] = await Promise.allSettled([
        binanceFuturesAdapter.fetchDerivativesSnapshot(upper),
        bybitFuturesAdapter.getOpenInterest(upper),
        bybitFuturesAdapter.getCurrentFundingRate(upper),
        binanceFuturesAdapter.detectOIDivergence(upper),
        binanceFuturesAdapter.checkFundingAlert(upper),
      ]);

      if (bSnap.status === 'fulfilled') setBinanceData(bSnap.value);
      if (byOI.status === 'fulfilled' || byFunding.status === 'fulfilled') {
        setBybitData({
          openInterest: byOI.value,
          funding: byFunding.value,
        });
      }
      if (oiDiv.status === 'fulfilled' && oiDiv.value) setOiDivergence(oiDiv.value);
      if (fundAlert.status === 'fulfilled' && fundAlert.value) setFundingAlert(fundAlert.value);

      // Funding opportunities
      const opps = fundingScanner.getOpportunities(10);
      setOpportunities(opps);
    } catch (e) {
      logger.ui.warn('Operation failed', e);
    }
  }, [symbol]);

  useEffect(() => {
    fetchExchangeData();
    const timer = setInterval(fetchExchangeData, 15000); // Refresh every 15s

    // Start funding scanner if not running
    fundingScanner.startScanning();

    // Subscribe to liquidations from both exchanges
    const binanceLiqUnsub = binanceFuturesAdapter.subscribeLiquidations((liq) => {
      setLiquidations((prev) => [{ ...liq, exchange: 'binance' }, ...prev].slice(0, 50));
    });
    unsubs.current.push(binanceLiqUnsub);

    const bybitLiqUnsub = bybitFuturesAdapter.subscribeLiquidations(symbol, (liq) => {
      setLiquidations((prev) => [{ ...liq, exchange: 'bybit' }, ...prev].slice(0, 50));
    });
    unsubs.current.push(bybitLiqUnsub);

    return () => {
      clearInterval(timer);
      for (const unsub of unsubs.current) {
        try {
          unsub();
        } catch (e) {
          logger.ui.warn('Operation failed', e);
        }
      }
      unsubs.current = [];
    };
  }, [symbol, fetchExchangeData]);

  const binanceOI = binanceData?.openInterest?.openInterest || 0;
  const bybitOI = bybitData?.openInterest?.openInterest || 0;
  const binanceFunding = binanceData?.funding?.rate || 0;
  const bybitFunding = bybitData?.funding?.fundingRate || 0;
  const lsr = binanceData?.longShortRatio;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'funding', label: 'Funding' },
    { id: 'liquidations', label: 'Liquidations' },
  ];

  return (
    <div
      style={{
        padding: 14,
        fontFamily: 'var(--tf-font)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        height: '100%',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div className={s.s6}>
        <div>
          <div className={s.s7}>🌐 Cross-Exchange — {symbol.replace('USDT', '')}</div>
          <div className={s.s8}>Binance + Bybit · Live data</div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className={s.s9}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '5px 0',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'var(--tf-font)',
              textTransform: 'uppercase',
              background: activeTab === tab.id ? 'var(--tf-b, #6366f1)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--tf-t3, #888)',
              transition: 'all 0.2s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ──────────────────────────────────── */}
      {activeTab === 'overview' && (
        <>
          {/* OI Comparison */}
          <div style={cardStyle}>
            <div style={labelStyle}>Open Interest Comparison</div>
            <OIBar binanceOI={binanceOI} bybitOI={bybitOI} />
            <div
              style={{
                fontSize: 10,
                fontFamily: 'var(--tf-mono)',
                color: 'var(--tf-t3, #888)',
                marginTop: 4,
                textAlign: 'center',
              }}
            >
              Total: <span className={s.s10}>{fmtNum(binanceOI + bybitOI)}</span>
            </div>
          </div>

          {/* Funding Comparison */}
          <div style={cardStyle}>
            <div style={labelStyle}>Funding Rates</div>
            <div className={s.s11}>
              <FundingCell rate={binanceFunding} label="Binance" />
              <FundingCell rate={bybitFunding} label="Bybit" />
              <FundingCell rate={binanceFunding - bybitFunding} label="Spread" />
            </div>
          </div>

          {/* L/S Ratio */}
          {lsr && (
            <div style={cardStyle}>
              <div style={labelStyle}>Long/Short Ratio (Binance Top Traders)</div>
              <div className={s.s12}>
                <span
                  style={{ fontSize: 10, fontFamily: 'var(--tf-mono)', color: '#22c55e', fontWeight: 700, width: 35 }}
                >
                  {lsr.longPct || 50}%
                </span>
                <div className={s.s13}>
                  <div
                    style={{
                      width: `${lsr.longPct || 50}%`,
                      height: '100%',
                      borderRadius: 3,
                      background: '#22c55e',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--tf-mono)',
                    color: '#ef4444',
                    fontWeight: 700,
                    width: 35,
                    textAlign: 'right',
                  }}
                >
                  {lsr.shortPct || 50}%
                </span>
              </div>
            </div>
          )}

          {/* OI Divergence Alert */}
          {oiDivergence && oiDivergence.divergence !== 'none' && (
            <div
              style={{
                ...cardStyle,
                border: `1px solid ${oiDivergence.divergence === 'bearish' || oiDivergence.divergence === 'crowded_long' ? '#ef4444' : '#22c55e'}40`,
                background: `${oiDivergence.divergence === 'bearish' || oiDivergence.divergence === 'crowded_long' ? '#ef4444' : '#22c55e'}08`,
              }}
            >
              <div style={labelStyle}>⚡ OI Divergence Detected</div>
              <div className={s.s14}>{oiDivergence.signal}</div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 6,
                  fontSize: 10,
                  fontFamily: 'var(--tf-mono)',
                  color: 'var(--tf-t3, #888)',
                }}
              >
                <span>
                  OI: {oiDivergence.oiChange > 0 ? '+' : ''}
                  {oiDivergence.oiChange}%
                </span>
                <span>Funding: {oiDivergence.fundingRate}%</span>
                <span>Strength: {(oiDivergence.strength * 100).toFixed(0)}%</span>
              </div>
            </div>
          )}

          {/* Funding Alert */}
          {fundingAlert && fundingAlert.isElevated && (
            <div
              style={{
                ...cardStyle,
                border: `1px solid ${fundingAlert.isExtreme ? '#ef4444' : '#f59e0b'}40`,
                background: `${fundingAlert.isExtreme ? '#ef4444' : '#f59e0b'}08`,
              }}
            >
              <div className={s.s15}>{fundingAlert.alert}</div>
            </div>
          )}
        </>
      )}

      {/* ── Funding Tab ──────────────────────────────────── */}
      {activeTab === 'funding' && (
        <>
          <div style={cardStyle}>
            <div style={labelStyle}>Funding Arbitrage Opportunities</div>
            {opportunities.length === 0 ? (
              <div className={s.s16}>Scanning for opportunities…</div>
            ) : (
              <div className={s.s17}>
                {opportunities.map((opp, i) => (
                  <div
                    key={opp.symbol + '-' + i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 10,
                      fontFamily: 'var(--tf-mono)',
                      padding: '4px 8px',
                      borderRadius: 6,
                      background: opp.type === 'extreme_funding' ? '#ef444410' : 'var(--tf-sf, #1a1d26)',
                      border: '1px solid var(--tf-bd, #2a2d36)',
                    }}
                  >
                    <span className={s.s18}>{opp.symbol.replace('USDT', '')}</span>
                    {opp.type === 'cross_exchange_spread' && (
                      <>
                        <span style={{ color: opp.spreadBps > 0 ? '#22c55e' : '#ef4444' }}>
                          Spread: {opp.spreadBps > 0 ? '+' : ''}
                          {opp.spreadBps.toFixed(1)} bps
                        </span>
                        <span className={s.s19}>{opp.direction.replace(/_/g, ' ')}</span>
                      </>
                    )}
                    {opp.type === 'extreme_funding' && (
                      <>
                        <span style={{ color: '#ef4444' }}>
                          🔥 {opp.fundingRate > 0 ? '+' : ''}
                          {opp.fundingRate}%
                        </span>
                        <span className={s.s20}>{opp.contrarian}</span>
                      </>
                    )}
                    {opp.type === 'funding_reversal' && (
                      <>
                        <span style={{ color: '#f59e0b' }}>
                          ⚠️ Reversal: {opp.previousDirection} → {opp.newDirection}
                        </span>
                        <span className={s.s21}>
                          {opp.currentRate > 0 ? '+' : ''}
                          {opp.currentRate}%
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scanner Stats */}
          <div style={cardStyle}>
            <div style={labelStyle}>Scanner Status</div>
            <div
              style={{
                display: 'flex',
                gap: 12,
                fontSize: 10,
                fontFamily: 'var(--tf-mono)',
                color: 'var(--tf-t2, #ccc)',
              }}
            >
              <span>Scans: {fundingScanner.getStats().scanCount}</span>
              <span>Tracked: {fundingScanner.getStats().trackedSymbols} pairs</span>
              <span>Alerts: {opportunities.length}</span>
            </div>
          </div>
        </>
      )}

      {/* ── Liquidations Tab ─────────────────────────────── */}
      {activeTab === 'liquidations' && (
        <div style={cardStyle}>
          <div style={labelStyle}>🔥 Live Liquidation Feed ({liquidations.length})</div>
          {liquidations.length === 0 ? (
            <div className={s.s22}>Waiting for liquidation events…</div>
          ) : (
            <div className={s.s23}>
              {liquidations.map((liq, i) => (
                <LiquidationRow key={`${liq.time || liq.timestamp}-${i}`} liq={liq} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(CrossExchangePanel);
