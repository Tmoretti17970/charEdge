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

// subLabel, subHint, cardWrap now in CSS module

function SubSectionHeader({ title }) {
  return <div className={s.subSectionHeader}>{title}</div>;
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
    <Card className={s.cardWrap}>
      <div className={s.subLabel}>
        <TFIcon name="layers" size={14} className={s.s0} />
        Theme Mode
      </div>
      <div className={s.subHint}>Choose your preferred interface theme</div>
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
              className={`tf-btn ${s.optionBtn}`}
              data-active={active ? 'true' : undefined}
            >
              <TFIcon name={opt.icon} size={22} color={active ? C.b : C.t2} />
              <span className={s.optionLabel} data-active={active ? 'true' : undefined}>{opt.label}</span>
              <span className={s.optionHint}>{opt.desc}</span>
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
    <Card className={s.cardWrap}>
      <div className={s.subLabel}>
        <TFIcon name="palette" size={14} className={s.s2} />
        Accent Color
      </div>
      <div className={s.subHint}>Personalize buttons, links, and highlights</div>

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
        <div className={s.customHexRow}>
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
            className={s.hexInput}
          />
          <button
            onClick={handleCustomSubmit}
            className={`tf-btn ${s.applyBtn}`}
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
    <Card className={s.cardWrap}>
      <div className={s.subLabel}>
        <TFIcon name="edit" size={14} className={s.s6} />
        Font Size
      </div>
      <div className={s.subHint}>
        Adjust the base font size across the interface
      </div>

      <div className={s.s7}>
        <span className={s.sliderSmall}>
          A<span className={s.sliderSmallSub}>a</span>
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

        <span className={s.sliderLarge}>
          A<span className={s.sliderLargeSub}>a</span>
        </span>
      </div>

      <div className={s.sliderDisplay}>
        {fontSize}px
      </div>

      {/* Live preview */}
      <div className={s.livePreview}>
        <div style={{ fontSize: fontSize, color: C.t1, marginBottom: 4 }}>
          The quick brown fox jumps over the lazy dog
        </div>
        <div style={{ fontSize: Math.max(10, fontSize - 2) }} className={s.previewSub}>
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
    <Card className={s.cardWrap}>
      <div className={s.subLabel}>
        <TFIcon name="chart" size={14} className={s.s8} />
        Chart Colors
      </div>
      <div className={s.chartInfoRow}>
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          {[activePreset.bull, activePreset.bear, activePreset.bull, activePreset.bear].map((clr, i) => (
            <div key={i} style={{ width: 5, borderRadius: 1, height: [14, 18, 12, 16][i], background: clr }} />
          ))}
        </div>
        <div>
          <div className={s.chartInfoLabel}>Current: {activePreset.label}</div>
          <div className={s.chartInfoHint}>🎨 Customize from the chart toolbar color picker</div>
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
    <Card className={s.cardWrap}>
      <div className={s.subLabel}>
        <TFIcon name="settings" size={14} className={s.s12} />
        UI Density
      </div>
      <div className={s.subHint}>Controls spacing, font sizes, and control sizes across the app.</div>
      <div className={s.s13}>
        {options.map((opt) => {
          const isActive = densityMode === opt.value;
          return (
            <button key={opt.value} onClick={() => setMode(opt.value)}
              className={`tf-btn ${s.densityBtn}`}
              data-active={isActive ? 'true' : undefined}>
              <TFIcon name={opt.icon} size={20} color={isActive ? C.b : C.t2} />
              <span className={s.optionLabel} data-active={isActive ? 'true' : undefined}>{opt.label}</span>
              <span className={s.optionHint}>{opt.hint}</span>
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
    <Card className={s.cardWrap}>
      <div className={s.s14}>
        <div style={{ flex: 1 }}>
          <div className={s.subLabel}>
            <TFIcon name="layers" size={14} className={s.s15} />
            Simple Mode
          </div>
          <div className={s.simpleDesc}>
            Hide advanced features like gamification, Smart Insights, and detailed analytics. Perfect for focused trading.
          </div>
        </div>
        <button
          id="simple-mode-toggle"
          onClick={() => update({ simpleMode: !simpleMode })}
          role="switch"
          aria-checked={simpleMode}
          aria-label="Toggle Simple Mode"
          className={`tf-btn ${s.toggleTrack}`}
          data-on={simpleMode ? 'true' : undefined}
        >
          <div className={s.toggleKnob} />
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
    <Card className={s.cardWrap}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`tf-btn ${s.shortcutHeader}`}
      >
        <TFIcon name="command" size={14} color={C.t3} />
        <span className={s.shortcutLabel}>Keyboard Shortcuts</span>
        <span className={s.shortcutArrow} data-open={expanded ? 'true' : undefined}>›</span>
      </button>
      {expanded && (
        <div className={s.shortcutList}>
          {QUICK_SHORTCUTS.map((sc) => (
            <div key={sc.key} className={s.shortcutRow}>
              <span className={s.shortcutDesc}>{sc.desc}</span>
              <span className={s.kbd}>{sc.key}</span>
            </div>
          ))}
          <div className={s.shortcutHint}>
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
    <div className={s.resetWrap}>
      <button
        onClick={handleReset}
        className={`tf-btn ${s.resetBtn}`}
      >
        ↺ Reset to Defaults
      </button>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────

function AppearanceSection() {
  return (
    <section className={s.sectionWrap}>
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
