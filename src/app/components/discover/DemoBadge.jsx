// ═══════════════════════════════════════════════════════════════════
// charEdge — Demo Data Badge
//
// Visual indicator for Discover panels using sample/mock data.
// Transparently communicates to users that the data is illustrative.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';

const style = {
  fontSize: 9,
  fontWeight: 700,
  color: '#f59e0b',
  background: 'rgba(245, 158, 11, 0.10)',
  padding: '2px 6px',
  borderRadius: 4,
  letterSpacing: '0.05em',
  fontFamily: 'var(--tf-mono)',
  cursor: 'help',
  flexShrink: 0,
};

function DemoBadge() {
  return (
    <span style={style} title="Sample data for preview — live data coming soon">
      SAMPLE
    </span>
  );
}

export default React.memo(DemoBadge);
