// ═══════════════════════════════════════════════════════════════════
// charEdge — Appearance Section  (Sprint 4: Appearance Revolution)
// Full theme editor: Theme, Accent, Font Size, Chart Style, Density.
// ═══════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { C } from '../../../constants.js';
import { DENSITY_MODES } from '../../../state/user/densitySlice.js';
import { ACCENT_PRESETS, CHART_COLOR_PRESETS } from '../../../state/user/themeSlice';
import { useSettingsHistory } from '../../../state/useSettingsHistory.js';
import { useUserStore } from '../../../state/useUserStore';
import TFIcon from '../ui/TFIcon.jsx';
import { Card } from '../ui/UIKit.jsx';
import { SectionHeader } from './SettingsHelpers.jsx';
import s from './AppearanceSection.module.css';

// ─── Shared Styles ───────────────────────────────────────────────

function subLabel() { return { fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 4 }; }
function subHint() { return { fontSize: 11, color: C.t3, marginBottom: 16 }; }
const cardWrap = { padding: 20, marginBottom: 12 };

function SubSectionHeader({ title }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: C.t3,
      textTransform: 'uppercase', letterSpacing: 0.8,
      padding: '16px 0 6px', marginBottom: 4,
      borderBottom: `1px solid ${C.bd}15`,
    }}>
      {title}
    </div>
  );
}

// ─── Theme Picker ────────────────────────────────────────────────

function ThemePicker() {
  const theme = useUserStore((s) => s.theme);
  const setTheme = useUserStore((s) => s.setTheme);

  const options = [
    { value: 'dark', label: 'Dark', icon: 'moon', desc: 'Easy on the eyes' },
    { value: 'light', label: 'Light', icon: 'sun', desc: 'Bright & clean' },
    { value: 'deep-sea', label: 'Deep Sea', icon: 'anchor', desc: 'OLED black, warm tones' },
    { value: 'system', label: 'System', icon: 'monitor', desc: 'Follow OS' },
  ];

  return (
    <Card style={cardWrap}>
      <div style={subLabel()}>
        <TFIcon name="layers" size={14} className={s.s0} />
        Theme Mode
      </div>
      <div style={subHint()}>Choose your preferred interface theme</div>
      <div className={s.s1}>
        {options.map((opt) => {
          const active = theme === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => {
                const prev = theme;
                setTheme(opt.value);
                useSettingsHistory.getState().record({
                  store: 'user', key: 'theme',
                  label: `Theme → ${opt.label}`,
                  previousValue: prev, newValue: opt.value,
                });
              }}
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
        <TFIcon name="palette" size={14} className={s.s2} />
        Accent Color
      </div>
      <div style={subHint()}>Personalize buttons, links, and highlights</div>

      <div className={s.s3}>
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
                <span className={s.s4}>✓</span>
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
            className={s.s5}
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
        <TFIcon name="edit" size={14} className={s.s6} />
        Font Size
      </div>
      <div style={subHint()}>
        Adjust the base font size across the interface
      </div>

      <div className={s.s7}>
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
  const activePreset = CHART_COLOR_PRESETS.find((p) => p.id === chartColorPreset) || CHART_COLOR_PRESETS[0];

  return (
    <Card style={cardWrap}>
      <div style={subLabel()}>
        <TFIcon name="chart" size={14} className={s.s8} />
        Chart Colors
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          {[activePreset.bull, activePreset.bear, activePreset.bull, activePreset.bear].map((clr, i) => (
            <div key={i} style={{ width: 5, borderRadius: 1, height: [14, 18, 12, 16][i], background: clr }} />
          ))}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>Current: {activePreset.label}</div>
          <div style={{ fontSize: 11, color: C.t3 }}>🎨 Customize from the chart toolbar color picker</div>
        </div>
      </div>
    </Card>
  );
}

/** Tiny candle stick for the preview */
function MiniCandle({ color, h, body, down }) {
  const wickH = h - body;
  return (
    <div className={s.s11}>
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
        <TFIcon name="settings" size={14} className={s.s12} />
        UI Density
      </div>
      <div style={subHint()}>Controls spacing, font sizes, and control sizes across the app.</div>
      <div className={s.s13}>
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
      <div className={s.s14}>
        <div style={{ flex: 1 }}>
          <div style={subLabel()}>
            <TFIcon name="layers" size={14} className={s.s15} />
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

// ─── Keyboard Shortcuts Reference Card ───────────────────────────

const QUICK_SHORTCUTS = [
  { key: '⌘K', desc: 'AI Copilot / Command Palette' },
  { key: '?', desc: 'Full shortcuts panel' },
  { key: '1–7', desc: 'Switch pages' },
  { key: '⌘I', desc: 'Indicator panel' },
  { key: 'Esc', desc: 'Close panel / cancel' },
  { key: 'J / K', desc: 'Navigate journal trades' },
  { key: 'D', desc: 'Drawing sidebar' },
  { key: '/', desc: 'Quick symbol search' },
];

function KeyboardShortcutsCard() {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card style={cardWrap}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="tf-btn"
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 0, textAlign: 'left',
        }}
      >
        <TFIcon name="command" size={14} color={C.t3} />
        <span style={{ ...subLabel(), marginBottom: 0, flex: 1 }}>Keyboard Shortcuts</span>
        <span style={{ fontSize: 11, color: C.t3, transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'none' }}>›</span>
      </button>
      {expanded && (
        <div style={{ marginTop: 12 }}>
          {QUICK_SHORTCUTS.map((sc) => (
            <div key={sc.key} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 0', borderBottom: `1px solid ${C.bd}08`,
            }}>
              <span style={{ fontSize: 11, color: C.t2 }}>{sc.desc}</span>
              <span style={{
                fontSize: 10, fontWeight: 600, color: C.t2,
                padding: '2px 7px', borderRadius: 4,
                background: C.bg2, border: `1px solid ${C.bd}`,
                fontFamily: "'JetBrains Mono', monospace",
              }}>{sc.key}</span>
            </div>
          ))}
          <div style={{ fontSize: 10, color: C.t3, marginTop: 8, fontStyle: 'italic' }}>
            Press <strong>?</strong> anywhere to see all shortcuts
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Reset to Defaults ───────────────────────────────────────────

function ResetDefaultsButton() {
  const resetSettings = useUserStore((s) => s.resetSettings);
  const handleReset = () => {
    if (window.confirm('Reset all appearance settings to defaults? This will reset your theme, accent color, font size, chart colors, and density.')) {
      resetSettings();
    }
  };
  return (
    <div style={{ textAlign: 'center', paddingTop: 8 }}>
      <button
        onClick={handleReset}
        className="tf-btn"
        style={{
          padding: '8px 20px', borderRadius: 8,
          border: `1px solid ${C.bd}`, background: 'transparent',
          color: C.t3, fontSize: 11, fontWeight: 600,
          cursor: 'pointer', transition: 'all 0.15s ease',
        }}
      >
        ↺ Reset to Defaults
      </button>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────

function AppearanceSection() {
  return (
    <section style={{ marginBottom: 40 }}>
      <SectionHeader icon="palette" title="Appearance" description="Customize how the interface looks and feels" />
      <SimpleModePicker />

      <SubSectionHeader title="Look & Feel" />
      <ThemePicker />
      <AccentColorPicker />
      <ChartStylePicker />

      <SubSectionHeader title="Display" />
      <FontSizeSlider />

      <SubSectionHeader title="Layout" />
      <DensityPicker />

      <SubSectionHeader title="Reference" />
      <KeyboardShortcutsCard />

      <ResetDefaultsButton />
    </section>
  );
}

export default React.memo(AppearanceSection);
