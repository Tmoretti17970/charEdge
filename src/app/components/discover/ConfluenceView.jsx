// ═══════════════════════════════════════════════════════════════════
// charEdge — Multi-Timeframe Confluence View
//
// Sprint 14: Signal alignment across timeframes.
// ═══════════════════════════════════════════════════════════════════

import { Telescope, List, Target } from 'lucide-react';
import React from 'react';
import { useState, useMemo } from 'react';
import { C } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';

const TIMEFRAMES = ['5m', '15m', '1H', '4H', '1D', '1W'];

function genSignals(symbol) {
  const seed = symbol.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const signals = {};
  let bullCount = 0;
  TIMEFRAMES.forEach((tf, i) => {
    const r = (Math.sin(seed * (i + 1) * 7) * 10000) % 1;
    const val = r > 0.6 ? 'bull' : r < 0.3 ? 'bear' : 'neutral';
    signals[tf] = val;
    if (val === 'bull') bullCount++;
  });
  const score = Math.round((bullCount / TIMEFRAMES.length) * 100);
  return { symbol, signals, score, bullCount };
}

const SYMBOLS = ['NVDA', 'META', 'AAPL', 'MSFT', 'GOOGL', 'TSLA', 'AMZN', 'AMD', 'SPY', 'QQQ', 'BTC', 'ETH'];

function getSignalColor(sig) {
  return { bull: C.g, bear: C.r, neutral: '#f0b64e' }[sig];
}
const SIGNAL_ICONS = { bull: '▲', bear: '▼', neutral: '—' };

function ConfluenceView() {
  const [collapsed, setCollapsed] = useState(false);
  const [highOnly, setHighOnly] = useState(false);

  const data = useMemo(() => {
    const all = SYMBOLS.map(genSignals).sort((a, b) => b.score - a.score);
    return highOnly ? all.filter((d) => d.score >= 70) : all;
  }, [highOnly]);

  const highConfCount = SYMBOLS.map(genSignals).filter((d) => d.score >= 70).length;

  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 16, overflow: 'hidden' }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="tf-btn"
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Telescope size={18} color={C.t1} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)' }}>
            Multi-Timeframe Confluence
          </h3>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.g,
              background: alpha(C.g, 0.1),
              padding: '2px 7px',
              borderRadius: 4,
              fontFamily: 'var(--tf-mono)',
            }}
          >
            {highConfCount} high confluence
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
          {/* Filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <button
              onClick={() => setHighOnly(false)}
              className="tf-btn"
              style={{
                padding: '5px 12px',
                borderRadius: 8,
                border: `1px solid ${!highOnly ? C.b : 'transparent'}`,
                background: !highOnly ? alpha(C.b, 0.08) : 'transparent',
                color: !highOnly ? C.b : C.t3,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'var(--tf-font)',
              }}
            >
              <List size={12} /> All Symbols
            </button>
            <button
              onClick={() => setHighOnly(true)}
              className="tf-btn"
              style={{
                padding: '5px 12px',
                borderRadius: 8,
                border: `1px solid ${highOnly ? C.g : 'transparent'}`,
                background: highOnly ? alpha(C.g, 0.08) : 'transparent',
                color: highOnly ? C.g : C.t3,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'var(--tf-font)',
              }}
            >
              <Target size={12} /> High Confluence Only (70%+)
            </button>
          </div>

          {/* Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `70px repeat(${TIMEFRAMES.length}, 1fr) 60px`,
              gap: 4,
              padding: '6px 10px',
              fontSize: 11,
              fontWeight: 700,
              color: C.t3,
              fontFamily: 'var(--tf-font)',
              textTransform: 'uppercase',
            }}
          >
            <span>Symbol</span>
            {TIMEFRAMES.map((tf) => (
              <span key={tf} style={{ textAlign: 'center' }}>
                {tf}
              </span>
            ))}
            <span style={{ textAlign: 'right' }}>Score</span>
          </div>

          {/* Data Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {data.map((item) => (
              <div
                key={item.symbol}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `70px repeat(${TIMEFRAMES.length}, 1fr) 60px`,
                  gap: 4,
                  padding: '10px 10px',
                  background: alpha(C.sf, item.score >= 70 ? 0.7 : 0.4),
                  borderRadius: 6,
                  alignItems: 'center',
                  border: `1px solid ${item.score >= 70 ? alpha(C.g, 0.15) : alpha(C.bd, 0.3)}`,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)' }}>
                  {item.symbol}
                </span>
                {TIMEFRAMES.map((tf) => {
                  const sig = item.signals[tf];
                  return (
                    <div key={tf} style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: getSignalColor(sig),
                          fontFamily: 'var(--tf-mono)',
                        }}
                      >
                        {SIGNAL_ICONS[sig]}
                      </span>
                    </div>
                  );
                })}
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      fontFamily: 'var(--tf-mono)',
                      color: item.score >= 70 ? C.g : item.score >= 50 ? C.y : C.r,
                      background: alpha(item.score >= 70 ? C.g : item.score >= 50 ? C.y : C.r, 0.08),
                      padding: '2px 8px',
                      borderRadius: 5,
                    }}
                  >
                    {item.score}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12 }}>
            {[
              ['bull', 'Bullish'],
              ['bear', 'Bearish'],
              ['neutral', 'Neutral'],
            ].map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: getSignalColor(key), fontFamily: 'var(--tf-mono)' }}>
                  {SIGNAL_ICONS[key]}
                </span>
                <span style={{ fontSize: 11, color: C.t3, fontFamily: 'var(--tf-font)', textTransform: 'capitalize' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { ConfluenceView };

export default React.memo(ConfluenceView);
