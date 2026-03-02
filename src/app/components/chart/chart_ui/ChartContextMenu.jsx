// ═══════════════════════════════════════════════════════════════════
// charEdge v10.6 — Chart Context Menu
// Sprint 10 C10.4: Right-click on chart → contextual trade actions.
//
// Actions: Set as Entry, Set SL, Set TP, Add Alert, Quick Journal,
// Add Drawing, Copy Price
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { C, F, M } from '../../../../constants.js';

const SEPARATOR = null;

/**
 * @param {Object} menu - { x, y, price, barIdx, date }
 * @param {Function} onClose
 * @param {Object} handlers - { onSetEntry, onSetSL, onSetTP, onAddAlert, onQuickJournal, onCopyPrice, onLongEntry, onShortEntry }
 * @param {boolean} tradeMode - Whether trade entry mode is active
 * @param {string} tradeStep - Current step: 'entry' | 'sl' | 'tp' | 'ready'
 */
export default function ChartContextMenu({ menu, onClose, handlers, tradeMode, tradeStep }) {
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!menu) return null;

  const price = menu.price?.toFixed(2) ?? '—';

  // Build menu items based on state
  const items = [];

  if (tradeMode) {
    // In trade mode: show step-appropriate actions
    if (tradeStep === 'entry' || tradeStep === 'idle') {
      items.push({ label: `📍 Set Entry @ ${price}`, action: () => handlers.onSetEntry?.(menu.price, menu.barIdx) });
    }
    if (tradeStep === 'sl' || tradeStep === 'entry') {
      items.push({
        label: `🛑 Set Stop Loss @ ${price}`,
        action: () => handlers.onSetSL?.(menu.price, menu.barIdx),
        color: C.r,
      });
    }
    if (tradeStep === 'tp' || tradeStep === 'sl') {
      items.push({
        label: `🎯 Set Target @ ${price}`,
        action: () => handlers.onSetTP?.(menu.price, menu.barIdx),
        color: C.g,
      });
    }
    items.push(SEPARATOR);
    items.push({ label: '✕ Exit Trade Mode', action: handlers.onExitTradeMode, color: C.t3 });
  } else {
    // Not in trade mode: show trade entry options
    items.push({
      label: `📈 Long Entry @ ${price}`,
      action: () => handlers.onLongEntry?.(menu.price, menu.barIdx),
      color: C.g,
    });
    items.push({
      label: `📉 Short Entry @ ${price}`,
      action: () => handlers.onShortEntry?.(menu.price, menu.barIdx),
      color: C.r,
    });
    items.push(SEPARATOR);
    items.push({ label: `🔔 Add Alert @ ${price}`, action: () => handlers.onAddAlert?.(menu.price) });
    items.push({ label: '📝 Quick Journal', action: handlers.onQuickJournal });
    items.push(SEPARATOR);
    items.push({ label: '📋 Copy Price', action: () => handlers.onCopyPrice?.(menu.price) });
  }

  // Position: keep menu in viewport
  const menuW = 200;
  const menuH = items.length * 30;
  const x = Math.min(menu.x, window.innerWidth - menuW - 20);
  const y = Math.min(menu.y, window.innerHeight - menuH - 20);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 200,
        width: menuW,
        background: C.bg,
        border: `1px solid ${C.bd}`,
        borderRadius: 8,
        padding: 4,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}
    >
      {/* Price header */}
      <div
        style={{
          padding: '4px 10px 6px',
          fontSize: 9,
          fontWeight: 700,
          color: C.t3,
          fontFamily: M,
          borderBottom: `1px solid ${C.bd}`,
          marginBottom: 2,
        }}
      >
        Price: {price}
        {menu.date && (
          <span style={{ float: 'right', fontWeight: 400 }}>{new Date(menu.date).toLocaleDateString()}</span>
        )}
      </div>

      {items.map((item, i) => {
        if (item === SEPARATOR) {
          return <div key={i} style={{ height: 1, background: C.bd, margin: '2px 4px' }} />;
        }
        return (
          <button
            className="tf-btn"
            key={i}
            onClick={() => {
              item.action();
              onClose();
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '6px 10px',
              fontSize: 11,
              fontFamily: F,
              background: 'none',
              border: 'none',
              color: item.color || C.t1,
              cursor: 'pointer',
              borderRadius: 4,
              fontWeight: 500,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.sf)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
