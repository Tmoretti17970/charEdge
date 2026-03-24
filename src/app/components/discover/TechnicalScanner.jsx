// ═══════════════════════════════════════════════════════════════════
// charEdge — Technical Scanner & Pattern Recognition
//
// Sprint 10: Automated chart pattern & signal detection engine.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { C } from '../../../constants.js';
import { useWatchlistStore } from '../../../state/useWatchlistStore';
import s from './TechnicalScanner.module.css';
import { alpha } from '@/shared/colorUtils';

// Default scan symbols if watchlist is empty
const DEFAULT_SCAN_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'DOGEUSDT',
  'AVAXUSDT',
  'DOTUSDT',
  'LINKUSDT',
];

function getConfColors() {
  return { bull: C.g, bear: C.r, neutral: C.y };
}
const CONF_ICONS = { bull: '▲', bear: '▼', neutral: '—' };
function getStrengthColors() {
  return { strong: C.g, high: C.cyan, medium: C.y };
}

const _TABS = ['patterns', 'signals', 'confluence'];
const CONFIDENCE_FILTERS = ['all', 'high', 'medium'];

function TechnicalScanner() {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState('patterns');
  const [confFilter, setConfFilter] = useState('all');
  const [scanData, setScanData] = useState({ patterns: [], signals: [], confluence: [] });
  const [loading, setLoading] = useState(false);
  const [_lastScan, setLastScan] = useState(null);

  const watchlistSymbols = useWatchlistStore((s) => s.symbols);

  // Run scan on mount and when watchlist changes
  useEffect(() => {
    let cancelled = false;
    async function runScan() {
      setLoading(true);
      try {
        const { scanEngine } = await import('../../../data/engine/ScanEngine.js');
        const symbols =
          watchlistSymbols?.length > 0 ? watchlistSymbols.map((w) => w.symbol || w) : DEFAULT_SCAN_SYMBOLS;
        const results = await scanEngine.scan(symbols);
        if (!cancelled) {
          setScanData(results);
          setLastScan(new Date());
        }
      } catch {
        // Keep existing data on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    runScan();
    return () => {
      cancelled = true;
    };
  }, [watchlistSymbols]);

  const patterns = useMemo(() => {
    const all = scanData.patterns;
    if (confFilter === 'high') return all.filter((p) => p.confidence >= 80);
    if (confFilter === 'medium') return all.filter((p) => p.confidence >= 60 && p.confidence < 80);
    return all;
  }, [confFilter, scanData.patterns]);

  const totalDetections = scanData.patterns.length + scanData.signals.length;

  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 16, overflow: 'hidden' }}>
      <button onClick={() => setCollapsed(!collapsed)} className={`tf-btn ${s.s0}`}>
        <div className={s.s1}>
          <span style={{ fontSize: 18 }}>📐</span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)' }}>
            Technical Scanner
          </h3>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.cyan,
              background: alpha(C.cyan, 0.1),
              padding: '2px 7px',
              borderRadius: 4,
              fontFamily: 'var(--tf-mono)',
            }}
          >
            {totalDetections} active
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
          {/* Tab Toggle */}
          <div className={s.s2}>
            {[
              { id: 'patterns', label: '📐 Patterns', count: scanData.patterns.length },
              { id: 'signals', label: '📊 Signals', count: scanData.signals.length },
              { id: 'confluence', label: '🔭 Confluence', count: scanData.confluence.length },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="tf-btn"
                style={{
                  padding: '5px 14px',
                  borderRadius: 8,
                  border: `1px solid ${tab === t.id ? C.b : 'transparent'}`,
                  background: tab === t.id ? alpha(C.b, 0.08) : 'transparent',
                  color: tab === t.id ? C.b : C.t3,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--tf-font)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {t.label}
                <span style={{ fontSize: 9, fontFamily: 'var(--tf-mono)', color: tab === t.id ? C.b : C.t3 }}>
                  ({t.count})
                </span>
              </button>
            ))}
          </div>

          {/* Loading indicator */}
          {loading && (
            <div
              style={{
                textAlign: 'center',
                padding: '20px 0',
                color: C.t3,
                fontSize: 11,
                fontFamily: 'var(--tf-font)',
              }}
            >
              Scanning {watchlistSymbols?.length || DEFAULT_SCAN_SYMBOLS.length} symbols...
            </div>
          )}

          {/* Patterns Tab */}
          {tab === 'patterns' && !loading && (
            <>
              <div className={s.s3}>
                {CONFIDENCE_FILTERS.map((cf) => (
                  <button
                    key={cf}
                    onClick={() => setConfFilter(cf)}
                    className="tf-btn"
                    style={{
                      padding: '3px 8px',
                      borderRadius: 5,
                      border: `1px solid ${confFilter === cf ? C.p : 'transparent'}`,
                      background: confFilter === cf ? alpha(C.p, 0.08) : 'transparent',
                      color: confFilter === cf ? C.p : C.t3,
                      cursor: 'pointer',
                      fontSize: 10,
                      fontWeight: 600,
                      fontFamily: 'var(--tf-font)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {cf === 'all' ? 'All' : cf === 'high' ? '🎯 High (80%+)' : '🔷 Medium'}
                  </button>
                ))}
              </div>
              <div className={s.s4}>
                {patterns.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      background: alpha(C.sf, 0.5),
                      border: `1px solid ${alpha(C.bd, 0.3)}`,
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ minWidth: 50 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)' }}>
                        {p.symbol}
                      </div>
                      <div style={{ fontSize: 9, color: C.t3, fontFamily: 'var(--tf-mono)' }}>{p.timeframe}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, fontFamily: 'var(--tf-font)' }}>
                        {p.pattern}
                      </div>
                      <div style={{ fontSize: 9, color: C.t3, fontFamily: 'var(--tf-font)' }}>
                        {p.type} · {p.detected}
                      </div>
                    </div>
                    {/* Confidence */}
                    <div className={s.s5}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          fontFamily: 'var(--tf-mono)',
                          color: p.confidence >= 80 ? C.g : p.confidence >= 60 ? C.y : C.t3,
                        }}
                      >
                        {p.confidence}%
                      </div>
                      <div style={{ fontSize: 8, color: C.t3, fontFamily: 'var(--tf-font)' }}>conf.</div>
                    </div>
                    {/* Direction */}
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        fontFamily: 'var(--tf-font)',
                        color: p.direction === 'bullish' ? C.g : C.r,
                        background: alpha(p.direction === 'bullish' ? C.g : C.r, 0.1),
                        padding: '3px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {p.direction === 'bullish' ? '▲ BULL' : '▼ BEAR'}
                    </span>
                    {/* Target */}
                    <div className={s.s6}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: C.t1, fontFamily: 'var(--tf-mono)' }}>
                        T: ${p.target}
                      </div>
                      <div style={{ fontSize: 9, color: C.t3, fontFamily: 'var(--tf-mono)' }}>S: ${p.stop}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Signals Tab */}
          {tab === 'signals' && !loading && (
            <div className={s.s7}>
              {scanData.signals.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: alpha(C.sf, 0.5),
                    border: `1px solid ${alpha(C.bd, 0.3)}`,
                    borderRadius: 8,
                  }}
                >
                  <div style={{ minWidth: 50 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)' }}>
                      {s.symbol}
                    </div>
                    <div style={{ fontSize: 9, color: C.t3, fontFamily: 'var(--tf-mono)' }}>{s.timeframe}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.t1, fontFamily: 'var(--tf-font)' }}>
                      {s.signal}
                    </div>
                    <div style={{ fontSize: 9, color: C.t3, fontFamily: 'var(--tf-font)' }}>{s.detected}</div>
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      color: getStrengthColors()[s.strength] || C.t3,
                      background: alpha(getStrengthColors()[s.strength] || C.t3, 0.1),
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontFamily: 'var(--tf-font)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {s.strength}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      fontFamily: 'var(--tf-font)',
                      color:
                        getConfColors()[
                          s.direction === 'bullish' ? 'bull' : s.direction === 'bearish' ? 'bear' : 'neutral'
                        ],
                    }}
                  >
                    {s.direction === 'bullish' ? '▲ BULL' : s.direction === 'bearish' ? '▼ BEAR' : '— NEUT'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Confluence Tab */}
          {tab === 'confluence' && !loading && (
            <div>
              {/* Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '70px 1fr 1fr 1fr 60px',
                  gap: 4,
                  padding: '6px 10px',
                  fontSize: 9,
                  fontWeight: 700,
                  color: C.t3,
                  fontFamily: 'var(--tf-font)',
                  textTransform: 'uppercase',
                }}
              >
                <span>Symbol</span>
                <span style={{ textAlign: 'center' }}>Trend</span>
                <span style={{ textAlign: 'center' }}>RSI</span>
                <span style={{ textAlign: 'center' }}>Volatility</span>
                <span style={{ textAlign: 'right' }}>Score</span>
              </div>
              <div className={s.s8}>
                {scanData.confluence.map((cd) => (
                  <div
                    key={cd.symbol}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '70px 1fr 1fr 1fr 60px',
                      gap: 4,
                      padding: '10px 10px',
                      background: alpha(C.sf, 0.5),
                      borderRadius: 6,
                      alignItems: 'center',
                      border: `1px solid ${alpha(C.bd, 0.3)}`,
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)' }}>
                      {cd.symbol}
                    </span>
                    <span
                      style={{
                        textAlign: 'center',
                        fontSize: 11,
                        fontWeight: 600,
                        color: getConfColors()[cd.trend === 'up' ? 'bull' : cd.trend === 'down' ? 'bear' : 'neutral'],
                        fontFamily: 'var(--tf-mono)',
                      }}
                    >
                      {CONF_ICONS[cd.trend === 'up' ? 'bull' : cd.trend === 'down' ? 'bear' : 'neutral']}{' '}
                      {cd.trend || 'neutral'}
                    </span>
                    <span
                      style={{
                        textAlign: 'center',
                        fontSize: 11,
                        fontWeight: 600,
                        color: cd.rsi > 70 ? C.r : cd.rsi < 30 ? C.g : C.t2,
                        fontFamily: 'var(--tf-mono)',
                      }}
                    >
                      {cd.rsi != null ? cd.rsi : '—'}
                    </span>
                    <span
                      style={{
                        textAlign: 'center',
                        fontSize: 10,
                        fontWeight: 600,
                        color: cd.volatility === 'high' ? C.r : cd.volatility === 'low' ? C.g : C.t3,
                        fontFamily: 'var(--tf-font)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {cd.volatility || 'normal'}
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          fontFamily: 'var(--tf-mono)',
                          color: cd.score >= 70 ? C.g : cd.score >= 50 ? C.y : C.r,
                        }}
                      >
                        {cd.score}
                      </span>
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

export default React.memo(TechnicalScanner);
