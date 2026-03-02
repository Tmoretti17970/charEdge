// ═══════════════════════════════════════════════════════════════════
// charEdge — Technical Scanner & Pattern Recognition
//
// Sprint 10: Automated chart pattern & signal detection engine.
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { alpha } from '../../../utils/colorUtils.js';

const MOCK_PATTERNS = [
  { id: 1, symbol: 'NVDA', pattern: 'Bull Flag', type: 'continuation', timeframe: '4H', confidence: 92, direction: 'bullish', target: 945, entry: 892, stop: 865, detected: '2h ago' },
  { id: 2, symbol: 'SPY', pattern: 'Rising Wedge', type: 'reversal', timeframe: '1D', confidence: 78, direction: 'bearish', target: 492, entry: 508, stop: 515, detected: '4h ago' },
  { id: 3, symbol: 'AAPL', pattern: 'Double Bottom', type: 'reversal', timeframe: '1D', confidence: 85, direction: 'bullish', target: 215, entry: 198, stop: 190, detected: '6h ago' },
  { id: 4, symbol: 'TSLA', pattern: 'Ascending Triangle', type: 'continuation', timeframe: '4H', confidence: 74, direction: 'bullish', target: 280, entry: 248, stop: 235, detected: '3h ago' },
  { id: 5, symbol: 'META', pattern: 'Cup & Handle', type: 'continuation', timeframe: '1D', confidence: 88, direction: 'bullish', target: 560, entry: 498, stop: 475, detected: '1h ago' },
  { id: 6, symbol: 'AMZN', pattern: 'Head & Shoulders', type: 'reversal', timeframe: '1W', confidence: 71, direction: 'bearish', target: 165, entry: 185, stop: 195, detected: '8h ago' },
];

const MOCK_SIGNALS = [
  { id: 's1', symbol: 'NVDA', signal: 'EMA 9/21 Bullish Cross', timeframe: '1H', strength: 'strong', direction: 'bullish', detected: '30m ago' },
  { id: 's2', symbol: 'BTC', signal: 'RSI Bullish Divergence', timeframe: '4H', strength: 'medium', direction: 'bullish', detected: '1h ago' },
  { id: 's3', symbol: 'SPY', signal: 'MACD Bearish Cross', timeframe: '1D', strength: 'strong', direction: 'bearish', detected: '2h ago' },
  { id: 's4', symbol: 'AAPL', signal: 'Bollinger Squeeze', timeframe: '1D', strength: 'high', direction: 'neutral', detected: '3h ago' },
  { id: 's5', symbol: 'ETH', signal: 'VWAP Reclaim', timeframe: '1H', strength: 'medium', direction: 'bullish', detected: '45m ago' },
  { id: 's6', symbol: 'TSLA', signal: 'RSI Overbought (78)', timeframe: '4H', strength: 'medium', direction: 'bearish', detected: '2h ago' },
  { id: 's7', symbol: 'GOOGL', signal: 'SMA 50/200 Golden Cross', timeframe: '1D', strength: 'strong', direction: 'bullish', detected: '5h ago' },
  { id: 's8', symbol: 'AMD', signal: 'Stochastic Oversold', timeframe: '1H', strength: 'medium', direction: 'bullish', detected: '1h ago' },
];

const CONFLUENCE_DATA = [
  { symbol: 'NVDA', tf5m: 'bull', tf15m: 'bull', tf1h: 'bull', tf4h: 'bull', tf1d: 'bull', score: 95 },
  { symbol: 'META', tf5m: 'bull', tf15m: 'bull', tf1h: 'bull', tf4h: 'bull', tf1d: 'neutral', score: 82 },
  { symbol: 'AAPL', tf5m: 'bear', tf15m: 'bull', tf1h: 'bull', tf4h: 'bull', tf1d: 'bull', score: 75 },
  { symbol: 'GOOGL', tf5m: 'bull', tf15m: 'neutral', tf1h: 'bull', tf4h: 'bull', tf1d: 'bull', score: 78 },
  { symbol: 'SPY', tf5m: 'bear', tf15m: 'bear', tf1h: 'neutral', tf4h: 'bull', tf1d: 'bull', score: 48 },
  { symbol: 'TSLA', tf5m: 'bull', tf15m: 'bull', tf1h: 'neutral', tf4h: 'bear', tf1d: 'neutral', score: 42 },
];

const CONF_COLORS = { bull: C.g, bear: C.r, neutral: C.y };
const CONF_ICONS = { bull: '▲', bear: '▼', neutral: '—' };
const STRENGTH_COLORS = { strong: C.g, high: C.cyan, medium: C.y };

const TABS = ['patterns', 'signals', 'confluence'];
const CONFIDENCE_FILTERS = ['all', 'high', 'medium'];

export default function TechnicalScanner() {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState('patterns');
  const [confFilter, setConfFilter] = useState('all');

  const patterns = useMemo(() => {
    if (confFilter === 'high') return MOCK_PATTERNS.filter((p) => p.confidence >= 80);
    if (confFilter === 'medium') return MOCK_PATTERNS.filter((p) => p.confidence >= 60 && p.confidence < 80);
    return MOCK_PATTERNS;
  }, [confFilter]);

  const totalDetections = MOCK_PATTERNS.length + MOCK_SIGNALS.length;

  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 16, overflow: 'hidden' }}>
      <button onClick={() => setCollapsed(!collapsed)} className="tf-btn"
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📐</span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>Technical Scanner</h3>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.cyan, background: alpha(C.cyan, 0.1), padding: '2px 7px', borderRadius: 4, fontFamily: M }}>
            {totalDetections} active
          </span>
        </div>
        <span style={{ color: C.t3, fontSize: 11, transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s ease' }}>▾</span>
      </button>

      {!collapsed && (
        <div style={{ padding: '0 20px 20px' }}>
          {/* Tab Toggle */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[{ id: 'patterns', label: '📐 Patterns', count: MOCK_PATTERNS.length }, { id: 'signals', label: '📊 Signals', count: MOCK_SIGNALS.length }, { id: 'confluence', label: '🔭 Confluence', count: CONFLUENCE_DATA.length }].map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className="tf-btn"
                style={{ padding: '5px 14px', borderRadius: 8, border: `1px solid ${tab === t.id ? C.b : 'transparent'}`, background: tab === t.id ? alpha(C.b, 0.08) : 'transparent', color: tab === t.id ? C.b : C.t3, cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: F, display: 'flex', alignItems: 'center', gap: 4 }}>
                {t.label}
                <span style={{ fontSize: 9, fontFamily: M, color: tab === t.id ? C.b : C.t3 }}>({t.count})</span>
              </button>
            ))}
          </div>

          {/* Patterns Tab */}
          {tab === 'patterns' && (
            <>
              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                {CONFIDENCE_FILTERS.map((cf) => (
                  <button key={cf} onClick={() => setConfFilter(cf)} className="tf-btn"
                    style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${confFilter === cf ? C.p : 'transparent'}`, background: confFilter === cf ? alpha(C.p, 0.08) : 'transparent', color: confFilter === cf ? C.p : C.t3, cursor: 'pointer', fontSize: 10, fontWeight: 600, fontFamily: F, textTransform: 'capitalize' }}>
                    {cf === 'all' ? 'All' : cf === 'high' ? '🎯 High (80%+)' : '🔷 Medium'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {patterns.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: alpha(C.sf, 0.5), border: `1px solid ${alpha(C.bd, 0.3)}`, borderRadius: 8 }}>
                    <div style={{ minWidth: 50 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>{p.symbol}</div>
                      <div style={{ fontSize: 9, color: C.t3, fontFamily: M }}>{p.timeframe}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, fontFamily: F }}>{p.pattern}</div>
                      <div style={{ fontSize: 9, color: C.t3, fontFamily: F }}>{p.type} · {p.detected}</div>
                    </div>
                    {/* Confidence */}
                    <div style={{ textAlign: 'center', minWidth: 50 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: M, color: p.confidence >= 80 ? C.g : p.confidence >= 60 ? C.y : C.t3 }}>{p.confidence}%</div>
                      <div style={{ fontSize: 8, color: C.t3, fontFamily: F }}>conf.</div>
                    </div>
                    {/* Direction */}
                    <span style={{ fontSize: 9, fontWeight: 700, fontFamily: F, color: p.direction === 'bullish' ? C.g : C.r, background: alpha(p.direction === 'bullish' ? C.g : C.r, 0.1), padding: '3px 8px', borderRadius: 4 }}>
                      {p.direction === 'bullish' ? '▲ BULL' : '▼ BEAR'}
                    </span>
                    {/* Target */}
                    <div style={{ textAlign: 'right', minWidth: 60 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: C.t1, fontFamily: M }}>T: ${p.target}</div>
                      <div style={{ fontSize: 9, color: C.t3, fontFamily: M }}>S: ${p.stop}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Signals Tab */}
          {tab === 'signals' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {MOCK_SIGNALS.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: alpha(C.sf, 0.5), border: `1px solid ${alpha(C.bd, 0.3)}`, borderRadius: 8 }}>
                  <div style={{ minWidth: 50 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>{s.symbol}</div>
                    <div style={{ fontSize: 9, color: C.t3, fontFamily: M }}>{s.timeframe}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, fontFamily: F }}>{s.signal}</div>
                    <div style={{ fontSize: 9, color: C.t3, fontFamily: F }}>{s.detected}</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 600, color: STRENGTH_COLORS[s.strength] || C.t3, background: alpha(STRENGTH_COLORS[s.strength] || C.t3, 0.1), padding: '2px 6px', borderRadius: 4, fontFamily: F, textTransform: 'capitalize' }}>{s.strength}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, fontFamily: F, color: CONF_COLORS[s.direction === 'bullish' ? 'bull' : s.direction === 'bearish' ? 'bear' : 'neutral'] }}>
                    {s.direction === 'bullish' ? '▲ BULL' : s.direction === 'bearish' ? '▼ BEAR' : '— NEUT'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Confluence Tab */}
          {tab === 'confluence' && (
            <div>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(5, 1fr) 60px', gap: 4, padding: '6px 10px', fontSize: 9, fontWeight: 700, color: C.t3, fontFamily: F, textTransform: 'uppercase' }}>
                <span>Symbol</span><span style={{ textAlign: 'center' }}>5m</span><span style={{ textAlign: 'center' }}>15m</span><span style={{ textAlign: 'center' }}>1H</span><span style={{ textAlign: 'center' }}>4H</span><span style={{ textAlign: 'center' }}>1D</span><span style={{ textAlign: 'right' }}>Score</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {CONFLUENCE_DATA.map((cd) => (
                  <div key={cd.symbol} style={{ display: 'grid', gridTemplateColumns: '60px repeat(5, 1fr) 60px', gap: 4, padding: '10px 10px', background: alpha(C.sf, 0.5), borderRadius: 6, alignItems: 'center', border: `1px solid ${alpha(C.bd, 0.3)}` }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: F }}>{cd.symbol}</span>
                    {['tf5m', 'tf15m', 'tf1h', 'tf4h', 'tf1d'].map((tf) => (
                      <span key={tf} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: CONF_COLORS[cd[tf]], fontFamily: M }}>{CONF_ICONS[cd[tf]]}</span>
                    ))}
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: M, color: cd.score >= 70 ? C.g : cd.score >= 50 ? C.y : C.r }}>{cd.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { TechnicalScanner };
