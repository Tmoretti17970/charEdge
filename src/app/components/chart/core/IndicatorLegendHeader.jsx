// ═══════════════════════════════════════════════════════════════════
// charEdge — Indicator Legend Header
// Persistent top-left overlay showing live indicator values,
// inline × remove, and click-to-edit. TradingView-style.
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useCallback, useState } from 'react';
import { formatPrice } from '../../../../charting_library/core/CoordinateSystem.js';
import { INDICATORS } from '../../../../charting_library/studies/indicators/registry.js';
import { C, F } from '@/constants.js';
import { useChartToolsStore } from '../../../../state/chart/useChartToolsStore';
import Icon from '../../design/Icon.jsx';
import s from './IndicatorLegendHeader.module.css';

/**
 * Format large numbers compactly: 1234567 → 1.23M
 */
function compactNum(n) {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (abs >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  return formatPrice(n);
}

export default function IndicatorLegendHeader({ data, hoverIdx, _onEditIndicator }) {
  const indicators = useChartToolsStore((s) => s.indicators);
  const removeIndicator = useChartToolsStore((s) => s.removeIndicator);
  const toggleIndicatorVisibility = useChartToolsStore((s) => s.toggleIndicatorVisibility);
  const updateIndicator = useChartToolsStore((s) => s.updateIndicator);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [editIdx, setEditIdx] = useState(null); // Sprint 11: inline quick-edit

  // Get current bar index: use hover or last bar
  const barIdx = useMemo(() => {
    if (hoverIdx != null && hoverIdx >= 0) return hoverIdx;
    if (data?.length > 0) return data.length - 1;
    return -1;
  }, [hoverIdx, data?.length]);

  // Build indicator display data with live computed values
  const legendItems = useMemo(() => {
    if (!indicators?.length) return [];

    return indicators
      .map((ind, idx) => {
        const regId = ind.indicatorId || ind.type;
        const def = INDICATORS[regId];
        if (!def) return null;
        // Skip pane-type indicators — they have their own sub-pane with a header
        if (def.mode === 'pane') return null;

        // Build params string, e.g. "20" or "12, 26, 9"
        const paramVals = Object.entries(ind.params || {})
          .filter(([, v]) => v != null && v !== '')
          .map(([, v]) => v);
        const paramStr = paramVals.length > 0 ? `(${paramVals.join(', ')})` : '';

        // Compute live indicator values from raw bar data
        const liveValues = [];
        if (data?.length > 0 && def.compute && barIdx >= 0) {
          try {
            const computed = def.compute(data, ind.params || {});
            if (computed && def.outputs) {
              for (const out of def.outputs) {
                const vals = computed[out.key];
                const val = vals && barIdx < vals.length ? vals[barIdx] : null;
                liveValues.push({
                  key: out.key,
                  label: out.label,
                  color: ind.color || out.color || '#AAA',
                  value: val != null && !isNaN(val) ? val : null,
                });
              }
            }
            // eslint-disable-next-line unused-imports/no-unused-vars
          } catch (_) {
            // Computation failed — show without values
          }
        }

        return {
          idx,
          indId: ind.id,
          id: regId,
          shortName: def.shortName || def.name || regId.toUpperCase(),
          paramStr,
          color: ind.color || def.outputs?.[0]?.color || '#AAA',
          visible: ind.visible !== false,
          liveValues,
          params: ind.params || {},
          opacity: ind.opacity ?? 1,
          lineStyle: ind.lineStyle || 'solid',
        };
      })
      .filter(Boolean);
  }, [indicators, data, barIdx]);

  const handleRemove = useCallback(
    (e, indId) => {
      e.stopPropagation();
      removeIndicator(indId);
      if (editIdx === indId) setEditIdx(null);
    },
    [removeIndicator, editIdx],
  );

  const handleToggleVis = useCallback(
    (e, indId) => {
      e.stopPropagation();
      toggleIndicatorVisibility(indId);
    },
    [toggleIndicatorVisibility],
  );

  const handleEdit = useCallback((indId) => {
    // Sprint 11: Toggle inline quick-edit popover
    setEditIdx((prev) => (prev === indId ? null : indId));
  }, []);

  if (!legendItems.length) return null;

  return (
    <div className={`tf-fade-in ${s.root}`}>
      {legendItems.map((item) => (
        <div key={`${item.id}-${item.idx}`} className={s.itemWrap}>
          <div
            onMouseEnter={() => setHoveredIdx(item.indId)}
            onMouseLeave={() => setHoveredIdx(null)}
            onClick={() => handleEdit(item.indId)}
            className={s.itemRow}
            data-hidden={!item.visible}
            style={{
              '--item-bg': editIdx === item.indId ? `${C.b}18` : hoveredIdx === item.indId ? `${C.sf2}E8` : `${C.sf2}B0`,
              '--item-border': editIdx === item.indId ? C.b : hoveredIdx === item.indId ? C.bd2 : C.bd,
            }}
          >
            {/* Color dot */}
            <div className={s.dot} style={{ '--dot-color': item.color }} />

            {/* Label */}
            <span className={s.label}>
              {item.shortName}
              {item.paramStr}
            </span>

            {/* Live indicator values */}
            {item.liveValues.length > 0 && item.liveValues.some((v) => v.value != null) && (
              <span className={s.values} style={{ '--val-color': item.liveValues[0]?.color || C.t3 }}>
                {item.liveValues
                  .filter((v) => v.value != null)
                  .map((v) => compactNum(v.value))
                  .join(' · ')}
              </span>
            )}

            {/* Eye toggle — always visible */}
            <button onClick={(e) => handleToggleVis(e, item.indId)} title={item.visible ? 'Hide' : 'Show'} className={s.eyeBtn}>
              {item.visible ? <Icon name="eye" size={9} /> : <Icon name="eye-off" size={9} />}
            </button>

            {/* × Remove button — always visible */}
            <button onClick={(e) => handleRemove(e, item.indId)} title="Remove indicator" className={`tf-hover-danger ${s.removeBtn}`}>
              ×
            </button>
          </div>

          {/* Sprint 11: Inline Quick-Edit Popover */}
          {editIdx === item.indId && (
            <IndicatorQuickEdit
              idx={item.indId}
              indicator={indicators.find((ind) => ind.id === item.indId)}
              onClose={() => setEditIdx(null)}
              updateIndicator={updateIndicator}
              removeIndicator={removeIndicator}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Sprint 11: Inline Quick-Edit Sub-component ─────────────────

function IndicatorQuickEdit({ idx, indicator, onClose, updateIndicator, removeIndicator }) {
  // Defined inside the component to avoid TDZ — C may not be
  // initialized at module-evaluation time in the bundled chunk.
  const COLOR_SWATCHES = [
    '#22d3ee',
    C.g,
    '#f59e0b',
    '#ef4444',
    '#a855f7',
    '#f472b6',
    '#6366f1',
    '#e8642c',
    '#a3e635',
    '#ffffff',
  ];

  const LINE_STYLES = [
    { id: 'solid', label: '━', title: 'Solid' },
    { id: 'dashed', label: '╌', title: 'Dashed' },
    { id: 'dotted', label: '···', title: 'Dotted' },
  ];
  if (!indicator) return null;

  const regId = indicator.indicatorId || indicator.type;
  const def = INDICATORS[regId];
  const params = indicator.params || {};
  const color = indicator.color || def?.outputs?.[0]?.color || '#AAA';
  const opacity = indicator.opacity ?? 1;
  const lineStyle = indicator.lineStyle || 'solid';

  const handleParamChange = (key, value) => {
    updateIndicator(idx, { params: { ...params, [key]: Number(value) } });
  };

  const handleColorChange = (newColor) => {
    updateIndicator(idx, { color: newColor });
  };

  const handleOpacityChange = (val) => {
    updateIndicator(idx, { opacity: Number(val) });
  };

  const handleLineStyleChange = (style) => {
    updateIndicator(idx, { lineStyle: style });
  };

  // Determine parameter ranges
  const paramDefs = Object.entries(params).filter(([k]) => typeof params[k] === 'number');

  return (
    <div onClick={(e) => e.stopPropagation()} className={s.popover}>
      {/* Header */}
      <div className={s.popoverHeader}>
        <span className={s.popoverTitle}>{def?.shortName || regId}</span>
        <div className={s.popoverActions}>
          <button onClick={() => { onClose(); removeIndicator(idx); }} title="Delete indicator" className={s.deleteBtn}>🗑</button>
          <button onClick={onClose} className={s.closePopoverBtn}>×</button>
        </div>
      </div>

      {/* Parameter sliders */}
      {paramDefs.map(([key, value]) => (
        <div key={key} className={s.paramRow}>
          <div className={s.paramHeader}>
            <span className={s.paramLabel}>{key}</span>
            <span className={s.paramValue}>{value}</span>
          </div>
          <input
            type="range"
            min={1}
            max={key === 'period' || key === 'fast' || key === 'slow' || key === 'signal' ? 200 : 100}
            value={value}
            onChange={(e) => handleParamChange(key, e.target.value)}
            className={s.paramSlider}
          />
        </div>
      ))}

      {/* Color swatches */}
      <div className={s.colorSection}>
        <span className={s.sectionLabel}>Color</span>
        <div className={s.swatchGrid}>
          {COLOR_SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => handleColorChange(c)}
              className={`tf-hover-pop ${s.swatch}`}
              style={{ background: c, border: color === c ? '2px solid #fff' : `1px solid ${C.bd}` }}
            />
          ))}
        </div>
      </div>

      {/* Line style */}
      <div className={s.lineStyleSection}>
        <span className={s.sectionLabel}>Line Style</span>
        <div className={s.lineStyleGrid}>
          {LINE_STYLES.map((ls) => (
            <button
              key={ls.id}
              onClick={() => handleLineStyleChange(ls.id)}
              title={ls.title}
              className={s.lineStyleBtn}
              style={{
                border: `1px solid ${lineStyle === ls.id ? C.b : C.bd}`,
                background: lineStyle === ls.id ? `${C.b}18` : 'transparent',
                color: lineStyle === ls.id ? C.b : C.t3,
              }}
            >
              {ls.label}
            </button>
          ))}
        </div>
      </div>

      {/* Opacity slider */}
      <div>
        <div className={s.opacityHeader}>
          <span className={s.opacityLabel}>Opacity</span>
          <span className={s.opacityValue}>{Math.round(opacity * 100)}%</span>
        </div>
        <input
          type="range"
          min={10}
          max={100}
          value={Math.round(opacity * 100)}
          onChange={(e) => handleOpacityChange(e.target.value / 100)}
          className={s.paramSlider}
        />
      </div>
    </div>
  );
}
