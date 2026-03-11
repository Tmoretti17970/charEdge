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
import { useState, useCallback, useMemo } from 'react';
import { INDICATORS } from '../../../charting_library/studies/indicators/registry.js';
import { C, F, GLASS } from '../../../constants.js';
import { useChartToolsStore } from '../../../state/useChartStore';
import { radii, transition } from '../../../theme/tokens.js';
import { Tooltip } from '../ui/AppleHIG.jsx';
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
      // merged from 'Advanced Oscillators'
      'connorsRsi', 'schaffTrendCycle', 'ehlersFisher', 'rvi', 'stochRsi', 'elderRay', 'adxr',
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
    ids: ['kama', 'vidya', 'frama', 'adaptiveRsi', 'dynamicATR', 'regimeSwitcher', 'sigmaBands', 'mama', 'mcginleyDynamic'],
  },
  {
    id: 'signals',
    label: 'Signals & Confluence',
    ids: [
      'rvolFilter', 'pivotPoints', 'autoFib', 'heikinAshi', 'marketProfile',
      // merged from 'Smart Signals'
      'fvgDetector', 'wickRejection', 'confluenceScore', 'signalQuality',
    ],
  },
  {
    id: 'exotic',
    label: 'Exotic & Research',
    ids: ['hurstExponent', 'renkoBrickCount'],
  },
];



/**
 * IndicatorPanel — Progressive Disclosure indicator browser.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen     - Panel visibility
 * @param {Function} props.onClose   - Close handler
 */
export default function IndicatorPanel({ isOpen, _onClose }) {
  const indicators = useChartToolsStore((s) => s.indicators);
  const addIndicator = useChartToolsStore((s) => s.addIndicator);
  const removeIndicator = useChartToolsStore((s) => s.removeIndicator);
  const updateIndicator = useChartToolsStore((s) => s.updateIndicator);
  const toggleVisibility = useChartToolsStore((s) => s.toggleIndicatorVisibility);

  const [searchTerm, setSearchTerm] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [openSections, setOpenSections] = useState({});

  // Toggle accordion section
  const toggleSection = useCallback((id) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // Filter indicators by search query
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

  // Build filtered categories
  const filteredCategories = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const defs = cat.ids.map((id) => INDICATORS[id]).filter((def) => def && matchesSearch(def));
      return { ...cat, defs };
    }).filter((cat) => cat.defs.length > 0);
  }, [matchesSearch]);

  // When searching, auto-expand all matching categories
  const effectiveOpenSections = useMemo(() => {
    if (!searchTerm) return openSections;
    const expanded = {};
    for (const cat of filteredCategories) {
      expanded[cat.id] = true;
    }
    return expanded;
  }, [searchTerm, openSections, filteredCategories]);

  const totalResults = filteredCategories.reduce((sum, c) => sum + c.defs.length, 0);

  // Add indicator with defaults
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

  // Update a parameter value
  const handleParamChange = useCallback(
    (id, paramKey, value) => {
      const ind = indicators.find(i => i.id === id);
      if (!ind) return;
      updateIndicator(id, {
        params: { ...ind.params, [paramKey]: Number(value) },
      });
    },
    [indicators, updateIndicator],
  );

  if (!isOpen) return null;

  // Item 40: IndicatorPanel renders inside SlidePanel — no floating container needed
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        fontFamily: F,
        overflow: 'hidden',
        userSelect: 'none',
        height: '100%',
        margin: '-16px', // undo SlidePanel's content padding
      }}
    >
      {/* ── Search Header ─────────────────────────────────────── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: GLASS.heavy,
          backdropFilter: GLASS.blurXl,
          WebkitBackdropFilter: GLASS.blurXl,
          borderBottom: GLASS.border,
          padding: '8px 10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 8px',
            background: alpha(C.bg, 0.5),
            border: `1px solid ${alpha(C.bd, 0.5)}`,
            borderRadius: radii.md,
            transition: `border-color ${transition.base}`,
          }}
        >
          <Search size={12} color={C.t3} strokeWidth={2} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search indicators..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: C.t1,
              fontSize: 11,
              outline: 'none',
              fontFamily: F,
              padding: 0,
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{
                background: alpha(C.t3, 0.2),
                border: 'none',
                borderRadius: '50%',
                width: 14,
                height: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <X size={9} color={C.t2} strokeWidth={3} />
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable Content ────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 0 6px' }}>

        {/* ── Active Indicators ─────────────────────────────── */}
        {indicators.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <div
              style={{
                padding: '6px 10px 3px',
                fontSize: 9,
                fontWeight: 650,
                color: C.t3,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Active · {indicators.length}
            </div>
            <div style={{ padding: '0 6px' }}>
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
          <div
            style={{
              padding: '32px 14px',
              textAlign: 'center',
              color: C.t3,
              fontSize: 12,
            }}
          >
            <Search size={20} color={C.t3} strokeWidth={1.5} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div>
              No indicators match "<strong style={{ color: C.t2 }}>{searchTerm}</strong>"
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

  return (
    <div
      style={{
        marginBottom: 2,
        borderRadius: radii.md,
        overflow: 'hidden',
        background: hovered ? alpha(C.sf2, 0.6) : alpha(C.sf, 0.4),
        transition: `background ${transition.fast}`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          padding: '7px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 36,
        }}
      >
        {/* Color dot */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: ind.color || def?.outputs[0]?.color || C.b,
            flexShrink: 0,
            boxShadow: `0 0 6px ${alpha(ind.color || def?.outputs[0]?.color || C.b, 0.4)}`,
          }}
        />

        {/* Name + params */}
        <button
          onClick={onToggleEdit}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: C.t1,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            textAlign: 'left',
            padding: 0,
            fontFamily: F,
          }}
        >
          {def?.shortName || id}
          {paramStr && <span style={{ color: C.t3, fontWeight: 400 }}> ({paramStr})</span>}
        </button>

        {/* Mode badge icon */}
        <Tooltip text={def?.mode === 'overlay' ? 'Overlay indicator' : 'Pane indicator'}>
          <div style={{ color: C.t3, display: 'flex', alignItems: 'center', opacity: 0.6 }}>
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
            style={{
              background: 'transparent',
              border: 'none',
              color: ind.visible !== false ? C.t2 : C.t3,
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
              opacity: ind.visible !== false ? 0.8 : 0.4,
              transition: `opacity ${transition.fast}`,
              borderRadius: radii.xs,
            }}
          >
            {ind.visible !== false ? <Eye size={13} strokeWidth={2} /> : <EyeOff size={13} strokeWidth={2} />}
          </button>
        </Tooltip>

        {/* Delete — only visible on hover */}
        <Tooltip text="Remove indicator">
          <button
            onClick={onRemove}
            style={{
              background: 'transparent',
              border: 'none',
              color: C.r,
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
              opacity: hovered ? 0.8 : 0,
              transition: `opacity ${transition.fast}`,
              pointerEvents: hovered ? 'auto' : 'none',
              borderRadius: radii.xs,
            }}
          >
            <Trash2 size={12} strokeWidth={2} />
          </button>
        </Tooltip>
      </div>

      {/* Parameter editor */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: isEditing && def && Object.keys(def.params).length > 0 ? '1fr' : '0fr',
          transition: 'grid-template-rows 200ms cubic-bezier(0.25, 0.1, 0.25, 1)',
          overflow: 'hidden',
        }}
      >
        <div style={{ minHeight: 0 }}>
          {def && Object.keys(def.params).length > 0 && (
            <div
              style={{
                padding: '2px 10px 8px 28px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {Object.entries(def.params).map(([key, config]) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <label
                    style={{
                      fontSize: 10,
                      color: C.t3,
                      fontFamily: F,
                      fontWeight: 500,
                    }}
                  >
                    {config.label || key}
                  </label>
                  <input
                    type="number"
                    value={ind.params?.[key] ?? config.default}
                    min={config.min}
                    max={config.max}
                    step={config.step || 1}
                    onChange={(e) => onParamChange(key, e.target.value)}
                    style={{
                      width: 60,
                      padding: '4px 6px',
                      background: alpha(C.bg, 0.5),
                      border: `1px solid ${alpha(C.bd, 0.5)}`,
                      borderRadius: radii.sm,
                      color: C.t1,
                      fontSize: 11,
                      fontFamily: F,
                      outline: 'none',
                      transition: `border-color ${transition.base}`,
                    }}
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
    <div style={{ borderTop: `1px solid ${alpha(C.bd, 0.3)}` }}>
      {/* Accordion header */}
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          padding: '10px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: F,
          transition: `background ${transition.fast}`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = alpha(C.sf2, 0.4);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginRight: 8,
            color: C.t3,
            transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 200ms cubic-bezier(0.25, 0.1, 0.25, 1)',
          }}
        >
          <ChevronDown size={13} strokeWidth={2.5} />
        </div>

        <span
          style={{
            flex: 1,
            textAlign: 'left',
            fontSize: 12,
            fontWeight: 600,
            color: C.t1,
            letterSpacing: '-0.01em',
          }}
        >
          {category.label}
        </span>

        {/* Count badge */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: C.t3,
            background: alpha(C.bd, 0.25),
            padding: '2px 7px',
            borderRadius: radii.pill,
            minWidth: 20,
            textAlign: 'center',
          }}
        >
          {category.defs.length}
        </span>
      </button>

      {/* Accordion body */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: isOpen ? '1fr' : '0fr',
          transition: 'grid-template-rows 250ms cubic-bezier(0.25, 0.1, 0.25, 1)',
          overflow: 'hidden',
        }}
      >
        <div style={{ minHeight: 0 }}>
          {isOpen && (
            <div style={{ paddingBottom: 4 }}>
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
  const [hovered, setHovered] = useState(false);
  const paramStr = Object.entries(def.params)
    .map(([, config]) => config.default)
    .join(', ');

  return (
    <button
      onClick={onAdd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '6px 14px 6px 36px',
        background: hovered ? alpha(C.sf2, 0.5) : 'transparent',
        border: 'none',
        color: C.t1,
        fontSize: 12,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: F,
        transition: `background ${transition.fast}`,
        minHeight: 32,
      }}
    >
      {/* Color dot — column-aligned */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: def.outputs[0]?.color || '#787B86',
          flexShrink: 0,
        }}
      />

      {/* Name + default params */}
      <span style={{ flex: 1, fontWeight: 450 }}>
        {def.name}
        {paramStr && <span style={{ color: C.t3, fontSize: 11, fontWeight: 400 }}> ({paramStr})</span>}
      </span>

      {/* Mode icon with tooltip */}
      <Tooltip text={def.mode === 'overlay' ? 'Overlay — draws on chart' : 'Pane — separate panel'}>
        <div
          style={{
            color: C.t3,
            opacity: hovered ? 0.8 : 0.4,
            display: 'flex',
            alignItems: 'center',
            transition: `opacity ${transition.fast}`,
          }}
        >
          {def.mode === 'overlay' ? <Layers size={12} strokeWidth={2} /> : <LayoutPanelTop size={12} strokeWidth={2} />}
        </div>
      </Tooltip>
    </button>
  );
}
