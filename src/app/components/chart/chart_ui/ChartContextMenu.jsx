// ═══════════════════════════════════════════════════════════════════
// charEdge v10.6 — Chart Context Menu
// Sprint 10 C10.4: Right-click on chart → contextual trade actions.
//
// Actions: Set as Entry, Set SL, Set TP, Add Alert, Quick Journal,
// Add Drawing, Copy Price
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { C, F, M } from '../../../../constants.js';
import Icon from '../../design/Icon.jsx';
import s from './ChartContextMenu.module.css';

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
      items.push({ label: <><Icon name="pin" size={11} /> Set Entry @ {price}</>, action: () => handlers.onSetEntry?.(menu.price, menu.barIdx) });
    }
    if (tradeStep === 'sl' || tradeStep === 'entry') {
      items.push({
        label: <><Icon name="stop-loss" size={11} /> Set Stop Loss @ {price}</>,
        action: () => handlers.onSetSL?.(menu.price, menu.barIdx),
        color: C.r,
      });
    }
    if (tradeStep === 'tp' || tradeStep === 'sl') {
      items.push({
        label: <><Icon name="target" size={11} /> Set Target @ {price}</>,
        action: () => handlers.onSetTP?.(menu.price, menu.barIdx),
        color: C.g,
      });
    }
    items.push(SEPARATOR);
    items.push({ label: '✕ Exit Trade Mode', action: handlers.onExitTradeMode, color: C.t3 });
  } else {
    // Not in trade mode: show trade entry options
    items.push({
      label: <><Icon name="long" size={11} /> Long Entry @ {price}</>,
      action: () => handlers.onLongEntry?.(menu.price, menu.barIdx),
      color: C.g,
    });
    items.push({
      label: <><Icon name="short" size={11} /> Short Entry @ {price}</>,
      action: () => handlers.onShortEntry?.(menu.price, menu.barIdx),
      color: C.r,
    });
    items.push(SEPARATOR);
    items.push({ label: <><Icon name="bell" size={11} /> Add Alert @ {price}</>, action: () => handlers.onAddAlert?.(menu.price) });
    items.push({ label: <><Icon name="edit" size={11} /> Quick Journal</>, action: handlers.onQuickJournal });
    items.push(SEPARATOR);
    items.push({ label: <><Icon name="changelog" size={11} /> Copy Price</>, action: () => handlers.onCopyPrice?.(menu.price) });
  }

  // Position: keep menu in viewport
  const menuW = 200;
  const menuH = items.length * 30;
  const x = Math.min(menu.x, window.innerWidth - menuW - 20);
  const y = Math.min(menu.y, window.innerHeight - menuH - 20);

  return (
    <div
      ref={ref}
      className={s.menu}
      style={{
        left: x,
        top: y,
        width: menuW,
        background: C.bg,
        border: `1px solid ${C.bd}`,
      }}
    >
      <div
        className={s.priceHeader}
        style={{ color: C.t3, fontFamily: M, borderBottom: `1px solid ${C.bd}` }}
      >
        Price: {price}
        {menu.date && (
          <span className={s.priceDate}>{new Date(menu.date).toLocaleDateString()}</span>
        )}
      </div>

      {items.map((item, i) => {
        if (item === SEPARATOR) {
          return <div key={i} className={s.separator} style={{ background: C.bd }} />;
        }
        return (
          <button
            className={`tf-btn ${s.menuItem}`}
            key={i}
            onClick={() => {
              item.action();
              onClose();
            }}
            style={{
              fontFamily: F,
              color: item.color || C.t1,
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
