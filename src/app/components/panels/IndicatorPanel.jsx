// ═══════════════════════════════════════════════════════════════════
// charEdge v12 — Indicator Panel (Progressive Disclosure)
//
// Accordion-based indicator browser with:
//   - Sticky glassmorphism header (search + AI toggle)
//   - P2 3.3: 7 consolidated categories (was 9)
//   - P2 3.2: Single indicator registry (INDICATORS from registry.js)
//     Oscillators & Momentum, Volatility & Volume
//   - Apple Settings–style active indicator list
//   - Lucide icons + framer-motion animations
// ═══════════════════════════════════════════════════════════════════

import { Search, X, ChevronDown, Layers, LayoutPanelTop, Trash2, Eye, EyeOff } from 'lucide-react';
import React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { INDICATORS } from '../../../charting_library/studies/indicators/registry.js';
import { C } from '../../../constants.js';
import { useChartToolsStore } from '../../../state/chart/useChartToolsStore';
import { Tooltip } from '../ui/AppleHIG.jsx';
import st from './IndicatorPanel.module.css';
import { alpha } from '@/shared/colorUtils';

// ─── Category Definitions (P2 3.3: consolidated 9→6) ────────────
const CATEGORIES = [
  {
    id: 'moving-averages',
    label: 'Moving Averages',
    ids: ['sma', 'ema', 'wma', 'dema', 'tema', 'hma', 'vwma'],
  },
  {
    id: 'trend-channels',
    label: 'Trend & Channels',
    ids: [
      'bb',
      'vwap',
      'vrvp',
      'ichimoku',
      'keltner',
      'donchian',
      'linreg',
      'supertrend',
      'psar',
      'sessionVwap',
      'anchoredVwap',
      'liquidationLevels',
    ],
  },
  {
    id: 'oscillators-momentum',
    label: 'Oscillators & Momentum',
    ids: [
      'rsi',
      'macd',
      'stochastic',
      'cci',
      'williamsR',
      'roc',
      'aroon',
      'momentum',
      'ppo',
      'dpo',
      'trix',
      'kst',
      'coppock',
      'squeeze',
      'awesomeOsc',
      'acceleratorOsc',
      'chandeMO',
      'chaikin',
      'tsi',
      'vortex',
      'ultimateOsc',
      'klinger',
      'fearGreed',
      'vwRsi',
      'connorsRsi',
      'schaffTrendCycle',
      'ehlersFisher',
      'rvi',
      'stochRsi',
      'elderRay',
      'adxr',
    ],
  },
  {
    id: 'volatility-volume',
    label: 'Volatility & Volume',
    ids: ['atr', 'adx', 'mfi', 'obv', 'volumeDelta', 'cmf', 'adLine', 'stdDev', 'historicalVol', 'chaikinVol'],
  },
  {
    id: 'adaptive',
    label: 'Adaptive & Smart',
    ids: [
      'kama',
      'vidya',
      'frama',
      'adaptiveRsi',
      'dynamicATR',
      'regimeSwitcher',
      'sigmaBands',
      'mama',
      'mcginleyDynamic',
    ],
  },
  {
    id: 'signals',
    label: 'Signals & Confluence',
    ids: [
      'rvolFilter',
      'pivotPoints',
      'autoFib',
      'heikinAshi',
      'marketProfile',
      'fvgDetector',
      'wickRejection',
      'confluenceScore',
      'signalQuality',
    ],
  },
  {
    id: 'exotic',
    label: 'Exotic & Research',
    ids: ['hurstExponent', 'renkoBrickCount'],
  },
];

function IndicatorPanel({ isOpen, _onClose }) {
  const indicators = useChartToolsStore((s) => s.indicators);
  const addIndicator = useChartToolsStore((s) => s.addIndicator);
  const removeIndicator = useChartToolsStore((s) => s.removeIndicator);
  const updateIndicator = useChartToolsStore((s) => s.updateIndicator);
  const toggleVisibility = useChartToolsStore((s) => s.toggleIndicatorVisibility);

  const [searchTerm, setSearchTerm] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [openSections, setOpenSections] = useState({});

  const toggleSection = useCallback((id) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const matchesSearch = useCallback(
    (def) => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        def.name.toLowerCase().includes(q) ||
        def.shortName.toLowerCase().includes(q) ||
        def.id.toLowerCase().includes(q)
      );
    },
    [searchTerm],
  );

  const filteredCategories = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const defs = cat.ids.map((id) => INDICATORS[id]).filter((def) => def && matchesSearch(def));
      return { ...cat, defs };
    }).filter((cat) => cat.defs.length > 0);
  }, [matchesSearch]);

  const effectiveOpenSections = useMemo(() => {
    if (!searchTerm) return openSections;
    const expanded = {};
    for (const cat of filteredCategories) {
      expanded[cat.id] = true;
    }
    return expanded;
  }, [searchTerm, openSections, filteredCategories]);

  const totalResults = filteredCategories.reduce((sum, c) => sum + c.defs.length, 0);

  const handleAdd = useCallback(
    (def) => {
      const params = {};
      for (const [key, config] of Object.entries(def.params)) {
        params[key] = config.default;
      }
      addIndicator({
        indicatorId: def.id,
        params,
        color: def.outputs[0]?.color,
        visible: true,
      });
    },
    [addIndicator],
  );

  const handleParamChange = useCallback(
    (id, paramKey, value) => {
      const ind = indicators.find((i) => i.id === id);
      if (!ind) return;
      updateIndicator(id, {
        params: { ...ind.params, [paramKey]: Number(value) },
      });
    },
    [indicators, updateIndicator],
  );

  if (!isOpen) return null;

  return (
    <div className={st.root}>
      {/* ── Search Header ─────────────────────────────────────── */}
      <div className={st.searchHeader}>
        <div className={st.searchBar}>
          <Search size={12} color={C.t3} strokeWidth={2} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search indicators..."
            className={st.searchInput}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className={st.searchClear}>
              <X size={9} color={C.t2} strokeWidth={3} />
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable Content ────────────────────────────────── */}
      <div className={st.scrollArea}>
        {/* ── Active Indicators ─────────────────────────────── */}
        {indicators.length > 0 && (
          <div className={st.activeSection}>
            <div className={st.activeSectionLabel}>Active · {indicators.length}</div>
            <div className={st.activeSectionList}>
              {indicators.map((ind) => (
                <ActiveIndicatorRow
                  key={ind.id}
                  ind={ind}
                  idx={ind.id}
                  isEditing={editingIdx === ind.id}
                  onToggleEdit={() => setEditingIdx(editingIdx === ind.id ? null : ind.id)}
                  onToggleVisibility={() => toggleVisibility(ind.id)}
                  onRemove={() => {
                    removeIndicator(ind.id);
                    if (editingIdx === ind.id) setEditingIdx(null);
                  }}
                  onParamChange={(key, val) => handleParamChange(ind.id, key, val)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Accordion Sections ────────────────────────────── */}
        {filteredCategories.map((cat) => (
          <AccordionSection
            key={cat.id}
            category={cat}
            isOpen={effectiveOpenSections[cat.id] ?? false}
            onToggle={() => toggleSection(cat.id)}
            onAdd={handleAdd}
          />
        ))}

        {/* No results */}
        {totalResults === 0 && searchTerm && (
          <div className={st.noResults}>
            <Search size={20} color={C.t3} strokeWidth={1.5} className={st.noResultsIcon} />
            <div>
              No indicators match "<strong className={st.noResultsHighlight}>{searchTerm}</strong>"
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Active Indicator Row (Apple Settings Style) ─────────────────

function ActiveIndicatorRow({ ind, idx: _idx, isEditing, onToggleEdit, onToggleVisibility, onRemove, onParamChange }) {
  const [hovered, setHovered] = useState(false);
  const id = ind.indicatorId || ind.type;
  const def = INDICATORS[id];
  const paramStr = Object.values(ind.params || {}).join(', ');
  const dotColor = ind.color || def?.outputs[0]?.color || C.b;

  return (
    <div
      className={st.activeRow}
      style={{ background: hovered ? alpha(C.sf2, 0.6) : alpha(C.sf, 0.4) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={st.activeRowInner}>
        {/* Color dot */}
        <div className={st.colorDot} style={{ '--dot-color': dotColor }} />

        {/* Name + params */}
        <button onClick={onToggleEdit} className={st.nameBtn}>
          {def?.shortName || id}
          {paramStr && <span className={st.nameSuffix}> ({paramStr})</span>}
        </button>

        {/* Mode badge icon */}
        <Tooltip text={def?.mode === 'overlay' ? 'Overlay indicator' : 'Pane indicator'}>
          <div className={st.modeIcon}>
            {def?.mode === 'overlay' ? (
              <Layers size={12} strokeWidth={2} />
            ) : (
              <LayoutPanelTop size={12} strokeWidth={2} />
            )}
          </div>
        </Tooltip>

        {/* Visibility toggle */}
        <Tooltip text={ind.visible !== false ? 'Hide indicator' : 'Show indicator'}>
          <button
            onClick={onToggleVisibility}
            className={`${st.visBtn} ${ind.visible !== false ? st.visBtnOn : st.visBtnOff}`}
          >
            {ind.visible !== false ? <Eye size={13} strokeWidth={2} /> : <EyeOff size={13} strokeWidth={2} />}
          </button>
        </Tooltip>

        {/* Delete — only visible on hover */}
        <Tooltip text="Remove indicator">
          <button
            onClick={onRemove}
            className={`${st.deleteBtn} ${hovered ? st.deleteBtnVisible : st.deleteBtnHidden}`}
          >
            <Trash2 size={12} strokeWidth={2} />
          </button>
        </Tooltip>
      </div>

      {/* Parameter editor */}
      <div
        className={`${st.paramToggle} ${isEditing && def && Object.keys(def.params).length > 0 ? st.paramToggleOpen : st.paramToggleClosed}`}
      >
        <div className={st.paramInner}>
          {def && Object.keys(def.params).length > 0 && (
            <div className={st.paramGrid}>
              {Object.entries(def.params).map(([key, config]) => (
                <div key={key} className={st.paramCol}>
                  <label className={st.paramLabel}>{config.label || key}</label>
                  <input
                    type="number"
                    value={ind.params?.[key] ?? config.default}
                    min={config.min}
                    max={config.max}
                    step={config.step || 1}
                    onChange={(e) => onParamChange(key, e.target.value)}
                    className={st.paramInput}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Accordion Section ───────────────────────────────────────────

function AccordionSection({ category, isOpen, onToggle, onAdd }) {
  return (
    <div className={st.accordionSection}>
      {/* Accordion header */}
      <button onClick={onToggle} className={st.accordionBtn}>
        <div className={`${st.chevronWrap} ${!isOpen ? st.chevronClosed : ''}`}>
          <ChevronDown size={13} strokeWidth={2.5} />
        </div>

        <span className={st.accordionLabel}>{category.label}</span>

        {/* Count badge */}
        <span className={st.countBadge}>{category.defs.length}</span>
      </button>

      {/* Accordion body */}
      <div className={`${st.accordionBody} ${isOpen ? st.accordionBodyOpen : st.accordionBodyClosed}`}>
        <div className={st.accordionInner}>
          {isOpen && (
            <div className={st.accordionInnerPad}>
              {category.defs.map((def) => (
                <CatalogIndicatorRow key={def.id} def={def} onAdd={() => onAdd(def)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Catalog Indicator Row ───────────────────────────────────────

function CatalogIndicatorRow({ def, onAdd }) {
  const paramStr = Object.entries(def.params)
    .map(([, config]) => config.default)
    .join(', ');

  return (
    <button onClick={onAdd} className={st.catalogRow}>
      {/* Color dot — column-aligned */}
      <div className={st.colorDot} style={{ '--dot-color': def.outputs[0]?.color || '#787B86', boxShadow: 'none' }} />

      {/* Name + default params */}
      <span className={st.catalogName}>
        {def.name}
        {paramStr && <span className={st.catalogParamHint}> ({paramStr})</span>}
      </span>

      {/* Mode icon with tooltip */}
      <Tooltip text={def.mode === 'overlay' ? 'Overlay — draws on chart' : 'Pane — separate panel'}>
        <div className={st.catalogMode}>
          {def.mode === 'overlay' ? <Layers size={12} strokeWidth={2} /> : <LayoutPanelTop size={12} strokeWidth={2} />}
        </div>
      </Tooltip>
    </button>
  );
}

export default React.memo(IndicatorPanel);
