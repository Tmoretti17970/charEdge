// ═══════════════════════════════════════════════════════════════════
// charEdge — AICard (Sprint 0 — AI Design Kit)
//
// Standard container for all AI-generated content. Built on top of
// the existing Card component with AI-specific branding:
//   • Compact AIOrb in header
//   • Optional AIConfidenceMeter
//   • Loading state via AILoadingSkeleton
//   • AI-tinted surface with left-border glow
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import AIConfidenceMeter from './AIConfidenceMeter.jsx';
import AILoadingSkeleton from './AILoadingSkeleton.jsx';
import AIOrb from './AIOrb.jsx';

/**
 * AICard — standard AI content container.
 *
 * @param {string}        title       - Header title
 * @param {string}        state       - AIOrb state (idle, thinking, streaming, etc.)
 * @param {number|null}   confidence  - Optional 0–1 confidence score
 * @param {boolean}       loading     - Show shimmer skeleton instead of children
 * @param {boolean}       collapsible - Enable click-to-collapse
 * @param {boolean}       defaultOpen - Start expanded (default true)
 * @param {React.ReactNode} children  - Card body content
 * @param {string}        className
 * @param {Object}        style
 */
export default function AICard({
  title = 'AI Analysis',
  state = 'idle',
  confidence = null,
  loading = false,
  collapsible = false,
  defaultOpen = true,
  children,
  className = '',
  style = {},
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  const handleToggle = () => {
    if (collapsible) setIsOpen((v) => !v);
  };

  return (
    <div
      className={`ai-card ${className}`}
      style={{
        background: 'var(--ai-surface, rgba(232,100,44,0.04))',
        borderRadius: 'var(--tf-radius-sm, 8px)',
        border: '1px solid var(--ai-border, rgba(232,100,44,0.12))',
        borderLeft: '3px solid var(--ai-glow-1, #FF8C42)',
        overflow: 'hidden',
        transition: 'border-color 0.2s ease, background 0.2s ease',
        ...style,
      }}
    >
      {/* Header */}
      <div
        onClick={handleToggle}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onKeyDown={
          collapsible
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggle();
                }
              }
            : undefined
        }
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          cursor: collapsible ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        <AIOrb size={16} state={state} glow={state === 'streaming'} />
        <span
          style={{
            flex: 1,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--tf-mono)',
            color: 'var(--tf-t2)',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}
        >
          {title}
        </span>
        {confidence !== null && <AIConfidenceMeter value={confidence} size={18} showLabel />}
        {collapsible && (
          <span
            style={{
              fontSize: 10,
              color: 'var(--tf-t3)',
              transition: 'transform 0.2s ease',
              transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
            }}
          >
            ▾
          </span>
        )}
      </div>

      {/* Body */}
      {isOpen && (
        <div style={{ padding: '0 12px 10px' }}>
          {loading ? <AILoadingSkeleton variant="compact" lines={3} /> : children}
        </div>
      )}
    </div>
  );
}

export { AICard };
