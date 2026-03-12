// ═══════════════════════════════════════════════════════════════════
// charEdge — Toolbar Slide Panel
// A lightweight, non-modal slide-in panel for toolbar sub-menus.
// Desktop: right-slide | Mobile: bottom-sheet (#38)
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState, useRef, useCallback } from 'react';
import { C, F } from '../../../../constants.js';
import { useBreakpoints } from '@/hooks/useMediaQuery';

export default function ToolbarSlidePanel({ isOpen, onClose, title, children, width = 280 }) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef(null);
  const { isMobile } = useBreakpoints();

  // #38: Touch swipe-to-dismiss state
  const touchStartY = useRef(0);
  const touchDeltaY = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);

  // Mount/unmount with animation delay
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
    } else {
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Click-outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    const t = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [isOpen, onClose]);

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

  // #38: Mobile swipe-to-dismiss handlers
  const onTouchStart = useCallback((e) => {
    touchStartY.current = e.touches[0].clientY;
    touchDeltaY.current = 0;
  }, []);

  const onTouchMove = useCallback((e) => {
    const delta = e.touches[0].clientY - touchStartY.current;
    touchDeltaY.current = delta;
    if (delta > 0) { // Only allow downward drag
      setDragOffset(delta);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (touchDeltaY.current > 80) {
      onClose(); // Dismiss if dragged more than 80px
    }
    setDragOffset(0);
  }, [onClose]);

  if (!mounted && !isOpen) return null;

  // #38: Mobile bottom-sheet styles
  if (isMobile) {
    return (
      <div
        ref={panelRef}
        className="tf-toolbar-slide"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '70vh',
          background: `rgba(${parseInt(C.bg.slice(1,3),16)||18},${parseInt(C.bg.slice(3,5),16)||18},${parseInt(C.bg.slice(5,7),16)||22},0.97)`,
          backdropFilter: 'blur(20px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
          transform: isOpen ? `translateY(${dragOffset}px)` : 'translateY(100%)',
          transition: dragOffset > 0 ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Drag handle */}
        <div style={{
          display: 'flex', justifyContent: 'center',
          padding: '10px 0 6px',
        }}>
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: 'rgba(255,255,255,0.2)',
          }} />
        </div>

        {/* Header */}
        <div style={{
          height: 40, minHeight: 40,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '0 16px',
        }}>
          <div style={{
            fontSize: 13, fontWeight: 700, fontFamily: F,
            color: C.t1, textTransform: 'uppercase',
          }}>{title}</div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 8,
              border: 'none', background: 'rgba(255,255,255,0.06)',
              color: C.t2, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}
          >✕</button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1, overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: `${C.bd} transparent`,
          padding: 14,
          paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
        }}>
          {children}
        </div>
      </div>
    );
  }

  // Desktop: right-slide (original behavior)
  return (
    <div
      ref={panelRef}
      className="tf-toolbar-slide"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width,
        maxWidth: '85vw',
        background: `rgba(${parseInt(C.bg.slice(1,3),16)||18},${parseInt(C.bg.slice(3,5),16)||18},${parseInt(C.bg.slice(5,7),16)||22},0.95)`,
        backdropFilter: 'blur(16px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.3)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '-8px 0 24px rgba(0,0,0,0.3)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        zIndex: 90,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 44,
          minHeight: 44,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          fontFamily: F,
          color: C.t1,
          letterSpacing: '-0.01em',
          textTransform: 'uppercase',
        }}>
          {title}
        </div>
        <button
          onClick={onClose}
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            color: C.t3,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
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
        style={{
          flex: 1,
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: `${C.bd} transparent`,
          padding: 12,
        }}
      >
        {children}
      </div>
    </div>
  );
}

