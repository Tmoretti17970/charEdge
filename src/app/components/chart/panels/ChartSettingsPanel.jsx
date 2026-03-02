import React, { useState } from 'react';
import { C, F, M } from '../../../../constants.js';
import { useChartStore } from '../../../../state/useChartStore.js';

// SVG Tab Icons
const TabIcon = ({ children }) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ display: 'block' }}>{children}</svg>;

const TAB_ICONS = {
  appearance: <TabIcon><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="5.5" cy="6" r="1.2" fill="currentColor" opacity="0.6"/><circle cx="8.5" cy="6" r="1.2" fill="currentColor" opacity="0.6"/><circle cx="7" cy="9" r="1.2" fill="currentColor" opacity="0.6"/></TabIcon>,
  grid: <TabIcon><line x1="1" y1="4.5" x2="13" y2="4.5" stroke="currentColor" strokeWidth="0.8" opacity="0.5"/><line x1="1" y1="9.5" x2="13" y2="9.5" stroke="currentColor" strokeWidth="0.8" opacity="0.5"/><line x1="4.5" y1="1" x2="4.5" y2="13" stroke="currentColor" strokeWidth="0.8" opacity="0.5"/><line x1="9.5" y1="1" x2="9.5" y2="13" stroke="currentColor" strokeWidth="0.8" opacity="0.5"/><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none"/></TabIcon>,
  scale: <TabIcon><line x1="2" y1="12" x2="12" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="12" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 1.5" opacity="0.5"/></TabIcon>,
  crosshair: <TabIcon><line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="1" opacity="0.6"/><line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1" opacity="0.6"/><circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" fill="none"/></TabIcon>,
};

const TABS = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'grid', label: 'Grid' },
  { id: 'scale', label: 'Scale' },
  { id: 'crosshair', label: 'Crosshair' },
];

// Theme preset display config
const THEME_PILLS = [
  { id: 'default', label: 'Default', colors: ['#26A69A', '#EF5350'] },
  { id: 'midnight', label: 'Midnight', colors: ['#5C6BC0', '#EC407A'] },
  { id: 'ocean', label: 'Ocean', colors: ['#00BCD4', '#FF7043'] },
  { id: 'terminal', label: 'Terminal', colors: ['#00E676', '#FF1744'] },
  { id: 'monochrome', label: 'Mono', colors: ['#B0BEC5', '#546E7A'] },
];

function ColorSwatch({ color, onChange, label }) {
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
            cursor: 'pointer',
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

function Toggle({ label, checked, onChange }) {
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

function RangeSlider({ label, value, min, max, step, onChange, display }) {
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
      <span style={{ flex: 1 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: 80, accentColor: C.b }}
      />
      <span style={{ fontFamily: M, fontSize: 11, color: C.t2, width: 30, textAlign: 'right' }}>
        {display || value}
      </span>
    </label>
  );
}

function RadioGroup({ label, options, value, onChange }) {
  return (
    <div style={{ padding: '6px 0' }}>
      <div style={{ fontSize: 13, fontFamily: F, color: C.t1, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            style={{
              flex: 1,
              padding: '5px 8px',
              borderRadius: 6,
              border: `1px solid ${value === opt.id ? C.b + '60' : C.bd}`,
              background: value === opt.id ? C.b + '15' : 'transparent',
              color: value === opt.id ? C.b : C.t2,
              fontFamily: F,
              fontSize: 11,
              fontWeight: value === opt.id ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.12s ease',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChartSettingsPanel({ onClose }) {
  const [tab, setTab] = useState('appearance');
  const appearance = useChartStore((s) => s.chartAppearance);
  const setAppearance = useChartStore((s) => s.setChartAppearance);
  const resetAppearance = useChartStore((s) => s.resetChartAppearance);
  const scaleMode = useChartStore((s) => s.scaleMode);
  const setScaleMode = useChartStore((s) => s.setScaleMode);
  const showMinimap = useChartStore((s) => s.showMinimap);
  const toggleMinimap = useChartStore((s) => s.toggleMinimap);
  const showStatusBar = useChartStore((s) => s.showStatusBar);
  const toggleStatusBar = useChartStore((s) => s.toggleStatusBar);
  const activePreset = useChartStore((s) => s.activePreset);
  const applyChartPreset = useChartStore((s) => s.applyChartPreset);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          marginBottom: 16,
          borderBottom: `1px solid ${C.bd}`,
          paddingBottom: 8,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: '6px 4px',
              background: tab === t.id ? C.b + '15' : 'transparent',
              border: 'none',
              borderRadius: 6,
              color: tab === t.id ? C.b : C.t2,
              fontFamily: F,
              fontSize: 11,
              fontWeight: tab === t.id ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.12s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <span style={{ fontSize: 14 }}>{TAB_ICONS[t.id]}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'appearance' && (
          <div>
            {/* Theme Preset Picker */}
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: C.t3,
                fontFamily: F,
                letterSpacing: 0.5,
                marginBottom: 6,
                textTransform: 'uppercase',
              }}
            >
              Theme
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
              {THEME_PILLS.map((tp) => (
                <button
                  key={tp.id}
                  onClick={() => applyChartPreset(tp.id)}
                  title={tp.label}
                  style={{
                    flex: 1,
                    padding: '6px 4px',
                    borderRadius: 8,
                    border: `1.5px solid ${activePreset === tp.id ? C.b : C.bd}`,
                    background: activePreset === tp.id ? C.b + '12' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', gap: 2 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: tp.colors[0] }} />
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: tp.colors[1] }} />
                  </div>
                  <span style={{
                    fontSize: 8, fontWeight: 600, fontFamily: F,
                    color: activePreset === tp.id ? C.b : C.t3,
                    letterSpacing: '0.3px',
                  }}>{tp.label}</span>
                </button>
              ))}
            </div>

            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: C.t3,
                fontFamily: F,
                letterSpacing: 0.5,
                marginBottom: 8,
                textTransform: 'uppercase',
              }}
            >
              Candle Colors
            </div>
            <ColorSwatch
              label="Up / Bullish"
              color={appearance.upColor}
              onChange={(v) => setAppearance('upColor', v)}
            />
            <ColorSwatch
              label="Down / Bearish"
              color={appearance.downColor}
              onChange={(v) => setAppearance('downColor', v)}
            />
            <ColorSwatch
              label="Up Wick"
              color={appearance.upWickColor}
              onChange={(v) => setAppearance('upWickColor', v)}
            />
            <ColorSwatch
              label="Down Wick"
              color={appearance.downWickColor}
              onChange={(v) => setAppearance('downWickColor', v)}
            />
            <RadioGroup
              label="Body Style"
              options={[
                { id: 'filled', label: 'Filled' },
                { id: 'hollow', label: 'Hollow' },
              ]}
              value={appearance.bodyStyle}
              onChange={(v) => setAppearance('bodyStyle', v)}
            />

            <div style={{ marginTop: 16 }}>
              <button
                onClick={resetAppearance}
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
                Reset to Defaults
              </button>
            </div>
          </div>
        )}

        {tab === 'grid' && (
          <div>
            <Toggle
              label="Show Grid Lines"
              checked={appearance.gridVisible}
              onChange={(v) => setAppearance('gridVisible', v)}
            />
            <RangeSlider
              label="Grid Opacity"
              value={appearance.gridOpacity}
              min={0.05}
              max={1}
              step={0.05}
              onChange={(v) => setAppearance('gridOpacity', v)}
              display={`${Math.round(appearance.gridOpacity * 100)}%`}
            />
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
              💡 Grid lines help identify price levels. Lower opacity keeps the chart clean while maintaining
              reference points.
            </div>
          </div>
        )}

        {tab === 'scale' && (
          <div>
            <RadioGroup
              label="Price Scale Mode"
              options={[
                { id: 'auto', label: 'Auto' },
                { id: 'log', label: 'Log' },
                { id: 'pct', label: '%' },
                { id: 'inverted', label: 'Inverted' },
              ]}
              value={scaleMode}
              onChange={setScaleMode}
            />

            <div
              style={{
                marginTop: 12,
                fontSize: 11,
                fontWeight: 600,
                color: C.t3,
                fontFamily: F,
                letterSpacing: 0.5,
                marginBottom: 8,
                textTransform: 'uppercase',
              }}
            >
              Layout
            </div>
            <Toggle label="Show Minimap" checked={showMinimap} onChange={toggleMinimap} />
            <Toggle label="Show Status Bar" checked={showStatusBar} onChange={toggleStatusBar} />
          </div>
        )}

        {tab === 'crosshair' && (
          <div>
            <RadioGroup
              label="Crosshair Style"
              options={[
                { id: 'cross', label: '✛ Cross' },
                { id: 'dot', label: '• Dot' },
                { id: 'line', label: '— Line' },
              ]}
              value={appearance.crosshairStyle}
              onChange={(v) => setAppearance('crosshairStyle', v)}
            />

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
              <div>
                <strong style={{ color: C.t2 }}>Cross</strong> — Full horizontal + vertical lines
              </div>
              <div>
                <strong style={{ color: C.t2 }}>Dot</strong> — Snap dot only on nearest bar
              </div>
              <div>
                <strong style={{ color: C.t2 }}>Line</strong> — Horizontal price line only
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
