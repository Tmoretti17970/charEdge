// ═══════════════════════════════════════════════════════════════════
// charEdge — Smart Action Bar (Sprint 3)
//
// Persistent floating action bar at the top of the dashboard providing
// one-tap access to the most common actions. Actions change based on
// session phase to always show the most relevant options.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { C, F, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { useUIStore } from '../../../state/useUIStore';
import { useBreakpoints } from '@/hooks/useMediaQuery';

// ─── Session Phase (shared logic) ────────────────────────────────

function getSessionPhase() {
  const h = new Date().getHours();
  const m = new Date().getMinutes();
  const decimal = h + m / 60;
  if (decimal < 9.5) return 'pre-market';
  if (decimal < 16) return 'active';
  return 'post-market';
}

// ─── Action Definitions ──────────────────────────────────────────

function useActions(phase) {
  const openModal = useUIStore((s) => s.openModal);
  const openQuickTrade = useUIStore((s) => s.openQuickTrade);
  const _setPage = useUIStore((s) => s.setPage);
  const toggleCmdPalette = useUIStore((s) => s.toggleCmdPalette);
  const _trades = useJournalStore((s) => s.trades);

  // File input ref for CSV import
  const triggerImport = () => {
    const el = document.querySelector('[data-tf-import-csv]');
    if (el) el.click();
  };

  const baseActions = [
    {
      id: 'add-trade',
      label: 'Add Trade',
      icon: '＋',
      primary: true,
      onClick: () => openModal({ mode: 'add' }),
    },
    {
      id: 'quick-add',
      label: 'Quick Add',
      icon: '⚡',
      onClick: openQuickTrade,
    },
    {
      id: 'import',
      label: 'Import',
      icon: '📥',
      onClick: triggerImport,
    },
    {
      id: 'search',
      label: 'Search',
      icon: '🔍',
      shortcut: 'Ctrl+K',
      onClick: toggleCmdPalette,
    },
  ];

  // Phase-specific actions
  const phaseActions = {
    'pre-market': [
      {
        id: 'view-plans',
        label: 'Plans',
        icon: '📋',
        onClick: () => {
          // Navigate to plans tab via JournalPage's tab system
          const event = new CustomEvent('tf-set-journal-tab', { detail: 'plans' });
          window.dispatchEvent(event);
        },
      },
    ],
    active: [
      {
        id: 'view-notes',
        label: 'Notes',
        icon: '📝',
        onClick: () => {
          const event = new CustomEvent('tf-set-journal-tab', { detail: 'notes' });
          window.dispatchEvent(event);
        },
      },
    ],
    'post-market': [
      {
        id: 'view-insights',
        label: 'Insights',
        icon: '📊',
        onClick: () => {
          const event = new CustomEvent('tf-set-journal-tab', { detail: 'overview' });
          window.dispatchEvent(event);
        },
      },
    ],
  };

  return [...baseActions, ...(phaseActions[phase] || [])];
}

// ─── Component ───────────────────────────────────────────────────

export default function SmartActionBar() {
  const { isMobile } = useBreakpoints();
  const [phase, setPhase] = useState(getSessionPhase);

  useEffect(() => {
    const interval = setInterval(() => setPhase(getSessionPhase()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const actions = useActions(phase);

  return (
    <div
      className="tf-container tf-smart-action-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 6 : 8,
        padding: isMobile ? '8px 12px' : '10px 16px',
        borderRadius: 10,
        background: C.sf,
        border: `1px solid ${C.bd}`,
        marginBottom: 16,
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {/* Label */}
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        fontFamily: M,
        color: C.t3,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginRight: isMobile ? 4 : 8,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        Actions
      </div>

      {/* Divider */}
      <div style={{
        width: 1,
        height: 20,
        background: C.bd,
        flexShrink: 0,
      }} />

      {/* Action buttons */}
      {actions.map((action) => (
        <ActionButton key={action.id} action={action} isMobile={isMobile} />
      ))}
    </div>
  );
}

// ─── Action Button ───────────────────────────────────────────────

function ActionButton({ action, isMobile }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      className="tf-btn"
      onClick={action.onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: isMobile ? '5px 10px' : '6px 12px',
        borderRadius: 6,
        border: action.primary
          ? `1px solid ${C.b}40`
          : `1px solid ${hovered ? C.bd2 : 'transparent'}`,
        background: action.primary
          ? (hovered ? C.b + '25' : C.b + '12')
          : (hovered ? C.sf2 : 'transparent'),
        color: action.primary ? C.b : C.t2,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: F,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
      title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
    >
      <span style={{ fontSize: 12, lineHeight: 1 }}>{action.icon}</span>
      <span>{action.label}</span>
      {action.shortcut && !isMobile && (
        <span style={{
          fontSize: 9,
          color: C.t3,
          fontFamily: M,
          padding: '1px 4px',
          borderRadius: 3,
          background: C.bg2,
          marginLeft: 2,
        }}>
          {action.shortcut}
        </span>
      )}
    </button>
  );
}
