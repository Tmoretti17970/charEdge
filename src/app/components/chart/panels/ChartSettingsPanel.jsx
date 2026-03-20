import { useState } from 'react';
import { CHART_TYPES, getChartTypeDefaults } from '../../../../charting_library/renderers/renderers/ChartTypes.js';
import { C, F } from '@/constants.js';
import { ColorSwatch, Toggle, RangeSlider, RadioGroup } from '../../settings/SettingsControls.jsx';
import { useChartCoreStore } from '../../../../state/chart/useChartCoreStore';
import { useChartFeaturesStore } from '../../../../state/chart/useChartFeaturesStore';
import s from './ChartSettingsPanel.module.css';

// SVG Tab Icons
const TabIcon = ({ children }) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ display: 'block' }}>{children}</svg>;

const TAB_ICONS = {
  appearance: <TabIcon><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.2" fill="none" /><circle cx="5.5" cy="6" r="1.2" fill="currentColor" opacity="0.6" /><circle cx="8.5" cy="6" r="1.2" fill="currentColor" opacity="0.6" /><circle cx="7" cy="9" r="1.2" fill="currentColor" opacity="0.6" /></TabIcon>,
  grid: <TabIcon><line x1="1" y1="4.5" x2="13" y2="4.5" stroke="currentColor" strokeWidth="0.8" opacity="0.5" /><line x1="1" y1="9.5" x2="13" y2="9.5" stroke="currentColor" strokeWidth="0.8" opacity="0.5" /><line x1="4.5" y1="1" x2="4.5" y2="13" stroke="currentColor" strokeWidth="0.8" opacity="0.5" /><line x1="9.5" y1="1" x2="9.5" y2="13" stroke="currentColor" strokeWidth="0.8" opacity="0.5" /><rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" /></TabIcon>,
  scale: <TabIcon><line x1="2" y1="12" x2="12" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><line x1="12" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 1.5" opacity="0.5" /></TabIcon>,
  crosshair: <TabIcon><line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="1" opacity="0.6" /><line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1" opacity="0.6" /><circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" fill="none" /></TabIcon>,
  chartType: <TabIcon><rect x="2" y="3" width="3" height="8" rx="0.5" fill="currentColor" opacity="0.7" /><rect x="6" y="5" width="3" height="6" rx="0.5" fill="currentColor" opacity="0.5" /><rect x="10" y="4" width="3" height="7" rx="0.5" fill="currentColor" opacity="0.6" /></TabIcon>,
};

const TABS = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'grid', label: 'Grid' },
  { id: 'scale', label: 'Scale' },
  { id: 'crosshair', label: 'Crosshair' },
  { id: 'chartType', label: 'Chart Type' },
];

// Theme preset display config
const THEME_PILLS = [
  { id: 'default', label: 'Default', colors: ['#26A69A', '#EF5350'] },
  { id: 'midnight', label: 'Midnight', colors: ['#5C6BC0', '#EC407A'] },
  { id: 'ocean', label: 'Ocean', colors: ['#00BCD4', '#FF7043'] },
  { id: 'terminal', label: 'Terminal', colors: ['#00E676', '#FF1744'] },
  { id: 'monochrome', label: 'Mono', colors: ['#B0BEC5', '#546E7A'] },
];

export default function ChartSettingsPanel({ _onClose }) {
  const [tab, setTab] = useState('appearance');
  const appearance = useChartFeaturesStore((s) => s.chartAppearance);
  const setAppearance = useChartFeaturesStore((s) => s.setChartAppearance);
  const resetAppearance = useChartFeaturesStore((s) => s.resetChartAppearance);
  const scaleMode = useChartCoreStore((s) => s.scaleMode);
  const setScaleMode = useChartCoreStore((s) => s.setScaleMode);
  const showMinimap = useChartFeaturesStore((s) => s.showMinimap);
  const toggleMinimap = useChartFeaturesStore((s) => s.toggleMinimap);
  const showStatusBar = useChartFeaturesStore((s) => s.showStatusBar);
  const toggleStatusBar = useChartFeaturesStore((s) => s.toggleStatusBar);
  const activePreset = useChartFeaturesStore((s) => s.activePreset);
  const applyChartPreset = useChartFeaturesStore((s) => s.applyChartPreset);
  // Sprint 15: Chart type config
  const chartType = useChartCoreStore((s) => s.chartType) || 'candlestick';
  const chartTypeConfig = useChartFeaturesStore((s) => s.chartTypeConfig) || {};
  const setChartTypeConfig = useChartFeaturesStore((s) => s.setChartTypeConfig);
  const resetChartTypeConfig = useChartFeaturesStore((s) => s.resetChartTypeConfig);
  const showCrosshairTooltip = useChartFeaturesStore((s) => s.showCrosshairTooltip);
  const toggleCrosshairTooltip = useChartFeaturesStore((s) => s.toggleCrosshairTooltip);

  return (
    <div className={s.root}>
      {/* Tabs */}
      <div className={s.tabRow}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={s.tab}
            data-active={tab === t.id || undefined}
          >
            <span className={s.tabIcon}>{TAB_ICONS[t.id]}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className={s.tabContent}>
        {tab === 'appearance' && (
          <div>
            {/* Theme Preset Picker */}
            <div className={s.sectionLabel} style={{ marginBottom: 6 }}>Theme</div>
            <div className={s.themeRow}>
              {THEME_PILLS.map((tp) => (
                <button
                  key={tp.id}
                  onClick={() => applyChartPreset(tp.id)}
                  title={tp.label}
                  className={s.themePill}
                  style={{
                    border: `1.5px solid ${activePreset === tp.id ? C.b : C.bd}`,
                    background: activePreset === tp.id ? C.b + '12' : 'transparent',
                  }}
                >
                  <div className={s.themeDots}>
                    <div className={s.themeDot} style={{ background: tp.colors[0] }} />
                    <div className={s.themeDot} style={{ background: tp.colors[1] }} />
                  </div>
                  <span className={s.themeLabel} style={{ color: activePreset === tp.id ? C.b : C.t3 }}>{tp.label}</span>
                </button>
              ))}
            </div>

            <div className={s.sectionLabel}>Candle Colors</div>
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

            <div className={s.resetWrap}>
              <button onClick={resetAppearance} className={s.resetBtn}>
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
            <div className={s.infoBox}>
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

            <div className={s.sectionLabel} style={{ marginTop: 12 }}>Layout</div>
            <Toggle label="Show Minimap" checked={showMinimap} onChange={toggleMinimap} />
            <Toggle label="Show Status Bar" checked={showStatusBar} onChange={toggleStatusBar} />
          </div>
        )}

        {tab === 'crosshair' && (
          <div>
            <RadioGroup
              label="Crosshair Mode"
              options={[
                { id: 'free', label: 'Free' },
                { id: 'snapBar', label: 'Snap Bar' },
                { id: 'snapClose', label: 'Snap Close' },
                { id: 'off', label: 'Off' },
              ]}
              value={appearance.crosshairMode || 'free'}
              onChange={(v) => setAppearance('crosshairMode', v)}
            />
            <RadioGroup
              label="Line Style"
              options={[
                { id: 'dashed', label: '— —' },
                { id: 'dotted', label: '· · ·' },
                { id: 'solid', label: '———' },
              ]}
              value={appearance.crosshairLineStyle || 'dashed'}
              onChange={(v) => setAppearance('crosshairLineStyle', v)}
            />
            <ColorSwatch
              label="Crosshair Color"
              color={appearance.crosshairColor || '#9598A1'}
              onChange={(v) => setAppearance('crosshairColor', v)}
            />
            <RangeSlider
              label="Crosshair Opacity"
              value={appearance.crosshairOpacity ?? 1}
              min={0.1}
              max={1}
              step={0.05}
              onChange={(v) => setAppearance('crosshairOpacity', v)}
              display={`${Math.round((appearance.crosshairOpacity ?? 1) * 100)}%`}
            />

            <Toggle
              label="Show Floating Tooltip"
              checked={showCrosshairTooltip}
              onChange={toggleCrosshairTooltip}
            />

            <div className={s.infoBox}>
              <div>
                <strong style={{ color: C.t2 }}>Free</strong> — Follows cursor with soft magnetic snap
              </div>
              <div>
                <strong style={{ color: C.t2 }}>Snap Bar</strong> — Locks X to nearest bar center
              </div>
              <div>
                <strong style={{ color: C.t2 }}>Snap Close</strong> — Locks to bar close price
              </div>
              <div>
                <strong style={{ color: C.t2 }}>Off</strong> — No crosshair
              </div>
            </div>
          </div>
        )}

        {tab === 'chartType' && (() => {
          const typeEntry = CHART_TYPES[chartType];
          const params = typeEntry?.configParams;
          if (!params) {
            return (
              <div className={s.chartTypeEmpty}>
                No configurable parameters for <strong style={{ color: C.t1 }}>{typeEntry?.name || chartType}</strong>.
              </div>
            );
          }
          const defaults = getChartTypeDefaults(chartType);
          const cfg = { ...defaults, ...(chartTypeConfig[chartType] || {}) };
          return (
            <div>
              <div className={s.sectionLabel}>
                {typeEntry.icon} {typeEntry.name} Settings
              </div>
              {Object.entries(params).map(([key, p]) => {
                const val = cfg[key] ?? p.default;
                if (p.type === 'range') {
                  return <RangeSlider key={key} label={p.label} value={val} min={p.min} max={p.max} step={p.step} onChange={(v) => setChartTypeConfig(chartType, key, v)} />;
                }
                if (p.type === 'select') {
                  return <RadioGroup key={key} label={p.label} options={p.options.map((o) => ({ id: o, label: o }))} value={val} onChange={(v) => setChartTypeConfig(chartType, key, v)} />;
                }
                if (p.type === 'color') {
                  return <ColorSwatch key={key} label={p.label} color={val} onChange={(v) => setChartTypeConfig(chartType, key, v)} />;
                }
                if (p.type === 'number') {
                  return <RangeSlider key={key} label={p.label} value={val} min={p.min || 0} max={p.max || 1000} step={p.step || 0.01} onChange={(v) => setChartTypeConfig(chartType, key, v)} display={val} />;
                }
                return null;
              })}
              <div className={s.resetWrap}>
                <button
                  onClick={() => resetChartTypeConfig(chartType)}
                  className={s.resetBtn}
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
