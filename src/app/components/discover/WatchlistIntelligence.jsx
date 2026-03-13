// ═══════════════════════════════════════════════════════════════════
// charEdge — Watchlist Intelligence Engine
//
// Sprint 13: Personalized symbol intelligence feed.
// THE highest-retention feature in the entire Discover plan.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { C, F, M } from '../../../constants.js';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import { alpha } from '@/shared/colorUtils';



const SENTIMENT_META = {
  bullish: { icon: '🟢', color: C.g, label: 'Bullish' },
  bearish: { icon: '🔴', color: C.r, label: 'Bearish' },
  neutral: { icon: '🟡', color: '#f0b64e', label: 'Neutral' },
};

const DEFAULT_SYMBOLS = ['ES', 'NQ', 'BTC', 'ETH', 'AAPL', 'SPY'];

function WatchlistIntelligence() {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedSym, setExpandedSym] = useState(null);
  const [intel, setIntel] = useState([]);
  const [loading, setLoading] = useState(true);
  const watchlist = useWatchlistStore((s) => s.items);

  const symbols = useMemo(() => {
    return watchlist.length > 0 ? watchlist.map((w) => w.symbol) : DEFAULT_SYMBOLS;
  }, [watchlist]);

  // Fetch bars and compute real indicators
  useEffect(() => {
    let mounted = true;
    setLoading(true);

    import('../../../data/engine/computeWatchlistIntel.js').then(async ({ batchComputeIntel }) => {
      // Also fetch tickers for live price data
      let tickerMap = {};
      try {
        const { fetch24hTicker } = await import('../../../data/FetchService');
        const tickers = await fetch24hTicker(symbols);
        for (const t of tickers) {
          if (t?.symbol) {
            const sym = t.symbol.replace('USDT', '').replace('USD', '');
            tickerMap[sym] = t;
            tickerMap[t.symbol] = t;
          }
        }
      } catch { /* ticker fetch is best-effort */ }

      const results = await batchComputeIntel(symbols, tickerMap, '1h');
      if (mounted) {
        setIntel(results);
        setLoading(false);
      }
    });

    return () => { mounted = false; };
  }, [symbols]);

  const actionableCount = intel.filter((i) => i.priority > 40).length;

  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
      <button onClick={() => setCollapsed(!collapsed)} className="tf-btn"
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🎯</span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>Watchlist Intelligence</h3>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.b, background: alpha(C.b, 0.1), padding: '2px 7px', borderRadius: 4, fontFamily: M }}>
            {actionableCount > 0 ? `${actionableCount} actionable` : 'all calm'}
          </span>
        </div>
        <span style={{ color: C.t3, fontSize: 11, transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s ease' }}>▾</span>
      </button>

      {!collapsed && (
        <div style={{ padding: '0 20px 20px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{
                  padding: '14px', background: alpha(C.sf, 0.5),
                  borderRadius: 10, animation: 'pulse 1.5s infinite',
                }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 60, height: 16, background: alpha(C.t3, 0.1), borderRadius: 4 }} />
                    <div style={{ width: 50, height: 16, background: alpha(C.t3, 0.1), borderRadius: 4 }} />
                    <div style={{ flex: 1, height: 24, background: alpha(C.t3, 0.05), borderRadius: 4 }} />
                    <div style={{ width: 70, height: 16, background: alpha(C.t3, 0.1), borderRadius: 4 }} />
                  </div>
                </div>
              ))}
              <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
            </div>
          ) : intel.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: C.t3, fontSize: 12, fontFamily: F }}>
              Add symbols to your watchlist to see personalized intelligence here.
            </div>
            ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {intel.map((item) => {
                const isExpanded = expandedSym === item.symbol;
                const sm = SENTIMENT_META[item.sentiment] || SENTIMENT_META.neutral;

                return (
                  <div key={item.symbol} onClick={() => setExpandedSym(isExpanded ? null : item.symbol)}
                    style={{ padding: '12px 14px', background: alpha(C.sf, 0.5), border: `1px solid ${alpha(C.bd, item.priority > 50 ? 0.8 : 0.4)}`, borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s ease', borderLeft: `3px solid ${item.priority > 50 ? C.b : 'transparent'}` }}>
                    {/* Main Row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Symbol + Price */}
                      <div style={{ minWidth: 80 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, fontFamily: F }}>{item.symbol}</div>
                        <div style={{ fontSize: 12, color: C.t2, fontFamily: M }}>${item.price ? item.price.toFixed(2) : '—'}</div>
                      </div>

                      {/* Change */}
                      <div style={{ minWidth: 65, textAlign: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: item.changePercent >= 0 ? C.g : C.r, fontFamily: M, background: alpha(item.changePercent >= 0 ? C.g : C.r, 0.08), padding: '3px 8px', borderRadius: 5 }}>
                          {item.changePercent >= 0 ? '+' : ''}{(item.changePercent || 0).toFixed(2)}%
                        </span>
                      </div>

                      {/* Sparkline */}
                      <div style={{ flex: 1, height: 24, display: 'flex', alignItems: 'flex-end', gap: 1 }}>
                        {(item.sparkline || []).slice(-20).map((v, i, arr) => {
                          const min = Math.min(...arr);
                          const max = Math.max(...arr);
                          const pct = max === min ? 50 : ((v - min) / (max - min)) * 100;
                          return <div key={i} style={{ flex: 1, height: `${Math.max(pct, 5)}%`, background: alpha(item.changePercent >= 0 ? C.g : C.r, 0.5), borderRadius: 1 }} />;
                        })}
                      </div>

                      {/* Sentiment */}
                      <span style={{ fontSize: 9, fontWeight: 600, color: sm.color, background: alpha(sm.color, 0.1), padding: '3px 8px', borderRadius: 4, fontFamily: F }}>
                        {sm.icon} {sm.label}
                      </span>

                      {/* Pattern */}
                      <div style={{ fontSize: 10, color: C.t2, fontFamily: F, maxWidth: 140, textAlign: 'right' }}>
                        {item.pattern}
                      </div>

                      <span style={{ color: C.t3, fontSize: 10, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▾</span>
                    </div>

                    {/* Expanded Detail — Real Indicator Data */}
                    {isExpanded && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.bd}`, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        {/* Key Levels */}
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: F, marginBottom: 4 }}>Key Levels</div>
                          <div style={{ fontSize: 11, fontFamily: M }}>
                            <span style={{ color: C.g }}>S: ${item.support ? item.support.toFixed(2) : '—'}</span>
                            <span style={{ color: C.t3, margin: '0 6px' }}>|</span>
                            <span style={{ color: C.r }}>R: ${item.resistance ? item.resistance.toFixed(2) : '—'}</span>
                          </div>
                        </div>

                        {/* Indicators */}
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: F, marginBottom: 4 }}>Indicators</div>
                          <div style={{ fontSize: 10, fontFamily: M, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ color: item.rsi14 > 70 ? C.r : item.rsi14 < 30 ? C.g : C.t2 }}>
                              RSI: {item.rsi14 ?? '—'}
                            </span>
                            <span style={{ color: C.t2 }}>ATR: {item.atr14 ? item.atr14.toFixed(2) : '—'}</span>
                            {item.bbWidth && (
                              <span style={{ color: C.t2 }}>BB Width: {item.bbWidth}%</span>
                            )}
                          </div>
                        </div>

                        {/* Trend + Volatility */}
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: F, marginBottom: 4 }}>Trend</div>
                          <div style={{ fontSize: 10, fontFamily: M, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ 
                              color: item.trendDirection === 'up' ? C.g : item.trendDirection === 'down' ? C.r : C.t3,
                              fontWeight: 600
                            }}>
                              {item.trendDirection === 'up' ? '↑ Uptrend' : item.trendDirection === 'down' ? '↓ Downtrend' : '→ Ranging'}
                            </span>
                            <span style={{
                              fontSize: 9, fontWeight: 600,
                              color: item.volatilityRank === 'high' ? C.r : item.volatilityRank === 'low' ? C.g : C.t3,
                              background: alpha(item.volatilityRank === 'high' ? C.r : item.volatilityRank === 'low' ? C.g : C.t3, 0.1),
                              padding: '1px 5px', borderRadius: 3, display: 'inline-block',
                            }}>
                              Vol: {item.volatilityRank?.toUpperCase()}
                            </span>
                            <span style={{ fontSize: 9, color: C.t3 }}>
                              Confidence: {item.sentimentConfidence}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { WatchlistIntelligence };

export default React.memo(WatchlistIntelligence);
