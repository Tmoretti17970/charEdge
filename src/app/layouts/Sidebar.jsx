// ═══════════════════════════════════════════════════════════════════
// charEdge — Sidebar Navigation (Simplified)
//
// Two nav items: Home | Charts
// Settings gear at the bottom.
//
// Icon-only default (60px), expand on hover (220px) with labels.
// Includes always-visible P&L widget and active indicator bar.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { C, F, M } from '../../constants.js';
import { useUIStore } from '../../state/useUIStore';
import { useUserStore } from '../../state/useUserStore';
import Icon from '../components/design/Icon.jsx';
import SidebarPersonaBadge from '../components/ui/SidebarPersonaBadge.jsx';
import SidebarPnL from '../components/ui/SidebarPnL.jsx';
import SidebarXPBadge from '../components/ui/SidebarXPBadge.jsx';
import sb from './Sidebar.module.css';
import { alpha } from '@/shared/colorUtils';

// ─── Icon Components (inline SVG — no deps) ────────────────────
// Sized to 20×20, stroke-based for consistent weight

function IconHome({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconChart({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function _IconDiscover({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function IconSettings({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function _IconCoach({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
      <line x1="9" y1="21" x2="15" y2="21" />
      <line x1="10" y1="23" x2="14" y2="23" />
    </svg>
  );
}

// ─── Navigation Items ───────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'journal', label: 'Home', Icon: IconHome },
  { id: 'charts', label: 'Charts', Icon: IconChart },
  // Wave 0: Quarantined — coach + discover removed from v1.0 launch scope
  // { id: 'coach', label: 'Char', Icon: IconCoach },
  // { id: 'discover', label: 'Discover', Icon: IconDiscover },
];

// ─── Sidebar Dimensions ─────────────────────────────────────────

const COLLAPSED_WIDTH = 60;
const EXPANDED_WIDTH = 220;

// ─── Sidebar Component ──────────────────────────────────────────

function Sidebar() {
  const page = useUIStore((s) => s.page);
  const setPage = useUIStore((s) => s.setPage);
  const openSettings = useUIStore((s) => s.openSettings);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const recentSymbols = useUIStore((s) => s.recentSymbols);
  const simpleMode = useUserStore((s) => s.simpleMode);
  const [hoveredId, setHoveredId] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const navRef = useRef(null);
  const collapseTimer = useRef(null);
  const [barTop, setBarTop] = useState(0);
  const [barVisible, setBarVisible] = useState(false);

  // Sprint 6: Chart Immersion Mode — sidebar stays collapsed on Charts page
  const isChartPage = page === 'charts';

  // Measure position of the active nav button and slide the indicator bar
  useEffect(() => {
    if (!navRef.current) return;
    const activeBtn = navRef.current.querySelector('[aria-current="page"]');
    if (activeBtn) {
      const navRect = navRef.current.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();
      setBarTop(btnRect.top - navRect.top + btnRect.height / 2 - 10);
      setBarVisible(true);
    } else {
      setBarVisible(false);
    }
  }, [page, expanded]);

  // Sprint 6: Force collapse on chart page transition
  useEffect(() => {
    if (isChartPage) setExpanded(false);
  }, [isChartPage]);

  // Expand/collapse handlers with delay to prevent flicker
  const handleMouseEnter = useCallback(() => {
    // Sprint 6: Don't expand on Charts page — maximum chart real estate
    if (isChartPage) return;
    if (collapseTimer.current) {
      clearTimeout(collapseTimer.current);
      collapseTimer.current = null;
    }
    setExpanded(true);
  }, [isChartPage]);

  const handleMouseLeave = useCallback(() => {
    collapseTimer.current = setTimeout(() => {
      setExpanded(false);
    }, 200);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
    };
  }, []);

  const sidebarWidth = expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  return (
    <nav
      ref={navRef}
      role="navigation"
      aria-label="Main navigation"
      className={`${sb.sidebar} ${expanded ? sb.expanded : sb.collapsed}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        background: 'var(--tf-depth-floating-bg)',
        backdropFilter: 'var(--tf-depth-floating-blur)',
        WebkitBackdropFilter: 'var(--tf-depth-floating-blur)',
        borderRight: 'var(--tf-glass-border)',
        boxShadow: 'var(--tf-depth-floating-specular), 1px 0 8px rgba(0,0,0,0.15)',
        fontFeatureSettings: '"tnum"',
        transition: 'width 300ms cubic-bezier(0.32, 0.72, 0, 1), min-width 300ms cubic-bezier(0.32, 0.72, 0, 1)',
      }}
    >
      {/* ─── Sliding Active Indicator Bar (Sprint 1: spring physics) ─ */}
      <div
        className={sb.activeBar}
        style={{
          top: barTop,
          background: C.b,
          boxShadow: `0 0 8px ${C.b}60`,
          opacity: barVisible ? 1 : 0,
          transition: 'top 300ms cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms ease',
        }}
      />

      {/* ─── Logo ─────────────────────────────────────────── */}
      <div
        className={`${sb.logo} ${expanded ? sb.logoExpanded : sb.logoCollapsed}`}
        onClick={() => setPage('journal')}
        title="charEdge"
        aria-label="charEdge — go to Home"
        role="button"
      >
        <div
          className={sb.logoIcon}
          style={{ background: `linear-gradient(135deg, ${C.b}, ${C.y})`, fontFamily: M }}
        >
          CE
        </div>
        {expanded && (
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              fontFamily: F,
              color: C.t1,
              whiteSpace: 'nowrap',
              opacity: expanded ? 1 : 0,
              transition: 'opacity 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            charEdge
            {/* P2 3.1: Unified nav identity — persistent beta badge */}
            <span style={{
              fontSize: 8, fontWeight: 700, color: C.b,
              background: alpha(C.b, 0.12), borderRadius: 4,
              padding: '1px 4px', letterSpacing: '0.05em',
            }}>β</span>
          </span>
        )}
      </div>

      {/* ─── Gamification Identity (XP Level + Streak) ──── */}
      {!simpleMode && (
        <div style={{ flexShrink: 0, marginBottom: 6 }}>
          <div className={sb.xpBadge}>
            <SidebarXPBadge />
          </div>
        </div>
      )}

      {/* ─── Main Nav ────────────────────────────────────── */}
      <div className={`${sb.navGroup} ${expanded ? sb.navGroupExpanded : sb.navGroupCollapsed}`} style={{ flex: 'none', marginBottom: 4 }}>
        {NAV_ITEMS.filter((item) => !simpleMode || item.id !== 'coach').map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={page === item.id || (item.id === 'journal' && page === 'dashboard') || (item.id === 'discover' && (page === 'social' || page === 'markets'))}
            hovered={hoveredId === item.id}
            expanded={expanded}
            onHover={setHoveredId}
            onClick={() => setPage(item.id)}
          />
        ))}
      </div>

      {/* ─── Recent Symbols (Phase B Sprint 7) ────────────── */}
      {expanded && recentSymbols.length > 0 && !isChartPage && (
        <div className={`${sb.navGroupExpanded}`} style={{ flex: 'none', marginBottom: 4 }}>
          <div
            style={{
              width: '100%', height: 1, background: C.bd,
              margin: '6px 0 4px', borderRadius: 1, flexShrink: 0,
            }}
          />
          <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: 1, padding: '0 4px', marginBottom: 2, fontFamily: F }}>
            Recent
          </div>
          {recentSymbols.map((sym) => (
            <button
              key={sym}
              onClick={() => {
                setPage('charts');
              }}
              onMouseEnter={() => setHoveredId(`sym-${sym}`)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                width: '100%', height: 28, borderRadius: 6, border: 'none',
                background: hoveredId === `sym-${sym}` ? alpha(C.b, 0.08) : 'transparent',
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0 6px', cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: hoveredId === `sym-${sym}` ? C.b : C.t2, fontFamily: F }}>
                {sym}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ─── Spacer ──────────────────────────────────────── */}
      <div style={{ flex: 1 }} />

      {/* ─── P&L Widget ───────────────────────────────────── */}
      <div className={`${sb.pnlWrap} ${expanded ? sb.pnlExpanded : sb.pnlCollapsed}`}>
        <SidebarPnL expanded={expanded} />
      </div>

      {/* ─── Bottom: Settings Gear ─────────────────────────── */}
      <div className={`${sb.bottomGroup} ${expanded ? sb.navGroupExpanded : sb.navGroupCollapsed}`}>
        {/* Divider */}
        <div
          style={{
            width: expanded ? '100%' : 24,
            height: 1,
            background: C.bd,
            margin: expanded ? '4px 0 6px' : '4px auto 6px',
            borderRadius: 1,
            transition: 'width 0.2s ease',
          }}
        />

        {/* Settings trigger */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={openSettings}
            onMouseEnter={() => setHoveredId('_settings')}
            onMouseLeave={() => setHoveredId(null)}
            title={expanded ? undefined : 'Settings'}
            aria-label="Settings"
            style={{
              width: expanded ? '100%' : 40,
              height: 40,
              borderRadius: 10,
              border: 'none',
              background: settingsOpen
                ? alpha(C.b, 0.09)
                : hoveredId === '_settings'
                  ? alpha(C.t3, 0.08)
                  : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: expanded ? 'flex-start' : 'center',
              gap: 10,
              padding: expanded ? '0 10px' : '0',
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s, width 0.2s ease',
            }}
          >
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20 }}>
              <IconSettings color={settingsOpen ? C.b : hoveredId === '_settings' ? C.t1 : C.t3} />
            </div>
            {expanded && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: settingsOpen ? 700 : 500,
                  fontFamily: F,
                  color: settingsOpen ? C.b : hoveredId === '_settings' ? C.t1 : C.t3,
                  whiteSpace: 'nowrap',
                }}
              >
                Settings
              </span>
            )}
          </button>

          {/* Tooltip — only shows when collapsed */}
          {!expanded && hoveredId === '_settings' && (
            <div
              className="tf-tooltip"
              style={{
                position: 'absolute',
                left: 50,
                top: '50%',
                transform: 'translateY(-50%)',
                background: alpha(C.sf2, 0.95),
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: `1px solid ${alpha(C.bd, 0.4)}`,
                borderRadius: 8,
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: F,
                color: C.t1,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 200,
                boxShadow: `0 4px 12px ${alpha(C.bg, 0.3)}`,
              }}
            >
              Settings
            </div>
          )}
        </div>
      </div>

      {/* ─── Footer: What's New + Legal ──────────────────────── */}
      <div
        style={{
          padding: expanded ? '6px 12px 2px' : '6px 4px 2px',
          flexShrink: 0,
          textAlign: 'center',
        }}
        title="charEdge is not financial advice. Trade at your own risk."
      >
        {/* What's New link */}
        <span
          role="button"
          tabIndex={0}
          aria-label="What's New — changelog"
          onClick={() => setPage('changelog')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPage('changelog'); } }}
          style={{
            fontSize: expanded ? 10 : 10,
            display: 'block',
            cursor: 'pointer',
            color: page === 'changelog' ? C.b : C.t3,
            opacity: page === 'changelog' ? 1 : 0.6,
            transition: 'opacity 0.2s, color 0.2s',
            marginBottom: 4,
            fontFamily: F,
            fontWeight: 500,
          }}
          title="What's New"
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { if (page !== 'changelog') e.currentTarget.style.opacity = '0.6'; }}
        >
          {expanded ? <><Icon name="changelog" size={10} /> What's New</> : <Icon name="changelog" size={10} />}
        </span>

        {/* Privacy Policy link */}
        <span
          role="button"
          tabIndex={0}
          aria-label="Privacy Policy"
          onClick={() => setPage('privacy')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPage('privacy'); } }}
          style={{
            fontSize: expanded ? 10 : 10,
            display: 'block',
            cursor: 'pointer',
            color: page === 'privacy' ? C.b : C.t3,
            opacity: page === 'privacy' ? 1 : 0.6,
            transition: 'opacity 0.2s, color 0.2s',
            marginBottom: 4,
            fontFamily: F,
            fontWeight: 500,
          }}
          title="Privacy Policy"
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { if (page !== 'privacy') e.currentTarget.style.opacity = '0.6'; }}
        >
          {expanded ? <><Icon name="lock" size={10} /> Privacy</> : <Icon name="lock" size={10} />}
        </span>

        {/* Terms of Service link */}
        <span
          role="button"
          tabIndex={0}
          aria-label="Terms of Service"
          onClick={() => setPage('terms')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPage('terms'); } }}
          style={{
            fontSize: expanded ? 10 : 10,
            display: 'block',
            cursor: 'pointer',
            color: page === 'terms' ? C.b : C.t3,
            opacity: page === 'terms' ? 1 : 0.6,
            transition: 'opacity 0.2s, color 0.2s',
            marginBottom: 4,
            fontFamily: F,
            fontWeight: 500,
          }}
          title="Terms of Service"
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { if (page !== 'terms') e.currentTarget.style.opacity = '0.6'; }}
        >
          {expanded ? <><Icon name="journal" size={10} /> Terms</> : <Icon name="journal" size={10} />}
        </span>

        <span
          style={{
            fontSize: 8,
            fontFamily: F,
            color: C.t3,
            opacity: 0.5,
            lineHeight: 1.3,
            display: 'block',
          }}
        >
          {expanded ? 'Not financial advice. Trade at your own risk.' : <Icon name="warning" size={8} />}
        </span>
        <span
          role="button"
          tabIndex={0}
          aria-label="For Charolette — dedication page"
          style={{
            fontSize: expanded ? 10 : 12,
            display: 'block',
            marginTop: 4,
            cursor: 'pointer',
            color: '#e8a0b0',
            opacity: page === 'charolette' ? 1 : 0.6,
            transition: 'opacity 0.2s',
          }}
          title="For Charolette ✦"
          onClick={() => setPage('charolette')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPage('charolette'); } }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { if (page !== 'charolette') e.currentTarget.style.opacity = '0.6'; }}
        >
          ✦
        </span>
      </div>



    </nav>
  );
}

// ─── NavButton ──────────────────────────────────────────────────

function NavButton({ item, active, hovered, expanded, onHover, onClick }) {
  const { id, label, Icon } = item;

  const color = active ? C.b : hovered ? C.t1 : C.t3;
  const bg = active ? alpha(C.b, 0.09) : hovered ? alpha(C.t3, 0.08) : 'transparent';

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        onMouseEnter={() => onHover(id)}
        onMouseLeave={() => onHover(null)}
        title={expanded ? undefined : label}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        data-tour={`nav-${id}`}
        style={{
          width: expanded ? '100%' : 40,
          height: 40,
          borderRadius: 'var(--tf-radius-sm, 8px)',
          border: '1px solid transparent',
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: expanded ? 'flex-start' : 'center',
          gap: 10,
          padding: expanded ? '0 10px' : '0',
          cursor: 'pointer',
          transition: 'background 0.15s, color 0.15s, transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1), width 0.2s ease',
          transform: active ? 'scale(1.02)' : 'scale(1)',
          position: 'relative',
        }}
      >
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20 }}>
          <Icon color={color} />
        </div>
        {expanded && (
          <span
            style={{
              fontSize: 12,
              fontWeight: active ? 700 : 500,
              fontFamily: F,
              color,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label}
          </span>
        )}
      </button>

      {/* Tooltip — only shows when collapsed */}
      {!expanded && hovered && (
        <div
          className="tf-tooltip"
          style={{
            position: 'absolute',
            left: 50,
            top: '50%',
            transform: 'translateY(-50%)',
            background: alpha(C.sf2, 0.95),
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${alpha(C.bd, 0.4)}`,
            borderRadius: 8,
            padding: '5px 12px',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: F,
            color: C.t1,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 200,
            boxShadow: `0 4px 12px ${alpha(C.bg, 0.3)}`,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

export { Sidebar, NAV_ITEMS };

export default React.memo(Sidebar);
