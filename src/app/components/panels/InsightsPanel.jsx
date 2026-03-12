// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Insights Panel (Sprint 4)
//
// Three-tab panel combining:
//   1. Patterns — behavioral pattern detection results
//   2. Debrief — daily/weekly trade summary
//   3. Checklist — pre-trade discipline checklist
//
// Decomposed: tab components live in ./insights/.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState } from 'react';
// eslint-disable-next-line import/order
import { C, F } from '../../../constants.js';

// Extracted sub-modules
import ChecklistTab from './insights/ChecklistTab.jsx';
import DebriefTab from './insights/DebriefTab.jsx';
import PatternsTab from './insights/PatternsTab.jsx';

const TABS = [
  { id: 'patterns', label: '🔍 Patterns' },
  { id: 'debrief', label: '📊 Debrief' },
  { id: 'checklist', label: '✅ Checklist' },
];

function InsightsPanel({ trades = [] }) {
  const [tab, setTab] = useState('patterns');

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: C.bg,
        fontFamily: F,
        color: C.t2,
        overflow: 'hidden',
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: `1px solid ${C.bd}`,
          flexShrink: 0,
        }}
      >
        {TABS.map((t) => (
          <button
            className="tf-btn"
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: '8px 4px',
              background: tab === t.id ? C.bg : C.bg2,
              border: 'none',
              borderBottom: tab === t.id ? `2px solid ${C.b}` : '2px solid transparent',
              color: tab === t.id ? C.t1 : C.t3,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: F,
              cursor: 'pointer',
              transition: 'all 0.1s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Financial disclaimer */}
      <div style={{ padding: '6px 10px', fontSize: 9, color: C.t3, fontFamily: F, borderBottom: `1px solid ${C.bd}`, flexShrink: 0 }}>
        ⚖️ For educational purposes only — not financial advice. Always do your own research.
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {tab === 'patterns' && <PatternsTab trades={trades} />}
        {tab === 'debrief' && <DebriefTab trades={trades} />}
        {tab === 'checklist' && <ChecklistTab />}
      </div>
    </div>
  );
}

export { InsightsPanel };

export default React.memo(InsightsPanel);
