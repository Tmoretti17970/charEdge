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

import {
  Monitor,
  Heart,
  Building,
  Zap,
  ShoppingBag,
  ShoppingCart,
  Factory,
  Layers,
  Building2,
  Lightbulb,
  Radio,
  TrendingUp,
  ArrowUp,
  TrendingDown,
  RefreshCw,
  MapPin,
} from 'lucide-react';
import React from 'react';
import { useState, useMemo } from 'react';
import { C } from '../../../constants.js';
import s from './SectorRotationMap.module.css';
import { alpha } from '@/shared/colorUtils';

const SECTOR_ICONS = {
  tech: Monitor,
  health: Heart,
  finance: Building,
  energy: Zap,
  consumer_d: ShoppingBag,
  consumer_s: ShoppingCart,
  industrial: Factory,
  materials: Layers,
  realestate: Building2,
  utilities: Lightbulb,
  comms: Radio,
};

const CYCLE_ICONS = {
  expansion: TrendingUp,
  peak: ArrowUp,
  contraction: TrendingDown,
  trough: RefreshCw,
};

// ─── Mock Sector Data ───────────────────────────────────────────

const SECTORS = [
  {
    id: 'tech',
    name: 'Technology',
    weight: 28.5,
    perf: { '1D': 1.42, '1W': 3.18, '1M': 5.64, '3M': 12.3, YTD: 8.9 },
    flow: 2.4, // billions, positive = inflow
    cycle: 'expansion',
    topMovers: [
      { symbol: 'NVDA', change: 4.8, price: 892.5 },
      { symbol: 'AAPL', change: 1.2, price: 198.3 },
      { symbol: 'MSFT', change: 0.9, price: 415.8 },
      { symbol: 'AVGO', change: 3.1, price: 1285.0 },
      { symbol: 'AMD', change: -0.6, price: 178.4 },
    ],
  },
  {
    id: 'health',
    name: 'Healthcare',
    weight: 13.2,
    perf: { '1D': -0.35, '1W': 0.82, '1M': -1.24, '3M': 2.1, YTD: 1.5 },
    flow: -0.8,
    cycle: 'contraction',
    topMovers: [
      { symbol: 'UNH', change: -1.2, price: 524.6 },
      { symbol: 'JNJ', change: 0.4, price: 162.1 },
      { symbol: 'LLY', change: 2.8, price: 785.4 },
      { symbol: 'PFE', change: -0.8, price: 28.9 },
      { symbol: 'ABBV', change: 0.3, price: 178.5 },
    ],
  },
  {
    id: 'finance',
    name: 'Financials',
    weight: 12.8,
    perf: { '1D': 0.68, '1W': 1.45, '1M': 3.82, '3M': 8.4, YTD: 6.2 },
    flow: 1.2,
    cycle: 'expansion',
    topMovers: [
      { symbol: 'JPM', change: 1.5, price: 198.2 },
      { symbol: 'BAC', change: 0.8, price: 38.4 },
      { symbol: 'GS', change: 2.1, price: 412.8 },
      { symbol: 'V', change: 0.3, price: 282.6 },
      { symbol: 'MA', change: 0.6, price: 468.9 },
    ],
  },
  {
    id: 'energy',
    name: 'Energy',
    weight: 4.2,
    perf: { '1D': -1.85, '1W': -3.2, '1M': -5.4, '3M': -8.6, YTD: -12.4 },
    flow: -1.6,
    cycle: 'contraction',
    topMovers: [
      { symbol: 'XOM', change: -2.1, price: 104.8 },
      { symbol: 'CVX', change: -1.8, price: 152.3 },
      { symbol: 'SLB', change: -2.5, price: 48.6 },
      { symbol: 'COP', change: -1.4, price: 112.4 },
      { symbol: 'EOG', change: -0.9, price: 118.2 },
    ],
  },
  {
    id: 'consumer_d',
    name: 'Cons. Discretionary',
    weight: 10.5,
    perf: { '1D': 0.92, '1W': 2.1, '1M': 4.35, '3M': 6.8, YTD: 5.1 },
    flow: 0.6,
    cycle: 'peak',
    topMovers: [
      { symbol: 'AMZN', change: 1.8, price: 185.2 },
      { symbol: 'TSLA', change: 3.4, price: 248.6 },
      { symbol: 'HD', change: 0.2, price: 378.9 },
      { symbol: 'NKE', change: -0.5, price: 98.4 },
      { symbol: 'MCD', change: 0.6, price: 294.1 },
    ],
  },
  {
    id: 'consumer_s',
    name: 'Cons. Staples',
    weight: 6.8,
    perf: { '1D': 0.12, '1W': -0.45, '1M': -0.82, '3M': 1.2, YTD: -0.4 },
    flow: -0.2,
    cycle: 'trough',
    topMovers: [
      { symbol: 'PG', change: 0.3, price: 168.4 },
      { symbol: 'KO', change: 0.1, price: 62.8 },
      { symbol: 'PEP', change: -0.2, price: 172.6 },
      { symbol: 'COST', change: 0.8, price: 728.3 },
      { symbol: 'WMT', change: 0.4, price: 172.8 },
    ],
  },
  {
    id: 'industrial',
    name: 'Industrials',
    weight: 8.5,
    perf: { '1D': 0.55, '1W': 1.82, '1M': 2.9, '3M': 5.4, YTD: 4.8 },
    flow: 0.4,
    cycle: 'expansion',
    topMovers: [
      { symbol: 'CAT', change: 1.2, price: 342.8 },
      { symbol: 'GE', change: 0.8, price: 168.4 },
      { symbol: 'HON', change: 0.3, price: 212.5 },
      { symbol: 'UNP', change: 0.5, price: 248.6 },
      { symbol: 'RTX', change: 0.9, price: 98.4 },
    ],
  },
  {
    id: 'materials',
    name: 'Materials',
    weight: 2.5,
    perf: { '1D': -0.28, '1W': 0.65, '1M': 1.42, '3M': -2.1, YTD: -1.8 },
    flow: -0.3,
    cycle: 'trough',
    topMovers: [
      { symbol: 'LIN', change: 0.4, price: 442.3 },
      { symbol: 'APD', change: -0.6, price: 268.4 },
      { symbol: 'SHW', change: 0.2, price: 342.8 },
      { symbol: 'FCX', change: -1.8, price: 42.6 },
      { symbol: 'NEM', change: 1.2, price: 38.9 },
    ],
  },
  {
    id: 'realestate',
    name: 'Real Estate',
    weight: 2.4,
    perf: { '1D': -0.62, '1W': -1.24, '1M': -2.85, '3M': -4.2, YTD: -5.6 },
    flow: -0.5,
    cycle: 'contraction',
    topMovers: [
      { symbol: 'AMT', change: -0.8, price: 198.4 },
      { symbol: 'PLD', change: -1.0, price: 128.6 },
      { symbol: 'EQIX', change: 0.2, price: 842.3 },
      { symbol: 'SPG', change: -0.5, price: 148.9 },
      { symbol: 'O', change: -0.3, price: 54.2 },
    ],
  },
  {
    id: 'utilities',
    name: 'Utilities',
    weight: 2.6,
    perf: { '1D': 0.18, '1W': -0.32, '1M': -1.1, '3M': 0.8, YTD: -2.1 },
    flow: 0.1,
    cycle: 'trough',
    topMovers: [
      { symbol: 'NEE', change: 0.4, price: 72.8 },
      { symbol: 'DUK', change: 0.1, price: 98.4 },
      { symbol: 'SO', change: -0.2, price: 74.6 },
      { symbol: 'D', change: 0.3, price: 48.9 },
      { symbol: 'AEP', change: -0.1, price: 88.2 },
    ],
  },
  {
    id: 'comms',
    name: 'Communication',
    weight: 8.0,
    perf: { '1D': 1.15, '1W': 2.48, '1M': 6.2, '3M': 14.5, YTD: 10.2 },
    flow: 1.8,
    cycle: 'expansion',
    topMovers: [
      { symbol: 'META', change: 2.4, price: 498.6 },
      { symbol: 'GOOGL', change: 1.6, price: 148.2 },
      { symbol: 'NFLX', change: 0.8, price: 628.4 },
      { symbol: 'DIS', change: -0.4, price: 112.3 },
      { symbol: 'T', change: 0.2, price: 18.9 },
    ],
  },
];

const TIMEFRAMES = ['1D', '1W', '1M', '3M', 'YTD'];

const CYCLE_META = {
  expansion: { color: C.g, label: 'Expansion' },
  peak: { color: '#f0b64e', label: 'Peak' },
  contraction: { color: C.r, label: 'Contraction' },
  trough: { color: '#c084fc', label: 'Trough' },
};

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════

function SectorRotationMap() {
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
    <div className={s.panelWrap}>
      {/* Header */}
      <button onClick={() => setCollapsed(!collapsed)} className={`tf-btn ${s.s0}`}>
        <div className={s.s1}>
          <span className={s.headerIcon}>
            <MapPin size={18} />
          </span>
          <h3 className={s.headerTitle}>Sector Rotation Map</h3>
          <span className={s.sectorBadge} style={{ color: C.g, background: alpha(C.g, 0.1) }}>
            {SECTORS.length} sectors
          </span>
        </div>
        <span className={s.chevron} style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
          ▾
        </span>
      </button>

      {!collapsed && (
        <div className={s.contentPad}>
          {/* Controls Row */}
          <div className={s.s2}>
            {/* Timeframe Selector */}
            <div className={s.s3}>
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setActiveTF(tf)}
                  className={`tf-btn ${s.tfBtn}`}
                  style={{
                    border: `1px solid ${activeTF === tf ? C.b : 'transparent'}`,
                    background: activeTF === tf ? alpha(C.b, 0.08) : 'transparent',
                    color: activeTF === tf ? C.b : C.t3,
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className={s.s4}>
              {[
                { id: 'perf', label: 'Performance' },
                { id: 'flow', label: 'Money Flow' },
                { id: 'weight', label: 'Weight' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSortBy(s.id)}
                  className={`tf-btn ${s.sortBtn}`}
                  style={{
                    border: `1px solid ${sortBy === s.id ? C.p : 'transparent'}`,
                    background: sortBy === s.id ? alpha(C.p, 0.08) : 'transparent',
                    color: sortBy === s.id ? C.p : C.t3,
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Drill-down back button */}
          {drillSector && (
            <button onClick={() => setDrillSector(null)} className={`tf-btn ${s.backBtn}`}>
              ← All Sectors
            </button>
          )}

          {/* Sector Grid or Drill-down */}
          {drillSector ? (
            <DrillDown sector={SECTORS.find((s) => s.id === drillSector)} activeTF={activeTF} />
          ) : (
            <div className={s.s5}>
              {/* Table Header */}
              <div className={s.tableHeader}>
                <span>Sector</span>
                {TIMEFRAMES.map((tf) => (
                  <span key={tf} className={s.textRight} style={{ color: activeTF === tf ? C.b : undefined }}>
                    {tf}
                  </span>
                ))}
                <span className={s.textRight}>Flow</span>
                <span className={s.textRight}>Cycle</span>
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
          <div className={s.s6}>
            {Object.entries(CYCLE_META).map(([key, meta]) => (
              <div key={key} className={s.s7}>
                <div className={s.legendDot} style={{ background: meta.color }} />
                <span className={s.legendLabel}>{meta.label}</span>
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
      className={`tf-btn ${s.sectorRow}`}
      style={{
        background: alpha(C.sf, 0.5),
        border: `1px solid ${alpha(C.bd, 0.3)}`,
      }}
    >
      {/* Sector Name */}
      <div className={s.s8}>
        <span className={s.sectorNameIcon}>{React.createElement(SECTOR_ICONS[sector.id], { size: 14 })}</span>
        <div>
          <div className={s.sectorName}>{sector.name}</div>
          <div className={s.sectorWeight}>{sector.weight}% of S&P</div>
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
              fontFamily: 'var(--tf-mono)',
              background: isActive ? alpha(val >= 0 ? C.g : C.r, 0.06) : 'transparent',
              padding: isActive ? '2px 6px' : 0,
              borderRadius: 4,
            }}
          >
            {val >= 0 ? '+' : ''}
            {val.toFixed(2)}%
          </div>
        );
      })}

      {/* Money Flow */}
      <div className={s.s9}>
        <span className={s.flowArrow} style={{ color: sector.flow >= 0 ? C.g : C.r }}>
          {sector.flow >= 0 ? '▲' : '▼'}
        </span>
        <span className={s.flowValue} style={{ color: sector.flow >= 0 ? C.g : C.r }}>
          ${Math.abs(sector.flow).toFixed(1)}B
        </span>
      </div>

      {/* Cycle Badge */}
      <div className={s.textRight}>
        <span className={s.cycleBadge} style={{ color: cycleMeta.color, background: alpha(cycleMeta.color, 0.1) }}>
          {React.createElement(CYCLE_ICONS[sector.cycle], { size: 12 })} {cycleMeta.label.slice(0, 4)}
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
      <div className={s.drillSummary} style={{ background: alpha(C.sf, 0.5) }}>
        <span className={s.drillIcon}>{React.createElement(SECTOR_ICONS[sector.id], { size: 14 })}</span>
        <div className={s.drillFlex}>
          <div className={s.drillTitle}>{sector.name}</div>
          <div className={s.drillSubtitle}>
            {sector.weight}% of S&P 500 ·{' '}
            {React.createElement(CYCLE_ICONS[sector.cycle], {
              size: 12,
              style: { display: 'inline-block', verticalAlign: 'middle' },
            })}{' '}
            {cycleMeta.label} phase
          </div>
        </div>
        <div className={s.drillAlignRight}>
          <div className={s.tinLabel}>{activeTF} Performance</div>
          <div className={s.drillPerfValue} style={{ color: sector.perf[activeTF] >= 0 ? C.g : C.r }}>
            {sector.perf[activeTF] >= 0 ? '+' : ''}
            {sector.perf[activeTF].toFixed(2)}%
          </div>
        </div>
        <div className={s.drillAlignRight}>
          <div className={s.tinLabel}>Net Flow</div>
          <div className={s.drillFlowValue} style={{ color: sector.flow >= 0 ? C.g : C.r }}>
            {sector.flow >= 0 ? '+' : ''}${sector.flow.toFixed(1)}B
          </div>
        </div>
      </div>

      {/* Top Movers */}
      <div className={s.topLabel}>Top Movers</div>
      <div className={s.s10}>
        {sector.topMovers.map((mover, i) => (
          <div
            key={mover.symbol}
            className={s.moverRow}
            style={{
              background: alpha(C.sf, 0.4),
              border: `1px solid ${alpha(C.bd, 0.3)}`,
            }}
          >
            <span className={s.moverRank}>{i + 1}</span>
            <div className={s.moverFlex}>
              <span className={s.moverSymbol}>{mover.symbol}</span>
            </div>
            <span className={s.moverPrice}>${mover.price.toFixed(2)}</span>
            <span
              className={s.moverChange}
              style={{
                color: mover.change >= 0 ? C.g : C.r,
                background: alpha(mover.change >= 0 ? C.g : C.r, 0.08),
              }}
            >
              {mover.change >= 0 ? '+' : ''}
              {mover.change.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { SectorRotationMap };

export default React.memo(SectorRotationMap);
