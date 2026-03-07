// ═══════════════════════════════════════════════════════════════════
// charEdge — Dashboard Quick Commands (Sprint 10)
//
// Inline command palette strip — quick keyboard-driven actions
// accessible directly from the dashboard. Not a full modal,
// but a compact row of frequently used commands.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, M } from '../../../constants.js';
import { radii } from '../../../theme/tokens.js';
import { useBreakpoints } from '../../../utils/useMediaQuery.js';
import { useUIStore } from '../../../state/useUIStore.js';

// ─── Command Definitions ─────────────────────────────────────────

const DASH_COMMANDS = [
  { id: 'journal', emoji: '📝', label: 'Journal', shortcut: 'J', page: 'journal' },
  { id: 'charts', emoji: '📈', label: 'Charts', shortcut: 'C', page: 'charts' },
  { id: 'analytics', emoji: '📊', label: 'Analytics', shortcut: 'A', page: 'journal' },
  { id: 'discover', emoji: '🌐', label: 'Community', shortcut: 'D', page: 'discover' },
  { id: 'settings', emoji: '⚙️', label: 'Settings', shortcut: ',', action: 'settings' },
];

export default function DashboardCommands() {
  const { isMobile } = useBreakpoints();
  const setPage = useUIStore((s) => s.setPage);
  const toggleSettings = useUIStore((s) => s.toggleSettings);

  const handleNav = (cmd) => {
    if (cmd.action === 'settings') {
      toggleSettings();
    } else if (cmd.page) {
      setPage(cmd.page);
    }
  };

  if (isMobile) return null; // Desktop only — mobile uses bottom nav

  return (
    <div className="tf-container" style={{
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
          onClick={() => handleNav(cmd)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: radii.xs,
            border: `1px solid ${C.bd}`,
            background: 'transparent',
            color: C.t2,
            fontSize: 10,
            fontFamily: M,
            cursor: 'pointer',
            transition: 'all 0.1s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = C.b + '40';
            e.currentTarget.style.background = C.b + '08';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = C.bd;
            e.currentTarget.style.background = 'transparent';
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

