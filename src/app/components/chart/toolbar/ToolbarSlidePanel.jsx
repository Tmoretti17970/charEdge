// ═══════════════════════════════════════════════════════════════════
// charEdge — Toolbar Slide Panel
// A lightweight, non-modal slide-in panel for toolbar sub-menus.
// Unlike the full SlidePanel (fixed overlay + backdrop blur), this:
//   - Slides from the right edge of the chart area
//   - Non-modal (no backdrop, chart stays interactive)
//   - Uses spring easing for smooth open/close
//   - Auto-closes on click-outside
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState, useRef } from 'react';
import { C, F } from '../../../../constants.js';

export default function ToolbarSlidePanel({ isOpen, onClose, title, children, width = 280 }) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef(null);

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
    // Delay to avoid same-click trigger
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

  if (!mounted && !isOpen) return null;

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
