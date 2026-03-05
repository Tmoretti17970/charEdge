// ═══════════════════════════════════════════════════════════════════
// charEdge — Discover Page (CommunityPage Orchestrator)
//
// Phase B Sprint 5-6: Unified filter chips + persistent ResearchPanel.
// ═══════════════════════════════════════════════════════════════════

import { useDataStore } from '../state/useDataStore.js';
import { useSocialStore } from '../state/useSocialStore.js';

// ─── Extracted Sub-components ────────────────────────────────────
import DiscoverHeader from './discover/DiscoverHeader.jsx';
import DiscoverFilterBar from './discover/DiscoverFilterBar.jsx';
import MoreTab from './discover/MoreTab.jsx';

// ─── Section Components ──────────────────────────────────────────
import FeedSection from '../app/components/discover/FeedSection.jsx';
import IntelSection from '../app/components/discover/IntelSection.jsx';
import ResearchPanel from '../app/components/discover/ResearchPanel.jsx';
import TraderProfileModal from '../app/components/social/TraderProfileModal.jsx';

// ─── Modals ──────────────────────────────────────────────────────
import ComposeIdeaModal from '../app/components/social/ComposeIdeaModal.jsx';
import CreatePollModal from '../app/components/social/CreatePollModal.jsx';
import CopyTradeModal from '../app/components/social/CopyTradeModal.jsx';

// ═════════════════════════════════════════════════════════════════
// Main CommunityPage (Orchestrator)
// ═════════════════════════════════════════════════════════════════
export default function CommunityPage() {
  // ─── Centralized Store ─────────────────────────────────────────
  const activeChip = useDataStore((s) => s.activeChip);
  const setActiveChip = useDataStore((s) => s.setActiveChip);
  const filter = useDataStore((s) => s.filter);
  const setFilter = useDataStore((s) => s.setFilter);
  const zenMode = useDataStore((s) => s.zenMode);
  const toggleZenMode = useDataStore((s) => s.toggleZenMode);
  const showFilters = useDataStore((s) => s.showFilters);
  const toggleFilters = useDataStore((s) => s.toggleFilters);
  const moreActiveFeature = useDataStore((s) => s.moreActiveFeature);
  const setMoreActiveFeature = useDataStore((s) => s.setMoreActiveFeature);

  const composeOpen = useDataStore((s) => s.composeOpen);
  const closeCompose = useDataStore((s) => s.closeCompose);
  const createPollOpen = useDataStore((s) => s.createPollOpen);
  const closeCreatePoll = useDataStore((s) => s.closeCreatePoll);
  const copyTradeModalOpen = useDataStore((s) => s.copyTradeModalOpen);
  const copyTradeTarget = useDataStore((s) => s.copyTradeTarget);
  const closeCopyTrade = useDataStore((s) => s.closeCopyTrade);
  const openCopyTrade = useDataStore((s) => s.openCopyTrade);
  const openCompose = useDataStore((s) => s.openCompose);

  // ─── Search ────────────────────────────────────────────────────
  const searchQuery = useSocialStore((s) => s.searchQuery);
  const setSearchQuery = useSocialStore((s) => s.setSearchQuery);

  // ─── Polls ─────────────────────────────────────────────────────
  const polls = useSocialStore((s) => s.polls);
  const activePolls = polls.filter((p) => p.status === 'active');
  const resolvedPolls = polls.filter((p) => p.status === 'resolved');

  // Determine which sections to show based on active chip
  const showFeed = activeChip === 'all' || activeChip === 'signals' || activeChip === 'social' || activeChip === 'news';
  const showIntel = activeChip === 'all' || activeChip === 'intel';
  const showMore = activeChip === 'more';

  return (
    <div
      role="main"
      aria-label="Discover"
      style={{
        maxWidth: 1600,
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        height: '100vh',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 0,
      }}
    >
      {/* ─── Left: Main Content ────────────────────────────── */}
      <div style={{ padding: '28px 36px', overflowY: 'auto' }}>
        <DiscoverHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          showFilters={showFilters}
          onToggleFilters={toggleFilters}
        />

        <DiscoverFilterBar
          showFilters={showFilters}
          zenMode={zenMode}
          onToggleZenMode={toggleZenMode}
          filter={filter}
          onSetFilter={setFilter}
          activeChip={activeChip}
          onSetActiveChip={setActiveChip}
        />

        {/* ─── Unified Content ──────────────────────────────────── */}
        <div className="tf-social-tab-content" key={activeChip}>
          {showFeed && (
            <FeedSection activePolls={activePolls} filterChip={activeChip} />
          )}

          {showIntel && (
            <div style={{ marginTop: activeChip === 'all' ? 32 : 0 }}>
              <IntelSection
                activePolls={activePolls}
                resolvedPolls={resolvedPolls}
                inline={activeChip === 'all'}
              />
            </div>
          )}

          {showMore && (
            <MoreTab
              moreActiveFeature={moreActiveFeature}
              setMoreActiveFeature={setMoreActiveFeature}
              onCopyTrader={openCopyTrade}
            />
          )}
        </div>

        <TraderProfileModal />

        {/* Modals */}
        <ComposeIdeaModal open={composeOpen} onClose={closeCompose} />
        <CreatePollModal open={createPollOpen} onClose={closeCreatePoll} />
        <CopyTradeModal
          open={copyTradeModalOpen}
          onClose={closeCopyTrade}
          trader={copyTradeTarget}
        />
      </div>

      {/* ─── Right: Research Panel ────────────────────────────── */}
      <ResearchPanel onCompose={openCompose} />
    </div>
  );
}
