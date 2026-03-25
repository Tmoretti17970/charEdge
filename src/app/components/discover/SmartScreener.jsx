// ═══════════════════════════════════════════════════════════════════
// charEdge — Smart Screener Component
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { C } from '../../../constants.js';
import { SCAN_PRESETS, fetchScreenerResults } from '../../../services/screenerService.js';
import { formatPrice } from '../../../shared/formatting';
import LabsBadge from '../ui/LabsBadge.jsx';
import st from './SmartScreener.module.css';
import { alpha } from '@/shared/colorUtils';

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

function SmartScreener() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePreset, setActivePreset] = useState(null);
  const [assetClass, setAssetClass] = useState('all');
  const [sortBy, setSortBy] = useState('change');
  const [sortDir, setSortDir] = useState('desc');
  const [collapsed, setCollapsed] = useState(false);

  const loadResults = useCallback(async () => {
    setLoading(true);
    const data = await fetchScreenerResults({ presetId: activePreset, assetClass, sortBy, sortDir });
    setResults(data);
    setLoading(false);
  }, [activePreset, assetClass, sortBy, sortDir]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const handlePresetClick = (presetId) => setActivePreset(activePreset === presetId ? null : presetId);
  const handleSort = (field) => {
    if (sortBy === field) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  return (
    <div className={st.card} style={{ background: C.bg2, border: `1px solid ${C.bd}` }}>
      <button onClick={() => setCollapsed(!collapsed)} className={`tf-btn ${st.headerBtn}`}>
        <div className={st.headerLeft}>
          <span className={st.headerIcon}>🔍</span>
          <h3 className={st.headerTitle}>Smart Screener</h3>
          <LabsBadge />
          <span className={st.badge} style={{ color: C.t3, background: alpha(C.t3, 0.1) }}>
            {results.length} results
          </span>
        </div>
        <span className={st.chevron} style={{ color: C.t3, transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}>
          ▾
        </span>
      </button>

      {!collapsed && (
        <div className={st.body}>
          {/* Scan Presets */}
          <div className={st.presetRow}>
            {SCAN_PRESETS.map((preset) => {
              const isActive = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset.id)}
                  className={`tf-btn ${st.presetBtn}`}
                  title={preset.description}
                  style={{
                    border: `1px solid ${isActive ? preset.color : C.bd}`,
                    background: isActive ? alpha(preset.color, 0.12) : 'transparent',
                    color: isActive ? preset.color : C.t2,
                  }}
                >
                  <span className={st.presetIcon}>{preset.icon}</span>
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Filters */}
          <div className={st.filterRow}>
            <div className={st.filterGroup}>
              {ASSET_CLASSES.map((ac) => {
                const isActive = assetClass === ac.id;
                return (
                  <button
                    key={ac.id}
                    onClick={() => setAssetClass(ac.id)}
                    className={`tf-btn ${st.filterBtn}`}
                    style={{
                      border: `1px solid ${isActive ? C.b : 'transparent'}`,
                      background: isActive ? alpha(C.b, 0.08) : 'transparent',
                      color: isActive ? C.b : C.t3,
                    }}
                  >
                    {ac.label}
                  </button>
                );
              })}
            </div>
            <div className={st.sortGroup}>
              <span className={st.sortLabel} style={{ color: C.t3 }}>
                Sort:
              </span>
              {SORT_OPTIONS.map((opt) => {
                const isActive = sortBy === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSort(opt.id)}
                    className={`tf-btn ${st.sortBtn}`}
                    style={{
                      background: isActive ? alpha(C.b, 0.1) : 'transparent',
                      color: isActive ? C.b : C.t3,
                      fontWeight: isActive ? 700 : 500,
                    }}
                  >
                    {opt.label}
                    {isActive && <span className={st.sortIcon}>{sortDir === 'desc' ? '↓' : '↑'}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className={st.loading} style={{ color: C.t3 }}>
              Scanning markets...
            </div>
          ) : results.length === 0 ? (
            <div className={st.emptyState} style={{ color: C.t3 }}>
              No results match this scan.{' '}
              <button
                onClick={() => {
                  setActivePreset(null);
                  setAssetClass('all');
                }}
                className={`tf-btn ${st.resetBtn}`}
                style={{ color: C.b }}
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className={st.tableWrap}>
              <div className={st.tableHeader} style={{ color: C.t3 }}>
                <span>Symbol</span>
                <span className={st.colRight}>Price</span>
                <span className={st.colRight}>Change</span>
                <span className={st.colRight}>RSI</span>
                <span className={st.colRight}>Vol Ratio</span>
                <span>Signal</span>
                <span className={st.colRight}>MAs</span>
              </div>
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

function ScreenerRow({ item }) {
  const isUp = item.change >= 0;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={st.row}
      style={{
        background: hovered ? alpha(C.b, 0.04) : 'transparent',
        border: `1px solid ${hovered ? alpha(C.b, 0.1) : 'transparent'}`,
      }}
    >
      <div>
        <div className={st.symNameRow}>
          <span className={st.symText}>{item.symbol}</span>
          <span className={st.classBadge} style={{ color: C.t3, background: alpha(C.t3, 0.1) }}>
            {item.assetClass}
          </span>
        </div>
        <div className={st.subText} style={{ color: C.t3 }}>
          {item.name}
        </div>
      </div>
      <div className={st.priceText}>{formatPrice(item.price)}</div>
      <div className={st.changeText} style={{ color: isUp ? C.g : C.r }}>
        {isUp ? '+' : ''}
        {item.change.toFixed(1)}%
      </div>
      <div className={st.colRight}>
        <span className={st.rsiText} style={{ color: item.rsi > 70 ? C.r : item.rsi < 30 ? C.g : C.t2 }}>
          {item.rsi}
        </span>
        <RSIBar value={item.rsi} />
      </div>
      <div className={st.colRight}>
        <span className={st.volText} style={{ color: parseFloat(item.volumeRatio) > 1.5 ? C.b : C.t2 }}>
          {item.volumeRatio}x
        </span>
      </div>
      <div>
        <span
          className={st.signalBadge}
          style={{ color: item.signal.color, background: alpha(item.signal.color, 0.12) }}
        >
          {item.signal.label}
        </span>
      </div>
      <div className={st.maCol}>
        <MABadge label="20" above={item.aboveMa20} />
        <MABadge label="50" above={item.aboveMa50} />
      </div>
    </div>
  );
}

function RSIBar({ value }) {
  const width = Math.min(value, 100);
  const color = value > 70 ? C.r : value > 55 ? C.g : value > 30 ? C.y : C.r;
  return (
    <div className={st.rsiTrack} style={{ background: alpha(C.t3, 0.1) }}>
      <div className={st.rsiFill} style={{ width: `${width}%`, background: color }} />
    </div>
  );
}

function MABadge({ label, above }) {
  return (
    <span className={st.maBadge} style={{ color: above ? C.g : C.r, background: alpha(above ? C.g : C.r, 0.1) }}>
      MA{label}
    </span>
  );
}

export { SmartScreener };
export default React.memo(SmartScreener);
