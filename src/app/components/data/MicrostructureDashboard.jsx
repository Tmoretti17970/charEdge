// ═══════════════════════════════════════════════════════════════════
// charEdge v17 — Multi-Symbol Microstructure Dashboard
//
// Real-time comparative view of market microstructure across
// multiple symbols. Shows spread, imbalance, trade flow, and
// institutional patterns side-by-side for correlation analysis.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { logger } from '@/observability/logger';

// ─── Default Watchlist ─────────────────────────────────────────

const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];

// ─── Styles ────────────────────────────────────────────────────

const css = {
  container: {
    background: 'var(--bg-primary, #0a0e16)',
    borderRadius: '8px',
    border: '1px solid var(--border-primary, rgba(255,255,255,0.06))',
    padding: '16px',
    fontFamily: '"Inter", "SF Pro Display", sans-serif',
    color: 'var(--text-primary, #c8d6e5)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    color: 'var(--text-primary, #e0e8f0)',
  },
  subtitle: {
    fontSize: '11px',
    color: 'var(--text-secondary, #667788)',
    marginTop: '2px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '12px',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    padding: '12px',
    transition: 'border-color 0.2s',
  },
  cardHover: {
    borderColor: 'rgba(100, 216, 255, 0.2)',
  },
  symbolName: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#e0e8f0',
    marginBottom: '8px',
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '3px 0',
    fontSize: '11px',
  },
  metricLabel: {
    color: '#667788',
  },
  metricValue: {
    fontFamily: '"JetBrains Mono", "SF Mono", monospace',
    fontSize: '11px',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  },
  positive: { color: '#4ecdc4' },
  negative: { color: '#ef5350' },
  neutral: { color: '#8899aa' },
  imbalanceBar: {
    height: '4px',
    borderRadius: '2px',
    background: 'rgba(255, 255, 255, 0.05)',
    marginTop: '6px',
    overflow: 'hidden',
    position: 'relative',
  },
  imbalanceFill: (pct, bullish) => ({
    height: '100%',
    width: `${Math.min(100, Math.max(0, pct))}%`,
    background: bullish
      ? 'linear-gradient(90deg, #4ecdc4, #26d0ce)'
      : 'linear-gradient(90deg, #ef5350, #ff6b6b)',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  }),
  badge: (color) => ({
    display: 'inline-block',
    padding: '1px 6px',
    borderRadius: '3px',
    background: `${color}15`,
    color: color,
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.3px',
  }),
  alertsSection: {
    marginTop: '12px',
    padding: '8px',
    background: 'rgba(255, 165, 0, 0.04)',
    border: '1px solid rgba(255, 165, 0, 0.1)',
    borderRadius: '6px',
  },
  alertItem: {
    fontSize: '10px',
    color: '#ffa726',
    padding: '2px 0',
  },
  noData: {
    textAlign: 'center',
    color: '#556677',
    fontSize: '11px',
    padding: '20px 0',
  },
};

// ─── Component ─────────────────────────────────────────────────

export default function MicrostructureDashboard({ symbols = DEFAULT_SYMBOLS }) {
  const [data, setData] = useState({});
  const [correlatorEvents, setCorrelatorEvents] = useState([]);
  const [hoveredCard, setHoveredCard] = useState(null);
  const intervalRef = useRef(null);

  // Collect microstructure data from engines
  const collectData = useCallback(async () => {
    try {
      const snap = {};

      // DepthEngine — spreads, imbalance
      let depthEngine;
      try {
        const depthMod = await import('../../data/engine/orderflow/DepthEngine.js');
        depthEngine = depthMod.depthEngine;
      } catch (e) { logger.ui.warn('Operation failed', e); }

      // OrderFlowEngine — CVD, aggressor ratio, tick rates
      let orderFlowEngine;
      try {
        const ofMod = await import('../../data/engine/orderflow/OrderFlowEngine.js');
        orderFlowEngine = ofMod.orderFlowEngine;
      } catch (e) { logger.ui.warn('Operation failed', e); }

      for (const symbol of symbols) {
        const upper = symbol.toUpperCase();
        const entry = {};

        // Depth data
        if (depthEngine) {
          const depth = depthEngine.getDepth(upper);
          if (depth) {
            entry.spread = depth.spread;
            entry.spreadPct = depth.spreadPct;
            entry.imbalanceRatio = depth.imbalanceRatio;
            entry.imbalanceLabel = depth.imbalanceLabel;
            entry.bestBid = depth.bids?.[0]?.price || 0;
            entry.bestAsk = depth.asks?.[0]?.price || 0;
            entry.bidDepth = depth.totalBidQty;
            entry.askDepth = depth.totalAskQty;
            entry.spoofAlerts = depth.spoofAlerts || [];
          }
          entry.depthState = depthEngine.getConnectionState(upper);
        }

        // Order flow data
        if (orderFlowEngine) {
          try {
            const stats = orderFlowEngine.getStats(upper);
            const cvd = orderFlowEngine.getCVD(upper);
            const aggressor = orderFlowEngine.getAggressorRatio(upper);
            entry.totalTicks = stats?.totalTicks || 0;
            entry.tickRate = stats?.tickRate || 0;
            entry.cvd = cvd?.current || 0;
            entry.aggressorBuy = aggressor?.buyPercent || 50;
            entry.aggressorSell = aggressor?.sellPercent || 50;
          } catch (e) { logger.ui.warn('Operation failed', e); }
        }

        snap[upper] = entry;
      }

      setData(snap);

      // Correlator events
      try {
        const { depthFlowCorrelator } = await import('../../data/engine/orderflow/DepthFlowCorrelator.js');
        const events = depthFlowCorrelator.getRecentEvents?.(10) || [];
        setCorrelatorEvents(events);
      } catch (e) { logger.ui.warn('Operation failed', e); }

    } catch (e) { logger.ui.warn('Operation failed', e); }
  }, [symbols]);

  useEffect(() => {
    collectData();
    intervalRef.current = setInterval(collectData, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [collectData]);

  const _activeSymbols = useMemo(() => {
    return symbols.filter(s => data[s.toUpperCase()]);
  }, [symbols, data]);

  return (
    <div style={css.container} id="microstructure-dashboard">
      {/* Header */}
      <div style={css.header}>
        <div>
          <div style={css.title}>Market Microstructure</div>
          <div style={css.subtitle}>
            Real-time spread, depth, & flow across {symbols.length} symbols
          </div>
        </div>
      </div>

      {/* Symbol Cards Grid */}
      <div style={css.grid}>
        {symbols.map(symbol => {
          const upper = symbol.toUpperCase();
          const d = data[upper] || {};
          const hasData = d.bestBid > 0 || d.totalTicks > 0;

          return (
            <div
              key={symbol}
              style={{
                ...css.card,
                ...(hoveredCard === symbol ? css.cardHover : {}),
              }}
              onMouseEnter={() => setHoveredCard(symbol)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              {/* Symbol + Connection State */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={css.symbolName}>{upper}</span>
                {d.depthState && (
                  <span style={css.badge(
                    d.depthState === 'connected' ? '#4ecdc4'
                    : d.depthState === 'reconnecting' ? '#ffa726'
                    : '#ef5350'
                  )}>
                    {d.depthState}
                  </span>
                )}
              </div>

              {!hasData ? (
                <div style={css.noData}>No live data</div>
              ) : (
                <>
                  {/* Spread */}
                  {d.bestBid > 0 && (
                    <>
                      <div style={css.metricRow}>
                        <span style={css.metricLabel}>Spread</span>
                        <span style={{ ...css.metricValue, color: '#64d8ff' }}>
                          {d.spread != null ? d.spread.toFixed(2) : '—'}
                          {d.spreadPct != null && (
                            <span style={{ color: '#667788', marginLeft: '4px' }}>
                              ({d.spreadPct.toFixed(3)}%)
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Best Bid/Ask */}
                      <div style={css.metricRow}>
                        <span style={css.metricLabel}>Bid / Ask</span>
                        <span style={css.metricValue}>
                          <span style={css.positive}>{d.bestBid?.toFixed(2)}</span>
                          {' / '}
                          <span style={css.negative}>{d.bestAsk?.toFixed(2)}</span>
                        </span>
                      </div>

                      {/* Depth Imbalance */}
                      <div style={css.metricRow}>
                        <span style={css.metricLabel}>Imbalance</span>
                        <span style={{
                          ...css.metricValue,
                          ...(d.imbalanceRatio > 0.55 ? css.positive
                            : d.imbalanceRatio < 0.45 ? css.negative
                            : css.neutral)
                        }}>
                          {d.imbalanceLabel || '—'}
                          {d.imbalanceRatio != null && (
                            <span style={{ color: '#667788', marginLeft: '4px' }}>
                              ({(d.imbalanceRatio * 100).toFixed(0)}% bid)
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Imbalance Bar */}
                      <div style={css.imbalanceBar}>
                        <div style={css.imbalanceFill(
                          (d.imbalanceRatio || 0.5) * 100,
                          (d.imbalanceRatio || 0.5) >= 0.5
                        )} />
                      </div>
                    </>
                  )}

                  {/* Trade Flow */}
                  {d.totalTicks > 0 && (
                    <>
                      <div style={{ ...css.metricRow, marginTop: '8px' }}>
                        <span style={css.metricLabel}>CVD</span>
                        <span style={{
                          ...css.metricValue,
                          ...(d.cvd > 0 ? css.positive : d.cvd < 0 ? css.negative : css.neutral)
                        }}>
                          {d.cvd > 0 ? '+' : ''}{(d.cvd || 0).toFixed(2)}
                        </span>
                      </div>

                      <div style={css.metricRow}>
                        <span style={css.metricLabel}>Aggressor</span>
                        <span style={css.metricValue}>
                          <span style={css.positive}>{d.aggressorBuy?.toFixed(0)}%</span>
                          {' / '}
                          <span style={css.negative}>{d.aggressorSell?.toFixed(0)}%</span>
                        </span>
                      </div>

                      <div style={css.metricRow}>
                        <span style={css.metricLabel}>Tick Rate</span>
                        <span style={css.metricValue}>
                          {(d.tickRate || 0).toFixed(1)}/s
                        </span>
                      </div>
                    </>
                  )}

                  {/* Spoof Alerts */}
                  {d.spoofAlerts?.length > 0 && (
                    <div style={{ marginTop: '6px' }}>
                      {d.spoofAlerts.slice(0, 2).map((alert, i) => (
                        <div key={i} style={{ fontSize: '9px', color: '#ffa726' }}>
                          ⚠ {alert.type}: {alert.side} @ {alert.price?.toFixed(2)}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Institutional Pattern Alerts */}
      {correlatorEvents.length > 0 && (
        <div style={css.alertsSection}>
          <div style={{ ...css.metricLabel, fontSize: '10px', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Institutional Patterns
          </div>
          {correlatorEvents.slice(0, 5).map((evt, i) => (
            <div key={i} style={css.alertItem}>
              <span style={css.badge(
                evt.type === 'absorption' ? '#64d8ff'
                : evt.type === 'iceberg' ? '#ba68c8'
                : evt.type === 'sweep' ? '#ef5350'
                : '#ffa726'
              )}>
                {evt.type}
              </span>
              <span style={{ marginLeft: '6px' }}>
                {evt.symbol} — {evt.description || evt.type}
                <span style={{ color: '#556677', marginLeft: '4px' }}>
                  {evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : ''}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
