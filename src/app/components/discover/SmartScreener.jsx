// ═══════════════════════════════════════════════════════════════════
// charEdge — Smart Screener Component
//
// Filterable, sortable asset scanner with pre-built scan presets.
// Features:
//   - 6 pre-built scan presets (Breakout, Oversold, Volume, etc.)
//   - Asset class filter (All, Crypto, Stocks, Futures)
//   - Sortable columns (Change, Volume, RSI, Price)
//   - Signal badges per result
//   - Mini sparkline & volume ratio bars
//   - Click result → navigate to Charts
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { alpha } from '../../../utils/colorUtils.js';
import { SCAN_PRESETS, fetchScreenerResults } from '../../../services/screenerService.js';

// ─── Asset Class Tabs ───────────────────────────────────────────

const ASSET_CLASSES = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'stock', label: 'Stocks' },
  { id: 'futures', label: 'Futures' },
];

const SORT_OPTIONS = [
  { id: 'change', label: 'Change %' },
  { id: 'volume', label: 'Volume' },
  { id: 'rsi', label: 'RSI' },
  { id: 'price', label: 'Price' },
];

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════

export default function SmartScreener() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePreset, setActivePreset] = useState(null);
  const [assetClass, setAssetClass] = useState('all');
  const [sortBy, setSortBy] = useState('change');
  const [sortDir, setSortDir] = useState('desc');
  const [collapsed, setCollapsed] = useState(false);

  const loadResults = useCallback(async () => {
    setLoading(true);
    const data = await fetchScreenerResults({
      presetId: activePreset,
      assetClass,
      sortBy,
      sortDir,
    });
    setResults(data);
    setLoading(false);
  }, [activePreset, assetClass, sortBy, sortDir]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const handlePresetClick = (presetId) => {
    setActivePreset(activePreset === presetId ? null : presetId);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  return (
    <div
      style={{
        background: C.bg2,
        border: `1px solid ${C.bd}`,
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* ─── Header ──────────────────────────────────────────── */}
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
          <span style={{ fontSize: 18 }}>🔍</span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>
            Smart Screener
          </h3>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.t3,
              background: alpha(C.t3, 0.1),
              padding: '2px 7px',
              borderRadius: 4,
              fontFamily: M,
            }}
          >
            {results.length} results
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
          {/* ─── Scan Presets ──────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginBottom: 14,
              overflowX: 'auto',
              scrollbarWidth: 'none',
              paddingBottom: 2,
            }}
          >
            {SCAN_PRESETS.map((preset) => {
              const isActive = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset.id)}
                  className="tf-btn"
                  title={preset.description}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 12px',
                    borderRadius: 20,
                    border: `1px solid ${isActive ? preset.color : C.bd}`,
                    background: isActive ? alpha(preset.color, 0.12) : 'transparent',
                    color: isActive ? preset.color : C.t2,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: F,
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 13 }}>{preset.icon}</span>
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* ─── Filters Row ──────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            {/* Asset Class Tabs */}
            <div style={{ display: 'flex', gap: 4 }}>
              {ASSET_CLASSES.map((ac) => {
                const isActive = assetClass === ac.id;
                return (
                  <button
                    key={ac.id}
                    onClick={() => setAssetClass(ac.id)}
                    className="tf-btn"
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: `1px solid ${isActive ? C.b : 'transparent'}`,
                      background: isActive ? alpha(C.b, 0.08) : 'transparent',
                      color: isActive ? C.b : C.t3,
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: F,
                      transition: 'all 0.15s',
                    }}
                  >
                    {ac.label}
                  </button>
                );
              })}
            </div>

            {/* Sort Controls */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: C.t3, fontFamily: F, marginRight: 4 }}>Sort:</span>
              {SORT_OPTIONS.map((opt) => {
                const isActive = sortBy === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSort(opt.id)}
                    className="tf-btn"
                    style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      border: 'none',
                      background: isActive ? alpha(C.b, 0.1) : 'transparent',
                      color: isActive ? C.b : C.t3,
                      cursor: 'pointer',
                      fontSize: 10,
                      fontWeight: isActive ? 700 : 500,
                      fontFamily: F,
                      transition: 'all 0.15s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    {opt.label}
                    {isActive && (
                      <span style={{ fontSize: 8 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── Results Table ─────────────────────────────────── */}
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: C.t3, fontSize: 12 }}>
              Scanning markets...
            </div>
          ) : results.length === 0 ? (
            <div
              style={{
                padding: '32px 20px',
                textAlign: 'center',
                color: C.t3,
                fontSize: 13,
                fontFamily: F,
              }}
            >
              No results match this scan.{' '}
              <button
                onClick={() => { setActivePreset(null); setAssetClass('all'); }}
                className="tf-btn"
                style={{
                  background: 'none',
                  border: 'none',
                  color: C.b,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                  fontFamily: F,
                }}
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Table Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 90px 80px 80px 70px 80px 1fr',
                  gap: 8,
                  padding: '6px 12px',
                  fontSize: 9,
                  fontWeight: 700,
                  color: C.t3,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  fontFamily: F,
                }}
              >
                <span>Symbol</span>
                <span style={{ textAlign: 'right' }}>Price</span>
                <span style={{ textAlign: 'right' }}>Change</span>
                <span style={{ textAlign: 'right' }}>RSI</span>
                <span style={{ textAlign: 'right' }}>Vol Ratio</span>
                <span>Signal</span>
                <span style={{ textAlign: 'right' }}>MAs</span>
              </div>

              {/* Result Rows */}
              {results.map((item) => (
                <ScreenerRow key={item.symbol} item={item} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Screener Row
// ═══════════════════════════════════════════════════════════════════

function ScreenerRow({ item }) {
  const isUp = item.change >= 0;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 90px 80px 80px 70px 80px 1fr',
        gap: 8,
        padding: '10px 12px',
        borderRadius: 8,
        background: hovered ? alpha(C.b, 0.04) : 'transparent',
        border: `1px solid ${hovered ? alpha(C.b, 0.1) : 'transparent'}`,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        alignItems: 'center',
      }}
    >
      {/* Symbol + Name */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>
            {item.symbol}
          </span>
          <span
            style={{
              fontSize: 8,
              fontWeight: 600,
              color: C.t3,
              background: alpha(C.t3, 0.1),
              padding: '1px 4px',
              borderRadius: 3,
              textTransform: 'uppercase',
              fontFamily: F,
            }}
          >
            {item.assetClass}
          </span>
        </div>
        <div style={{ fontSize: 10, color: C.t3, fontFamily: F, marginTop: 1 }}>
          {item.name}
        </div>
      </div>

      {/* Price */}
      <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: M }}>
        {formatPrice(item.price)}
      </div>

      {/* Change */}
      <div
        style={{
          textAlign: 'right',
          fontSize: 12,
          fontWeight: 700,
          color: isUp ? C.g : C.r,
          fontFamily: M,
        }}
      >
        {isUp ? '+' : ''}{item.change.toFixed(1)}%
      </div>

      {/* RSI */}
      <div style={{ textAlign: 'right' }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: item.rsi > 70 ? C.r : item.rsi < 30 ? C.g : C.t2,
            fontFamily: M,
          }}
        >
          {item.rsi}
        </span>
        <RSIBar value={item.rsi} />
      </div>

      {/* Volume Ratio */}
      <div style={{ textAlign: 'right' }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: parseFloat(item.volumeRatio) > 1.5 ? C.b : C.t2,
            fontFamily: M,
          }}
        >
          {item.volumeRatio}x
        </span>
      </div>

      {/* Signal Badge */}
      <div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: item.signal.color,
            background: alpha(item.signal.color, 0.12),
            padding: '3px 7px',
            borderRadius: 4,
            fontFamily: F,
            whiteSpace: 'nowrap',
          }}
        >
          {item.signal.label}
        </span>
      </div>

      {/* MA Status */}
      <div style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
        <MABadge label="20" above={item.aboveMa20} />
        <MABadge label="50" above={item.aboveMa50} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════

function RSIBar({ value }) {
  const width = Math.min(value, 100);
  const color = value > 70 ? C.r : value > 55 ? C.g : value > 30 ? C.y : C.r;

  return (
    <div
      style={{
        width: '100%',
        height: 3,
        background: alpha(C.t3, 0.1),
        borderRadius: 2,
        marginTop: 3,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${width}%`,
          height: '100%',
          background: color,
          borderRadius: 2,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}

function MABadge({ label, above }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 600,
        color: above ? C.g : C.r,
        background: alpha(above ? C.g : C.r, 0.1),
        padding: '2px 4px',
        borderRadius: 3,
        fontFamily: M,
      }}
    >
      MA{label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════

function formatPrice(price) {
  if (price == null) return '—';
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (price >= 1) return price.toFixed(2);
  return price.toFixed(4);
}

export { SmartScreener };
