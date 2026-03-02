// ═══════════════════════════════════════════════════════════════════
// charEdge — Universal Slide Panel v2.0 (Sprint 2)
// Apple-quality slide-over panel with glassmorphism, drag-resize,
// spring animation, and integration with usePanelStore.
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { C, F, M } from '../../../constants.js';

const MAX_WIDTH = 800;

export default function SlidePanel({ isOpen, onClose, title, children, width = 340, minWidth = 280, onWidthChange }) {
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
        className="tf-slide-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(8px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(8px) saturate(1.4)',
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 1000,
          cursor: 'pointer',
        }}
      />

      {/* Panel — glassmorphic */}
      <div
        ref={panelRef}
        className="tf-slide-panel"
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          right: 0,
          width: currentWidth,
          maxWidth: '95vw',
          background: `rgba(${parseInt(C.bg.slice(1,3),16)||18},${parseInt(C.bg.slice(3,5),16)||18},${parseInt(C.bg.slice(5,7),16)||22},0.88)`,
          backdropFilter: 'blur(24px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
          borderLeft: `1px solid rgba(255,255,255,0.06)`,
          boxShadow: `-12px 0 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03) inset`,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: resizing ? 'none' : 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          style={{
            position: 'absolute',
            top: 0,
            left: -3,
            bottom: 0,
            width: 6,
            cursor: 'col-resize',
            zIndex: 10,
          }}
        >
          {/* Visual resize indicator */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 2,
              transform: 'translateY(-50%)',
              width: 3,
              height: 32,
              borderRadius: 2,
              background: resizing ? C.b : `rgba(255,255,255,0.1)`,
              transition: 'background 0.2s ease, height 0.2s ease',
            }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            height: 52,
            minHeight: 52,
            borderBottom: `1px solid rgba(255,255,255,0.06)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            fontFamily: F,
            color: C.t1,
            letterSpacing: '-0.01em',
          }}>
            {title}
          </div>
          <button
            className="tf-slide-close"
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: C.t3,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = C.t1; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.t3; }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div
          className="tf-slide-panel-content"
          style={{
            flex: 1,
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: `${C.bd} transparent`,
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
