// ═══════════════════════════════════════════════════════════════════
// charEdge — Watchlist Intelligence Engine
//
// Sprint 13: Personalized symbol intelligence feed.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { C } from '../../../constants.js';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import { alpha } from '@/shared/colorUtils';
import st from './WatchlistIntelligence.module.css';

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

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    import('../../../data/engine/computeWatchlistIntel.js').then(async ({ batchComputeIntel }) => {
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
      if (mounted) { setIntel(results); setLoading(false); }
    });
    return () => { mounted = false; };
  }, [symbols]);

  const actionableCount = intel.filter((i) => i.priority > 40).length;

  return (
    <div className={st.card} style={{ background: C.bg2, border: `1px solid ${C.bd}` }}>
      <button onClick={() => setCollapsed(!collapsed)} className={`tf-btn ${st.headerBtn}`}>
        <div className={st.headerLeft}>
          <span className={st.headerIcon}>🎯</span>
          <h3 className={st.headerTitle}>Watchlist Intelligence</h3>
          <span className={st.badge} style={{ color: C.b, background: alpha(C.b, 0.1) }}>
            {actionableCount > 0 ? `${actionableCount} actionable` : 'all calm'}
          </span>
        </div>
        <span className={st.chevron} style={{ color: C.t3, transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>▾</span>
      </button>

      {!collapsed && (
        <div className={st.body}>
          {loading ? (
            <div className={st.list}>
              {[1, 2, 3].map(i => (
                <div key={i} className={st.skelRow} style={{ background: alpha(C.sf, 0.5) }}>
                  <div className={st.skelInner}>
                    <div className={st.skelBlock} style={{ width: 60, height: 16, background: alpha(C.t3, 0.1) }} />
                    <div className={st.skelBlock} style={{ width: 50, height: 16, background: alpha(C.t3, 0.1) }} />
                    <div className={st.skelBlock} style={{ flex: 1, height: 24, background: alpha(C.t3, 0.05) }} />
                    <div className={st.skelBlock} style={{ width: 70, height: 16, background: alpha(C.t3, 0.1) }} />
                  </div>
                </div>
              ))}
            </div>
          ) : intel.length === 0 ? (
            <div className={st.empty} style={{ color: C.t3 }}>
              Add symbols to your watchlist to see personalized intelligence here.
            </div>
          ) : (
            <div className={st.list}>
              {intel.map((item) => {
                const isExpanded = expandedSym === item.symbol;
                const sm = SENTIMENT_META[item.sentiment] || SENTIMENT_META.neutral;
                return (
                  <div key={item.symbol} onClick={() => setExpandedSym(isExpanded ? null : item.symbol)}
                    className={st.intelRow}
                    style={{ background: alpha(C.sf, 0.5), border: `1px solid ${alpha(C.bd, item.priority > 50 ? 0.8 : 0.4)}`, borderLeft: `3px solid ${item.priority > 50 ? C.b : 'transparent'}` }}>
                    <div className={st.intelMain}>
                      <div className={st.symCol}>
                        <div className={st.symName}>{item.symbol}</div>
                        <div className={st.symPrice} style={{ color: C.t2 }}>${item.price ? item.price.toFixed(2) : '—'}</div>
                      </div>
                      <div className={st.changeCol}>
                        <span className={st.changeBadge}
                          style={{ color: item.changePercent >= 0 ? C.g : C.r, background: alpha(item.changePercent >= 0 ? C.g : C.r, 0.08) }}>
                          {item.changePercent >= 0 ? '+' : ''}{(item.changePercent || 0).toFixed(2)}%
                        </span>
                      </div>
                      <div className={st.sparkline}>
                        {(item.sparkline || []).slice(-20).map((v, i, arr) => {
                          const min = Math.min(...arr);
                          const max = Math.max(...arr);
                          const pct = max === min ? 50 : ((v - min) / (max - min)) * 100;
                          return <div key={i} className={st.sparkBar} style={{ height: `${Math.max(pct, 5)}%`, background: alpha(item.changePercent >= 0 ? C.g : C.r, 0.5) }} />;
                        })}
                      </div>
                      <span className={st.sentBadge} style={{ color: sm.color, background: alpha(sm.color, 0.1) }}>
                        {sm.icon} {sm.label}
                      </span>
                      <div className={st.patternCol} style={{ color: C.t2 }}>{item.pattern}</div>
                      <span className={st.rowChevron} style={{ color: C.t3, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                    </div>

                    {isExpanded && (
                      <div className={st.detail} style={{ borderTop: `1px solid ${C.bd}` }}>
                        <div>
                          <div className={st.detailLabel} style={{ color: C.t3 }}>Key Levels</div>
                          <div className={st.detailMono}>
                            <span style={{ color: C.g }}>S: ${item.support ? item.support.toFixed(2) : '—'}</span>
                            <span style={{ color: C.t3, margin: '0 6px' }}>|</span>
                            <span style={{ color: C.r }}>R: ${item.resistance ? item.resistance.toFixed(2) : '—'}</span>
                          </div>
                        </div>
                        <div>
                          <div className={st.detailLabel} style={{ color: C.t3 }}>Indicators</div>
                          <div className={st.detailCol}>
                            <span style={{ color: item.rsi14 > 70 ? C.r : item.rsi14 < 30 ? C.g : C.t2 }}>RSI: {item.rsi14 ?? '—'}</span>
                            <span style={{ color: C.t2 }}>ATR: {item.atr14 ? item.atr14.toFixed(2) : '—'}</span>
                            {item.bbWidth && <span style={{ color: C.t2 }}>BB Width: {item.bbWidth}%</span>}
                          </div>
                        </div>
                        <div>
                          <div className={st.detailLabel} style={{ color: C.t3 }}>Trend</div>
                          <div className={st.detailCol}>
                            <span style={{ color: item.trendDirection === 'up' ? C.g : item.trendDirection === 'down' ? C.r : C.t3, fontWeight: 600 }}>
                              {item.trendDirection === 'up' ? '↑ Uptrend' : item.trendDirection === 'down' ? '↓ Downtrend' : '→ Ranging'}
                            </span>
                            <span className={st.volBadge}
                              style={{ color: item.volatilityRank === 'high' ? C.r : item.volatilityRank === 'low' ? C.g : C.t3, background: alpha(item.volatilityRank === 'high' ? C.r : item.volatilityRank === 'low' ? C.g : C.t3, 0.1) }}>
                              Vol: {item.volatilityRank?.toUpperCase()}
                            </span>
                            <span className={st.confText} style={{ color: C.t3 }}>Confidence: {item.sentimentConfidence}%</span>
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
