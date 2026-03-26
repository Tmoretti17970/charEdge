// ═══════════════════════════════════════════════════════════════════
// charEdge — Go Deeper
//
// Collapsible accordion section for deep-dive analysis tools.
// Progressive disclosure — hidden by default, expandable on demand.
// ═══════════════════════════════════════════════════════════════════

import { ChevronRight } from 'lucide-react';
import React, { useState } from 'react';
import s from './GoDeeper.module.css';
import VolatilityDashboard from './VolatilityDashboard.jsx';

const ITEMS = [
  {
    id: 'volatility',
    title: 'Volatility Dashboard',
    description: 'VIX term structure, regime classification, and per-symbol volatility analysis',
  },
];

function GoDeeper() {
  const [expanded, setExpanded] = useState(null);

  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <h3 className={s.title}>Go Deeper</h3>
        <span className={s.subtitle}>Advanced analysis tools</span>
      </div>

      <div className={s.list}>
        {ITEMS.map((item) => {
          const isOpen = expanded === item.id;
          return (
            <div key={item.id} className={s.item}>
              <button className={s.itemBtn} onClick={() => setExpanded(isOpen ? null : item.id)} aria-expanded={isOpen}>
                <ChevronRight
                  size={14}
                  className={s.chevron}
                  style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                />
                <div className={s.itemText}>
                  <span className={s.itemTitle}>{item.title}</span>
                  <span className={s.itemDesc}>{item.description}</span>
                </div>
              </button>
              {isOpen && <div className={s.itemContent}>{item.id === 'volatility' && <VolatilityDashboard />}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(GoDeeper);
