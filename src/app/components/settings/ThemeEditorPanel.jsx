// ═══════════════════════════════════════════════════════════════════
// charEdge — Theme Editor Panel (Sprint 7)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import { C } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';
import { Card } from '../ui/UIKit.jsx';
import { toast } from '../ui/Toast.jsx';
import st from './ThemeEditorPanel.module.css';

const ACCENT_COLORS = [
  { id: 'blue', hex: '#228BE6', label: 'Ocean' },
  { id: 'violet', hex: '#7C3AED', label: 'Violet' },
  { id: 'rose', hex: '#E11D48', label: 'Rose' },
  { id: 'orange', hex: '#E8590C', label: 'Ember' },
  { id: 'green', hex: '#16A34A', label: 'Forest' },
  { id: 'cyan', hex: '#06B6D4', label: 'Cyan' },
  { id: 'amber', hex: '#D97706', label: 'Amber' },
  { id: 'pink', hex: '#EC4899', label: 'Pink' },
];

const CHART_SCHEMES = [
  { id: 'classic', bull: '#22C55E', bear: '#EF4444', label: 'Classic' },
  { id: 'ocean', bull: '#06B6D4', bear: '#F97316', label: 'Ocean' },
  { id: 'monochrome', bull: '#94A3B8', bear: '#475569', label: 'Mono' },
  { id: 'neon', bull: '#4ADE80', bear: '#FB7185', label: 'Neon' },
];

const FONT_SCALES = [
  { value: 0.85, label: 'Compact' }, { value: 0.92, label: 'Small' },
  { value: 1.0, label: 'Default' }, { value: 1.1, label: 'Large' },
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
    if (typeof updateSetting === 'function') updateSetting({ accentColor: id, customAccentHex: hex });
    toast.success(`Accent: ${ACCENT_COLORS.find(c => c.id === id)?.label || id}`);
  }, [updateSetting]);

  const handleChartSchemeChange = useCallback((id) => {
    setChartScheme(id);
    if (typeof updateSetting === 'function') updateSetting({ chartScheme: id });
  }, [updateSetting]);

  const handleFontScaleChange = useCallback((value) => {
    setFontScale(value);
    if (typeof updateSetting === 'function') updateSetting({ fontScale: value });
  }, [updateSetting]);

  const selectedAccent = ACCENT_COLORS.find(c => c.id === accentColor)?.hex || customHex || '#228BE6';
  const selectedScheme = CHART_SCHEMES.find(s => s.id === chartScheme) || CHART_SCHEMES[0];

  return (
    <div className={st.root}>
      {/* Accent Color */}
      <Card className={st.cardPad}>
        <div className={st.cardTitle}>Accent Color</div>
        <div className={st.cardHint}>Applied to buttons, links, and active states</div>
        <div className={st.swatchRow}>
          {ACCENT_COLORS.map((color) => (
            <button key={color.id} onClick={() => handleAccentChange(color.id, color.hex)}
              className={`tf-btn ${st.accentSwatch}`} title={color.label}
              style={{
                background: color.hex,
                border: `2px solid ${accentColor === color.id ? '#fff' : 'transparent'}`,
                boxShadow: accentColor === color.id ? `0 0 0 2px ${color.hex}` : 'none',
              }} />
          ))}
        </div>
        <div className={st.customRow}>
          <input type="color" value={customHex || selectedAccent} className={st.colorInput}
            onChange={(e) => { setCustomHex(e.target.value); setAccentColor('custom'); if (typeof updateSetting === 'function') updateSetting({ accentColor: 'custom', customAccentHex: e.target.value }); }} />
          <span className={st.customLabel}>Custom color</span>
        </div>
      </Card>

      {/* Chart Colors */}
      <Card className={st.cardPad}>
        <div className={st.cardTitle}>Chart Color Scheme</div>
        <div className={st.cardHint}>Bullish & bearish candle colors</div>
        <div className={st.schemeRow}>
          {CHART_SCHEMES.map((scheme) => (
            <button key={scheme.id} onClick={() => handleChartSchemeChange(scheme.id)}
              className={`tf-btn ${st.schemeBtn}`}
              style={{
                border: `2px solid ${chartScheme === scheme.id ? selectedAccent : C.bd + '30'}`,
                background: chartScheme === scheme.id ? selectedAccent + '08' : 'transparent',
              }}>
              <div className={st.candlePreview}>
                <div className={st.candle} style={{ height: 20, background: scheme.bull }} />
                <div className={st.candle} style={{ height: 14, background: scheme.bear }} />
                <div className={st.candle} style={{ height: 18, background: scheme.bull }} />
                <div className={st.candle} style={{ height: 12, background: scheme.bear }} />
              </div>
              <div className={st.schemeLabel}>{scheme.label}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* Font Scale */}
      <Card className={st.cardPadLast}>
        <div className={st.cardTitle}>Font Size</div>
        <div className={st.cardHint}>Global text size multiplier</div>
        <div className={st.scaleRow}>
          {FONT_SCALES.map((scale) => (
            <button key={scale.value} onClick={() => handleFontScaleChange(scale.value)}
              className={`tf-btn ${st.scaleBtn}`}
              style={{
                border: `1px solid ${fontScale === scale.value ? selectedAccent : C.bd + '30'}`,
                background: fontScale === scale.value ? selectedAccent + '10' : 'transparent',
                color: fontScale === scale.value ? selectedAccent : C.t3,
              }}>
              {scale.label}
            </button>
          ))}
        </div>
        <div className={st.previewBox}
          style={{ background: C.bd + '08', fontSize: 12 * fontScale }}>
          Preview text at {Math.round(fontScale * 100)}% size
        </div>
      </Card>
    </div>
  );
}

export default React.memo(ThemeEditorPanel);
