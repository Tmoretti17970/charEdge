// ═══════════════════════════════════════════════════════════════════
// charEdge — Hotkey Customization Panel
// Lets users view and rebind keyboard shortcuts.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import s from './HotkeyCustomizationPanel.module.css';
import { logger } from '@/observability/logger';

const STORAGE_KEY = 'charEdge-hotkeys';

const DEFAULT_HOTKEYS = [
  { id: 'tf_1m', label: 'Switch to 1m', category: 'Timeframe', defaultKey: '1', key: '1' },
  { id: 'tf_5m', label: 'Switch to 5m', category: 'Timeframe', defaultKey: '2', key: '2' },
  { id: 'tf_15m', label: 'Switch to 15m', category: 'Timeframe', defaultKey: '3', key: '3' },
  { id: 'tf_1h', label: 'Switch to 1h', category: 'Timeframe', defaultKey: '4', key: '4' },
  { id: 'tf_4h', label: 'Switch to 4h', category: 'Timeframe', defaultKey: '5', key: '5' },
  { id: 'tf_1d', label: 'Switch to 1D', category: 'Timeframe', defaultKey: '6', key: '6' },
  { id: 'undo', label: 'Undo Drawing', category: 'Drawing', defaultKey: 'Ctrl+Z', key: 'Ctrl+Z' },
  { id: 'redo', label: 'Redo Drawing', category: 'Drawing', defaultKey: 'Ctrl+Y', key: 'Ctrl+Y' },
  { id: 'escape', label: 'Deselect Tool', category: 'Drawing', defaultKey: 'Escape', key: 'Escape' },
  { id: 'copilot', label: 'Toggle AI Copilot', category: 'Tools', defaultKey: 'Ctrl+K', key: 'Ctrl+K' },
  { id: 'snapshot', label: 'Share Snapshot', category: 'Tools', defaultKey: 'Ctrl+S', key: 'Ctrl+S' },
  { id: 'shortcuts', label: 'Show Shortcuts', category: 'Tools', defaultKey: '?', key: '?' },
  { id: 'insights', label: 'Toggle Insights', category: 'Tools', defaultKey: 'I', key: 'I' },
  { id: 'crosshair', label: 'Crosshair Mode', category: 'Chart', defaultKey: 'C', key: 'C' },
  { id: 'trendline', label: 'Trendline Tool', category: 'Drawing', defaultKey: 'T', key: 'T' },
  { id: 'hline', label: 'Horizontal Line', category: 'Drawing', defaultKey: 'H', key: 'H' },
  { id: 'fib', label: 'Fibonacci', category: 'Drawing', defaultKey: 'F', key: 'F' },
  { id: 'measure', label: 'Measure Tool', category: 'Drawing', defaultKey: 'M', key: 'M' },
];

function loadHotkeys() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return DEFAULT_HOTKEYS.map((hk) => ({ ...hk, key: parsed[hk.id] || hk.defaultKey }));
    }
  } catch (e) {
    logger.ui.warn('Operation failed', e);
  }
  return DEFAULT_HOTKEYS.map((hk) => ({ ...hk }));
}

function saveHotkeys(hotkeys) {
  const map = {};
  hotkeys.forEach((hk) => {
    map[hk.id] = hk.key;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export default function HotkeyCustomizationPanel({ onClose }) {
  const [hotkeys, setHotkeys] = useState(loadHotkeys);
  const [editingId, setEditingId] = useState(null);
  const [listening, setListening] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const handleRebind = useCallback((id) => {
    setEditingId(id);
    setListening(true);
  }, []);

  useEffect(() => {
    if (!listening || !editingId) return;
    setCountdown(5);
    const countdownTimer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          setEditingId(null);
          setListening(false);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      let keyStr = '';
      if (e.ctrlKey || e.metaKey) keyStr += 'Ctrl+';
      if (e.shiftKey) keyStr += 'Shift+';
      if (e.altKey) keyStr += 'Alt+';
      const key = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        keyStr += key;
        setHotkeys((prev) => {
          const updated = prev.map((hk) => (hk.id === editingId ? { ...hk, key: keyStr } : hk));
          saveHotkeys(updated);
          return updated;
        });
        setEditingId(null);
        setListening(false);
        setCountdown(0);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => {
      window.removeEventListener('keydown', handler, true);
      clearInterval(countdownTimer);
    };
  }, [listening, editingId]);

  const resetAll = useCallback(() => {
    const reset = DEFAULT_HOTKEYS.map((hk) => ({ ...hk }));
    setHotkeys(reset);
    saveHotkeys(reset);
  }, []);
  const categories = [...new Set(hotkeys.map((hk) => hk.category))];

  return (
    <div className={s.root}>
      <div className={s.header}>
        <span className={s.headerTitle}>⌨️ Keyboard Shortcuts</span>
        <div className={s.headerActions}>
          <button onClick={resetAll} className={s.resetBtn}>
            Reset All
          </button>
          <button onClick={onClose} className={s.closeBtn}>
            ×
          </button>
        </div>
      </div>
      <div className={s.body}>
        {categories.map((cat) => (
          <div key={cat}>
            <div className={s.catLabel}>{cat.toUpperCase()}</div>
            {hotkeys
              .filter((hk) => hk.category === cat)
              .map((hk) => (
                <div key={hk.id} className={s.hotkeyRow}>
                  <span className={s.hotkeyLabel}>{hk.label}</span>
                  <button
                    onClick={() => handleRebind(hk.id)}
                    className={s.hotkeyBtn}
                    data-editing={editingId === hk.id || undefined}
                  >
                    {editingId === hk.id ? `Press key... ${countdown}s` : hk.key}
                  </button>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
