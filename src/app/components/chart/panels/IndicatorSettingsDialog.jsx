// ═══════════════════════════════════════════════════════════════════
// charEdge — Indicator Settings Dialog (Batch 14)
// Full 3-tab dialog: Inputs / Style / Visibility
// Uses SettingsTabShell for layout and SettingsControls for form controls.
// Live preview, reset, templates, keyboard nav.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { INDICATORS as INDICATOR_REGISTRY } from '../../../../charting_library/studies/indicators/registry.js';
import { C, F } from '../../../../constants.js';
import { useChartToolsStore } from '../../../../state/useChartStore';
import {
  ColorSwatch,
  Toggle,
  RangeSlider,
  NumberInput,
  SelectDropdown,
  LineStylePicker,
  SectionLabel,
} from '../../settings/SettingsControls.jsx';
import SettingsTabShell from '../../settings/SettingsTabShell.jsx';

// ─── Constants ──────────────────────────────────────────────────

const TABS = [
  { id: 'inputs', label: 'Inputs' },
  { id: 'style', label: 'Style' },
  { id: 'visibility', label: 'Visibility' },
];

const SOURCE_OPTIONS = [
  { id: 'close', label: 'Close' },
  { id: 'open', label: 'Open' },
  { id: 'high', label: 'High' },
  { id: 'low', label: 'Low' },
  { id: 'hl2', label: 'HL2' },
  { id: 'hlc3', label: 'HLC3' },
  { id: 'ohlc4', label: 'OHLC4' },
  { id: 'hlcc4', label: 'HLCC4' },
];

const PRECISION_OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: '0', label: '0' },
  { id: '1', label: '1' },
  { id: '2', label: '2' },
  { id: '3', label: '3' },
  { id: '4', label: '4' },
  { id: '5', label: '5' },
  { id: '6', label: '6' },
  { id: '7', label: '7' },
  { id: '8', label: '8' },
];

const TIMEFRAMES = [
  { id: 'sec', label: 'Sec' },
  { id: 'min', label: 'Min' },
  { id: 'hr', label: 'Hr' },
  { id: 'day', label: 'Day' },
  { id: 'wk', label: 'Wk' },
  { id: 'mo', label: 'Mo' },
];

const WIDTH_OPTIONS = [
  { id: 1, label: '1px' },
  { id: 2, label: '2px' },
  { id: 3, label: '3px' },
  { id: 4, label: '4px' },
];

// ─── Template helpers ────────────────────────────────────────────

const TEMPLATE_PREFIX = 'indTemplate:';

function saveTemplate(indicatorId, name, config) {
  const key = `${TEMPLATE_PREFIX}${indicatorId}`;
  const existing = JSON.parse(localStorage.getItem(key) || '{}');
  existing[name] = config;
  localStorage.setItem(key, JSON.stringify(existing));
}

function loadTemplate(indicatorId, name) {
  const key = `${TEMPLATE_PREFIX}${indicatorId}`;
  const existing = JSON.parse(localStorage.getItem(key) || '{}');
  return existing[name] || null;
}

function listTemplates(indicatorId) {
  const key = `${TEMPLATE_PREFIX}${indicatorId}`;
  const existing = JSON.parse(localStorage.getItem(key) || '{}');
  return Object.keys(existing);
}

// ─── Main Dialog Component ───────────────────────────────────────

export default function IndicatorSettingsDialog({ indicatorIdx: indicatorStableId, onClose }) {
  const indicators = useChartToolsStore((s) => s.indicators);
  const updateIndicator = useChartToolsStore((s) => s.updateIndicator);
  const updateIndicatorOutputStyle = useChartToolsStore((s) => s.updateIndicatorOutputStyle);
  const setIndicatorVisibility = useChartToolsStore((s) => s.setIndicatorVisibility);
  const setIndicatorPrecision = useChartToolsStore((s) => s.setIndicatorPrecision);
  const setIndicatorSource = useChartToolsStore((s) => s.setIndicatorSource);
  const setIndicatorShowOnScale = useChartToolsStore((s) => s.setIndicatorShowOnScale);
  const setIndicatorShowInStatusLine = useChartToolsStore((s) => s.setIndicatorShowInStatusLine);
  const updateIndicatorBands = useChartToolsStore((s) => s.updateIndicatorBands);

  // Sprint 4: Look up by stable ID instead of array index
  const indicator = indicators?.find(ind => ind.id === indicatorStableId);
  const indicatorId = indicator?.indicatorId;
  const registryDef = indicatorId ? INDICATOR_REGISTRY?.[indicatorId] : null;

  // ─── Local state ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('inputs');
  const [localParams, setLocalParams] = useState({});
  const [localColor, setLocalColor] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templates, setTemplates] = useState([]);

  // ─── Initialize from indicator ────────────────────────────────
  useEffect(() => {
    if (!indicator || !registryDef) return;
    const defaults = {};
    for (const [key, schema] of Object.entries(registryDef.params || {})) {
      defaults[key] = indicator.params?.[key] ?? schema.default;
    }
    setLocalParams(defaults);
    setLocalColor(indicator.color || registryDef.outputs?.[0]?.color || '#2962FF');
    setTemplates(listTemplates(indicatorId));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicatorStableId, indicatorId]);

  // ─── Live preview ─────────────────────────────────────────────
  const applyParams = useCallback((newParams, newColor) => {
    updateIndicator(indicatorStableId, {
      params: { ...newParams },
      color: newColor,
    });
  }, [indicatorStableId, updateIndicator]);

  const handleParamChange = useCallback((key, value) => {
    setLocalParams((prev) => {
      const next = { ...prev, [key]: value };
      applyParams(next, localColor);
      return next;
    });
  }, [applyParams, localColor]);

  const handleColorChange = useCallback((color) => {
    setLocalColor(color);
    applyParams(localParams, color);
  }, [applyParams, localParams]);

  // ─── Reset ────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (!registryDef) return;
    const defaults = {};
    for (const [key, schema] of Object.entries(registryDef.params || {})) {
      defaults[key] = schema.default;
    }
    const defaultColor = registryDef.outputs?.[0]?.color || '#2962FF';
    setLocalParams(defaults);
    setLocalColor(defaultColor);
    applyParams(defaults, defaultColor);
  }, [registryDef, applyParams]);

  // ─── Templates ────────────────────────────────────────────────
  const handleSaveTemplate = useCallback(() => {
    const name = templateName.trim();
    if (!name || !indicatorId) return;
    saveTemplate(indicatorId, name, { params: localParams, color: localColor });
    setTemplates(listTemplates(indicatorId));
    setTemplateName('');
  }, [indicatorId, localParams, localColor, templateName]);

  const handleLoadTemplate = useCallback((name) => {
    const config = loadTemplate(indicatorId, name);
    if (!config) return;
    setLocalParams(config.params || {});
    setLocalColor(config.color || localColor);
    applyParams(config.params || localParams, config.color || localColor);
  }, [indicatorId, applyParams, localParams, localColor]);

  if (!indicator || !registryDef) return null;

  const title = registryDef.label || registryDef.shortName || indicatorId?.toUpperCase() || 'Settings';
  const outputs = registryDef.outputs || [];
  const outputStyles = indicator.outputStyles || {};
  const visibility = indicator.visibility || { timeframes: [], showAll: true };

  // ─── Template footer ──────────────────────────────────────────
  const templateFooter = (
    <div>
      <SectionLabel>Templates</SectionLabel>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input
          type="text"
          placeholder="Template name..."
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTemplate(); }}
          style={{
            flex: 1,
            padding: '5px 8px',
            borderRadius: 6,
            border: `1px solid ${C.bd}`,
            background: C.sf,
            color: C.t1,
            fontFamily: F,
            fontSize: 12,
            outline: 'none',
          }}
        />
        <button
          onClick={handleSaveTemplate}
          disabled={!templateName.trim()}
          style={{
            padding: '5px 12px',
            borderRadius: 6,
            border: `1px solid ${C.b}40`,
            background: C.b + '15',
            color: C.b,
            fontFamily: F,
            fontSize: 11,
            fontWeight: 600,
            cursor: templateName.trim() ? 'pointer' : 'default',
            opacity: templateName.trim() ? 1 : 0.4,
            transition: 'all 0.12s ease',
          }}
        >
          Save
        </button>
      </div>
      {templates.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {templates.map((name) => (
            <button
              key={name}
              onClick={() => handleLoadTemplate(name)}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: `1px solid ${C.bd}`,
                background: 'transparent',
                color: C.t2,
                fontFamily: F,
                fontSize: 11,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = C.b + '15';
                e.currentTarget.style.borderColor = C.b + '40';
                e.currentTarget.style.color = C.b;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = C.bd;
                e.currentTarget.style.color = C.t2;
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <SettingsTabShell
      title={title}
      iconColor={localColor}
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClose={onClose}
      onOk={onClose}
      onCancel={() => { handleReset(); onClose(); }}
      footerExtra={templateFooter}
    >
      {/* ═══ Inputs Tab ══════════════════════════════════════════ */}
      {activeTab === 'inputs' && (
        <div>
          <SectionLabel>Parameters</SectionLabel>

          {Object.entries(registryDef.params || {}).map(([key, schema]) => {
            const val = localParams[key] ?? schema.default;

            if (typeof schema.default === 'boolean') {
              return (
                <Toggle
                  key={key}
                  label={schema.label || key}
                  checked={val}
                  onChange={(v) => handleParamChange(key, v)}
                />
              );
            }

            return (
              <RangeSlider
                key={key}
                label={schema.label || key}
                value={val}
                min={schema.min ?? 1}
                max={schema.max ?? 500}
                step={schema.step ?? 1}
                onChange={(v) => handleParamChange(key, v)}
              />
            );
          })}

          <SectionLabel>Source</SectionLabel>
          <SelectDropdown
            label="Input Source"
            value={indicator.source || 'close'}
            options={SOURCE_OPTIONS}
            onChange={(v) => setIndicatorSource(indicatorStableId, v)}
          />

          {/* Strategy Item #13: Editable pane-config band levels (RSI 70/30, etc.) */}
          {registryDef.paneConfig?.bands?.length > 0 && (
            <>
              <SectionLabel>Reference Lines</SectionLabel>
              {registryDef.paneConfig.bands.map((band, bi) => {
                const override = indicator.bandOverrides?.[bi] || {};
                const currentValue = override.value ?? band.value;
                const currentColor = override.color ?? band.color;
                return (
                  <div
                    key={bi}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 6,
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: C.sf,
                      border: `1px solid ${C.bd}`,
                    }}
                  >
                    <span style={{ fontSize: 11, color: C.t3, fontFamily: F, minWidth: 40 }}>
                      {band.label || `Level ${bi + 1}`}
                    </span>
                    <NumberInput
                      label=""
                      value={currentValue}
                      step={registryDef.paneConfig.max ? 1 : 0.1}
                      onChange={(v) => updateIndicatorBands(indicatorStableId, bi, { value: v })}
                    />
                    <ColorSwatch
                      color={currentColor}
                      onChange={(c) => updateIndicatorBands(indicatorStableId, bi, { color: c })}
                    />
                  </div>
                );
              })}
            </>
          )}

          {/* Info tooltip area */}
          <div
            style={{
              marginTop: 16,
              padding: '8px 10px',
              borderRadius: 6,
              background: C.sf,
              border: `1px solid ${C.bd}`,
              fontSize: 11,
              color: C.t3,
              fontFamily: F,
              lineHeight: 1.5,
            }}
          >
            💡 {registryDef.name} — {registryDef.mode === 'overlay' ? 'Overlay indicator' : 'Pane indicator'}.
            {Object.keys(registryDef.params || {}).length > 0 &&
              ` Adjust parameters above for live preview.`}
          </div>
        </div>
      )}

      {/* ═══ Style Tab ═══════════════════════════════════════════ */}
      {activeTab === 'style' && (
        <div>
          <SectionLabel>Line Style</SectionLabel>

          {/* Primary color (backward compat) */}
          <ColorSwatch
            label="Primary Color"
            color={localColor}
            onChange={handleColorChange}
          />

          {/* Per-output styling */}
          {outputs.length > 1 && (
            <>
              <SectionLabel>Per-Output Styling</SectionLabel>
              {outputs.map((out) => {
                const style = outputStyles[out.key] || {
                  color: out.color,
                  width: out.width ?? 2,
                  dash: out.dash || [],
                  visible: true,
                };
                return (
                  <div
                    key={out.key}
                    style={{
                      padding: '8px 10px',
                      marginBottom: 6,
                      borderRadius: 8,
                      background: C.sf,
                      border: `1px solid ${C.bd}`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontSize: 12, fontFamily: F, color: C.t1, fontWeight: 600 }}>
                        {out.label || out.key}
                      </span>
                      <button
                        onClick={() => updateIndicatorOutputStyle(indicatorStableId, out.key, { visible: !style.visible })}
                        title={style.visible ? 'Hide' : 'Show'}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          border: `1px solid ${C.bd}`,
                          background: 'transparent',
                          color: style.visible ? C.b : C.t3,
                          fontSize: 12,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        {style.visible ? '👁' : '👁‍🗨'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <ColorSwatch
                        color={style.color}
                        onChange={(c) => updateIndicatorOutputStyle(indicatorStableId, out.key, { color: c })}
                      />
                      <SelectDropdown
                        label="Width"
                        value={style.width}
                        options={WIDTH_OPTIONS}
                        onChange={(w) => updateIndicatorOutputStyle(indicatorStableId, out.key, { width: parseInt(w) })}
                      />
                    </div>
                    <LineStylePicker
                      value={style.dash}
                      onChange={(d) => updateIndicatorOutputStyle(indicatorStableId, out.key, { dash: d })}
                    />
                  </div>
                );
              })}
            </>
          )}

          {/* Fill controls for band indicators */}
          {registryDef.fills && registryDef.fills.length > 0 && (
            <>
              <SectionLabel>Fill</SectionLabel>
              <div
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  background: C.sf,
                  border: `1px solid ${C.bd}`,
                  fontSize: 11,
                  color: C.t3,
                  fontFamily: F,
                }}
              >
                {registryDef.fills.length} fill zone{registryDef.fills.length > 1 ? 's' : ''} configured from defaults.
              </div>
            </>
          )}

          {/* Precision & Status Line */}
          <SectionLabel>Display</SectionLabel>
          <SelectDropdown
            label="Precision"
            value={String(indicator.precision ?? 'auto')}
            options={PRECISION_OPTIONS}
            onChange={(v) => setIndicatorPrecision(indicatorStableId, v === 'auto' ? 'auto' : parseInt(v))}
          />
          <Toggle
            label="Show on Price Scale"
            checked={indicator.showOnScale !== false}
            onChange={(v) => setIndicatorShowOnScale(indicatorStableId, v)}
          />
          <Toggle
            label="Show in Status Line"
            checked={indicator.showInStatusLine !== false}
            onChange={(v) => setIndicatorShowInStatusLine(indicatorStableId, v)}
          />
        </div>
      )}

      {/* ═══ Visibility Tab ══════════════════════════════════════ */}
      {activeTab === 'visibility' && (
        <div>
          <SectionLabel>Timeframe Visibility</SectionLabel>

          <Toggle
            label="Show on all timeframes"
            checked={visibility.showAll !== false}
            onChange={(v) => setIndicatorVisibility(indicatorStableId, { showAll: v, timeframes: v ? [] : visibility.timeframes })}
          />

          {!visibility.showAll && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 6,
                marginTop: 10,
              }}
            >
              {TIMEFRAMES.map((tf) => {
                const isActive = visibility.timeframes?.includes(tf.id);
                return (
                  <button
                    key={tf.id}
                    onClick={() => {
                      const tfs = visibility.timeframes || [];
                      const next = isActive
                        ? tfs.filter((t) => t !== tf.id)
                        : [...tfs, tf.id];
                      setIndicatorVisibility(indicatorStableId, { showAll: false, timeframes: next });
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: `1px solid ${isActive ? C.b + '60' : C.bd}`,
                      background: isActive ? C.b + '15' : 'transparent',
                      color: isActive ? C.b : C.t2,
                      fontFamily: F,
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 400,
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    {tf.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Pane height for pane indicators */}
          {registryDef.mode === 'pane' && (
            <>
              <SectionLabel>Pane</SectionLabel>
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: C.sf,
                  border: `1px solid ${C.bd}`,
                  fontSize: 11,
                  color: C.t3,
                  fontFamily: F,
                  lineHeight: 1.5,
                }}
              >
                📐 This indicator renders in a separate pane below the main chart.
                {registryDef.paneConfig?.min !== undefined && (
                  <> Scale: {registryDef.paneConfig.min} – {registryDef.paneConfig.max}.</>
                )}
              </div>
            </>
          )}

          {/* Reset button */}
          <div style={{ marginTop: 20 }}>
            <button
              onClick={handleReset}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: `1px solid ${C.bd}`,
                background: 'transparent',
                color: C.t2,
                fontFamily: F,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = C.r + '15';
                e.currentTarget.style.borderColor = C.r + '40';
                e.currentTarget.style.color = C.r;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = C.bd;
                e.currentTarget.style.color = C.t2;
              }}
            >
              Reset to Default
            </button>
          </div>
        </div>
      )}
    </SettingsTabShell>
  );
}
