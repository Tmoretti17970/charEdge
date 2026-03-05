// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Context Menu
// Apple-style right-click context menu for selected drawings.
// Shows duplicate, delete, lock, visibility, and layer controls.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useCallback } from 'react';

const MENU_ITEMS = [
  { id: 'duplicate', label: 'Duplicate', icon: '⊕', shortcut: 'Ctrl+D' },
  { id: 'addLabel', label: 'Add Label', icon: '🏷' },
  { id: 'divider1' },
  { id: 'lock', label: 'Lock', icon: '🔒' },
  { id: 'hide', label: 'Hide', icon: '👁' },
  { id: 'syncTimeframes', label: 'Sync Across Timeframes', icon: '🔗' },
  { id: 'divider2' },
  { id: 'bringToFront', label: 'Bring to Front', icon: '↑' },
  { id: 'sendToBack', label: 'Send to Back', icon: '↓' },
  { id: 'divider3' },
  { id: 'delete', label: 'Delete', icon: '🗑', shortcut: 'Del', danger: true },
];

export default function DrawingContextMenu({ x, y, drawing, engine, onClose }) {
  const menuRef = useRef(null);

  // Close on click outside or Escape
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
      case 'duplicate':
        engine.duplicateDrawing(drawing.id);
        break;
      case 'lock':
        engine.toggleLock(drawing.id);
        break;
      case 'hide':
        engine.toggleVisibility(drawing.id);
        break;
      case 'bringToFront':
        engine.bringToFront(drawing.id);
        break;
      case 'sendToBack':
        engine.sendToBack(drawing.id);
        break;
      case 'addLabel': {
        const label = prompt('Enter label for this drawing:', drawing.meta?.label || '');
        if (label !== null) engine.setDrawingLabel(drawing.id, label);
        break;
      }
      case 'syncTimeframes':
        engine.toggleSyncAcrossTimeframes(drawing.id);
        break;
      case 'delete':
        engine.removeDrawing(drawing.id);
        break;
    }
    onClose();
  }, [drawing, engine, onClose]);

  if (!drawing) return null;

  // Build dynamic labels
  const items = MENU_ITEMS.map((item) => {
    if (item.id === 'lock') {
      return { ...item, label: drawing.locked ? 'Unlock' : 'Lock', icon: drawing.locked ? '🔓' : '🔒' };
    }
    if (item.id === 'hide') {
      return { ...item, label: drawing.visible ? 'Hide' : 'Show', icon: drawing.visible ? '👁‍🗨' : '👁' };
    }
    if (item.id === 'addLabel') {
      return { ...item, label: drawing.meta?.label ? `Edit Label "${drawing.meta.label}"` : 'Add Label' };
    }
    if (item.id === 'syncTimeframes') {
      return { ...item, label: drawing.syncAcrossTimeframes ? '✓ Synced Across TFs' : 'Sync Across Timeframes' };
    }
    return item;
  });

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 9999,
        minWidth: 200,
        background: 'rgba(24, 26, 32, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        padding: '4px 0',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
        fontSize: 13,
        color: '#D1D4DC',
        animation: 'scaleInSm 0.15s ease-out',
      }}
    >
      {items.map((item, i) => {
        if (item.id?.startsWith('divider')) {
          return (
            <div
              key={i}
              style={{
                height: 1,
                background: 'rgba(255,255,255,0.06)',
                margin: '4px 8px',
              }}
            />
          );
        }

        return (
          <button
            key={item.id}
            onClick={() => handleAction(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: '7px 12px',
              background: 'transparent',
              border: 'none',
              color: item.danger ? '#EF5350' : '#D1D4DC',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 13,
              borderRadius: 6,
              margin: '0 4px',
              boxSizing: 'border-box',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(41, 98, 255, 0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ width: 24, textAlign: 'center', marginRight: 8, fontSize: 14 }}>
              {item.icon}
            </span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.shortcut && (
              <span style={{ fontSize: 11, color: '#787B86', marginLeft: 16 }}>
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}

    </div>
  );
}
