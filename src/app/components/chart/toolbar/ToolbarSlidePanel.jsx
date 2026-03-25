// ═══════════════════════════════════════════════════════════════════
// charEdge — Toolbar Slide Panel
// A lightweight, non-modal slide-in panel for toolbar sub-menus.
// Desktop: right-slide | Mobile: bottom-sheet (#38)
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState, useRef, useCallback } from 'react';
import s from './ToolbarSlidePanel.module.css';
import { useBreakpoints } from '@/hooks/useMediaQuery';

export default function ToolbarSlidePanel({ isOpen, onClose, title, children, width = 280 }) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef(null);
  const { isMobile } = useBreakpoints();

  // #38: Touch swipe-to-dismiss state
  const touchStartY = useRef(0);
  const touchDeltaY = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
    } else {
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [isOpen, onClose]);

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

  const onTouchStart = useCallback((e) => {
    touchStartY.current = e.touches[0].clientY;
    touchDeltaY.current = 0;
  }, []);
  const onTouchMove = useCallback((e) => {
    const d = e.touches[0].clientY - touchStartY.current;
    touchDeltaY.current = d;
    if (d > 0) setDragOffset(d);
  }, []);
  const onTouchEnd = useCallback(() => {
    if (touchDeltaY.current > 80) onClose();
    setDragOffset(0);
  }, [onClose]);

  if (!mounted && !isOpen) return null;

  if (isMobile) {
    return (
      <div
        ref={panelRef}
        className={`tf-toolbar-slide ${s.mobileSheet}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        data-open={isOpen}
        style={{
          transform: isOpen ? `translateY(${dragOffset}px)` : undefined,
          transition: dragOffset > 0 ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <div className={s.dragHandle}>
          <div className={s.dragHandleBar} />
        </div>
        <div className={s.header}>
          <div className={s.headerTitle}>{title}</div>
          <button onClick={onClose} className={s.closeBtn}>
            ✕
          </button>
        </div>
        <div className={s.mobileContent}>{children}</div>
      </div>
    );
  }

  return (
    <div ref={panelRef} className={`tf-toolbar-slide ${s.desktopSlide}`} style={{ width }} data-open={isOpen}>
      <div className={s.header}>
        <div className={s.headerTitle}>{title}</div>
        <button onClick={onClose} className={s.closeBtn}>
          ✕
        </button>
      </div>
      <div className={s.content}>{children}</div>
    </div>
  );
}
