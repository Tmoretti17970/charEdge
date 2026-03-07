// ═══════════════════════════════════════════════════════════════════
// charEdge v12 — Indicator Panel (Progressive Disclosure)
//
// Accordion-based indicator browser with:
//   - Sticky glassmorphism header (search + AI toggle)
//   - 4 collapsible categories: Moving Averages, Trend & Channels,
//     Oscillators & Momentum, Volatility & Volume
//   - Apple Settings–style active indicator list
//   - Lucide icons + framer-motion animations
// ═══════════════════════════════════════════════════════════════════

import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ChevronDown, Layers, LayoutPanelTop, Trash2, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';
import { INDICATORS } from '../../../charting_library/studies/indicators/registry.js';
import { C, F, GLASS } from '../../../constants.js';
import { useChartStore } from '../../../state/useChartStore.js';
import { radii, transition, zIndex } from '../../../theme/tokens.js';
import { alpha } from '../../../utils/colorUtils.js';
import { ToggleSwitch, Tooltip } from '../ui/AppleHIG.jsx';

// ─── Category Definitions ────────────────────────────────────────
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
    ],
  },
  {
    id: 'volatility-volume',
    label: 'Volatility & Volume',
    ids: ['atr', 'adx', 'mfi', 'obv', 'volumeDelta', 'cmf', 'adLine', 'stdDev', 'historicalVol', 'chaikinVol'],
  },
];

// ─── Animation Config ────────────────────────────────────────────
const accordionMotion = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1, transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { height: 0, opacity: 0, transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } },
};

/**
 * IndicatorPanel — Progressive Disclosure indicator browser.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen     - Panel visibility
 * @param {Function} props.onClose   - Close handler
 */
export default function IndicatorPanel({ isOpen, onClose }) {
  const indicators = useChartStore((s) => s.indicators);
  const addIndicator = useChartStore((s) => s.addIndicator);
  const removeIndicator = useChartStore((s) => s.removeIndicator);
  const updateIndicator = useChartStore((s) => s.updateIndicator);
  const toggleVisibility = useChartStore((s) => s.toggleIndicatorVisibility);

  const intelligence = useChartStore((s) => s.intelligence);
  const toggleIntelligence = useChartStore((s) => s.toggleIntelligence);
  const toggleIntelligenceMaster = useChartStore((s) => s.toggleIntelligenceMaster);

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
    (idx, paramKey, value) => {
      const ind = indicators[idx];
      if (!ind) return;
      updateIndicator(idx, {
        params: { ...ind.params, [paramKey]: Number(value) },
      });
    },
    [indicators, updateIndicator],
  );

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        width: 320,
        maxHeight: 'calc(100vh - 80px)',
        background: GLASS.standard,
        backdropFilter: GLASS.blurLg,
        WebkitBackdropFilter: GLASS.blurLg,
        border: GLASS.border,
        borderRadius: radii.xl,
        boxShadow: '0 12px 40px rgba(0,0,0,0.35), 0 0 1px rgba(0,0,0,0.08)',
        zIndex: zIndex.popover,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: F,
        overflow: 'hidden',
      }}
    >
      {/* ── Sticky Header ────────────────────────────────────── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          background: GLASS.heavy,
          backdropFilter: GLASS.blurXl,
          WebkitBackdropFilter: GLASS.blurXl,
          borderBottom: GLASS.border,
        }}
      >
        {/* Title bar */}
        <div
          style={{
            padding: '12px 14px 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ color: C.t1, fontSize: 14, fontWeight: 650, letterSpacing: '-0.01em' }}>Indicators</span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: C.t3,
              cursor: 'pointer',
              padding: 4,
              borderRadius: radii.sm,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: `color ${transition.fast}, background ${transition.fast}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = alpha(C.t3, 0.12);
              e.currentTarget.style.color = C.t1;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = C.t3;
            }}
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>

        {/* Search bar */}
        <div style={{ padding: '10px 14px 0' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 10px',
              background: alpha(C.bg, 0.5),
              border: `1px solid ${alpha(C.bd, 0.5)}`,
              borderRadius: radii.md,
              transition: `border-color ${transition.base}`,
            }}
          >
            <Search size={13} color={C.t3} strokeWidth={2} />
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
                fontSize: 12,
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
                  width: 16,
                  height: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <X size={10} color={C.t2} strokeWidth={3} />
              </button>
            )}
          </div>
        </div>

        {/* AI Toggle */}
        <div style={{ padding: '10px 14px 12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              background: alpha(C.b, intelligence?.enabled ? 0.08 : 0.03),
              border: `1px solid ${alpha(C.b, intelligence?.enabled ? 0.2 : 0.06)}`,
              borderRadius: radii.md,
              transition: `all ${transition.base}`,
            }}
          >
            <Sparkles size={13} color={intelligence?.enabled ? C.b : C.t3} strokeWidth={2} />
            <span style={{ flex: 1, fontSize: 12, color: C.t1, fontWeight: 500 }}>AI Analysis</span>
            <ToggleSwitch checked={intelligence?.enabled ?? false} onChange={toggleIntelligenceMaster} size="sm" />
          </div>
        </div>
      </div>

      {/* ── Scrollable Content ────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 0 8px' }}>
        {/* AI Sub-toggles */}
        <AnimatePresence>
          {intelligence?.enabled && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ padding: '4px 14px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  { key: 'showSR', label: 'Support & Resistance' },
                  { key: 'showPatterns', label: 'Candlestick Patterns' },
                  { key: 'showDivergences', label: 'RSI Divergences' },
                ].map((item) => (
                  <div
                    key={item.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: radii.sm,
                      background: alpha(C.sf2, 0.5),
                    }}
                  >
                    <span style={{ fontSize: 11, color: C.t2 }}>{item.label}</span>
                    <ToggleSwitch
                      checked={intelligence[item.key]}
                      onChange={() => toggleIntelligence(item.key)}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Active Indicators ─────────────────────────────── */}
        {indicators.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <div
              style={{
                padding: '8px 14px 4px',
                fontSize: 10,
                fontWeight: 650,
                color: C.t3,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Active · {indicators.length}
            </div>
            <div style={{ padding: '0 8px' }}>
              {indicators.map((ind, idx) => (
                <ActiveIndicatorRow
                  key={idx}
                  ind={ind}
                  idx={idx}
                  isEditing={editingIdx === idx}
                  onToggleEdit={() => setEditingIdx(editingIdx === idx ? null : idx)}
                  onToggleVisibility={() => toggleVisibility(idx)}
                  onRemove={() => {
                    removeIndicator(idx);
                    if (editingIdx === idx) setEditingIdx(null);
                  }}
                  onParamChange={(key, val) => handleParamChange(idx, key, val)}
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
      <AnimatePresence>
        {isEditing && def && Object.keys(def.params).length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ overflow: 'hidden' }}
          >
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
          </motion.div>
        )}
      </AnimatePresence>
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
        <motion.div
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ display: 'flex', alignItems: 'center', marginRight: 8, color: C.t3 }}
        >
          <ChevronDown size={13} strokeWidth={2.5} />
        </motion.div>

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
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div {...accordionMotion} style={{ overflow: 'hidden' }}>
            <div style={{ paddingBottom: 4 }}>
              {category.defs.map((def) => (
                <CatalogIndicatorRow key={def.id} def={def} onAdd={() => onAdd(def)} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
