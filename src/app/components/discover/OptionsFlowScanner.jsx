// ═══════════════════════════════════════════════════════════════════
// charEdge — Options Flow Scanner
//
// Sprint 7: Unusual options activity feed.
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { alpha } from '../../../utils/colorUtils.js';

const MOCK_FLOWS = [
  { id: 1, time: '14:32', symbol: 'NVDA', strike: 900, expiry: '03/07', type: 'Call', premium: 2850000, size: 1200, side: 'Buy', sweep: true },
  { id: 2, time: '14:30', symbol: 'SPY', strike: 505, expiry: '02/28', type: 'Put', premium: 1240000, size: 3500, side: 'Sell', sweep: false },
  { id: 3, time: '14:28', symbol: 'AAPL', strike: 200, expiry: '03/21', type: 'Call', premium: 890000, size: 2800, side: 'Buy', sweep: false },
  { id: 4, time: '14:25', symbol: 'TSLA', strike: 260, expiry: '03/07', type: 'Call', premium: 4200000, size: 850, side: 'Buy', sweep: true },
  { id: 5, time: '14:22', symbol: 'META', strike: 520, expiry: '03/14', type: 'Call', premium: 1680000, size: 600, side: 'Buy', sweep: false },
  { id: 6, time: '14:19', symbol: 'AMD', strike: 170, expiry: '02/28', type: 'Put', premium: 520000, size: 1800, side: 'Buy', sweep: false },
  { id: 7, time: '14:16', symbol: 'GOOGL', strike: 155, expiry: '03/21', type: 'Call', premium: 780000, size: 2200, side: 'Buy', sweep: true },
  { id: 8, time: '14:14', symbol: 'QQQ', strike: 440, expiry: '03/07', type: 'Put', premium: 3100000, size: 4200, side: 'Buy', sweep: true },
  { id: 9, time: '14:11', symbol: 'MSFT', strike: 420, expiry: '03/14', type: 'Call', premium: 620000, size: 900, side: 'Buy', sweep: false },
  { id: 10, time: '14:08', symbol: 'JPM', strike: 200, expiry: '03/21', type: 'Call', premium: 380000, size: 1400, side: 'Buy', sweep: false },
  { id: 11, time: '14:05', symbol: 'NVDA', strike: 880, expiry: '02/28', type: 'Put', premium: 1950000, size: 700, side: 'Buy', sweep: false },
  { id: 12, time: '14:02', symbol: 'NFLX', strike: 650, expiry: '03/14', type: 'Call', premium: 1420000, size: 480, side: 'Buy', sweep: true },
];

const FILTERS = ['all', 'calls', 'puts', 'sweeps'];

export default function OptionsFlowScanner() {
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState('all');

  const flows = useMemo(() => {
    if (filter === 'calls') return MOCK_FLOWS.filter((f) => f.type === 'Call');
    if (filter === 'puts') return MOCK_FLOWS.filter((f) => f.type === 'Put');
    if (filter === 'sweeps') return MOCK_FLOWS.filter((f) => f.sweep);
    return MOCK_FLOWS;
  }, [filter]);

  const sentiment = useMemo(() => {
    let bull = 0, bear = 0;
    for (const f of MOCK_FLOWS) {
      const isBull = (f.type === 'Call' && f.side === 'Buy') || (f.type === 'Put' && f.side === 'Sell');
      if (isBull) bull += f.premium; else bear += f.premium;
    }
    return { bullPct: (bull / (bull + bear)) * 100 };
  }, []);

  const totalPremium = MOCK_FLOWS.reduce((s, f) => s + f.premium, 0);

  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 16, overflow: 'hidden' }}>
      <button onClick={() => setCollapsed(!collapsed)} className="tf-btn"
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>Options Flow Scanner</h3>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.y, background: alpha(C.y, 0.1), padding: '2px 7px', borderRadius: 4, fontFamily: M }}>
            ${(totalPremium / 1e6).toFixed(1)}M today
          </span>
        </div>
        <span style={{ color: C.t3, fontSize: 11, transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s ease' }}>▾</span>
      </button>

      {!collapsed && (
        <div style={{ padding: '0 20px 20px' }}>
          {/* Sentiment Bar */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: C.g, fontFamily: F }}>🟢 Bullish {sentiment.bullPct.toFixed(0)}%</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: C.r, fontFamily: F }}>Bearish {(100 - sentiment.bullPct).toFixed(0)}% 🔴</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: alpha(C.r, 0.3), overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${sentiment.bullPct}%`, background: `linear-gradient(90deg, ${C.g}, ${alpha(C.g, 0.7)})`, borderRadius: 3 }} />
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)} className="tf-btn"
                style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${filter === f ? C.b : 'transparent'}`, background: filter === f ? alpha(C.b, 0.08) : 'transparent', color: filter === f ? C.b : C.t3, cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: F, textTransform: 'capitalize' }}>
                {f === 'all' ? '📋 All' : f === 'calls' ? '📈 Calls' : f === 'puts' ? '📉 Puts' : '🔥 Sweeps'}
              </button>
            ))}
          </div>

          {/* Table Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '50px 55px 65px 50px 50px 1fr 50px', gap: 4, padding: '6px 10px', fontSize: 9, fontWeight: 700, color: C.t3, fontFamily: F, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            <span>Time</span><span>Symbol</span><span>Strike</span><span>Exp</span><span>Type</span><span>Premium</span><span style={{ textAlign: 'right' }}>Signal</span>
          </div>

          {/* Flow Entries */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 340, overflowY: 'auto' }}>
            {flows.map((flow) => {
              const isBull = (flow.type === 'Call' && flow.side === 'Buy') || (flow.type === 'Put' && flow.side === 'Sell');
              const tier = flow.premium >= 1e6 ? '🐋' : flow.premium >= 250000 ? '🔷' : '•';
              return (
                <div key={flow.id} style={{ display: 'grid', gridTemplateColumns: '50px 55px 65px 50px 50px 1fr 50px', gap: 4, padding: '8px 10px', background: alpha(C.sf, flow.sweep ? 0.8 : 0.4), border: `1px solid ${flow.sweep ? alpha(C.y, 0.2) : alpha(C.bd, 0.3)}`, borderRadius: 6, alignItems: 'center', fontSize: 11, fontFamily: M }}>
                  <span style={{ color: C.t3, fontSize: 10 }}>{flow.time}</span>
                  <span style={{ fontWeight: 700, color: C.t1, fontFamily: F, fontSize: 12 }}>{flow.symbol}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ color: C.t1 }}>${flow.strike}</span>
                    {flow.sweep && <span style={{ fontSize: 7, fontWeight: 700, color: C.y, background: alpha(C.y, 0.15), padding: '1px 3px', borderRadius: 2, fontFamily: F }}>SWEEP</span>}
                  </div>
                  <span style={{ color: C.t3, fontSize: 10 }}>{flow.expiry}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: flow.type === 'Call' ? C.g : C.r, fontFamily: F }}>{flow.type}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10 }}>{tier}</span>
                    <span style={{ fontWeight: 600, color: C.t1 }}>${flow.premium >= 1e6 ? (flow.premium / 1e6).toFixed(2) + 'M' : (flow.premium / 1e3).toFixed(0) + 'K'}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, fontFamily: F, color: isBull ? C.g : C.r, background: alpha(isBull ? C.g : C.r, 0.1), padding: '2px 6px', borderRadius: 4 }}>
                      {isBull ? 'BULL' : 'BEAR'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export { OptionsFlowScanner };
