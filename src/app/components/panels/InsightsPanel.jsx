// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Insights Panel (Sprint 4)
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState } from 'react';
import ChecklistTab from './insights/ChecklistTab.jsx';
import DebriefTab from './insights/DebriefTab.jsx';
import PatternsTab from './insights/PatternsTab.jsx';
import st from './InsightsPanel.module.css';

const TABS = [
  { id: 'patterns', label: '🔍 Patterns' },
  { id: 'debrief', label: '📊 Debrief' },
  { id: 'checklist', label: '✅ Checklist' },
];

function InsightsPanel({ trades = [] }) {
  const [tab, setTab] = useState('patterns');

  return (
    <div className={st.root}>
      <div className={st.tabBar}>
        {TABS.map((t) => (
          <button
            className={`tf-btn ${st.tabBtn} ${tab === t.id ? st.tabBtnActive : st.tabBtnInactive}`}
            key={t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={st.disclaimer}>
        ⚖️ For educational purposes only — not financial advice. Always do your own research.
      </div>

      <div className={st.content}>
        {tab === 'patterns' && <PatternsTab trades={trades} />}
        {tab === 'debrief' && <DebriefTab trades={trades} />}
        {tab === 'checklist' && <ChecklistTab />}
      </div>
    </div>
  );
}

export { InsightsPanel };
export default React.memo(InsightsPanel);
