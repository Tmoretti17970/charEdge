// ═══════════════════════════════════════════════════════════════════
// charEdge v11.0 — Global Quick-Add Modal
// Spotlight-style global Trade Entry overlay
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import JournalQuickAdd from '../../features/journal/journal_ui/JournalQuickAdd.jsx';
import { toast } from '../ui/Toast.jsx';

export default function GlobalQuickAddModal() {
  const [isOpen, setIsOpen] = useState(false);
  const addTrade = useJournalStore((s) => s.addTrade);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const _handleClose = () => setIsOpen(false);

    window.addEventListener('charEdge:global-quick-add', handleOpen);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('charEdge:global-quick-add', handleOpen);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSave = (trade) => {
    addTrade(trade);
    setIsOpen(false);
    toast.success('Trade quickly added!');
  };

  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
    } else {
      setAnimating(false);
    }
  }, [isOpen]);

  const handleTransitionEnd = useCallback((e) => {
    if (!isOpen && e.target === e.currentTarget) setMounted(false);
  }, [isOpen]);

  if (!mounted) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 6000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '20vh',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={() => setIsOpen(false)}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          opacity: animating ? 1 : 0,
          transition: 'opacity 150ms ease',
        }}
      />

      {/* Modal Content */}
      <div
        onTransitionEnd={handleTransitionEnd}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 700,
          padding: '0 20px',
          opacity: animating ? 1 : 0,
          transform: animating ? 'translateY(0) scale(1)' : 'translateY(-20px) scale(0.95)',
          transition: 'opacity 150ms ease-out, transform 150ms ease-out',
        }}
      >
        <div
          style={{
            background: C.sf,
            borderRadius: 12,
            boxShadow: '0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 20px',
              borderBottom: `1px solid ${C.bd}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, fontFamily: F }}>
              ⚡ Global Quick-Add
            </div>
            <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
              Press <kbd style={{ padding: '2px 6px', background: C.bg2, borderRadius: 4, border: `1px solid ${C.bd}` }}>ESC</kbd> to close
            </div>
          </div>
          <div style={{ padding: 20 }}>
            <JournalQuickAdd onSave={handleSave} onCancel={() => setIsOpen(false)} />
          </div>
        </div>
      </div>
    </div>
  );
}
