// ═══════════════════════════════════════════════════════════════════
// charEdge — Boot Waterfall (Sprint 4, Task 4.1.4)
//
// Visual timeline showing boot phase durations as colored bars.
// Reads from window.__charEdge_bootMetrics (set by AppBoot.js).
// Displayed in Settings → Data section, collapsed by default.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { C, M } from '../../../constants.js';
import { Card } from '../ui/UIKit.jsx';

function BootWaterfall() {
  const [metrics, setMetrics] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Read metrics on mount (they're set once during boot)
    if (typeof window !== 'undefined' && window.__charEdge_bootMetrics) {
      setMetrics(window.__charEdge_bootMetrics);
    }
  }, []);

  if (!metrics) return null;

  const maxDuration = Math.max(...metrics.phases.map(p => p.duration), 1);

  return (
    <Card style={{ padding: 16, marginTop: 12 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>⚡</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>Boot Performance</div>
            <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
              Total: {metrics.total}ms
            </div>
          </div>
        </div>
        <span style={{ fontSize: 11, color: C.t3, transition: 'transform 0.2s ease', transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>
          ▼
        </span>
      </button>

      {expanded && (
        <div style={{ marginTop: 14 }}>
          {/* Phase bars */}
          {metrics.phases.map((phase) => {
            const pct = Math.max((phase.duration / maxDuration) * 100, 4);
            return (
              <div key={phase.name} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: C.t2, fontWeight: 600 }}>{phase.name}</span>
                  <span style={{ fontSize: 11, color: C.t3, fontFamily: M }}>{phase.duration}ms</span>
                </div>
                <div style={{
                  height: 8,
                  borderRadius: 4,
                  background: C.sf2,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${pct}%`,
                    borderRadius: 4,
                    background: phase.color,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            );
          })}

          {/* Summary row */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 0 0',
            borderTop: `1px solid ${C.bd}`,
            marginTop: 8,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.t1 }}>Total Boot Time</span>
            <span style={{
              fontSize: 13,
              fontWeight: 800,
              fontFamily: M,
              color: metrics.total < 1000 ? '#4ecdc4' : metrics.total < 2000 ? '#ffa726' : '#ef5350',
            }}>
              {metrics.total}ms
            </span>
          </div>

          {/* Health indicator */}
          <div style={{
            fontSize: 10,
            color: C.t3,
            fontFamily: M,
            marginTop: 6,
            textAlign: 'center',
          }}>
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
