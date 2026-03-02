// ═══════════════════════════════════════════════════════════════════
// charEdge — Sector Rotation & Flow Map
//
// Sprint 6: Visual sector performance & money flow visualization.
// Features:
//   - Treemap-style sector grid with performance heat colors
//   - Multi-timeframe comparison (1D, 1W, 1M, 3M, YTD)
//   - Money flow inflow/outflow indicators
//   - Business cycle overlay
//   - Drill-down top movers per sector
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { alpha } from '../../../utils/colorUtils.js';

// ─── Mock Sector Data ───────────────────────────────────────────

const SECTORS = [
  {
    id: 'tech', name: 'Technology', icon: '💻', weight: 28.5,
    perf: { '1D': 1.42, '1W': 3.18, '1M': 5.64, '3M': 12.3, 'YTD': 8.9 },
    flow: 2.4, // billions, positive = inflow
    cycle: 'expansion',
    topMovers: [
      { symbol: 'NVDA', change: 4.8, price: 892.50 },
      { symbol: 'AAPL', change: 1.2, price: 198.30 },
      { symbol: 'MSFT', change: 0.9, price: 415.80 },
      { symbol: 'AVGO', change: 3.1, price: 1285.00 },
      { symbol: 'AMD', change: -0.6, price: 178.40 },
    ],
  },
  {
    id: 'health', name: 'Healthcare', icon: '🏥', weight: 13.2,
    perf: { '1D': -0.35, '1W': 0.82, '1M': -1.24, '3M': 2.10, 'YTD': 1.5 },
    flow: -0.8,
    cycle: 'contraction',
    topMovers: [
      { symbol: 'UNH', change: -1.2, price: 524.60 },
      { symbol: 'JNJ', change: 0.4, price: 162.10 },
      { symbol: 'LLY', change: 2.8, price: 785.40 },
      { symbol: 'PFE', change: -0.8, price: 28.90 },
      { symbol: 'ABBV', change: 0.3, price: 178.50 },
    ],
  },
  {
    id: 'finance', name: 'Financials', icon: '🏦', weight: 12.8,
    perf: { '1D': 0.68, '1W': 1.45, '1M': 3.82, '3M': 8.4, 'YTD': 6.2 },
    flow: 1.2,
    cycle: 'expansion',
    topMovers: [
      { symbol: 'JPM', change: 1.5, price: 198.20 },
      { symbol: 'BAC', change: 0.8, price: 38.40 },
      { symbol: 'GS', change: 2.1, price: 412.80 },
      { symbol: 'V', change: 0.3, price: 282.60 },
      { symbol: 'MA', change: 0.6, price: 468.90 },
    ],
  },
  {
    id: 'energy', name: 'Energy', icon: '⚡', weight: 4.2,
    perf: { '1D': -1.85, '1W': -3.20, '1M': -5.40, '3M': -8.6, 'YTD': -12.4 },
    flow: -1.6,
    cycle: 'contraction',
    topMovers: [
      { symbol: 'XOM', change: -2.1, price: 104.80 },
      { symbol: 'CVX', change: -1.8, price: 152.30 },
      { symbol: 'SLB', change: -2.5, price: 48.60 },
      { symbol: 'COP', change: -1.4, price: 112.40 },
      { symbol: 'EOG', change: -0.9, price: 118.20 },
    ],
  },
  {
    id: 'consumer_d', name: 'Cons. Discretionary', icon: '🛍️', weight: 10.5,
    perf: { '1D': 0.92, '1W': 2.10, '1M': 4.35, '3M': 6.8, 'YTD': 5.1 },
    flow: 0.6,
    cycle: 'peak',
    topMovers: [
      { symbol: 'AMZN', change: 1.8, price: 185.20 },
      { symbol: 'TSLA', change: 3.4, price: 248.60 },
      { symbol: 'HD', change: 0.2, price: 378.90 },
      { symbol: 'NKE', change: -0.5, price: 98.40 },
      { symbol: 'MCD', change: 0.6, price: 294.10 },
    ],
  },
  {
    id: 'consumer_s', name: 'Cons. Staples', icon: '🛒', weight: 6.8,
    perf: { '1D': 0.12, '1W': -0.45, '1M': -0.82, '3M': 1.2, 'YTD': -0.4 },
    flow: -0.2,
    cycle: 'trough',
    topMovers: [
      { symbol: 'PG', change: 0.3, price: 168.40 },
      { symbol: 'KO', change: 0.1, price: 62.80 },
      { symbol: 'PEP', change: -0.2, price: 172.60 },
      { symbol: 'COST', change: 0.8, price: 728.30 },
      { symbol: 'WMT', change: 0.4, price: 172.80 },
    ],
  },
  {
    id: 'industrial', name: 'Industrials', icon: '🏭', weight: 8.5,
    perf: { '1D': 0.55, '1W': 1.82, '1M': 2.90, '3M': 5.4, 'YTD': 4.8 },
    flow: 0.4,
    cycle: 'expansion',
    topMovers: [
      { symbol: 'CAT', change: 1.2, price: 342.80 },
      { symbol: 'GE', change: 0.8, price: 168.40 },
      { symbol: 'HON', change: 0.3, price: 212.50 },
      { symbol: 'UNP', change: 0.5, price: 248.60 },
      { symbol: 'RTX', change: 0.9, price: 98.40 },
    ],
  },
  {
    id: 'materials', name: 'Materials', icon: '🧱', weight: 2.5,
    perf: { '1D': -0.28, '1W': 0.65, '1M': 1.42, '3M': -2.1, 'YTD': -1.8 },
    flow: -0.3,
    cycle: 'trough',
    topMovers: [
      { symbol: 'LIN', change: 0.4, price: 442.30 },
      { symbol: 'APD', change: -0.6, price: 268.40 },
      { symbol: 'SHW', change: 0.2, price: 342.80 },
      { symbol: 'FCX', change: -1.8, price: 42.60 },
      { symbol: 'NEM', change: 1.2, price: 38.90 },
    ],
  },
  {
    id: 'realestate', name: 'Real Estate', icon: '🏢', weight: 2.4,
    perf: { '1D': -0.62, '1W': -1.24, '1M': -2.85, '3M': -4.2, 'YTD': -5.6 },
    flow: -0.5,
    cycle: 'contraction',
    topMovers: [
      { symbol: 'AMT', change: -0.8, price: 198.40 },
      { symbol: 'PLD', change: -1.0, price: 128.60 },
      { symbol: 'EQIX', change: 0.2, price: 842.30 },
      { symbol: 'SPG', change: -0.5, price: 148.90 },
      { symbol: 'O', change: -0.3, price: 54.20 },
    ],
  },
  {
    id: 'utilities', name: 'Utilities', icon: '💡', weight: 2.6,
    perf: { '1D': 0.18, '1W': -0.32, '1M': -1.10, '3M': 0.8, 'YTD': -2.1 },
    flow: 0.1,
    cycle: 'trough',
    topMovers: [
      { symbol: 'NEE', change: 0.4, price: 72.80 },
      { symbol: 'DUK', change: 0.1, price: 98.40 },
      { symbol: 'SO', change: -0.2, price: 74.60 },
      { symbol: 'D', change: 0.3, price: 48.90 },
      { symbol: 'AEP', change: -0.1, price: 88.20 },
    ],
  },
  {
    id: 'comms', name: 'Communication', icon: '📡', weight: 8.0,
    perf: { '1D': 1.15, '1W': 2.48, '1M': 6.20, '3M': 14.5, 'YTD': 10.2 },
    flow: 1.8,
    cycle: 'expansion',
    topMovers: [
      { symbol: 'META', change: 2.4, price: 498.60 },
      { symbol: 'GOOGL', change: 1.6, price: 148.20 },
      { symbol: 'NFLX', change: 0.8, price: 628.40 },
      { symbol: 'DIS', change: -0.4, price: 112.30 },
      { symbol: 'T', change: 0.2, price: 18.90 },
    ],
  },
];

const TIMEFRAMES = ['1D', '1W', '1M', '3M', 'YTD'];

const CYCLE_META = {
  expansion: { color: '#2dd4a0', label: 'Expansion', icon: '📈' },
  peak: { color: '#f0b64e', label: 'Peak', icon: '🔝' },
  contraction: { color: '#f25c5c', label: 'Contraction', icon: '📉' },
  trough: { color: '#c084fc', label: 'Trough', icon: '🔄' },
};

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════

export default function SectorRotationMap() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTF, setActiveTF] = useState('1D');
  const [drillSector, setDrillSector] = useState(null);
  const [sortBy, setSortBy] = useState('perf'); // 'perf' | 'flow' | 'weight'

  const sorted = useMemo(() => {
    const arr = [...SECTORS];
    if (sortBy === 'perf') arr.sort((a, b) => b.perf[activeTF] - a.perf[activeTF]);
    else if (sortBy === 'flow') arr.sort((a, b) => b.flow - a.flow);
    else arr.sort((a, b) => b.weight - a.weight);
    return arr;
  }, [sortBy, activeTF]);

  return (
    <div
      style={{
        background: C.bg2,
        border: `1px solid ${C.bd}`,
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
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
          <span style={{ fontSize: 18 }}>🗺️</span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>
            Sector Rotation Map
          </h3>
          <span
            style={{
              fontSize: 10, fontWeight: 700, color: C.g,
              background: alpha(C.g, 0.1), padding: '2px 7px',
              borderRadius: 4, fontFamily: M,
            }}
          >
            {SECTORS.length} sectors
          </span>
        </div>
        <span
          style={{
            color: C.t3, fontSize: 11,
            transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          ▾
        </span>
      </button>

      {!collapsed && (
        <div style={{ padding: '0 20px 20px' }}>
          {/* Controls Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            {/* Timeframe Selector */}
            <div style={{ display: 'flex', gap: 4 }}>
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setActiveTF(tf)}
                  className="tf-btn"
                  style={{
                    padding: '4px 10px', borderRadius: 6,
                    border: `1px solid ${activeTF === tf ? C.b : 'transparent'}`,
                    background: activeTF === tf ? alpha(C.b, 0.08) : 'transparent',
                    color: activeTF === tf ? C.b : C.t3,
                    cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: M,
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { id: 'perf', label: 'Performance' },
                { id: 'flow', label: 'Money Flow' },
                { id: 'weight', label: 'Weight' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSortBy(s.id)}
                  className="tf-btn"
                  style={{
                    padding: '4px 10px', borderRadius: 6,
                    border: `1px solid ${sortBy === s.id ? C.p : 'transparent'}`,
                    background: sortBy === s.id ? alpha(C.p, 0.08) : 'transparent',
                    color: sortBy === s.id ? C.p : C.t3,
                    cursor: 'pointer', fontSize: 10, fontWeight: 600, fontFamily: F,
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Drill-down back button */}
          {drillSector && (
            <button
              onClick={() => setDrillSector(null)}
              className="tf-btn"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', marginBottom: 12,
                background: 'transparent', border: `1px solid ${C.bd}`,
                borderRadius: 8, cursor: 'pointer',
                color: C.t2, fontSize: 11, fontFamily: F, fontWeight: 600,
              }}
            >
              ← All Sectors
            </button>
          )}

          {/* Sector Grid or Drill-down */}
          {drillSector ? (
            <DrillDown sector={SECTORS.find((s) => s.id === drillSector)} activeTF={activeTF} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Table Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr repeat(5, 1fr) 80px 70px',
                  gap: 4,
                  padding: '6px 10px',
                  fontSize: 9,
                  fontWeight: 700,
                  color: C.t3,
                  fontFamily: F,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                <span>Sector</span>
                {TIMEFRAMES.map((tf) => (
                  <span key={tf} style={{ textAlign: 'right', color: activeTF === tf ? C.b : C.t3 }}>{tf}</span>
                ))}
                <span style={{ textAlign: 'right' }}>Flow</span>
                <span style={{ textAlign: 'right' }}>Cycle</span>
              </div>

              {/* Sector Rows */}
              {sorted.map((sector) => (
                <SectorRow
                  key={sector.id}
                  sector={sector}
                  activeTF={activeTF}
                  onClick={() => setDrillSector(sector.id)}
                />
              ))}
            </div>
          )}

          {/* Business Cycle Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 14, justifyContent: 'center' }}>
            {Object.entries(CYCLE_META).map(([key, meta]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} />
                <span style={{ fontSize: 9, color: C.t3, fontFamily: F }}>{meta.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sector Row
// ═══════════════════════════════════════════════════════════════════

function SectorRow({ sector, activeTF, onClick }) {
  const cycleMeta = CYCLE_META[sector.cycle];

  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '2fr repeat(5, 1fr) 80px 70px',
        gap: 4,
        padding: '10px 10px',
        background: alpha(C.sf, 0.5),
        border: `1px solid ${alpha(C.bd, 0.3)}`,
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        alignItems: 'center',
      }}
      className="tf-btn"
    >
      {/* Sector Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{sector.icon}</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: F }}>{sector.name}</div>
          <div style={{ fontSize: 9, color: C.t3, fontFamily: M }}>{sector.weight}% of S&P</div>
        </div>
      </div>

      {/* Performance columns */}
      {TIMEFRAMES.map((tf) => {
        const val = sector.perf[tf];
        const isActive = tf === activeTF;
        return (
          <div
            key={tf}
            style={{
              textAlign: 'right',
              fontSize: isActive ? 13 : 11,
              fontWeight: isActive ? 700 : 500,
              color: val >= 0 ? C.g : C.r,
              fontFamily: M,
              background: isActive ? alpha(val >= 0 ? C.g : C.r, 0.06) : 'transparent',
              padding: isActive ? '2px 6px' : 0,
              borderRadius: 4,
            }}
          >
            {val >= 0 ? '+' : ''}{val.toFixed(2)}%
          </div>
        );
      })}

      {/* Money Flow */}
      <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
        <span style={{ fontSize: 10, color: sector.flow >= 0 ? C.g : C.r }}>
          {sector.flow >= 0 ? '▲' : '▼'}
        </span>
        <span
          style={{
            fontSize: 11, fontWeight: 600, fontFamily: M,
            color: sector.flow >= 0 ? C.g : C.r,
          }}
        >
          ${Math.abs(sector.flow).toFixed(1)}B
        </span>
      </div>

      {/* Cycle Badge */}
      <div style={{ textAlign: 'right' }}>
        <span
          style={{
            fontSize: 9, fontWeight: 600, fontFamily: F,
            color: cycleMeta.color,
            background: alpha(cycleMeta.color, 0.1),
            padding: '2px 6px', borderRadius: 4,
          }}
        >
          {cycleMeta.icon} {cycleMeta.label.slice(0, 4)}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Drill-Down View
// ═══════════════════════════════════════════════════════════════════

function DrillDown({ sector, activeTF }) {
  if (!sector) return null;
  const cycleMeta = CYCLE_META[sector.cycle];

  return (
    <div>
      {/* Sector Summary */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
          padding: '14px 16px', background: alpha(C.sf, 0.5),
          borderRadius: 10, border: `1px solid ${C.bd}`,
        }}
      >
        <span style={{ fontSize: 28 }}>{sector.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>{sector.name}</div>
          <div style={{ fontSize: 11, color: C.t3, fontFamily: F }}>
            {sector.weight}% of S&P 500 · {cycleMeta.icon} {cycleMeta.label} phase
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: C.t3, fontFamily: F }}>{activeTF} Performance</div>
          <div
            style={{
              fontSize: 20, fontWeight: 700, fontFamily: M,
              color: sector.perf[activeTF] >= 0 ? C.g : C.r,
            }}
          >
            {sector.perf[activeTF] >= 0 ? '+' : ''}{sector.perf[activeTF].toFixed(2)}%
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: C.t3, fontFamily: F }}>Net Flow</div>
          <div
            style={{
              fontSize: 16, fontWeight: 700, fontFamily: M,
              color: sector.flow >= 0 ? C.g : C.r,
            }}
          >
            {sector.flow >= 0 ? '+' : ''}${sector.flow.toFixed(1)}B
          </div>
        </div>
      </div>

      {/* Top Movers */}
      <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, fontFamily: F, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Top Movers
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sector.topMovers.map((mover, i) => (
          <div
            key={mover.symbol}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', background: alpha(C.sf, 0.4),
              borderRadius: 8, border: `1px solid ${alpha(C.bd, 0.3)}`,
            }}
          >
            <span
              style={{
                fontSize: 10, fontWeight: 700, color: C.t3,
                fontFamily: M, width: 16, textAlign: 'center',
              }}
            >
              {i + 1}
            </span>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>{mover.symbol}</span>
            </div>
            <span style={{ fontSize: 12, color: C.t2, fontFamily: M }}>${mover.price.toFixed(2)}</span>
            <span
              style={{
                fontSize: 12, fontWeight: 700, fontFamily: M,
                color: mover.change >= 0 ? C.g : C.r,
                background: alpha(mover.change >= 0 ? C.g : C.r, 0.08),
                padding: '3px 8px', borderRadius: 5, minWidth: 60, textAlign: 'right',
              }}
            >
              {mover.change >= 0 ? '+' : ''}{mover.change.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { SectorRotationMap };
