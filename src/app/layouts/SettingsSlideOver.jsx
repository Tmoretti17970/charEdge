// ═══════════════════════════════════════════════════════════════════
// charEdge — Settings Slide-Over Panel
//
// Right-side slide-over that replaces full-page Settings navigation.
// Contains: Settings header (close + theme + notifications) +
//           scrollable SettingsPage body.
// Sprint 1: Framer Motion spring entrance + smooth exit.
// ═══════════════════════════════════════════════════════════════════

import React, { Suspense, useEffect, useCallback, useState, useRef } from 'react';
import { C, F } from '../../constants.js';
import { useUIStore } from '../../state/useUIStore';
import { useUserStore } from '../../state/useUserStore';
import { NotificationBell } from '../components/panels/NotificationPanel.jsx';
import QuickSettings from '../components/ui/QuickSettings.jsx';
import styles from './SettingsSlideOver.module.css';
import { alpha } from '@/shared/colorUtils';

const SettingsPage = React.lazy(() => import('../../pages/SettingsPage.jsx'));

const PANEL_WIDTH = 480;

export default function SettingsSlideOver() {
  const isOpen = useUIStore((s) => s.settingsOpen);
  const close = useUIStore((s) => s.closeSettings);
  const theme = useUserStore((s) => s.theme);
  const toggleTheme = useUserStore((s) => s.toggleTheme);
  const skipMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  // Sprint 5: Settings search
  const [settingsSearch, setSettingsSearch] = useState('');
  // Quick Settings popover
  const [qsOpen, setQsOpen] = useState(false);
  const qsBtnRef = useRef(null);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && isOpen) {
        e.stopPropagation();
        close();
      }
    },
    [isOpen, close],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Sprint 5: Clear search on close
  useEffect(() => {
    if (!isOpen) {
      setSettingsSearch('');
      setQsOpen(false);
    }
  }, [isOpen]);

  // CSS transition mount/unmount
  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
    } else {
      setAnimating(false);
    }
  }, [isOpen]);

  const handleTransitionEnd = useCallback((e) => {
    // Only handle transitions on the panel itself
    if (!isOpen && e.target === e.currentTarget) setMounted(false);
  }, [isOpen]);

  if (!mounted) return null;

  const dur = skipMotion ? '0ms' : '300ms';
  const ease = 'cubic-bezier(0.32, 0.72, 0, 1)';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: 'fixed',
          inset: 0,
          background: alpha(C.bg, 0.5),
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 900,
          opacity: animating ? 1 : 0,
          transition: `opacity ${dur} ease`,
        }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Settings"
        aria-modal="true"
        onTransitionEnd={handleTransitionEnd}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: PANEL_WIDTH,
          maxWidth: '100vw',
          background: C.bg2,
          borderLeft: `1px solid ${alpha(C.bd, 0.5)}`,
          boxShadow: `-8px 0 40px ${alpha(C.bg, 0.4)}`,
          zIndex: 901,
          display: 'flex',
          flexDirection: 'column',
          transform: animating ? 'translateX(0)' : 'translateX(100%)',
          transition: `transform ${dur} ${ease}`,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '16px 20px',
            borderBottom: `1px solid ${C.bd}`,
            flexShrink: 0,
          }}
        >
          {/* Title */}
          <div style={{ flex: 1 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                fontFamily: F,
                color: C.t1,
              }}
            >
              Settings
            </h2>
          </div>

          {/* Quick Settings toggle */}
          <button
            ref={qsBtnRef}
            onClick={() => setQsOpen((v) => !v)}
            className="tf-icon-btn"
            title="Quick Settings"
            aria-label="Quick settings"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: qsOpen ? C.b + '18' : 'transparent',
              color: qsOpen ? C.b : C.t3,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </button>

          {/* Notification bell */}
          <NotificationBell />

          {/* Theme toggle */}
          <button
            className="tf-icon-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: C.t3,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Close button */}
          <button
            onClick={close}
            className="tf-icon-btn"
            aria-label="Close settings"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: C.t3,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Sprint 5: Search Bar */}
        <div style={{ padding: '10px 20px', borderBottom: `1px solid ${C.bd}`, flexShrink: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 8,
            background: C.sf,
            border: `1px solid ${C.bd}`,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.t3} strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={settingsSearch}
              onChange={(e) => setSettingsSearch(e.target.value)}
              placeholder="Search settings..."
              autoFocus
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                color: C.t1,
                fontSize: 13,
                fontFamily: F,
                outline: 'none',
              }}
            />
            {settingsSearch && (
              <button
                onClick={() => setSettingsSearch('')}
                style={{ background: 'none', border: 'none', color: C.t3, cursor: 'pointer', fontSize: 12, padding: 0 }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Quick Settings Popover */}
        {qsOpen && (
          <div className={styles.qsAnchor}>
            <QuickSettings
              anchorRef={qsBtnRef}
              onClose={() => setQsOpen(false)}
            />
          </div>
        )}

        {/* Body — scrollable SettingsPage */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          <Suspense
            fallback={
              <div style={{ padding: 32, textAlign: 'center', color: C.t3, fontSize: 13 }}>
                Loading settings…
              </div>
            }
          >
            <SettingsPage searchFilter={settingsSearch} />
          </Suspense>
        </div>
      </div>
    </>
  );
}
