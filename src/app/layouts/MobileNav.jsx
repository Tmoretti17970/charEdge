// ═══════════════════════════════════════════════════════════════════
// charEdge — Mobile Navigation (Sprint 5 Simplified)
//
// Home | Charts | ➕ Quick Add | Discover | ⚙️ Settings (slide-over)
// Center tab is a raised FAB that opens the Quick Add modal.
// ═══════════════════════════════════════════════════════════════════

import { C, M } from '../../constants.js';
import { useUIStore } from '../../state/useUIStore.js';

// Compact inline SVG icons (18×18 for bottom bar)
const icons = {
  home: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  charts: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  discover: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  ),
  settings: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  coach: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
      <line x1="9" y1="21" x2="15" y2="21" />
      <line x1="10" y1="23" x2="14" y2="23" />
    </svg>
  ),
};

const TABS = [
  { id: 'journal', label: 'Home', icon: 'home' },
  { id: 'charts', label: 'Charts', icon: 'charts' },
  { id: '_quickadd', label: 'Add', icon: null, isFab: true },
  // Wave 0: Coach quarantined from v1.0 launch scope
  // { id: 'coach', label: 'Coach', icon: 'coach' },
  { id: '_settings', label: 'Settings', icon: 'settings', isSlideOver: true },
];

export default function MobileNav() {
  const page = useUIStore((s) => s.page);
  const setPage = useUIStore((s) => s.setPage);
  const openQuickTrade = useUIStore((s) => s.openQuickTrade);
  const openSettings = useUIStore((s) => s.openSettings);

  return (
    <nav
      role="navigation"
      aria-label="Mobile navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 56,
        background: C.bg,
        borderTop: `1px solid ${C.bd}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 999,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {TABS.map((tab) => {
        // Quick Add FAB — center button
        if (tab.isFab) {
          return (
            <button
              key={tab.id}
              onClick={openQuickTrade}
              className="tf-nav-btn"
              aria-label="Quick add trade"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                border: 'none',
                background: `linear-gradient(135deg, ${C.b}, ${C.y})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                marginTop: -12,
                boxShadow: `0 4px 16px ${C.b}40`,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                position: 'relative',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff"
                strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          );
        }

        // Settings — opens slide-over
        if (tab.isSlideOver) {
          const settingsOpen = useUIStore.getState().settingsOpen;
          const iconFn = icons[tab.icon];
          return (
            <button
              key={tab.id}
              onClick={openSettings}
              className="tf-nav-btn"
              aria-label={tab.label}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: '8px 0',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                minHeight: 44,
              }}
            >
              {iconFn && iconFn(settingsOpen ? C.b : C.t3)}
              <span
                style={{
                  fontSize: 10,
                  fontFamily: M,
                  fontWeight: settingsOpen ? 700 : 500,
                  color: settingsOpen ? C.b : C.t3,
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        }

        // Regular tab button
        const active = page === tab.id || (tab.id === 'journal' && page === 'dashboard') || (tab.id === 'discover' && (page === 'social' || page === 'markets'));
        const iconFn = icons[tab.icon];
        return (
          <button
            key={tab.id}
            onClick={() => setPage(tab.id)}
            className="tf-nav-btn"
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '8px 0',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              minHeight: 44,
            }}
          >
            {iconFn && iconFn(active ? C.b : C.t3)}
            <span
              style={{
                fontSize: 10,
                fontFamily: M,
                fontWeight: active ? 700 : 500,
                color: active ? C.b : C.t3,
              }}
            >
              {tab.label}
            </span>
            {active && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '25%',
                  right: '25%',
                  height: 2,
                  borderRadius: 1,
                  background: C.b,
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
