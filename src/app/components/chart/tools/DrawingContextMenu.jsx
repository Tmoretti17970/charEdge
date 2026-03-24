// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Context Menu
// Apple-style right-click context menu for selected drawings.
// Shows duplicate, delete, lock, visibility, and layer controls.
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useCallback, useState } from 'react';
import { createDrawingAlert } from '../../../../charting_library/tools/DrawingAlertEngine.js';
import s from './DrawingContextMenu.module.css';

const MENU_ITEMS = [
  { id: 'duplicate', label: 'Duplicate', icon: '⊕', shortcut: 'Ctrl+D' },
  { id: 'addLabel', label: 'Add Label', icon: '🏷' },
  { id: 'addAlert', label: 'Add Alert', icon: '🔔', hasSubmenu: true },
  { id: 'divider1' },
  { id: 'lock', label: 'Lock', icon: '🔒' },
  { id: 'hide', label: 'Hide', icon: '👁' },
  { id: 'syncTimeframes', label: 'Sync Across Timeframes', icon: '🔗' },
  { id: 'divider2' },
  { id: 'bringToFront', label: 'Bring to Front', icon: '↑' },
  { id: 'sendToBack', label: 'Send to Back', icon: '↓' },
  { id: 'groupSelected', label: 'Group', icon: '📎' },
  { id: 'ungroupSelected', label: 'Ungroup', icon: '📌' },
  { id: 'selectAll', label: 'Select All', icon: '⬜', shortcut: '⌘A' },
  { id: 'divider3' },
  { id: 'delete', label: 'Delete', icon: '🗑', shortcut: 'Del', danger: true },
];

const ALERT_SUBMENU = [
  { id: 'alert_cross', label: 'Cross (touch)', icon: '↗' },
  { id: 'alert_enter', label: 'Enter (break in)', icon: '→' },
  { id: 'alert_exit', label: 'Exit (break out)', icon: '←' },
];

export default function DrawingContextMenu({ x, y, drawing, engine, onClose }) {
  const menuRef = useRef(null);
  const [alertSubmenuOpen, setAlertSubmenuOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const handleEscape = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleEscape, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [onClose]);

  const handleAction = useCallback((id) => {
    if (!drawing || !engine) return;
    switch (id) {
      case 'duplicate': engine.duplicateDrawing(drawing.id); break;
      case 'lock': engine.toggleLock(drawing.id); break;
      case 'hide': engine.toggleVisibility(drawing.id); break;
      case 'bringToFront': engine.bringToFront(drawing.id); break;
      case 'sendToBack': engine.sendToBack(drawing.id); break;
      case 'addLabel': {
        const label = prompt('Enter label for this drawing:', drawing.meta?.label || '');
        if (label !== null) engine.setDrawingLabel(drawing.id, label);
        break;
      }
      case 'syncTimeframes': engine.toggleSyncAcrossTimeframes(drawing.id); break;
      case 'alert_cross':
      case 'alert_enter':
      case 'alert_exit': {
        const triggerMap = { alert_cross: 'cross', alert_enter: 'enter', alert_exit: 'exit' };
        createDrawingAlert(drawing, triggerMap[id]);
        if (engine.enableAlert) engine.enableAlert(drawing.id, { trigger: triggerMap[id] });
        break;
      }
      case 'groupSelected': if (engine.groupSelected) engine.groupSelected(); break;
      case 'ungroupSelected': if (engine.ungroupSelected) engine.ungroupSelected(); break;
      case 'selectAll': if (engine.selectAll) engine.selectAll(); break;
      case 'delete': engine.removeDrawing(drawing.id); break;
    }
    onClose();
  }, [drawing, engine, onClose]);

  if (!drawing) return null;

  const items = MENU_ITEMS.map((item) => {
    if (item.id === 'lock') return { ...item, label: drawing.locked ? 'Unlock' : 'Lock', icon: drawing.locked ? '🔓' : '🔒' };
    if (item.id === 'hide') return { ...item, label: drawing.visible ? 'Hide' : 'Show', icon: drawing.visible ? '👁‍🗨' : '👁' };
    if (item.id === 'addLabel') return { ...item, label: drawing.meta?.label ? `Edit Label "${drawing.meta.label}"` : 'Add Label' };
    if (item.id === 'syncTimeframes') return { ...item, label: drawing.syncAcrossTimeframes ? '✓ Synced Across TFs' : 'Sync Across Timeframes' };
    return item;
  });

  return (
    <div ref={menuRef} className={s.menu} style={{ left: x, top: y }}>
      {items.map((item, i) => {
        if (item.id?.startsWith('divider')) {
          return <div key={i} className={s.divider} />;
        }
        return (
          <div
            key={item.id}
            className={s.itemWrap}
            onMouseEnter={() => item.hasSubmenu && setAlertSubmenuOpen(true)}
            onMouseLeave={() => item.hasSubmenu && setAlertSubmenuOpen(false)}
          >
            <button
              className={s.item}
              onClick={() => !item.hasSubmenu && handleAction(item.id)}
              data-danger={item.danger || undefined}
            >
              <span className={s.itemIcon}>{item.icon}</span>
              <span className={s.itemLabel}>{item.label}</span>
              {item.shortcut && <span className={s.itemShortcut}>{item.shortcut}</span>}
              {item.hasSubmenu && <span className={s.itemArrow}>▸</span>}
            </button>
            {item.hasSubmenu && alertSubmenuOpen && (
              <div className={s.submenu}>
                {ALERT_SUBMENU.map((sub) => (
                  <button key={sub.id} onClick={() => handleAction(sub.id)} className={s.item}>
                    <span className={s.itemIcon}>{sub.icon}</span>
                    <span className={s.itemLabel}>{sub.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
