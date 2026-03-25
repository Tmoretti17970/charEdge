// ═══════════════════════════════════════════════════════════════════
// charEdge — Community Signals Panel (Phase 10)
//
// P2P community signals placeholder.
// Requires a signaling server (planned for Horizon 3).
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C } from '../../../constants.js';

function CommunitySignals() {
  return (
    <div
      style={{
        padding: '20px 16px',
        borderRadius: 8,
        background: C.sf,
        border: `1px solid ${C.bd}`,
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: 20, display: 'block', marginBottom: 6 }}>📡</span>
      <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--tf-mono)', color: C.t2, marginBottom: 4 }}>
        Community Signals
      </div>
      <div style={{ fontSize: 10, fontFamily: 'var(--tf-mono)', color: C.t3 }}>Coming soon — requires peer network</div>
    </div>
  );
}

export default React.memo(CommunitySignals);
