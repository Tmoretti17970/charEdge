// ═══════════════════════════════════════════════════════════════════
// charEdge — Analyst Consensus Hub
//
// Sprint 9: Aggregated analyst ratings dashboard.
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { alpha } from '../../../utils/colorUtils.js';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';

const MOCK_CONSENSUS = [
  {
    symbol: 'NVDA', name: 'NVIDIA', current: 892.50, targetLow: 750, targetAvg: 1050, targetHigh: 1400, buy: 38, hold: 5, sell: 1, upside: 17.6, recentChanges: [
      { analyst: 'Morgan Stanley', firm: 'MS', rating: 'Overweight', target: 1160, accuracy: 82, date: '02/23' },
      { analyst: 'Goldman Sachs', firm: 'GS', rating: 'Buy', target: 1100, accuracy: 78, date: '02/20' },
    ]
  },
  {
    symbol: 'AAPL', name: 'Apple', current: 198.30, targetLow: 160, targetAvg: 220, targetHigh: 260, buy: 28, hold: 12, sell: 3, upside: 10.9, recentChanges: [
      { analyst: 'JP Morgan', firm: 'JPM', rating: 'Overweight', target: 235, accuracy: 75, date: '02/22' },
    ]
  },
  {
    symbol: 'TSLA', name: 'Tesla', current: 248.60, targetLow: 120, targetAvg: 265, targetHigh: 400, buy: 15, hold: 18, sell: 12, upside: 6.6, recentChanges: [
      { analyst: 'Wedbush', firm: 'WED', rating: 'Outperform', target: 380, accuracy: 65, date: '02/24' },
      { analyst: 'Bernstein', firm: 'AB', rating: 'Underperform', target: 150, accuracy: 72, date: '02/21' },
    ]
  },
  {
    symbol: 'MSFT', name: 'Microsoft', current: 415.80, targetLow: 380, targetAvg: 480, targetHigh: 550, buy: 42, hold: 4, sell: 0, upside: 15.4, recentChanges: [
      { analyst: 'UBS', firm: 'UBS', rating: 'Buy', target: 500, accuracy: 80, date: '02/23' },
    ]
  },
  {
    symbol: 'META', name: 'Meta', current: 498.60, targetLow: 400, targetAvg: 560, targetHigh: 650, buy: 52, hold: 6, sell: 1, upside: 12.3, recentChanges: [
      { analyst: 'Barclays', firm: 'BARC', rating: 'Overweight', target: 580, accuracy: 77, date: '02/24' },
    ]
  },
  {
    symbol: 'AMZN', name: 'Amazon', current: 185.20, targetLow: 160, targetAvg: 220, targetHigh: 260, buy: 58, hold: 3, sell: 0, upside: 18.8, recentChanges: [
      { analyst: 'BofA', firm: 'BAC', rating: 'Buy', target: 230, accuracy: 74, date: '02/22' },
    ]
  },
];

let _RATINGS = null;
function getRatings() {
  if (!_RATINGS) _RATINGS = { 'Overweight': C.g, 'Outperform': C.g, 'Buy': C.g, 'Hold': C.y, 'Neutral': C.y, 'Underweight': C.r, 'Underperform': C.r, 'Sell': C.r };
  return _RATINGS;
}

export default function AnalystConsensus() {
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const watchlist = useWatchlistStore((s) => s.items);

  const data = useMemo(() => {
    if (filter === 'watchlist') {
      const syms = new Set(watchlist.map((w) => w.symbol));
      return MOCK_CONSENSUS.filter((d) => syms.has(d.symbol));
    }
    return MOCK_CONSENSUS;
  }, [filter, watchlist]);

  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 16, overflow: 'hidden' }}>
      <button onClick={() => setCollapsed(!collapsed)} className="tf-btn"
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>⭐</span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>Analyst Consensus</h3>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.p, background: alpha(C.p, 0.1), padding: '2px 7px', borderRadius: 4, fontFamily: M }}>
            {MOCK_CONSENSUS.length} symbols
          </span>
        </div>
        <span style={{ color: C.t3, fontSize: 11, transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s ease' }}>▾</span>
      </button>

      {!collapsed && (
        <div style={{ padding: '0 20px 20px' }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {['all', 'watchlist'].map((f) => (
              <button key={f} onClick={() => setFilter(f)} className="tf-btn"
                style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${filter === f ? C.b : 'transparent'}`, background: filter === f ? alpha(C.b, 0.08) : 'transparent', color: filter === f ? C.b : C.t3, cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: F }}>
                {f === 'all' ? '📋 All Covered' : '⭐ My Watchlist'}
              </button>
            ))}
          </div>

          {data.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: C.t3, fontSize: 12, fontFamily: F }}>No analyst coverage for your watchlist symbols yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.map((stock) => {
                const total = stock.buy + stock.hold + stock.sell;
                const buyPct = (stock.buy / total) * 100;
                const holdPct = (stock.hold / total) * 100;
                const isExpanded = expanded === stock.symbol;

                return (
                  <div key={stock.symbol} onClick={() => setExpanded(isExpanded ? null : stock.symbol)}
                    style={{ padding: '12px 14px', background: alpha(C.sf, 0.5), border: `1px solid ${alpha(C.bd, 0.5)}`, borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s ease' }}>
                    {/* Main Row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ minWidth: 70 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: F }}>{stock.symbol}</div>
                        <div style={{ fontSize: 10, color: C.t3, fontFamily: F }}>{stock.name}</div>
                      </div>

                      {/* Consensus Bar */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${buyPct}%`, background: C.g }} />
                          <div style={{ width: `${holdPct}%`, background: C.y }} />
                          <div style={{ flex: 1, background: C.r }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                          <span style={{ fontSize: 9, color: C.g, fontFamily: M, fontWeight: 600 }}>{stock.buy} Buy</span>
                          <span style={{ fontSize: 9, color: C.y, fontFamily: M, fontWeight: 600 }}>{stock.hold} Hold</span>
                          <span style={{ fontSize: 9, color: C.r, fontFamily: M, fontWeight: 600 }}>{stock.sell} Sell</span>
                        </div>
                      </div>

                      {/* Price Target */}
                      <div style={{ textAlign: 'right', minWidth: 90 }}>
                        <div style={{ fontSize: 9, color: C.t3, fontFamily: F }}>Avg Target</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: M }}>${stock.targetAvg}</div>
                        <div style={{ fontSize: 9, color: stock.upside >= 0 ? C.g : C.r, fontFamily: M, fontWeight: 600 }}>
                          {stock.upside >= 0 ? '▲' : '▼'} {stock.upside.toFixed(1)}% upside
                        </div>
                      </div>

                      <span style={{ color: C.t3, fontSize: 10, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>▾</span>
                    </div>

                    {/* Expanded: Price Target Range + Recent Changes */}
                    {isExpanded && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.bd}` }}>
                        {/* Price Target Range Vis */}
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: F, marginBottom: 6 }}>Price Target Range</div>
                          <div style={{ position: 'relative', height: 24, background: alpha(C.sf, 0.5), borderRadius: 4 }}>
                            {/* Range bar */}
                            <div style={{
                              position: 'absolute', top: 8, height: 8, borderRadius: 4,
                              left: `${((stock.targetLow - stock.targetLow) / (stock.targetHigh - stock.targetLow)) * 100}%`,
                              right: `${100 - ((stock.targetHigh - stock.targetLow) / (stock.targetHigh - stock.targetLow)) * 100}%`,
                              background: `linear-gradient(90deg, ${alpha(C.r, 0.4)}, ${alpha(C.g, 0.4)})`,
                            }} />
                            {/* Current price marker */}
                            <div style={{
                              position: 'absolute', top: 2, width: 2, height: 20, borderRadius: 1,
                              background: C.b,
                              left: `${Math.max(0, Math.min(100, ((stock.current - stock.targetLow) / (stock.targetHigh - stock.targetLow)) * 100))}%`,
                            }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                            <span style={{ fontSize: 9, color: C.r, fontFamily: M }}>${stock.targetLow}</span>
                            <span style={{ fontSize: 9, color: C.b, fontFamily: M, fontWeight: 600 }}>Current: ${stock.current}</span>
                            <span style={{ fontSize: 9, color: C.g, fontFamily: M }}>${stock.targetHigh}</span>
                          </div>
                        </div>

                        {/* Recent Rating Changes */}
                        <div style={{ fontSize: 10, fontWeight: 600, color: C.t3, fontFamily: F, marginBottom: 6 }}>Recent Changes</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {stock.recentChanges.map((rc, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: alpha(C.sf, 0.3), borderRadius: 6, fontSize: 10 }}>
                              <span style={{ color: C.t3, fontFamily: M, minWidth: 40 }}>{rc.date}</span>
                              <span style={{ fontWeight: 600, color: C.t1, fontFamily: F, minWidth: 60 }}>{rc.firm}</span>
                              <span style={{ fontWeight: 600, color: getRatings()[rc.rating] || C.t2, fontFamily: F }}>{rc.rating}</span>
                              <span style={{ color: C.t1, fontFamily: M, marginLeft: 'auto' }}>PT ${rc.target}</span>
                              <span style={{ fontSize: 9, color: C.t3, fontFamily: M }}>({rc.accuracy}% acc)</span>
                            </div>
                          ))}
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

export { AnalystConsensus };
