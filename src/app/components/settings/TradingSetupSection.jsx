import React from 'react';
import { C, F } from '../../../constants.js';
import { useUserStore } from '../../../state/useUserStore';
import { radii } from '../../../theme/tokens.js';
import RiskCalculator from '../../features/trading/RiskCalculator.jsx';
import { listPresets } from '../../features/trading/RiskPresets.js';
import { Card, inputStyle } from '../ui/UIKit.jsx';
import { SectionHeader, SettingRow } from './SettingsHelpers.jsx';

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

  const settings = {
    accountSize, riskPerTrade, dailyLossLimit, riskFreeRate,
    maxDailyTrades, kellyFraction, activeRiskPreset, defaultSymbol, defaultTf,
  };
  const update = useUserStore((s) => s.update);

  return (
    <section style={{ marginBottom: 40 }}>
      <SectionHeader icon="settings" title="Trading Setup" description="Account parameters, risk rules, and chart defaults" />

      {/* Account & Risk */}
      <Card style={{ marginBottom: 16, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 16 }}>Account & Risk</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <SettingRow label="Account Size ($)">
            <input type="number" value={settings.accountSize || ''} onChange={(e) => update({ accountSize: Number(e.target.value) || 0 })} placeholder="e.g. 25000" style={inputStyle} />
          </SettingRow>
          <SettingRow label="Risk Per Trade (%)">
            <input type="number" value={settings.riskPerTrade || ''} onChange={(e) => update({ riskPerTrade: Number(e.target.value) || 0 })} placeholder="e.g. 1" step="0.1" style={inputStyle} />
          </SettingRow>
          <SettingRow label="Daily Loss Limit ($)">
            <input type="number" value={settings.dailyLossLimit || ''} onChange={(e) => update({ dailyLossLimit: Number(e.target.value) || 0 })} placeholder="e.g. 500" style={inputStyle} />
          </SettingRow>
          <SettingRow label="Risk-Free Rate (%)">
            <input type="number" value={settings.riskFreeRate != null ? settings.riskFreeRate * 100 : ''} onChange={(e) => update({ riskFreeRate: (Number(e.target.value) || 0) / 100 })} placeholder="e.g. 5.0" step="0.1" style={inputStyle} />
          </SettingRow>
          <SettingRow label="Max Daily Trades">
            <input type="number" value={settings.maxDailyTrades || ''} onChange={(e) => update({ maxDailyTrades: Number(e.target.value) || 0 })} placeholder="0 = unlimited" style={inputStyle} />
          </SettingRow>
          <SettingRow label="Kelly Fraction">
            <select value={settings.kellyFraction || 0.5} onChange={(e) => update({ kellyFraction: Number(e.target.value) })} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value={0.25}>Quarter-Kelly (0.25×)</option>
              <option value={0.5}>Half-Kelly (0.5×)</option>
              <option value={0.75}>Three-Quarter Kelly (0.75×)</option>
              <option value={1.0}>Full Kelly (1.0×)</option>
            </select>
          </SettingRow>
        </div>

        {/* Risk Presets */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.bd}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.t3, marginBottom: 10 }}>Quick Presets</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {listPresets().map((preset) => (
              <button key={preset.id} onClick={() => update({ ...preset.params, activeRiskPreset: preset.id })} className="tf-btn"
                style={{ padding: '7px 12px', borderRadius: radii.md, border: `1px solid ${settings.activeRiskPreset === preset.id ? C.b : C.bd}`, background: settings.activeRiskPreset === preset.id ? C.b + '15' : 'transparent', color: settings.activeRiskPreset === preset.id ? C.b : C.t2, fontSize: 12, fontWeight: 600, fontFamily: F, cursor: 'pointer' }}>
                {preset.icon} {preset.name}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Chart Defaults */}
      <Card style={{ marginBottom: 16, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 16 }}>Chart Defaults</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <SettingRow label="Default Symbol">
            <input value={settings.defaultSymbol || ''} onChange={(e) => update({ defaultSymbol: e.target.value.toUpperCase() })} placeholder="e.g. BTC" style={{ ...inputStyle, textTransform: 'uppercase' }} />
          </SettingRow>
          <SettingRow label="Default Timeframe">
            <select value={settings.defaultTf || '3m'} onChange={(e) => update({ defaultTf: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="1d">1 Day</option>
              <option value="5d">5 Days</option>
              <option value="1m">1 Month</option>
              <option value="3m">3 Months</option>
              <option value="6m">6 Months</option>
              <option value="1y">1 Year</option>
            </select>
          </SettingRow>
        </div>
      </Card>

      {/* Position Sizer */}
      <Card style={{ padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 12 }}>Position Sizer</div>
        <RiskCalculator />
      </Card>
    </section>
  );
}

export default React.memo(TradingSetupSection);
