// ═══════════════════════════════════════════════════════════════════
// charEdge — IntelCard
//
// Unified container component for all Intel page sections.
// Provides consistent header, collapse/expand, badge, and layout.
// Implements Glass Depth "raised" tier styling.
// ═══════════════════════════════════════════════════════════════════

import { ChevronDown } from 'lucide-react';
import React, { useState } from 'react';
import s from './IntelCard.module.css';

function IntelCard({
  icon,
  title,
  badge,
  badgeColor,
  actions,
  collapsible = true,
  defaultCollapsed = false,
  children,
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className={s.card}>
      {/* Header */}
      {collapsible && !actions ? (
        <button className={s.headerBtn} onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed}>
          <div className={s.headerLeft}>
            {icon && <span className={s.headerIcon}>{icon}</span>}
            <h3 className={s.headerTitle}>{title}</h3>
            {badge && (
              <span
                className={s.headerBadge}
                style={badgeColor ? { color: badgeColor, background: `${badgeColor}14` } : undefined}
              >
                {badge}
              </span>
            )}
          </div>
          <ChevronDown
            size={14}
            className={s.chevron}
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          />
        </button>
      ) : collapsible && actions ? (
        <div className={s.headerStatic}>
          <div
            className={s.headerLeft}
            role="button"
            tabIndex={0}
            onClick={() => setCollapsed((c) => !c)}
            style={{ cursor: 'pointer' }}
          >
            {icon && <span className={s.headerIcon}>{icon}</span>}
            <h3 className={s.headerTitle}>{title}</h3>
            {badge && (
              <span
                className={s.headerBadge}
                style={badgeColor ? { color: badgeColor, background: `${badgeColor}14` } : undefined}
              >
                {badge}
              </span>
            )}
          </div>
          <div className={s.headerRight}>
            <div className={s.headerActions}>{actions}</div>
            <button
              className={s.collapseBtn}
              onClick={() => setCollapsed((c) => !c)}
              aria-expanded={!collapsed}
              aria-label="Toggle section"
            >
              <ChevronDown
                size={14}
                className={s.chevron}
                style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
              />
            </button>
          </div>
        </div>
      ) : (
        <div className={s.headerStatic}>
          <div className={s.headerLeft}>
            {icon && <span className={s.headerIcon}>{icon}</span>}
            <h3 className={s.headerTitle}>{title}</h3>
            {badge && (
              <span
                className={s.headerBadge}
                style={badgeColor ? { color: badgeColor, background: `${badgeColor}14` } : undefined}
              >
                {badge}
              </span>
            )}
          </div>
          {actions && <div className={s.headerActions}>{actions}</div>}
        </div>
      )}

      {/* Body */}
      {!collapsed && <div className={s.body}>{children}</div>}
    </div>
  );
}

export default React.memo(IntelCard);
