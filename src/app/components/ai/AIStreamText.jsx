// ═══════════════════════════════════════════════════════════════════
// charEdge — AIStreamText (Sprint 61)
//
// Token-by-token streaming text display with cursor animation.
// Renders markdown-like formatting (bold, code, lists).
//
// Usage:
//   <AIStreamText text={streamedText} isStreaming={true} />
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef } from 'react';
import { C } from '../../../constants.js';
import st from './AIStreamText.module.css';

/** Streaming text with animated cursor */
export default function AIStreamText({ text, isStreaming = false, style = {} }) {
  const endRef = useRef(null);

  // Auto-scroll to bottom as text streams in
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [text]);

  if (!text) return null;

  // Simple markdown-like rendering
  const rendered = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.06);padding:1px 4px;border-radius:3px;font-size:11px;font-family:monospace">$1</code>')
    .replace(/\n/g, '<br/>');

  return (
    <div style={{
      fontSize: 12,
      fontFamily: 'var(--tf-font)',
      color: C.t2,
      lineHeight: 1.6,
      letterSpacing: '0.01em',
      ...style,
    }}>
      <span dangerouslySetInnerHTML={{ __html: rendered }} />
      {isStreaming && (
        <span
          style={{
            display: 'inline-block',
            width: 2,
            height: 14,
            background: C.b,
            marginLeft: 2,
            verticalAlign: 'text-bottom',
            animation: 'aiCursorBlink 0.8s ease-in-out infinite',
          }}
        />
      )}
      <div ref={endRef} />
      <style>{`
        @keyframes aiCursorBlink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
