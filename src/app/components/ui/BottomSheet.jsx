// ═══════════════════════════════════════════════════════════════════
// charEdge — Bottom Sheet System
//
// Sprint 6 S6.2: Reusable bottom sheet with snap points (30/50/90%).
// Uses Framer Motion for drag + spring physics.
// Features: drag handle, backdrop dismiss, escape key, safe-area.
// Respects prefers-reduced-motion.
// ═══════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { C, GLASS, DEPTH } from '../../../constants.js';

// Snap points as % of viewport height
const SNAP_POINTS = { min: 0.3, mid: 0.5, max: 0.9 };

// Spring config for snapping
const SPRING = { type: 'spring', damping: 28, stiffness: 300, mass: 0.8 };

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   children: React.ReactNode,
 *   initialSnap?: 'min' | 'mid' | 'max',
 *   title?: string,
 *   id?: string,
 * }} props
 */
export default function BottomSheet({
  open,
  onClose,
  children,
  initialSnap = 'mid',
  title,
  id = 'bottom-sheet',
}) {
  const reducedMotion = useReducedMotion();
  const sheetRef = useRef(null);
  const snapHeight = useRef(0);

  // Calculate snap point in px
  const getSnapPx = useCallback((snap) => {
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    return vh * (1 - SNAP_POINTS[snap]);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const handleDragEnd = useCallback((_e, info) => {
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const currentY = info.point.y;
    const velocity = info.velocity.y;

    // Fast downward swipe → close
    if (velocity > 500) {
      onClose();
      return;
    }

    // Fast upward swipe → max
    if (velocity < -500) {
      snapHeight.current = getSnapPx('max');
      return;
    }

    // Snap to nearest point
    const ratio = currentY / vh;
    if (ratio > 0.8) {
      onClose();
    } else if (ratio > 0.6) {
      snapHeight.current = getSnapPx('min');
    } else if (ratio > 0.35) {
      snapHeight.current = getSnapPx('mid');
    } else {
      snapHeight.current = getSnapPx('max');
    }
  }, [onClose, getSnapPx]);

  const initialY = getSnapPx(initialSnap);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            onClick={onClose}
            aria-hidden="true"
            style={{
              position: 'fixed',
              inset: 0,
              background: GLASS.backdrop,
              backdropFilter: GLASS.blurSm,
              WebkitBackdropFilter: GLASS.blurSm,
              zIndex: 1000,
            }}
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            key="sheet-content"
            role="dialog"
            aria-modal="true"
            aria-label={title || 'Bottom sheet'}
            id={id}
            drag="y"
            dragConstraints={{ top: getSnapPx('max'), bottom: getSnapPx('min') + 100 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            initial={{ y: '100%' }}
            animate={{ y: initialY }}
            exit={{ y: '100%' }}
            transition={reducedMotion ? { duration: 0 } : SPRING}
            style={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              top: 0,
              background: C.sf,
              borderRadius: '16px 16px 0 0',
              boxShadow: DEPTH[4],
              zIndex: 1001,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              touchAction: 'none',
            }}
          >
            {/* Drag handle */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '10px 0 6px',
                cursor: 'grab',
                flexShrink: 0,
              }}
            >
              <div className="tf-sheet-handle" />
            </div>

            {/* Title bar */}
            {title && (
              <div
                style={{
                  padding: '0 16px 10px',
                  fontSize: 15,
                  fontWeight: 600,
                  color: C.t1,
                  borderBottom: `1px solid ${C.bd}`,
                  flexShrink: 0,
                }}
              >
                {title}
              </div>
            )}

            {/* Content */}
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                WebkitOverflowScrolling: 'touch',
                padding: '12px 16px',
                paddingBottom: 'env(safe-area-inset-bottom, 16px)',
              }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export { BottomSheet, SNAP_POINTS };
