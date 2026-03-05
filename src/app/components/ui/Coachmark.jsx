// ═══════════════════════════════════════════════════════════════════
// charEdge — Coachmark (Sprint 16: Micro-Onboarding)
//
// Contextual tooltip that appears once per feature, pointing at a
// UI element. Integrated with useUserStore for persistence.
//
// Props:
//   tipId      – unique string, tracked in useUserStore
//   targetRef  – React ref to anchor element (preferred)
//   targetSel  – CSS selector to anchor element (fallback)
//   title      – bold heading
//   message    – description text
//   position   – 'top' | 'bottom' | 'left' | 'right' (default: 'bottom')
//   ctaLabel   – optional CTA button text
//   onCta      – optional CTA callback
//   delay      – optional appearance delay in ms (default: 800)
// ═══════════════════════════════════════════════════════════════════

import { useUserStore } from '../../../state/useUserStore.js';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { C, F, M } from '../../../constants.js';

export default function Coachmark({
  tipId,
  targetRef,
  targetSel,
  title,
  message,
  position = 'bottom',
  ctaLabel,
  onCta,
  delay = 800,
}) {
  const isDismissed = useUserStore((s) => s.isTipDismissed(tipId));
  const dismissTip = useUserStore((s) => s.dismissTip);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState(null);
  const tooltipRef = useRef(null);

  const updatePosition = useCallback(() => {
    let el = targetRef?.current;
    if (!el && targetSel) {
      el = document.querySelector(targetSel);
    }
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const tooltip = tooltipRef.current;
    const tw = tooltip?.offsetWidth || 260;
    const th = tooltip?.offsetHeight || 100;
    const gap = 12;

    let top, left;

    switch (position) {
      case 'top':
        top = rect.top - th - gap;
        left = rect.left + rect.width / 2 - tw / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - th / 2;
        left = rect.left - tw - gap;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - th / 2;
        left = rect.right + gap;
        break;
      case 'bottom':
      default:
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tw / 2;
        break;
    }

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - th - 8));

    setCoords({ top, left });
  }, [targetRef, targetSel, position]);

  useEffect(() => {
    if (isDismissed) return;

    const timer = setTimeout(() => {
      setVisible(true);
      // Position after first render
      requestAnimationFrame(updatePosition);
    }, delay);

    return () => clearTimeout(timer);
  }, [isDismissed, delay, updatePosition]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!visible) return;
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [visible, updatePosition]);

  const handleDismiss = () => {
    setVisible(false);
    dismissTip(tipId);
  };

  if (isDismissed || !visible) return null;

  const arrowSize = 8;
  const arrowStyle = {
    position: 'absolute',
    width: 0,
    height: 0,
    ...(position === 'bottom' && {
      top: -arrowSize,
      left: '50%',
      transform: 'translateX(-50%)',
      borderLeft: `${arrowSize}px solid transparent`,
      borderRight: `${arrowSize}px solid transparent`,
      borderBottom: `${arrowSize}px solid ${C.sf}`,
    }),
    ...(position === 'top' && {
      bottom: -arrowSize,
      left: '50%',
      transform: 'translateX(-50%)',
      borderLeft: `${arrowSize}px solid transparent`,
      borderRight: `${arrowSize}px solid transparent`,
      borderTop: `${arrowSize}px solid ${C.sf}`,
    }),
    ...(position === 'left' && {
      right: -arrowSize,
      top: '50%',
      transform: 'translateY(-50%)',
      borderTop: `${arrowSize}px solid transparent`,
      borderBottom: `${arrowSize}px solid transparent`,
      borderLeft: `${arrowSize}px solid ${C.sf}`,
    }),
    ...(position === 'right' && {
      left: -arrowSize,
      top: '50%',
      transform: 'translateY(-50%)',
      borderTop: `${arrowSize}px solid transparent`,
      borderBottom: `${arrowSize}px solid transparent`,
      borderRight: `${arrowSize}px solid ${C.sf}`,
    }),
  };

  return createPortal(
    <div
      ref={tooltipRef}
      className="tf-coachmark"
      style={{
        position: 'fixed',
        zIndex: 10000,
        top: coords?.top ?? -9999,
        left: coords?.left ?? -9999,
        width: 260,
        padding: '16px 18px',
        background: C.sf,
        border: `1px solid ${C.b}40`,
        borderRadius: 12,
        boxShadow: `0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px ${C.b}15`,
        backdropFilter: 'blur(16px)',
        animation: 'scaleInSm 0.3s ease forwards',
        fontFamily: F,
      }}
    >
      {/* Arrow */}
      <div style={arrowStyle} />

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: 'none',
          border: 'none',
          color: C.t3,
          fontSize: 14,
          cursor: 'pointer',
          padding: '2px 6px',
          borderRadius: 4,
          lineHeight: 1,
        }}
      >
        ✕
      </button>

      {/* Content */}
      {title && (
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.t1,
            marginBottom: 4,
            paddingRight: 20,
          }}
        >
          {title}
        </div>
      )}
      <div
        style={{
          fontSize: 12,
          color: C.t2,
          lineHeight: 1.5,
          marginBottom: ctaLabel ? 12 : 0,
        }}
      >
        {message}
      </div>

      {/* CTA */}
      {ctaLabel && (
        <button
          onClick={() => {
            if (onCta) onCta();
            handleDismiss();
          }}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: 'none',
            background: C.b,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: F,
            cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          {ctaLabel}
        </button>
      )}

    </div>,
    document.body,
  );
}
