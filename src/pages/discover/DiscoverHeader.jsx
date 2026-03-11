// ═══════════════════════════════════════════════════════════════════
// charEdge — Discover Header
// Extracted from CommunityPage.jsx for single-responsibility.
// Contains: page title, search bar, notification bell, layout engine,
// and filter toggle button.
// ═══════════════════════════════════════════════════════════════════

import DiscoverLayoutEngine from '../../app/components/discover/DiscoverLayoutEngine.jsx';
import NotificationBell from '../../app/components/social/NotificationBell.jsx';
import { C, F } from '../../constants.js';
import { alpha } from '@/shared/colorUtils';

export default function DiscoverHeader({
  searchQuery,
  onSearchChange,
  showFilters,
  onToggleFilters,
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
      <div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            fontFamily: F,
            color: C.t1,
            margin: '0 0 4px 0',
          }}
        >
          Discover
        </h1>
        <p style={{ fontSize: 12, color: C.t3, margin: 0 }}>
          High-signal trade setups · market intelligence · prediction markets
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Search Bar */}
        <div style={{ position: 'relative' }}>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke={C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search..."
            className="tf-social-search"
            aria-label="Search Discover"
            style={{
              padding: '7px 12px 7px 32px',
              borderRadius: 10,
              border: `1px solid ${C.bd}`,
              background: C.bg2,
              color: C.t1,
              fontSize: 12,
              fontFamily: F,
              outline: 'none',
              width: 160,
            }}
          />
        </div>

        <NotificationBell />
        <DiscoverLayoutEngine />

        {/* Filter Toggle */}
        <button
          onClick={onToggleFilters}
          aria-expanded={showFilters}
          aria-controls="discover-filter-row"
          style={{
            padding: '6px 12px',
            borderRadius: 8,
            border: `1px solid ${showFilters ? C.b : C.bd}`,
            background: showFilters ? alpha(C.b, 0.08) : 'transparent',
            color: showFilters ? C.b : C.t2,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 12,
            fontFamily: F,
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          ≡ Filters
        </button>
      </div>
    </div>
  );
}
