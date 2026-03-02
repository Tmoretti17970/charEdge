// ═══════════════════════════════════════════════════════════════════
// charEdge — Dashboard Quick Commands (Sprint 10)
//
// Inline command palette strip — quick keyboard-driven actions
// accessible directly from the dashboard. Not a full modal,
// but a compact row of frequently used commands.
// ═══════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react';
import { C, M, F } from '../../../constants.js';
import { useBreakpoints } from '../../../utils/useMediaQuery.js';

// ─── Command Definitions ─────────────────────────────────────────

const DASH_COMMANDS = [
  { id: 'journal', emoji: '📝', label: 'Journal', shortcut: 'J', tab: 'journal' },
  { id: 'chart', emoji: '📈', label: 'Charts', shortcut: 'C', tab: 'chart' },
  { id: 'analytics', emoji: '📊', label: 'Analytics', shortcut: 'A', tab: 'analytics' },
  { id: 'community', emoji: '🌐', label: 'Community', shortcut: 'D', tab: 'community' },
  { id: 'settings', emoji: '⚙️', label: 'Settings', shortcut: ',', tab: 'settings' },
];

export default function DashboardCommands() {
  const { isMobile } = useBreakpoints();

  const handleNav = (tab) => {
    // Try to click sidebar nav button with matching data attribute
    const btn = document.querySelector(`[data-tab="${tab}"], [data-nav="${tab}"]`);
    if (btn) { btn.click(); return; }
    // Fallback: dispatch custom event
    window.dispatchEvent(new CustomEvent('tf-navigate', { detail: { tab } }));
  };

  if (isMobile) return null; // Desktop only — mobile uses bottom nav

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
      flexWrap: 'wrap',
    }}>
      <span style={{
        fontSize: 8, fontWeight: 700, fontFamily: M,
        color: C.t3, letterSpacing: '0.06em', textTransform: 'uppercase',
        marginRight: 4,
      }}>
        Quick Nav
      </span>
      {DASH_COMMANDS.map((cmd) => (
        <button
          key={cmd.id}
          className="tf-btn"
          onClick={() => handleNav(cmd.tab)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 4,
            border: `1px solid ${C.bd}`,
            background: 'transparent',
            color: C.t2,
            fontSize: 10,
            fontFamily: M,
            cursor: 'pointer',
            transition: 'all 0.1s',
          }}
          onMouseEnter={(e) => {
            e.target.style.borderColor = C.b + '40';
            e.target.style.background = C.b + '08';
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = C.bd;
            e.target.style.background = 'transparent';
          }}
        >
          <span style={{ fontSize: 11 }}>{cmd.emoji}</span>
          <span>{cmd.label}</span>
          <kbd style={{
            fontSize: 8,
            fontFamily: M,
            color: C.t3,
            background: C.bg2,
            padding: '1px 4px',
            borderRadius: 2,
            border: `1px solid ${C.bd}`,
            marginLeft: 2,
          }}>
            {cmd.shortcut}
          </kbd>
        </button>
      ))}
    </div>
  );
}
