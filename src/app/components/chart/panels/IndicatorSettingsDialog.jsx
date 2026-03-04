// ═══════════════════════════════════════════════════════════════════
// charEdge — Indicator Settings Dialog (Sprint 13)
// Opens on double-click indicator in legend. Auto-generates controls
// from registry params schema. Live preview, reset, templates.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useChartStore } from '../../../../state/useChartStore.js';
import { C, F, M } from '../../../../constants.js';
import { INDICATORS as INDICATOR_REGISTRY } from '../../../../charting_library/studies/indicators/registry.js';

// ─── Reusable Form Controls (matching ChartSettingsPanel style) ──

function ParamSlider({ label, value, min, max, step, onChange }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 0',
        fontSize: 13,
        fontFamily: F,
        color: C.t1,
      }}
    >
      <span style={{ flex: 1, minWidth: 80 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: 90, accentColor: C.b }}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        style={{
          width: 48,
          padding: '3px 6px',
          borderRadius: 6,
          border: `1px solid ${C.bd}`,
          background: C.sf,
          color: C.t1,
          fontFamily: M,
          fontSize: 11,
          textAlign: 'right',
          outline: 'none',
        }}
      />
    </label>
  );
}

function ParamColor({ label, color, onChange }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 0',
        fontSize: 13,
        fontFamily: F,
        color: C.t1,
        cursor: 'pointer',
      }}
    >
      <span style={{ flex: 1 }}>{label}</span>
      <div style={{ position: 'relative', width: 28, height: 28 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: color,
            border: `1px solid ${C.bd}`,
          }}
        />
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
          }}
        />
      </div>
    </label>
  );
}

function ParamToggle({ label, checked, onChange }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 0',
        fontSize: 13,
        fontFamily: F,
        color: C.t1,
        cursor: 'pointer',
      }}
    >
      <span style={{ flex: 1 }}>{label}</span>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          border: 'none',
          padding: 2,
          background: checked ? C.b : C.bd,
          cursor: 'pointer',
          transition: 'background 0.2s ease',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            transition: 'transform 0.2s ease',
            transform: checked ? 'translateX(16px)' : 'translateX(0)',
          }}
        />
      </button>
    </label>
  );
}

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

export default function IndicatorSettingsDialog({ indicatorIdx, onClose }) {
  const indicators = useChartStore((s) => s.indicators);
  const updateIndicator = useChartStore((s) => s.updateIndicator);

  const indicator = indicators?.[indicatorIdx];
  const indicatorId = indicator?.indicatorId;
  const registryDef = indicatorId ? INDICATOR_REGISTRY?.[indicatorId] : null;

  // Local state for live editing
  const [localParams, setLocalParams] = useState({});
  const [localColor, setLocalColor] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templates, setTemplates] = useState([]);
  const dialogRef = useRef(null);

  // Initialize local state from indicator
  useEffect(() => {
    if (!indicator || !registryDef) return;
    const defaults = {};
    for (const [key, schema] of Object.entries(registryDef.params || {})) {
      defaults[key] = indicator.params?.[key] ?? schema.default;
    }
    setLocalParams(defaults);
    setLocalColor(indicator.color || registryDef.outputs?.[0]?.color || '#2962FF');
    setTemplates(listTemplates(indicatorId));
  }, [indicatorIdx, indicatorId]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target)) onClose();
    };
    setTimeout(() => window.addEventListener('mousedown', onClick), 100);
    return () => window.removeEventListener('mousedown', onClick);
  }, [onClose]);

  // Live preview: update store on every param change
  const applyParams = useCallback((newParams, newColor) => {
    updateIndicator(indicatorIdx, {
      params: { ...newParams },
      color: newColor,
    });
  }, [indicatorIdx, updateIndicator]);

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

  // Reset to registry defaults
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

  // Save template
  const handleSaveTemplate = useCallback(() => {
    const name = templateName.trim();
    if (!name || !indicatorId) return;
    saveTemplate(indicatorId, name, { params: localParams, color: localColor });
    setTemplates(listTemplates(indicatorId));
    setTemplateName('');
  }, [indicatorId, localParams, localColor, templateName]);

  // Load template
  const handleLoadTemplate = useCallback((name) => {
    const config = loadTemplate(indicatorId, name);
    if (!config) return;
    setLocalParams(config.params || {});
    setLocalColor(config.color || localColor);
    applyParams(config.params || localParams, config.color || localColor);
  }, [indicatorId, applyParams, localParams, localColor]);

  if (!indicator || !registryDef) return null;

  const title = registryDef.label || registryDef.shortName || indicatorId?.toUpperCase() || 'Settings';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        ref={dialogRef}
        className="indicator-settings-dialog"
        style={{
          width: 340,
          maxHeight: '80vh',
          background: 'rgba(22, 24, 29, 0.95)',
          borderRadius: 14,
          border: `1px solid ${C.bd}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '14px 16px 10px',
            borderBottom: `1px solid ${C.bd}`,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: localColor,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              flex: 1,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: F,
              color: C.t1,
            }}
          >
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: `1px solid ${C.bd}`,
              background: 'transparent',
              color: C.t2,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = C.r + '20';
              e.currentTarget.style.color = C.r;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = C.t2;
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {/* Parameters Section */}
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.t3,
              fontFamily: F,
              letterSpacing: 0.8,
              marginBottom: 6,
              textTransform: 'uppercase',
            }}
          >
            Parameters
          </div>

          {Object.entries(registryDef.params || {}).map(([key, schema]) => {
            const val = localParams[key] ?? schema.default;

            if (typeof schema.default === 'boolean') {
              return (
                <ParamToggle
                  key={key}
                  label={schema.label || key}
                  checked={val}
                  onChange={(v) => handleParamChange(key, v)}
                />
              );
            }

            return (
              <ParamSlider
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

          {/* Line Style Section */}
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.t3,
              fontFamily: F,
              letterSpacing: 0.8,
              marginTop: 16,
              marginBottom: 6,
              textTransform: 'uppercase',
            }}
          >
            Line Style
          </div>

          <ParamColor
            label="Color"
            color={localColor}
            onChange={handleColorChange}
          />

          {/* Templates Section */}
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.t3,
              fontFamily: F,
              letterSpacing: 0.8,
              marginTop: 16,
              marginBottom: 6,
              textTransform: 'uppercase',
            }}
          >
            Templates
          </div>

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

        {/* Footer */}
        <div
          style={{
            padding: '10px 16px 14px',
            borderTop: `1px solid ${C.bd}`,
            display: 'flex',
            gap: 8,
          }}
        >
          <button
            onClick={handleReset}
            style={{
              flex: 1,
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
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: C.b,
              color: '#fff',
              fontFamily: F,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
