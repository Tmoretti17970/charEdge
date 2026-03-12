// ═══════════════════════════════════════════════════════════════════
// charEdge — Watchlist Intelligence Engine
//
// Sprint 13: Personalized symbol intelligence feed.
// THE highest-retention feature in the entire Discover plan.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import { alpha } from '@/shared/colorUtils';

// Generate intelligent data per symbol
function generateIntel(symbol) {
  const seed = symbol.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const r = (n) => ((Math.sin(seed * n) * 10000) % 1);
  const price = 50 + r(1) * 900;
  const change = (r(2) - 0.45) * 8;
  const support = price * (0.95 + r(3) * 0.02);
  const resistance = price * (1.03 + r(4) * 0.04);

  const sentimentVal = r(5);
  const sentiment = sentimentVal > 0.65 ? 'bullish' : sentimentVal < 0.35 ? 'bearish' : 'neutral';

  const patterns = [
    'Consolidation near support', 'Bull flag forming', 'Testing resistance',
    'Bearish divergence on RSI', 'Breakout imminent', 'Range-bound',
    'Higher lows pattern', 'Double bottom forming',
  ];

  const newsItems = [
    `${symbol} beats Q4 expectations by 12%`,
    `Analyst upgrades ${symbol} to Overweight`,
    `${symbol} announces $2B buyback program`,
    `Sector headwinds may pressure ${symbol}`,
    `${symbol} insider buys 50K shares`,
    `New product launch lifts ${symbol} outlook`,
  ];

  const events = [
    { type: 'earnings', label: `Earnings ${r(9) > 0.5 ? 'in 3 days' : 'in 12 days'}` },
    { type: 'dividend', label: `Ex-div ${r(10) > 0.6 ? 'tomorrow' : 'in 8 days'}` },
  ];

  // Priority score: higher = more actionable
  const priority = Math.round(
    (Math.abs(change) * 8) +
    (sentimentVal > 0.65 || sentimentVal < 0.35 ? 20 : 0) +
    (r(7) > 0.6 ? 15 : 0) + // pattern alert
    r(8) * 30
  );

  return {
    symbol,
    price: +price.toFixed(2),
    change: +change.toFixed(2),
    support: +support.toFixed(2),
    resistance: +resistance.toFixed(2),
    sentiment,
    pattern: patterns[Math.floor(r(6) * patterns.length)],
    news: newsItems[Math.floor(r(7) * newsItems.length)],
    events: r(10) > 0.4 ? [events[Math.floor(r(11) * events.length)]] : [],
    analystChange: r(12) > 0.65 ? { firm: ['MS', 'GS', 'JPM', 'UBS'][Math.floor(r(13) * 4)], action: r(14) > 0.5 ? 'Upgrade' : 'Downgrade' } : null,
    sparkline: Array.from({ length: 20 }, (_, i) => price + (r(i + 15) - 0.5) * price * 0.06),
    priority,
  };
}

const SENTIMENT_META = {
  bullish: { icon: '🟢', color: C.g, label: 'Bullish' },
  bearish: { icon: '🔴', color: C.r, label: 'Bearish' },
  neutral: { icon: '🟡', color: '#f0b64e', label: 'Neutral' },
};

const DEFAULT_SYMBOLS = ['ES', 'NQ', 'BTC', 'ETH', 'AAPL', 'SPY'];

function WatchlistIntelligence() {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedSym, setExpandedSym] = useState(null);
  const watchlist = useWatchlistStore((s) => s.items);

  const symbols = useMemo(() => {
    return watchlist.length > 0 ? watchlist.map((w) => w.symbol) : DEFAULT_SYMBOLS;
  }, [watchlist]);

  const intel = useMemo(() => {
    return symbols.map(generateIntel).sort((a, b) => b.priority - a.priority);
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
          {intel.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: C.t3, fontSize: 12, fontFamily: F }}>
              Add symbols to your watchlist to see personalized intelligence here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {intel.map((item) => {
                const sm = SENTIMENT_META[item.sentiment];
                const isExpanded = expandedSym === item.symbol;

                return (
                  <div key={item.symbol} onClick={() => setExpandedSym(isExpanded ? null : item.symbol)}
                    style={{ padding: '12px 14px', background: alpha(C.sf, 0.5), border: `1px solid ${alpha(C.bd, item.priority > 50 ? 0.8 : 0.4)}`, borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s ease', borderLeft: `3px solid ${item.priority > 50 ? C.b : 'transparent'}` }}>
                    {/* Main Row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Symbol + Price */}
                      <div style={{ minWidth: 80 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, fontFamily: F }}>{item.symbol}</div>
                        <div style={{ fontSize: 12, color: C.t2, fontFamily: M }}>${item.price.toFixed(2)}</div>
                      </div>

                      {/* Change */}
                      <div style={{ minWidth: 65, textAlign: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: item.change >= 0 ? C.g : C.r, fontFamily: M, background: alpha(item.change >= 0 ? C.g : C.r, 0.08), padding: '3px 8px', borderRadius: 5 }}>
                          {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
                        </span>
                      </div>

                      {/* Sparkline */}
                      <div style={{ flex: 1, height: 24, display: 'flex', alignItems: 'flex-end', gap: 1 }}>
                        {item.sparkline.map((v, i) => {
                          const min = Math.min(...item.sparkline);
                          const max = Math.max(...item.sparkline);
                          const pct = max === min ? 50 : ((v - min) / (max - min)) * 100;
                          return <div key={i} style={{ flex: 1, height: `${Math.max(pct, 5)}%`, background: alpha(item.change >= 0 ? C.g : C.r, 0.5), borderRadius: 1 }} />;
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

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.bd}`, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        {/* Key Levels */}
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: F, marginBottom: 4 }}>Key Levels</div>
                          <div style={{ fontSize: 11, fontFamily: M }}>
                            <span style={{ color: C.g }}>S: ${item.support.toFixed(2)}</span>
                            <span style={{ color: C.t3, margin: '0 6px' }}>|</span>
                            <span style={{ color: C.r }}>R: ${item.resistance.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* News */}
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: F, marginBottom: 4 }}>Latest News</div>
                          <div style={{ fontSize: 10, color: C.t2, fontFamily: F, lineHeight: 1.4 }}>{item.news}</div>
                        </div>

                        {/* Events + Analyst */}
                        <div>
                          {item.events.length > 0 && (
                            <div style={{ marginBottom: 6 }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: F, marginBottom: 2 }}>Upcoming</div>
                              {item.events.map((ev, i) => (
                                <div key={i} style={{ fontSize: 10, color: C.y, fontFamily: F }}>📅 {ev.label}</div>
                              ))}
                            </div>
                          )}
                          {item.analystChange && (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: F, marginBottom: 2 }}>Analyst</div>
                              <div style={{ fontSize: 10, fontFamily: F }}>
                                <span style={{ fontWeight: 600, color: C.t1 }}>{item.analystChange.firm}</span>
                                {' '}
                                <span style={{ color: item.analystChange.action === 'Upgrade' ? C.g : C.r, fontWeight: 600 }}>{item.analystChange.action}</span>
                              </div>
                            </div>
                          )}
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
