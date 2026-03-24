// ═══════════════════════════════════════════════════════════════════
// charEdge — Boot Waterfall (Sprint 4, Task 4.1.4)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { C } from '../../../constants.js';
import { Card } from '../ui/UIKit.jsx';
import st from './BootWaterfall.module.css';

function BootWaterfall() {
  const [metrics, setMetrics] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.__charEdge_bootMetrics) {
      setMetrics(window.__charEdge_bootMetrics);
    }
  }, []);

  if (!metrics) return null;
  const maxDuration = Math.max(...metrics.phases.map(p => p.duration), 1);

  return (
    <Card className={st.cardPad}>
      <button onClick={() => setExpanded(!expanded)} className={st.headerBtn}>
        <div className={st.headerLeft}>
          <span className={st.headerIcon}>⚡</span>
          <div>
            <div className={st.headerTitle}>Boot Performance</div>
            <div className={st.headerSub}>Total: {metrics.total}ms</div>
          </div>
        </div>
        <span className={st.chevron} style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
      </button>

      {expanded && (
        <div className={st.body}>
          {metrics.phases.map((phase) => {
            const pct = Math.max((phase.duration / maxDuration) * 100, 4);
            return (
              <div key={phase.name} className={st.phase}>
                <div className={st.phaseHeader}>
                  <span className={st.phaseName}>{phase.name}</span>
                  <span className={st.phaseDuration}>{phase.duration}ms</span>
                </div>
                <div className={st.barTrack}>
                  <div className={st.barFill} style={{ width: `${pct}%`, background: phase.color }} />
                </div>
              </div>
            );
          })}
          <div className={st.summaryRow} style={{ borderTop: `1px solid ${C.bd}` }}>
            <span className={st.summaryLabel}>Total Boot Time</span>
            <span className={st.summaryValue}
              style={{ color: metrics.total < 1000 ? '#4ecdc4' : metrics.total < 2000 ? '#ffa726' : '#ef5350' }}>
              {metrics.total}ms
            </span>
          </div>
          <div className={st.health}>
            {metrics.total < 1000 && '🟢 Excellent — under 1s'}
            {metrics.total >= 1000 && metrics.total < 2000 && '🟡 Good — under 2s'}
            {metrics.total >= 2000 && '🔴 Slow — consider optimizing boot sequence'}
          </div>
        </div>
      )}
    </Card>
  );
}

export default React.memo(BootWaterfall);
