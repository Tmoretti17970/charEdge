// ═══════════════════════════════════════════════════════════════════
// charEdge v11 — Risk Calculator Hub
// Tabbed multi-calculator: Position Sizer, PnL, Margin, Drawdown
//
// Decomposed into per-tab modules in ./risk-calculator/
// ═══════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { C, M } from '../../../constants.js';
import { PositionSizerTab, PnLCalculatorTab, MarginCalculatorTab, DrawdownRecoveryTab } from './risk-calculator/index.js';

// ─── Tab Definitions ────────────────────────────────────────────
const TABS = [
  { id: 'position', label: 'Position Sizer', icon: '📏' },
  { id: 'pnl', label: 'PnL', icon: '💰' },
  { id: 'margin', label: 'Margin', icon: '⚖️' },
  { id: 'drawdown', label: 'Recovery', icon: '📉' },
];

// ═════════════════════════════════════════════════════════════════
// Main Component
// ═════════════════════════════════════════════════════════════════
export default function RiskCalculator() {
  const [activeTab, setActiveTab] = useState('position');

  return (
    <div>
      {/* Tab Bar */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          marginBottom: 16,
          background: C.bg2,
          borderRadius: 8,
          padding: 3,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className="tf-btn"
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '7px 4px',
              borderRadius: 6,
              border: 'none',
              background: activeTab === tab.id ? C.b + '22' : 'transparent',
              color: activeTab === tab.id ? C.b : C.t3,
              fontSize: 10,
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontFamily: M,
              cursor: 'pointer',
              transition: 'all 0.15s',
              borderBottom: activeTab === tab.id ? `2px solid ${C.b}` : '2px solid transparent',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ marginRight: 3 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'position' && <PositionSizerTab />}
      {activeTab === 'pnl' && <PnLCalculatorTab />}
      {activeTab === 'margin' && <MarginCalculatorTab />}
      {activeTab === 'drawdown' && <DrawdownRecoveryTab />}
    </div>
  );
}

export { RiskCalculator };
