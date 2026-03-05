// ═══════════════════════════════════════════════════════════════════
// charEdge — Appearance Section  (Sprint 4: Appearance Revolution)
// Full theme editor: Theme, Accent, Font Size, Chart Style, Density.
// ═══════════════════════════════════════════════════════════════════

import { useUserStore } from '../../../state/useUserStore.js';
import { useState } from 'react';
import { C } from '../../../constants.js';
import { Card } from '../ui/UIKit.jsx';
import { DENSITY_MODES } from '../../../state/user/densitySlice.js';
import { ACCENT_PRESETS, CHART_COLOR_PRESETS } from '../../../state/user/themeSlice.js';
import TFIcon from '../ui/TFIcon.jsx';
import { SectionHeader } from './SettingsHelpers.jsx';

// ─── Shared Styles ───────────────────────────────────────────────

function subLabel() { return { fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 4 }; }
function subHint() { return { fontSize: 11, color: C.t3, marginBottom: 16 }; }
const cardWrap = { padding: 20, marginBottom: 12 };

// ─── Theme Picker ────────────────────────────────────────────────

function ThemePicker() {
  const theme = useUserStore((s) => s.theme);
  const setTheme = useUserStore((s) => s.setTheme);

  const options = [
    { value: 'dark', label: 'Dark', icon: 'moon', desc: 'Easy on the eyes' },
    { value: 'light', label: 'Light', icon: 'sun', desc: 'Bright & clean' },
    { value: 'system', label: 'System', icon: 'monitor', desc: 'Follow OS' },
  ];

  return (
    <Card style={cardWrap}>
      <div style={subLabel()}>
        <TFIcon name="layers" size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
        Theme Mode
      </div>
      <div style={subHint()}>Choose your preferred interface theme</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {options.map((opt) => {
          const active = theme === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className="tf-btn"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '16px 10px', borderRadius: 10,
                border: `1.5px solid ${active ? C.b : C.bd}`,
                background: active ? C.b + '12' : 'transparent',
                cursor: 'pointer', textAlign: 'center',
              }}
            >
              <TFIcon name={opt.icon} size={22} color={active ? C.b : C.t2} />
              <span style={{ fontSize: 12, fontWeight: 700, color: active ? C.b : C.t1 }}>{opt.label}</span>
              <span style={{ fontSize: 10, color: C.t3, lineHeight: 1.3 }}>{opt.desc}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Accent Color Picker ─────────────────────────────────────────

function AccentColorPicker() {
  const accentColor = useUserStore((s) => s.accentColor);
  const setAccentColor = useUserStore((s) => s.setAccentColor);
  const [customHex, setCustomHex] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const handleCustomSubmit = () => {
    const hex = customHex.startsWith('#') ? customHex : `#${customHex}`;
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      setAccentColor(hex);
      setShowCustom(false);
    }
  };

  return (
    <Card style={cardWrap}>
      <div style={subLabel()}>
        <TFIcon name="palette" size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
        Accent Color
      </div>
      <div style={subHint()}>Personalize buttons, links, and highlights</div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        {ACCENT_PRESETS.map((preset) => {
          const active = accentColor === preset.hex;
          return (
            <button
              key={preset.id}
              onClick={() => setAccentColor(preset.hex)}
              title={preset.label}
              className="tf-btn"
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: preset.hex,
                border: `2.5px solid ${active ? '#fff' : 'transparent'}`,
                boxShadow: active ? `0 0 0 2px ${preset.hex}, 0 2px 8px ${preset.hex}40` : 'none',
                cursor: 'pointer', position: 'relative',
                transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
              }}
            >
              {active && (
                <span style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 14, fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                }}>✓</span>
              )}
            </button>
          );
        })}

        {/* Custom hex button */}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="tf-btn"
          title="Custom color"
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: !ACCENT_PRESETS.some((p) => p.hex === accentColor)
              ? accentColor
              : `conic-gradient(from 0deg, #e8642c, #f0b64e, #2dd4a0, #22d3ee, #c084fc, #f472b6, #e8642c)`,
            border: `2.5px solid ${!ACCENT_PRESETS.some((p) => p.hex === accentColor) ? '#fff' : 'transparent'}`,
            cursor: 'pointer', fontSize: 14, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {showCustom ? '×' : '+'}
        </button>
      </div>

      {showCustom && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px', borderRadius: 8,
          background: C.sf2, border: `1px solid ${C.bd}`,
        }}>
          <input
            type="color"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            style={{ width: 32, height: 32, border: 'none', cursor: 'pointer', background: 'none', padding: 0 }}
          />
          <input
            type="text"
            placeholder="#e8642c"
            value={customHex}
            onChange={(e) => setCustomHex(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
            maxLength={7}
            style={{
              flex: 1, padding: '6px 10px', borderRadius: 6,
              background: C.bg2, border: `1px solid ${C.bd}`,
              color: C.t1, fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
              outline: 'none',
            }}
          />
          <button
            onClick={handleCustomSubmit}
            className="tf-btn"
            style={{
              padding: '6px 14px', borderRadius: 6,
              background: C.b, color: '#fff', border: 'none',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Apply
          </button>
        </div>
      )}
    </Card>
  );
}

// ─── Font Size Slider ────────────────────────────────────────────

function FontSizeSlider() {
  const fontSize = useUserStore((s) => s.fontSize);
  const setFontSize = useUserStore((s) => s.setFontSize);

  return (
    <Card style={cardWrap}>
      <div style={subLabel()}>
        <TFIcon name="edit" size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
        Font Size
      </div>
      <div style={subHint()}>
        Adjust the base font size across the interface
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 11, color: C.t3, fontFamily: "'JetBrains Mono', monospace", minWidth: 28 }}>
          A<span style={{ fontSize: 9 }}>a</span>
        </span>

        <input
          type="range"
          min={12}
          max={18}
          step={1}
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="tf-range-slider"
          style={{ flex: 1, accentColor: C.b }}
        />

        <span style={{ fontSize: 16, color: C.t1, fontFamily: "'JetBrains Mono', monospace", minWidth: 28, fontWeight: 600 }}>
          A<span style={{ fontSize: 13 }}>a</span>
        </span>
      </div>

      <div style={{
        textAlign: 'center', marginTop: 10,
        fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: C.t2,
      }}>
        {fontSize}px
      </div>

      {/* Live preview */}
      <div style={{
        marginTop: 12, padding: '12px 14px', borderRadius: 8,
        background: C.bg2, border: `1px solid ${C.bd}`,
      }}>
        <div style={{ fontSize: fontSize, color: C.t1, marginBottom: 4 }}>
          The quick brown fox jumps over the lazy dog
        </div>
        <div style={{ fontSize: Math.max(10, fontSize - 2), color: C.t3 }}>
          0123456789 · OHLCV · $4,521.30
        </div>
      </div>
    </Card>
  );
}

// ─── Chart Color Style ───────────────────────────────────────────

function ChartStylePicker() {
  const chartColorPreset = useUserStore((s) => s.chartColorPreset);
  const setChartColorPreset = useUserStore((s) => s.setChartColorPreset);

  return (
    <Card style={cardWrap}>
      <div style={subLabel()}>
        <TFIcon name="chart" size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
        Chart Colors
      </div>
      <div style={subHint()}>Choose candle color styling for charts</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8 }}>
        {CHART_COLOR_PRESETS.map((preset) => {
          const active = chartColorPreset === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => setChartColorPreset(preset.id)}
              className="tf-btn"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '14px 8px', borderRadius: 10,
                border: `1.5px solid ${active ? C.b : C.bd}`,
                background: active ? C.b + '10' : 'transparent',
                cursor: 'pointer',
              }}
            >
              {/* Mini candle preview */}
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 28 }}>
                <MiniCandle color={preset.bull} h={20} body={12} />
                <MiniCandle color={preset.bear} h={24} body={16} down />
                <MiniCandle color={preset.bull} h={18} body={10} />
                <MiniCandle color={preset.bear} h={22} body={14} down />
                <MiniCandle color={preset.bull} h={26} body={18} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: active ? C.b : C.t2 }}>
                {preset.label}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/** Tiny candle stick for the preview */
function MiniCandle({ color, h, body, down }) {
  const wickH = h - body;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      width: 6,
    }}>
      {!down && <div style={{ width: 1, height: wickH, background: color, opacity: 0.6 }} />}
      <div style={{
        width: 6, height: body, borderRadius: 1,
        background: down ? 'transparent' : color,
        border: down ? `1px solid ${color}` : 'none',
      }} />
      {down && <div style={{ width: 1, height: wickH, background: color, opacity: 0.6 }} />}
    </div>
  );
}

// ─── Density Picker (existing) ───────────────────────────────────

function DensityPicker() {
  const densityMode = useUserStore((s) => s.mode);
  const activeDensity = useUserStore((s) => s.activeDensity);
  const setMode = useUserStore((s) => s.setMode);

  const options = [
    { value: 'auto', label: 'Auto', icon: 'layers', hint: `Detected: ${activeDensity}` },
    { value: DENSITY_MODES.COMFORTABLE, label: 'Comfortable', icon: 'grid', hint: 'Larger controls, more whitespace' },
    { value: DENSITY_MODES.STANDARD, label: 'Standard', icon: 'layout', hint: 'Balanced density' },
    { value: DENSITY_MODES.COMPACT, label: 'Compact', icon: 'minimize', hint: 'Dense info, smaller controls' },
  ];

  return (
    <Card style={cardWrap}>
      <div style={subLabel()}>
        <TFIcon name="settings" size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
        UI Density
      </div>
      <div style={subHint()}>Controls spacing, font sizes, and control sizes across the app.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        {options.map((opt) => {
          const isActive = densityMode === opt.value;
          return (
            <button key={opt.value} onClick={() => setMode(opt.value)} className="tf-btn"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '14px 10px', borderRadius: 10,
                border: `1.5px solid ${isActive ? C.b : C.bd}`,
                background: isActive ? C.b + '10' : 'transparent',
                cursor: 'pointer', textAlign: 'center',
              }}>
              <TFIcon name={opt.icon} size={20} color={isActive ? C.b : C.t2} />
              <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? C.b : C.t1 }}>{opt.label}</span>
              <span style={{ fontSize: 10, color: C.t3, lineHeight: 1.3 }}>{opt.hint}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Simple Mode Toggle ──────────────────────────────────────────

function SimpleModePicker() {
  const simpleMode = useUserStore((s) => s.simpleMode);
  const update = useUserStore((s) => s.update);

  return (
    <Card style={cardWrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={subLabel()}>
            <TFIcon name="layers" size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            Simple Mode
          </div>
          <div style={{ fontSize: 11, color: C.t3, lineHeight: 1.5 }}>
            Hide advanced features like gamification, Smart Insights, and detailed analytics. Perfect for focused trading.
          </div>
        </div>
        <button
          id="simple-mode-toggle"
          onClick={() => update({ simpleMode: !simpleMode })}
          role="switch"
          aria-checked={simpleMode}
          aria-label="Toggle Simple Mode"
          className="tf-btn"
          style={{
            width: 48, height: 26, borderRadius: 13,
            background: simpleMode ? C.b : C.bd,
            border: 'none', cursor: 'pointer',
            position: 'relative', flexShrink: 0,
            transition: 'background 0.2s ease',
          }}
        >
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            background: '#fff',
            position: 'absolute', top: 3,
            left: simpleMode ? 25 : 3,
            transition: 'left 0.2s ease',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>
    </Card>
  );
}

// ─── Main Export ─────────────────────────────────────────────────

export default function AppearanceSection() {
  return (
    <section style={{ marginBottom: 40 }}>
      <SectionHeader icon="palette" title="Appearance" description="Customize how the interface looks and feels" />
      <SimpleModePicker />
      <ThemePicker />
      <AccentColorPicker />
      <FontSizeSlider />
      <ChartStylePicker />
      <DensityPicker />
    </section>
  );
}
