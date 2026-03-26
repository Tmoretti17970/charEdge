// ═══════════════════════════════════════════════════════════════════
// charEdge — Smart Money
//
// Consolidated smart money intelligence — merges Options Flow,
// Insider Trading, and Congress Trades into a single tabbed section.
// ═══════════════════════════════════════════════════════════════════

import { DollarSign } from 'lucide-react';
import React, { useState } from 'react';
import InsiderTracker from './InsiderTracker.jsx';
import IntelCard from './IntelCard.jsx';
import OptionsFlowScanner from './OptionsFlowScanner.jsx';
import s from './SmartMoney.module.css';

const TABS = [
  { id: 'options', label: 'Options Flow' },
  { id: 'insiders', label: 'Insider Activity' },
];

function SmartMoney() {
  const [activeTab, setActiveTab] = useState('options');

  return (
    <IntelCard
      icon={<DollarSign size={18} />}
      title="Smart Money"
      badge="live"
      badgeColor="#22c55e"
      collapsible
      actions={
        <div className={s.tabBar}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={s.tabBtn}
              style={{
                background: activeTab === tab.id ? 'rgba(92, 156, 245, 0.1)' : 'transparent',
                color: activeTab === tab.id ? '#5c9cf5' : 'var(--tf-t3)',
                borderBottom: activeTab === tab.id ? '2px solid #5c9cf5' : '2px solid transparent',
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      }
    >
      <div className={s.content}>
        {activeTab === 'options' && <OptionsFlowScanner />}
        {activeTab === 'insiders' && <InsiderTracker />}
      </div>
    </IntelCard>
  );
}

export default React.memo(SmartMoney);
