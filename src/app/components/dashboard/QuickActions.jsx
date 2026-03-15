// ═══════════════════════════════════════════════════════════════════
// charEdge — QuickActions (Sprint 46)
//
// Inline action row with keyboard shortcuts.
// T = new trade, C = chart, J = journal, W = watchlist
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useCallback, memo } from 'react';
import { C, M } from '../../../constants.js';
import { useUIStore } from '../../../state/useUIStore';
import { radii, transition } from '../../../theme/tokens.js';

const ACTIONS = [
  { label: '+ Add Trade', key: 'T', icon: '📝', page: null, action: 'addTrade' },
  { label: 'Open Chart', key: 'C', icon: '📈', page: 'charts' },
  { label: 'Journal', key: 'J', icon: '📓', page: 'journal' },
  { label: 'Watchlist', key: 'W', icon: '👀', page: null, action: 'focusWatchlist' },
];

function QuickActions({ isActive = true }) {
  const setPage = useUIStore((s) => s.setPage);

  const handleAction = useCallback(
    (act) => {
      if (act.page) {
        setPage(act.page);
      } else if (act.action === 'addTrade') {
        // Trigger trade modal (if available)
        const event = new CustomEvent('charEdge:addTrade');
        window.dispatchEvent(event);
      } else if (act.action === 'focusWatchlist') {
        const el = document.querySelector('[aria-label="Add symbol to watchlist"]');
        if (el) el.focus();
      }
    },
    [setPage],
  );

  // Keyboard shortcuts
  useEffect(() => {
    if (!isActive) return;
    const handler = (e) => {
      // Don't trigger if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      const key = e.key.toUpperCase();
      const action = ACTIONS.find((a) => a.key === key);
      if (action) {
        e.preventDefault();
        handleAction(action);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isActive, handleAction]);

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        padding: '8px 0',
      }}
    >
      {ACTIONS.map((act) => (
        <button
          key={act.key}
          onClick={() => handleAction(act)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            background: `${C.b}08`,
            border: `1px solid ${C.b}20`,
            borderRadius: radii.md,
            color: C.t1,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: `all ${transition.fast}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${C.b}18`;
            e.currentTarget.style.borderColor = C.b;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `${C.b}08`;
            e.currentTarget.style.borderColor = `${C.b}20`;
          }}
        >
          <span>{act.icon}</span>
          <span>{act.label}</span>
          <kbd
            style={{
              fontSize: 9,
              fontFamily: M,
              color: C.t3,
              background: `${C.bd}30`,
              padding: '1px 5px',
              borderRadius: radii.xs,
              marginLeft: 2,
            }}
          >
            {act.key}
          </kbd>
        </button>
      ))}
    </div>
  );
}

export default memo(QuickActions);
