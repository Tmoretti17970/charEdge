// ═══════════════════════════════════════════════════════════════════
// charEdge — Correlation & Risk Matrix
//
// Sprint 11: Interactive correlation heatmap for portfolio risk.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import { alpha } from '@/shared/colorUtils';

const SYMBOLS = ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'META', 'AMZN', 'GOOGL', 'SPY'];
const MACRO = ['SPY', 'DXY', 'VIX', 'TLT'];

// Simulated correlation values (seeded pseudo-random but realistic)
function simCorr(a, b, tf) {
  if (a === b) return 1.0;
  const seed = (a + b + tf).split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const raw = ((Math.sin(seed) * 10000) % 1);
  // Stocks tend to be positively correlated, adjust range
  if (MACRO.includes(a) || MACRO.includes(b)) return +(raw * 1.6 - 0.6).toFixed(2);
  return +(raw * 0.8 + 0.1).toFixed(2);
}

const TF_OPTIONS = ['30D', '90D', '1Y'];

function CorrelationMatrix() {
  const [collapsed, setCollapsed] = useState(false);
  const [tf, setTf] = useState('90D');
  const [showMacro, setShowMacro] = useState(true);
  const watchlist = useWatchlistStore((s) => s.items);

  const symbols = useMemo(() => {
    const wl = watchlist.map((w) => w.symbol).filter((s) => !MACRO.includes(s));
    const base = wl.length >= 3 ? wl.slice(0, 8) : SYMBOLS;
    return base;
  }, [watchlist]);

  const rows = showMacro ? [...symbols, ...MACRO.filter((m) => !symbols.includes(m))] : symbols;

  // Find high correlations
  const warnings = useMemo(() => {
    const w = [];
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const c = simCorr(symbols[i], symbols[j], tf);
        if (c > 0.85) w.push({ a: symbols[i], b: symbols[j], corr: c });
      }
    }
    return w;
  }, [symbols, tf]);

  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 16, overflow: 'hidden' }}>
      <button onClick={() => setCollapsed(!collapsed)} className="tf-btn"
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔗</span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>Correlation Matrix</h3>
          {warnings.length > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: C.y, background: alpha(C.y, 0.1), padding: '2px 7px', borderRadius: 4, fontFamily: M }}>
              ⚠ {warnings.length} high corr
            </span>
          )}
        </div>
        <span style={{ color: C.t3, fontSize: 11, transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s ease' }}>▾</span>
      </button>

      {!collapsed && (
        <div style={{ padding: '0 20px 20px' }}>
          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {TF_OPTIONS.map((t) => (
                <button key={t} onClick={() => setTf(t)} className="tf-btn"
                  style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${tf === t ? C.b : 'transparent'}`, background: tf === t ? alpha(C.b, 0.08) : 'transparent', color: tf === t ? C.b : C.t3, cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: M }}>
                  {t}
                </button>
              ))}
            </div>
            <button onClick={() => setShowMacro(!showMacro)} className="tf-btn"
              style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${showMacro ? C.p : 'transparent'}`, background: showMacro ? alpha(C.p, 0.08) : 'transparent', color: showMacro ? C.p : C.t3, cursor: 'pointer', fontSize: 10, fontWeight: 600, fontFamily: F }}>
              {showMacro ? '🌐 Macro On' : '🌐 Macro Off'}
            </button>
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div style={{ padding: '8px 12px', background: alpha(C.y, 0.06), border: `1px solid ${alpha(C.y, 0.15)}`, borderRadius: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.y, fontFamily: F, marginBottom: 4 }}>⚠ Hidden Correlation Risk</div>
              {warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 10, color: C.t2, fontFamily: F }}>
                  <span style={{ fontWeight: 600 }}>{w.a}</span> ↔ <span style={{ fontWeight: 600 }}>{w.b}</span>: <span style={{ color: C.r, fontWeight: 700, fontFamily: M }}>{w.corr}</span> — your portfolio may be less diversified than you think
                </div>
              ))}
            </div>
          )}

          {/* Matrix */}
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${rows.length}, 1fr)`, gap: 2, minWidth: rows.length * 48 + 60 }}>
              {/* Header row */}
              <div />
              {rows.map((s) => (
                <div key={s} style={{ fontSize: 9, fontWeight: 700, color: MACRO.includes(s) ? C.p : C.t2, fontFamily: M, textAlign: 'center', padding: '4px 2px' }}>{s}</div>
              ))}

              {/* Data rows */}
              {rows.map((rowSym) => (
                <div key={rowSym} style={{ display: 'contents' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: MACRO.includes(rowSym) ? C.p : C.t1, fontFamily: F, display: 'flex', alignItems: 'center', paddingRight: 4 }}>{rowSym}</div>
                  {rows.map((colSym) => {
                    const val = simCorr(rowSym, colSym, tf);
                    const absVal = Math.abs(val);
                    const col = val > 0.3 ? C.g : val < -0.3 ? C.r : C.t3;
                    return (
                      <div key={colSym} title={`${rowSym} ↔ ${colSym}: ${val}`}
                        style={{
                          textAlign: 'center', padding: '6px 2px', borderRadius: 4,
                          background: rowSym === colSym ? alpha(C.t3, 0.1) : alpha(col, absVal * 0.15),
                          fontSize: 10, fontWeight: rowSym === colSym ? 400 : 600, fontFamily: M,
                          color: rowSym === colSym ? C.t3 : col,
                        }}>
                        {rowSym === colSym ? '—' : val.toFixed(2)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 8, borderRadius: 2, background: C.g }} />
              <span style={{ fontSize: 9, color: C.t3, fontFamily: F }}>Positive</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 8, borderRadius: 2, background: C.t3 }} />
              <span style={{ fontSize: 9, color: C.t3, fontFamily: F }}>Neutral</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 8, borderRadius: 2, background: C.r }} />
              <span style={{ fontSize: 9, color: C.t3, fontFamily: F }}>Negative</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { CorrelationMatrix };

export default React.memo(CorrelationMatrix);
