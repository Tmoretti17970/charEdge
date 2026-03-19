// ═══════════════════════════════════════════════════════════════════
// charEdge — Theme Editor Panel (Sprint 7)
//
// Full theme customization:
//   - Accent color picker (8 presets + custom hex)
//   - Chart color scheme (bullish/bearish pairs)
//   - Live preview swatch
//   - Font size scale slider
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';
import { radii, transition } from '../../../theme/tokens.js';
import { Card } from '../ui/UIKit.jsx';
import { toast } from '../ui/Toast.jsx';

const ACCENT_COLORS = [
  { id: 'blue',    hex: '#228BE6', label: 'Ocean' },
  { id: 'violet',  hex: '#7C3AED', label: 'Violet' },
  { id: 'rose',    hex: '#E11D48', label: 'Rose' },
  { id: 'orange',  hex: '#E8590C', label: 'Ember' },
  { id: 'green',   hex: '#16A34A', label: 'Forest' },
  { id: 'cyan',    hex: '#06B6D4', label: 'Cyan' },
  { id: 'amber',   hex: '#D97706', label: 'Amber' },
  { id: 'pink',    hex: '#EC4899', label: 'Pink' },
];

const CHART_SCHEMES = [
  { id: 'classic',   bull: '#22C55E', bear: '#EF4444', label: 'Classic' },
  { id: 'ocean',     bull: '#06B6D4', bear: '#F97316', label: 'Ocean' },
  { id: 'monochrome',bull: '#94A3B8', bear: '#475569', label: 'Mono' },
  { id: 'neon',      bull: '#4ADE80', bear: '#FB7185', label: 'Neon' },
];

const FONT_SCALES = [
  { value: 0.85, label: 'Compact' },
  { value: 0.92, label: 'Small' },
  { value: 1.0,  label: 'Default' },
  { value: 1.1,  label: 'Large' },
  { value: 1.25, label: 'X-Large' },
];

function ThemeEditorPanel() {
  const settings = useUserStore((s) => s.settings) || {};

  const [accentColor, setAccentColor] = useState(settings.accentColor || 'blue');
  const [customHex, setCustomHex] = useState(settings.customAccentHex || '');
  const [chartScheme, setChartScheme] = useState(settings.chartScheme || 'classic');
  const [fontScale, setFontScale] = useState(settings.fontScale || 1.0);

  const updateSetting = useUserStore((s) => s.updateSettings);

  const handleAccentChange = useCallback((id, hex) => {
    setAccentColor(id);
    if (typeof updateSetting === 'function') {
      updateSetting({ accentColor: id, customAccentHex: hex });
    }
    toast.success(`Accent: ${ACCENT_COLORS.find(c => c.id === id)?.label || id}`);
  }, [updateSetting]);

  const handleChartSchemeChange = useCallback((id) => {
    setChartScheme(id);
    if (typeof updateSetting === 'function') {
      updateSetting({ chartScheme: id });
    }
  }, [updateSetting]);

  const handleFontScaleChange = useCallback((value) => {
    setFontScale(value);
    if (typeof updateSetting === 'function') {
      updateSetting({ fontScale: value });
    }
  }, [updateSetting]);

  const selectedAccent = ACCENT_COLORS.find(c => c.id === accentColor)?.hex || customHex || '#228BE6';
  const selectedScheme = CHART_SCHEMES.find(s => s.id === chartScheme) || CHART_SCHEMES[0];

  return (
    <div style={{ marginTop: 16 }}>
      {/* Accent Color */}
      <Card style={{ padding: 20, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 4 }}>
          Accent Color
        </div>
        <div style={{ fontSize: 11, color: C.t3, fontFamily: F, marginBottom: 14 }}>
          Applied to buttons, links, and active states
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {ACCENT_COLORS.map((color) => (
            <button
              key={color.id}
              onClick={() => handleAccentChange(color.id, color.hex)}
              className="tf-btn"
              title={color.label}
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: color.hex,
                border: `2px solid ${accentColor === color.id ? '#fff' : 'transparent'}`,
                boxShadow: accentColor === color.id ? `0 0 0 2px ${color.hex}` : 'none',
                cursor: 'pointer',
                transition: `all ${transition.base}`,
              }}
            />
          ))}
        </div>

        {/* Custom hex */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="color"
            value={customHex || selectedAccent}
            onChange={(e) => {
              setCustomHex(e.target.value);
              setAccentColor('custom');
              if (typeof updateSetting === 'function') {
                updateSetting({ accentColor: 'custom', customAccentHex: e.target.value });
              }
            }}
            style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
          />
          <span style={{ fontSize: 11, color: C.t3, fontFamily: M }}>Custom color</span>
        </div>
      </Card>

      {/* Chart Colors */}
      <Card style={{ padding: 20, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 4 }}>
          Chart Color Scheme
        </div>
        <div style={{ fontSize: 11, color: C.t3, fontFamily: F, marginBottom: 14 }}>
          Bullish & bearish candle colors
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {CHART_SCHEMES.map((scheme) => (
            <button
              key={scheme.id}
              onClick={() => handleChartSchemeChange(scheme.id)}
              className="tf-btn"
              style={{
                flex: 1, padding: '10px 8px',
                borderRadius: radii.sm,
                border: `2px solid ${chartScheme === scheme.id ? selectedAccent : C.bd + '30'}`,
                background: chartScheme === scheme.id ? selectedAccent + '08' : 'transparent',
                cursor: 'pointer',
                transition: `all ${transition.base}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 6 }}>
                <div style={{ width: 8, height: 20, borderRadius: 2, background: scheme.bull }} />
                <div style={{ width: 8, height: 14, borderRadius: 2, background: scheme.bear }} />
                <div style={{ width: 8, height: 18, borderRadius: 2, background: scheme.bull }} />
                <div style={{ width: 8, height: 12, borderRadius: 2, background: scheme.bear }} />
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: C.t2, fontFamily: F }}>
                {scheme.label}
              </div>
            </button>
          ))}
        </div>
      </Card>

      {/* Font Scale */}
      <Card style={{ padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F, marginBottom: 4 }}>
          Font Size
        </div>
        <div style={{ fontSize: 11, color: C.t3, fontFamily: F, marginBottom: 14 }}>
          Global text size multiplier
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {FONT_SCALES.map((scale) => (
            <button
              key={scale.value}
              onClick={() => handleFontScaleChange(scale.value)}
              className="tf-btn"
              style={{
                flex: 1, padding: '8px 4px',
                borderRadius: radii.sm,
                border: `1px solid ${fontScale === scale.value ? selectedAccent : C.bd + '30'}`,
                background: fontScale === scale.value ? selectedAccent + '10' : 'transparent',
                color: fontScale === scale.value ? selectedAccent : C.t3,
                fontSize: 10, fontWeight: 600, fontFamily: F,
                cursor: 'pointer',
                transition: `all ${transition.base}`,
              }}
            >
              {scale.label}
            </button>
          ))}
        </div>

        {/* Preview */}
        <div style={{
          marginTop: 12, padding: 10, borderRadius: radii.sm,
          background: C.bd + '08', fontSize: 12 * fontScale, color: C.t2, fontFamily: F,
        }}>
          Preview text at {Math.round(fontScale * 100)}% size
        </div>
      </Card>
    </div>
  );
}

export default React.memo(ThemeEditorPanel);
