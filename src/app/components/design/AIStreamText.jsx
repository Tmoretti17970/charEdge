// ═══════════════════════════════════════════════════════════════════
// charEdge — AIStreamText (Sprint 0 — AI Design Kit)
//
// Token-by-token text reveal with blinking cursor.
// Used by all AI-generated text surfaces. Falls back to instant
// render when text hasn't changed (no re-animation on same content).
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * AIStreamText — progressive text reveal with cursor blink.
 *
 * @param {string}   text       - Full text to reveal
 * @param {number}   speed      - Milliseconds per character (default 18)
 * @param {Function} onComplete - Called when reveal finishes
 * @param {boolean}  instant    - If true, skip animation and show full text
 * @param {string}   className  - Additional class
 * @param {Object}   style      - Additional inline styles
 */
export default function AIStreamText({
  text = '',
  speed = 18,
  onComplete,
  instant = false,
  className = '',
  style = {},
}) {
  const [revealed, setRevealed] = useState(instant ? text.length : 0);
  const prevTextRef = useRef(text);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  // Reset when text changes
  useEffect(() => {
    if (text !== prevTextRef.current) {
      prevTextRef.current = text;
      if (instant) {
        setRevealed(text.length);
      } else {
        setRevealed(0);
        startRef.current = null;
      }
    }
  }, [text, instant]);

  // Animation loop
  const animate = useCallback((timestamp) => {
    if (!startRef.current) startRef.current = timestamp;
    const elapsed = timestamp - startRef.current;
    const chars = Math.min(Math.floor(elapsed / speed), text.length);
    setRevealed(chars);

    if (chars < text.length) {
      rafRef.current = requestAnimationFrame(animate);
    } else {
      onComplete?.();
    }
  }, [text, speed, onComplete]);

  useEffect(() => {
    if (instant || revealed >= text.length) return;

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [animate, instant, revealed, text.length]);

  const isComplete = revealed >= text.length;
  const displayText = text.slice(0, revealed);

  return (
    <span
      className={`ai-stream-text ${className}`}
      style={{
        fontFamily: 'var(--tf-font)',
        fontSize: 'var(--tf-density-font-base, 13px)',
        lineHeight: 1.5,
        color: 'var(--tf-t1)',
        whiteSpace: 'pre-wrap',
        ...style,
      }}
    >
      {displayText}
      {!isComplete && (
        <span
          className="ai-stream-cursor"
          style={{
            display: 'inline-block',
            width: 2,
            height: '1em',
            background: 'var(--ai-glow-1, #FF8C42)',
            marginLeft: 1,
            verticalAlign: 'text-bottom',
            animation: 'ai-cursor-blink 0.8s steps(1) infinite',
          }}
          aria-hidden="true"
        />
      )}
    </span>
  );
}

export { AIStreamText };
