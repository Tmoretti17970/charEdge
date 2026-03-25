// ═══════════════════════════════════════════════════════════════════
// charEdge — Markets Toolbar (Sprint 7)
//
// Sort, filter, and group controls for the Markets watchlist grid.
//
// Features:
//   - Asset class chip filters (Crypto, Stocks, Futures, ETF)
//   - Group-by toggle (asset class grouping)
//   - Active filter count badge
//   - Column customizer gear icon
// ═══════════════════════════════════════════════════════════════════

import { memo } from 'react';
import { C } from '../../../constants.js';
import { useMarketsPrefsStore, ASSET_CLASSES } from '../../../state/useMarketsPrefsStore';
import { radii, transition } from '../../../theme/tokens.js';
import ColumnCustomizer from './ColumnCustomizer.jsx';

// ─── Asset class display info ──────────────────────────────────

const ASSET_INFO = {
  crypto: { label: 'Crypto', color: '#F7931A', emoji: '₿' },
  stocks: { label: 'Stocks', color: '#4A90D9', emoji: '📈' },
  futures: { label: 'Futures', color: '#8B5CF6', emoji: '📊' },
  etf: { label: 'ETF', color: '#10B981', emoji: '🏦' },
  forex: { label: 'Forex', color: '#06B6D4', emoji: '💱' },
  options: { label: 'Options', color: '#EC4899', emoji: '🎯' },
};

// ─── Sprint 17: View Mode Toggle ─────────────────────────────

const VIEW_MODES = [
  {
    id: 'list',
    label: 'List',
    icon: (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    ),
  },
  {
    id: 'cards',
    label: 'Cards',
    icon: (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: 'compact',
    label: 'Compact',
    icon: (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <line x1="3" y1="5" x2="21" y2="5" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="3" y1="15" x2="21" y2="15" />
        <line x1="3" y1="20" x2="21" y2="20" />
      </svg>
    ),
  },
  {
    id: 'heatmap',
    label: 'Heat Map',
    icon: (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="10" height="10" rx="1" />
        <rect x="15" y="3" width="6" height="6" rx="1" />
        <rect x="3" y="15" width="6" height="6" rx="1" />
        <rect x="11" y="15" width="10" height="6" rx="1" />
        <rect x="15" y="11" width="6" height="2" rx="0.5" />
      </svg>
    ),
  },
];

function ViewModeToggle() {
  const viewMode = useMarketsPrefsStore((s) => s.viewMode);
  const setViewMode = useMarketsPrefsStore((s) => s.setViewMode);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: `${C.bd}15`,
        borderRadius: radii.sm,
        padding: 2,
      }}
    >
      {VIEW_MODES.map((mode) => {
        const isActive = viewMode === mode.id;
        return (
          <button
            key={mode.id}
            title={mode.label}
            onClick={() => setViewMode(mode.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 22,
              borderRadius: 3,
              border: 'none',
              cursor: 'pointer',
              background: isActive ? `${C.b}18` : 'transparent',
              color: isActive ? C.b : C.t3,
              transition: `all ${transition.fast}`,
            }}
          >
            {mode.icon}
          </button>
        );
      })}
    </div>
  );
}

function CompareButton() {
  const compareSymbols = useMarketsPrefsStore((s) => s.compareSymbols);
  const clearCompare = useMarketsPrefsStore((s) => s.clearCompare);
  const count = compareSymbols?.length || 0;

  return (
    <button
      onClick={() => {
        if (count > 0) clearCompare();
      }}
      title={count > 0 ? `Comparing ${count} symbols — click to clear` : 'Select rows to compare'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        borderRadius: radii.sm,
        fontSize: 10,
        fontWeight: 600,
        fontFamily: 'var(--tf-mono)',
        border: count > 0 ? '1px solid #6e5ce640' : `1px solid ${C.bd}30`,
        background: count > 0 ? '#6e5ce612' : 'transparent',
        color: count > 0 ? '#6e5ce6' : C.t3,
        cursor: 'pointer',
        transition: `all ${transition.fast}`,
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </svg>
      Compare{count > 0 ? ` (${count})` : ''}
    </button>
  );
}

function AlertsButton() {
  const alertPickerOpen = useMarketsPrefsStore((s) => s.alertPickerOpen);
  const setAlertPickerOpen = useMarketsPrefsStore((s) => s.setAlertPickerOpen);

  return (
    <button
      onClick={() => setAlertPickerOpen(!alertPickerOpen)}
      title="Smart Alert Templates"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        borderRadius: radii.sm,
        fontSize: 10,
        fontWeight: 600,
        fontFamily: 'var(--tf-mono)',
        border: alertPickerOpen ? '1px solid #f0b64e40' : `1px solid ${C.bd}30`,
        background: alertPickerOpen ? '#f0b64e12' : 'transparent',
        color: alertPickerOpen ? '#f0b64e' : C.t3,
        cursor: 'pointer',
        transition: `all ${transition.fast}`,
      }}
    >
      🔔 Alerts
    </button>
  );
}

function SmartFolderButton() {
  const smartFolderOpen = useMarketsPrefsStore((s) => s.smartFolderOpen);
  const setSmartFolderOpen = useMarketsPrefsStore((s) => s.setSmartFolderOpen);

  return (
    <button
      onClick={() => setSmartFolderOpen(!smartFolderOpen)}
      title="Smart Folders"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        borderRadius: radii.sm,
        fontSize: 10,
        fontWeight: 600,
        fontFamily: 'var(--tf-mono)',
        border: smartFolderOpen ? `1px solid ${C.y}40` : `1px solid ${C.bd}30`,
        background: smartFolderOpen ? `${C.y}12` : 'transparent',
        color: smartFolderOpen ? C.y : C.t3,
        cursor: 'pointer',
        transition: `all ${transition.fast}`,
      }}
    >
      ⚡ Folders
    </button>
  );
}

function ScreenerButton() {
  const screenerPanelOpen = useMarketsPrefsStore((s) => s.screenerPanelOpen);
  const setScreenerPanelOpen = useMarketsPrefsStore((s) => s.setScreenerPanelOpen);

  return (
    <button
      onClick={() => setScreenerPanelOpen(!screenerPanelOpen)}
      title="Screener"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        borderRadius: radii.sm,
        fontSize: 10,
        fontWeight: 600,
        fontFamily: 'var(--tf-mono)',
        border: screenerPanelOpen ? `1px solid ${C.p}40` : `1px solid ${C.bd}30`,
        background: screenerPanelOpen ? `${C.p}12` : 'transparent',
        color: screenerPanelOpen ? C.p : C.t3,
        cursor: 'pointer',
        transition: `all ${transition.fast}`,
      }}
    >
      🔍 Screener
    </button>
  );
}

function AnalyticsButton() {
  const performancePanelOpen = useMarketsPrefsStore((s) => s.performancePanelOpen);
  const setPerformancePanelOpen = useMarketsPrefsStore((s) => s.setPerformancePanelOpen);

  return (
    <button
      onClick={() => setPerformancePanelOpen(!performancePanelOpen)}
      title="Performance Analytics"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        borderRadius: radii.sm,
        fontSize: 10,
        fontWeight: 600,
        fontFamily: 'var(--tf-mono)',
        border: performancePanelOpen ? `1px solid ${C.cyan}40` : `1px solid ${C.bd}30`,
        background: performancePanelOpen ? `${C.cyan}12` : 'transparent',
        color: performancePanelOpen ? C.cyan : C.t3,
        cursor: 'pointer',
        transition: `all ${transition.fast}`,
      }}
    >
      📊 Analytics
    </button>
  );
}

function MarketsToolbar() {
  const assetClassFilters = useMarketsPrefsStore((s) => s.assetClassFilters);
  const toggleAssetFilter = useMarketsPrefsStore((s) => s.toggleAssetFilter);
  const clearFilters = useMarketsPrefsStore((s) => s.clearFilters);
  const groupBy = useMarketsPrefsStore((s) => s.groupBy);
  const setGroupBy = useMarketsPrefsStore((s) => s.setGroupBy);
  const clearGroupBy = useMarketsPrefsStore((s) => s.clearGroupBy);

  const hasFilters = assetClassFilters.length > 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 20px',
        borderBottom: `1px solid ${C.bd}30`,
        flexShrink: 0,
        gap: 8,
        flexWrap: 'wrap',
      }}
    >
      {/* Left: Filter chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {/* "All" chip */}
        <button
          onClick={clearFilters}
          style={{
            padding: '4px 10px',
            borderRadius: radii.pill,
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'var(--tf-mono)',
            border: `1px solid ${!hasFilters ? C.b : C.bd}40`,
            background: !hasFilters ? `${C.b}12` : 'transparent',
            color: !hasFilters ? C.b : C.t3,
            cursor: 'pointer',
            transition: `all ${transition.fast}`,
          }}
        >
          All
        </button>

        {ASSET_CLASSES.map((cls) => {
          const info = ASSET_INFO[cls];
          if (!info) return null;
          const isActive = assetClassFilters.includes(cls);

          return (
            <button
              key={cls}
              onClick={() => toggleAssetFilter(cls)}
              style={{
                padding: '4px 10px',
                borderRadius: radii.pill,
                fontSize: 10,
                fontWeight: 600,
                fontFamily: 'var(--tf-mono)',
                border: `1px solid ${isActive ? info.color : C.bd}40`,
                background: isActive ? `${info.color}15` : 'transparent',
                color: isActive ? info.color : C.t3,
                cursor: 'pointer',
                transition: `all ${transition.fast}`,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = `${info.color}60`;
                  e.currentTarget.style.color = info.color;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = `${C.bd}40`;
                  e.currentTarget.style.color = C.t3;
                }
              }}
            >
              <span style={{ fontSize: 10 }}>{info.emoji}</span>
              {info.label}
            </button>
          );
        })}

        {/* Active filter count */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            title="Clear all filters"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              padding: '3px 8px',
              borderRadius: radii.pill,
              fontSize: 9,
              fontWeight: 700,
              fontFamily: 'var(--tf-mono)',
              background: `${C.r}12`,
              color: C.r,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Right: View mode toggle + Group toggle + Column customizer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Sprint 17: View mode toggle */}
        <ViewModeToggle />

        {/* Sprint 20: Compare button */}
        <CompareButton />

        {/* Sprint 22: Alerts button */}
        <AlertsButton />

        {/* Sprint 28: Smart Folders button */}
        <SmartFolderButton />

        {/* Sprint 29: Screener button */}
        <ScreenerButton />

        {/* Sprint 31: Analytics button */}
        <AnalyticsButton />

        {/* Divider */}
        <div style={{ width: 1, height: 16, background: `${C.bd}40` }} />

        {/* Group by asset class */}
        <button
          onClick={() => (groupBy === 'assetClass' ? clearGroupBy() : setGroupBy('assetClass'))}
          style={{
            padding: '4px 10px',
            borderRadius: radii.sm,
            fontSize: 10,
            fontWeight: 600,
            fontFamily: 'var(--tf-mono)',
            border: `1px solid ${groupBy ? C.b : C.bd}40`,
            background: groupBy ? `${C.b}10` : 'transparent',
            color: groupBy ? C.b : C.t3,
            cursor: 'pointer',
            transition: `all ${transition.fast}`,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="15" y2="12" />
            <line x1="3" y1="18" x2="9" y2="18" />
          </svg>
          Group
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 16, background: `${C.bd}40` }} />

        {/* Column customizer */}
        <ColumnCustomizer />
      </div>
    </div>
  );
}

export default memo(MarketsToolbar);
