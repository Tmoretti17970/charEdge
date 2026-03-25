// ═══════════════════════════════════════════════════════════════════
// charEdge — PageBreadcrumb (Sprint 11)
//
// Sticky section title at the top of each page.
// Shows: charEdge › {Page Name} with optional sub-tab context.
// Skipped on Charts page (full-bleed layout).
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, F } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';

const PAGE_META = {
  journal: { label: 'Command Center', icon: '🏠' },
  dashboard: { label: 'Command Center', icon: '🏠' },
  markets: { label: 'Markets', icon: '👁' },
  charts: { label: 'Charts', icon: '📈' },
  import: { label: 'Import Hub', icon: '📥' },
  settings: { label: 'Settings', icon: '⚙️' },
  changelog: { label: "What's New", icon: '📋' },
  privacy: { label: 'Privacy Policy', icon: '🔒' },
  terms: { label: 'Terms of Service', icon: '📄' },
  charolette: { label: "Charolette's Light", icon: '✦' },
  telemetry: { label: 'Telemetry', icon: '📊' },
  speedtest: { label: 'Speed Test', icon: '⚡' },
  landing: { label: 'Landing', icon: '🚀' },
};

function PageBreadcrumb({ page, subTab = null }) {
  // Skip breadcrumb for chart page (full-bleed) and landing
  if (page === 'charts' || page === 'landing') return null;

  const meta = PAGE_META[page] || { label: page, icon: '📄' };

  return (
    <div
      data-tour="breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 24px',
        fontSize: 11,
        fontFamily: F,
        fontWeight: 500,
        color: C.t3,
        borderBottom: `1px solid ${alpha(C.bd, 0.3)}`,
        background: alpha(C.bg2, 0.5),
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        flexShrink: 0,
        userSelect: 'none',
        letterSpacing: '0.01em',
      }}
    >
      <span style={{ opacity: 0.6 }}>charEdge</span>
      <span style={{ opacity: 0.3 }}>›</span>
      <span style={{ color: C.t1, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 12 }}>{meta.icon}</span>
        {meta.label}
      </span>
      {subTab && (
        <>
          <span style={{ opacity: 0.3 }}>›</span>
          <span style={{ color: C.b, fontWeight: 600 }}>{subTab}</span>
        </>
      )}
    </div>
  );
}

export default React.memo(PageBreadcrumb);
