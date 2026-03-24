import React from 'react';
import { C } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';
import RiskCalculator from '../../features/trading/RiskCalculator.jsx';
import { listPresets } from '../../features/trading/RiskPresets.js';
import { Card, inputStyle } from '../ui/UIKit.jsx';
import { SectionHeader, SettingRow } from './SettingsHelpers.jsx';
import st from './TradingSetupSection.module.css';

function TradingSetupSection() {
  const accountSize = useUserStore((s) => s.accountSize);
  const riskPerTrade = useUserStore((s) => s.riskPerTrade);
  const dailyLossLimit = useUserStore((s) => s.dailyLossLimit);
  const riskFreeRate = useUserStore((s) => s.riskFreeRate);
  const maxDailyTrades = useUserStore((s) => s.maxDailyTrades);
  const kellyFraction = useUserStore((s) => s.kellyFraction);
  const activeRiskPreset = useUserStore((s) => s.activeRiskPreset);
  const defaultSymbol = useUserStore((s) => s.defaultSymbol);
  const defaultTf = useUserStore((s) => s.defaultTf);
  const settings = { accountSize, riskPerTrade, dailyLossLimit, riskFreeRate, maxDailyTrades, kellyFraction, activeRiskPreset, defaultSymbol, defaultTf };
  const update = useUserStore((s) => s.update);

  return (
    <section className={st.section}>
      <SectionHeader icon="settings" title="Trading Setup" description="Account parameters, risk rules, and chart defaults" />

      <Card className={st.cardPad}>
        <div className={st.cardTitle}>Account & Risk</div>
        <div className={st.formGrid}>
          <SettingRow label="Account Size ($)"><input type="number" value={settings.accountSize || ''} onChange={(e) => update({ accountSize: Number(e.target.value) || 0 })} placeholder="e.g. 25000" style={inputStyle} /></SettingRow>
          <SettingRow label="Risk Per Trade (%)"><input type="number" value={settings.riskPerTrade || ''} onChange={(e) => update({ riskPerTrade: Number(e.target.value) || 0 })} placeholder="e.g. 1" step="0.1" style={inputStyle} /></SettingRow>
          <SettingRow label="Daily Loss Limit ($)"><input type="number" value={settings.dailyLossLimit || ''} onChange={(e) => update({ dailyLossLimit: Number(e.target.value) || 0 })} placeholder="e.g. 500" style={inputStyle} /></SettingRow>
          <SettingRow label="Risk-Free Rate (%)"><input type="number" value={settings.riskFreeRate != null ? settings.riskFreeRate * 100 : ''} onChange={(e) => update({ riskFreeRate: (Number(e.target.value) || 0) / 100 })} placeholder="e.g. 5.0" step="0.1" style={inputStyle} /></SettingRow>
          <SettingRow label="Max Daily Trades"><input type="number" value={settings.maxDailyTrades || ''} onChange={(e) => update({ maxDailyTrades: Number(e.target.value) || 0 })} placeholder="0 = unlimited" style={inputStyle} /></SettingRow>
          <SettingRow label="Kelly Fraction"><select value={settings.kellyFraction || 0.5} onChange={(e) => update({ kellyFraction: Number(e.target.value) })} style={{ ...inputStyle, cursor: 'pointer' }}><option value={0.25}>Quarter-Kelly (0.25×)</option><option value={0.5}>Half-Kelly (0.5×)</option><option value={0.75}>Three-Quarter Kelly (0.75×)</option><option value={1.0}>Full Kelly (1.0×)</option></select></SettingRow>
        </div>
        <div className={st.presetsWrap} style={{ borderTop: `1px solid ${C.bd}` }}>
          <div className={st.presetsLabel}>Quick Presets</div>
          <div className={st.presetsRow}>
            {listPresets().map((preset) => (
              <button key={preset.id} onClick={() => update({ ...preset.params, activeRiskPreset: preset.id })}
                className={`tf-btn ${st.presetBtn}`}
                style={{ border: `1px solid ${settings.activeRiskPreset === preset.id ? C.b : C.bd}`, background: settings.activeRiskPreset === preset.id ? C.b + '15' : 'transparent', color: settings.activeRiskPreset === preset.id ? C.b : C.t2 }}>
                {preset.icon} {preset.name}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className={st.cardPad}>
        <div className={st.cardTitle}>Chart Defaults</div>
        <div className={st.formGrid}>
          <SettingRow label="Default Symbol"><input value={settings.defaultSymbol || ''} onChange={(e) => update({ defaultSymbol: e.target.value.toUpperCase() })} placeholder="e.g. BTC" style={{ ...inputStyle, textTransform: 'uppercase' }} /></SettingRow>
          <SettingRow label="Default Timeframe"><select value={settings.defaultTf || '3m'} onChange={(e) => update({ defaultTf: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}><option value="1d">1 Day</option><option value="5d">5 Days</option><option value="1m">1 Month</option><option value="3m">3 Months</option><option value="6m">6 Months</option><option value="1y">1 Year</option></select></SettingRow>
        </div>
      </Card>

      <Card style={{ padding: 20 }}>
        <div className={st.cardTitle}>Position Sizer</div>
        <RiskCalculator />
      </Card>
    </section>
  );
}

export default React.memo(TradingSetupSection);
