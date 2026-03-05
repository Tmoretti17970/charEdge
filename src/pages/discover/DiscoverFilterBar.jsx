// ═══════════════════════════════════════════════════════════════════
// charEdge — Discover Filter Bar
// Extracted from CommunityPage.jsx for single-responsibility.
// Contains: collapsible category filters + sticky filter chip tabs.
// ═══════════════════════════════════════════════════════════════════

import { C, F } from '../../constants.js';
import { alpha } from '../../utils/colorUtils.js';

// ─── Constants ──────────────────────────────────────────────────
const FILTER_CHIPS = [
  { id: 'all',     label: 'All' },
  { id: 'signals', label: 'Signals' },
  { id: 'social',  label: 'Social' },
  { id: 'intel',   label: 'Intel' },
  { id: 'news',    label: 'News' },
  { id: 'more',    label: '··· More' },
];

const CATEGORIES = [
  { id: 'all', label: 'All Markets' },
  { id: 'crypto', label: 'Crypto & Web3' },
  { id: 'macro', label: 'Global Macro' },
];

export default function DiscoverFilterBar({
  showFilters,
  zenMode,
  onToggleZenMode,
  filter,
  onSetFilter,
  activeChip,
  onSetActiveChip,
}) {
  return (
    <>
      {/* ─── Collapsible Filter Row ─────────────────────────── */}
      {showFilters && (
        <div
          id="discover-filter-row"
          role="toolbar"
          aria-label="Discover filters"
          style={{
            display: 'flex', gap: 8, marginBottom: 16, padding: '10px 14px',
            background: C.bg2, borderRadius: 10, border: `1px solid ${C.bd}`,
            animation: 'tfSubTabsIn 0.2s ease forwards',
            alignItems: 'center',
          }}
        >
          <button
            onClick={onToggleZenMode}
            aria-pressed={zenMode}
            style={{
              padding: '5px 12px',
              borderRadius: 20,
              border: `1px solid ${zenMode ? C.g : C.bd}`,
              background: zenMode ? alpha(C.g, 0.1) : 'transparent',
              color: zenMode ? C.g : C.t2,
              cursor: 'pointer',
              fontWeight: 600, fontSize: 11, fontFamily: F,
              transition: 'all 0.2s ease',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: zenMode ? C.g : C.t3, boxShadow: zenMode ? `0 0 4px ${C.g}` : 'none' }} />
            Zen
          </button>

          <div style={{ width: 1, height: 20, background: C.bd, margin: '0 4px' }} />

          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => onSetFilter(c.id)}
              aria-pressed={filter === c.id}
              style={{
                padding: '4px 10px',
                borderRadius: 20,
                border: `1px solid ${filter === c.id ? C.b : C.bd}`,
                background: filter === c.id ? alpha(C.b, 0.1) : 'transparent',
                color: filter === c.id ? C.b : C.t3,
                cursor: 'pointer',
                fontWeight: 600, fontSize: 11, fontFamily: F,
                transition: 'all 0.2s ease',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* ─── Filter Chips ────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Discover filter chips"
        style={{
          display: 'flex', gap: 6, marginBottom: 24, padding: 4,
          background: alpha(C.sf, 0.5),
          borderRadius: 14, border: `1px solid ${C.bd}`,
          position: 'sticky', top: 0, zIndex: 50,
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {FILTER_CHIPS.map((chip) => {
          const isActive = activeChip === chip.id;
          return (
            <button
              key={chip.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSetActiveChip(chip.id)}
              style={{
                flex: 1,
                minWidth: 72,
                padding: '9px 8px',
                borderRadius: 10,
                border: 'none',
                background: isActive
                  ? `linear-gradient(135deg, ${alpha(C.b, 0.18)}, ${alpha(C.b, 0.08)})`
                  : 'transparent',
                color: isActive ? C.b : C.t2,
                cursor: 'pointer',
                fontWeight: isActive ? 700 : 600,
                fontSize: 12,
                fontFamily: F,
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                textAlign: 'center',
                position: 'relative',
                whiteSpace: 'nowrap',
                boxShadow: isActive ? `0 1px 4px ${alpha(C.b, 0.15)}` : 'none',
              }}
            >
              {chip.label}
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 16,
                    height: 2,
                    borderRadius: 1,
                    background: C.b,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
