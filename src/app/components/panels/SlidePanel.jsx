// ═══════════════════════════════════════════════════════════════════
// charEdge — Universal Slide Panel v2.0 (Sprint 2)
// Apple-quality slide-over panel with glassmorphism, drag-resize,
// spring animation, and integration with usePanelStore.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { C, F } from '../../../constants.js';
import sp from './SlidePanel.module.css';

const MAX_WIDTH = 800;

function SlidePanel({ isOpen, onClose, title, children, width = 340, minWidth = 280, onWidthChange }) {
  const [mounted, setMounted] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [currentWidth, setCurrentWidth] = useState(width);
  const panelRef = useRef(null);

  // Sync width prop
  useEffect(() => {
    if (!resizing) setCurrentWidth(width);
  }, [width, resizing]);

  // Mount/unmount with animation delay
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
    } else {
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // ─── Drag-to-resize ──────────────────────────────────────
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setResizing(true);
    const startX = e.clientX;
    const startWidth = currentWidth;

    const handleMove = (moveEvt) => {
      const delta = startX - moveEvt.clientX; // dragging left = wider
      const newWidth = Math.max(minWidth, Math.min(MAX_WIDTH, startWidth + delta));
      setCurrentWidth(newWidth);
    };

    const handleUp = () => {
      setResizing(false);
      onWidthChange?.(currentWidth);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [currentWidth, minWidth, onWidthChange]);

  if (!mounted && !isOpen) return null;

  return (
    <>
      {/* Backdrop — soft blur */}
      <div
        className={`tf-slide-backdrop ${sp.backdrop}`}
        onClick={onClose}
        style={{ opacity: isOpen ? 1 : 0 }}
      />

      {/* Panel — glassmorphic */}
      <div
        ref={panelRef}
        className={`tf-slide-panel ${sp.panel}`}
        style={{
          width: currentWidth,
          background: `rgba(${parseInt(C.bg.slice(1,3),16)||18},${parseInt(C.bg.slice(3,5),16)||18},${parseInt(C.bg.slice(5,7),16)||22},0.88)`,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: resizing ? 'none' : 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Resize handle */}
        <div className={sp.resizeHandle} onMouseDown={handleResizeStart}>
          <div className={sp.resizeIndicator} style={{ background: resizing ? C.b : 'rgba(255,255,255,0.1)' }} />
        </div>
        {/* Header */}
        <div className={sp.header}>
          <div className={sp.title} style={{ fontFamily: F, color: C.t1 }}>{title}</div>
          <button
            className={`tf-slide-close ${sp.closeBtn}`}
            onClick={onClose}
            style={{ color: C.t3 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = C.t1; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.t3; }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className={`tf-slide-panel-content ${sp.content}`} style={{ scrollbarColor: `${C.bd} transparent` }}>
          {children}
        </div>
      </div>
    </>
  );
}

export default React.memo(SlidePanel);
