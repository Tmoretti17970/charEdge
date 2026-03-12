// ═══════════════════════════════════════════════════════════════════
// charEdge — Widget Wrapper
//
// Sprint 21: Standardized wrapper for all Discover widgets.
// Features: collapsible header, lazy rendering via Intersection
// Observer, loading skeleton, and consistent styling.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { C, F } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';

function WidgetWrapper({
  id,
  title,
  icon,
  children,
  collapsible = true,
  lazy = true,
  defaultExpanded = true,
  accentColor,
  headerRight,
  ariaLabel,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [visible, setVisible] = useState(!lazy);
  const ref = useRef(null);

  // ─── Intersection Observer for lazy rendering ──────────────────
  useEffect(() => {
    if (!lazy || visible) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [lazy, visible]);

  const accent = accentColor || C.b;

  return (
    <div
      ref={ref}
      id={id ? `discover-widget-${id}` : undefined}
      role="region"
      aria-label={ariaLabel || title}
      style={{
        background: C.bg2,
        border: `1px solid ${C.bd}`,
        borderRadius: 14,
        overflow: 'hidden',
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* ─── Header ───────────────────────────────────────────── */}
      {title && (
        <button
          onClick={collapsible ? () => setExpanded(!expanded) : undefined}
          aria-expanded={expanded}
          aria-controls={id ? `discover-widget-body-${id}` : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '14px 18px',
            background: 'transparent',
            border: 'none',
            borderBottom: expanded ? `1px solid ${C.bd}` : 'none',
            cursor: collapsible ? 'pointer' : 'default',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            if (collapsible) e.currentTarget.style.background = alpha(accent, 0.04);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
          tabIndex={collapsible ? 0 : -1}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: C.t1,
                fontFamily: F,
              }}
            >
              {title}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {headerRight}
            {collapsible && (
              <span
                style={{
                  fontSize: 10,
                  color: C.t3,
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  display: 'inline-block',
                }}
              >
                ▼
              </span>
            )}
          </div>
        </button>
      )}

      {/* ─── Body ─────────────────────────────────────────────── */}
      {expanded && (
        <div
          id={id ? `discover-widget-body-${id}` : undefined}
          style={{ padding: title ? '16px 18px' : 0 }}
        >
          {visible ? (
            children
          ) : (
            <WidgetSkeleton />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton Placeholder ──────────────────────────────────────────
function WidgetSkeleton() {
  return (
    <div style={{ padding: '20px 0' }} aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="tf-skeleton-pulse"
          style={{
            height: 14,
            background: alpha(C.t3, 0.08),
            borderRadius: 6,
            marginBottom: 10,
            width: `${90 - i * 15}%`,
          }}
        />
      ))}
    </div>
  );
}

export { WidgetWrapper };

export default React.memo(WidgetWrapper);
