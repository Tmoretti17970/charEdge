// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Tooltip Component
//
// Portal-based tooltip positioned relative to its trigger element.
// Supports placement, delay, and arrow pointer.
//
// Usage:
//   <Tooltip content="Hello world">
//     <button>Hover me</button>
//   </Tooltip>
//
//   <Tooltip content="Details here" placement="bottom" delay={300}>
//     <span>Info</span>
//   </Tooltip>
// ═══════════════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import s from '../../../styles/Tooltip.module.css';

const ARROW_MAP = {
  top: 'arrowTop',
  bottom: 'arrowBottom',
  left: 'arrowLeft',
  right: 'arrowRight',
};

const GAP = 8; // distance from trigger

/**
 * Calculate tooltip position relative to trigger element.
 * @param {DOMRect} triggerRect
 * @param {DOMRect} tooltipRect
 * @param {'top'|'bottom'|'left'|'right'} placement
 * @returns {{ top: number, left: number }}
 */
function calcPosition(triggerRect, tooltipRect, placement) {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  switch (placement) {
    case 'bottom':
      return {
        top: triggerRect.bottom + GAP + scrollY,
        left: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2 + scrollX,
      };
    case 'left':
      return {
        top: triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2 + scrollY,
        left: triggerRect.left - tooltipRect.width - GAP + scrollX,
      };
    case 'right':
      return {
        top: triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2 + scrollY,
        left: triggerRect.right + GAP + scrollX,
      };
    case 'top':
    default:
      return {
        top: triggerRect.top - tooltipRect.height - GAP + scrollY,
        left: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2 + scrollX,
      };
  }
}

/**
 * Tooltip component with configurable placement and delay.
 * @param {Object} props
 * @param {React.ReactNode} props.content - Tooltip content (string or JSX)
 * @param {'top'|'bottom'|'left'|'right'} [props.placement='top'] - Placement
 * @param {number} [props.delay=200] - Show delay in ms
 * @param {React.ReactNode} props.children - Trigger element
 * @param {boolean} [props.disabled=false] - Disable tooltip
 */
export default function Tooltip({
  content,
  placement = 'top',
  delay = 200,
  children,
  disabled = false,
}) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);
  const timerRef = useRef(null);

  const show = useCallback(() => {
    if (disabled || !content) return;
    timerRef.current = setTimeout(() => {
      setVisible(true);
    }, delay);
  }, [disabled, content, delay]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  // Position the tooltip when it becomes visible
  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const pos = calcPosition(triggerRect, tooltipRect, placement);

    // Clamp to viewport
    const maxLeft = window.innerWidth - tooltipRect.width - 8;
    pos.left = Math.max(8, Math.min(pos.left, maxLeft));

    setPosition(pos);
  }, [visible, placement]);

  // Cleanup timer on unmount
  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <>
      <span
        ref={triggerRef}
        className={s.trigger}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>

      {createPortal(
        visible ? (
          <div
            ref={tooltipRef}
            className={`${s.tooltip} ${s.visible}`}
            style={{
              top: position.top,
              left: position.left,
              opacity: 1,
              scale: 1,
              transition: 'opacity 150ms ease, scale 150ms ease',
            }}
            role="tooltip"
          >
            {content}
            <span className={`${s.arrow} ${s[ARROW_MAP[placement]]}`} />
          </div>
        ) : null,
        document.body,
      )}
    </>
  );
}
