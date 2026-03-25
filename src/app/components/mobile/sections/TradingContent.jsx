// ═══════════════════════════════════════════════════════════════════
// Mobile Settings — Trading Setup Section
// ═══════════════════════════════════════════════════════════════════

import { useUserStore } from '../../../../state/useUserStore';
import { radii } from '../../../../theme/tokens.js';
import RiskCalculator from '../../../features/trading/RiskCalculator.jsx';
import { listPresets } from '../../../features/trading/RiskPresets.js';
import { MobileRow, mobileInput } from '../MobilePrimitives.jsx';
import { C, F } from '@/constants.js';
import { shallow } from '@/shared/shallow';

export default function TradingContent() {
  const settings = useUserStore(
    (s) => ({
      accountSize: s.accountSize,
      riskPerTrade: s.riskPerTrade,
      dailyLossLimit: s.dailyLossLimit,
      riskFreeRate: s.riskFreeRate,
      maxDailyTrades: s.maxDailyTrades,
      kellyFraction: s.kellyFraction,
      activeRiskPreset: s.activeRiskPreset,
      defaultSymbol: s.defaultSymbol,
      defaultTf: s.defaultTf,
    }),
    shallow,
  );
  const update = useUserStore((s) => s.update);

  return (
    <div>
      {/* Account & Risk */}
      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 12 }}>Account & Risk</div>

      <MobileRow label="Account Size ($)">
        <input
          type="number"
          value={settings.accountSize || ''}
          onChange={(e) => update({ accountSize: Number(e.target.value) || 0 })}
          placeholder="e.g. 25000"
          style={mobileInput}
        />
      </MobileRow>

      <MobileRow label="Risk Per Trade (%)">
        <input
          type="number"
          value={settings.riskPerTrade || ''}
          onChange={(e) => update({ riskPerTrade: Number(e.target.value) || 0 })}
          placeholder="e.g. 1"
          step="0.1"
          style={mobileInput}
        />
      </MobileRow>

      <MobileRow label="Daily Loss Limit ($)">
        <input
          type="number"
          value={settings.dailyLossLimit || ''}
          onChange={(e) => update({ dailyLossLimit: Number(e.target.value) || 0 })}
          placeholder="e.g. 500"
          style={mobileInput}
        />
      </MobileRow>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <MobileRow label="Risk-Free Rate (%)">
          <input
            type="number"
            value={settings.riskFreeRate != null ? settings.riskFreeRate * 100 : ''}
            onChange={(e) => update({ riskFreeRate: (Number(e.target.value) || 0) / 100 })}
            placeholder="5.0"
            step="0.1"
            style={mobileInput}
          />
        </MobileRow>

        <MobileRow label="Max Daily Trades">
          <input
            type="number"
            value={settings.maxDailyTrades || ''}
            onChange={(e) => update({ maxDailyTrades: Number(e.target.value) || 0 })}
            placeholder="0 = ∞"
            style={mobileInput}
          />
        </MobileRow>
      </div>

      <MobileRow label="Kelly Fraction">
        <select
          value={settings.kellyFraction || 0.5}
          onChange={(e) => update({ kellyFraction: Number(e.target.value) })}
          style={{ ...mobileInput, cursor: 'pointer' }}
        >
          <option value={0.25}>Quarter-Kelly (0.25×)</option>
          <option value={0.5}>Half-Kelly (0.5×)</option>
          <option value={0.75}>Three-Quarter Kelly (0.75×)</option>
          <option value={1.0}>Full Kelly (1.0×)</option>
        </select>
      </MobileRow>

      {/* Quick Presets */}
      <div style={{ marginTop: 8, paddingTop: 12, borderTop: `1px solid ${C.bd}` }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.t3, marginBottom: 10 }}>Quick Presets</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {listPresets().map((preset) => (
            <button
              key={preset.id}
              onClick={() => update({ ...preset.params, activeRiskPreset: preset.id })}
              className="tf-btn"
              style={{
                padding: '8px 14px',
                minHeight: 36,
                borderRadius: radii.md,
                border: `1px solid ${settings.activeRiskPreset === preset.id ? C.b : C.bd}`,
                background: settings.activeRiskPreset === preset.id ? C.b + '15' : 'transparent',
                color: settings.activeRiskPreset === preset.id ? C.b : C.t2,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: F,
                cursor: 'pointer',
              }}
            >
              {preset.icon} {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Defaults */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.bd}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 12 }}>Chart Defaults</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <MobileRow label="Symbol">
            <input
              value={settings.defaultSymbol || ''}
              onChange={(e) => update({ defaultSymbol: e.target.value.toUpperCase() })}
              placeholder="BTC"
              style={{ ...mobileInput, textTransform: 'uppercase' }}
            />
          </MobileRow>

          <MobileRow label="Timeframe">
            <select
              value={settings.defaultTf || '3m'}
              onChange={(e) => update({ defaultTf: e.target.value })}
              style={{ ...mobileInput, cursor: 'pointer' }}
            >
              <option value="1d">1 Day</option>
              <option value="5d">5 Days</option>
              <option value="1m">1 Month</option>
              <option value="3m">3 Months</option>
              <option value="6m">6 Months</option>
              <option value="1y">1 Year</option>
            </select>
          </MobileRow>
        </div>
      </div>

      {/* Position Sizer */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.bd}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 12 }}>Position Sizer</div>
        <RiskCalculator />
      </div>
    </div>
  );
}
