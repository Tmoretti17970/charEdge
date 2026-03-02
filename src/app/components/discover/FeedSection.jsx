// ═══════════════════════════════════════════════════════════════════
// charEdge — Feed Section (Extracted from CommunityPage)
//
// Phase B Sprint 5: Accepts filterChip prop to show/hide subsections.
// Each content block is tagged with a category for chip filtering.
// ═══════════════════════════════════════════════════════════════════

import { useDataStore } from '../../../state/useDataStore.js';
import { C, F, M } from '../../../constants.js';
import { alpha } from '../../../utils/colorUtils.js';
import { useSocialStore } from '../../../state/useSocialStore.js';

// ─── Components ──────────────────────────────────────────────────
import MorningBriefing from './MorningBriefing.jsx';
import WatchlistIntelligence from './WatchlistIntelligence.jsx';
import ContextualEducation from './ContextualEducation.jsx';
import SmartScreener from './SmartScreener.jsx';
import SentimentNewsFeed from './SentimentNewsFeed.jsx';

import StreakRewardsBanner from '../social/StreakRewardsBanner.jsx';
import ChartIdeasFeed from '../social/ChartIdeasFeed.jsx';
import TopPostsFeed from '../social/TopPostsFeed.jsx';
import FollowingFeed from '../social/FollowingFeed.jsx';
import TraderLeaderboard from '../social/TraderLeaderboard.jsx';
import SignalAlertPanel from '../social/SignalAlertPanel.jsx';
import TrendingNarratives from '../social/TrendingNarratives.jsx';
import PollCard from '../social/PollCard.jsx';

// ─── Category mapping for filter chips ───────────────────────────
// 'all' shows everything, specific chips filter to tagged sections
const SECTION_CATEGORIES = {
  streak:      ['all', 'social'],
  briefing:    ['all', 'signals'],
  watchlist:   ['all', 'signals'],
  education:   ['all', 'social'],
  screener:    ['all', 'signals'],
  narratives:  ['all', 'social'],
  ideas:       ['all', 'social'],
  polls:       ['all', 'social'],
  topPosts:    ['all', 'social'],
  following:   ['all', 'social'],
  news:        ['all', 'news'],
  signals:     ['all', 'signals'],
  leaderboard: ['all', 'social'],
};

function showSection(section, chip) {
  if (chip === 'all') return true;
  return SECTION_CATEGORIES[section]?.includes(chip) ?? false;
}

export default function FeedSection({ activePolls, filterChip = 'all' }) {
  const filter = useDataStore((s) => s.filter);
  const zenMode = useDataStore((s) => s.zenMode);
  const openCompose = useDataStore((s) => s.openCompose);
  const followingCount = useSocialStore((s) => s.following.length);

  return (
    <div role="tabpanel" aria-label="Feed">
      {/* Streak Rewards Banner */}
      {showSection('streak', filterChip) && <StreakRewardsBanner />}

      {/* Morning Briefing */}
      {showSection('briefing', filterChip) && <MorningBriefing />}

      {/* Watchlist Intelligence */}
      {showSection('watchlist', filterChip) && <WatchlistIntelligence />}

      {/* Contextual Education */}
      {showSection('education', filterChip) && <ContextualEducation />}

      {/* Smart Screener */}
      {showSection('screener', filterChip) && <SmartScreener />}

      {/* Trending Narratives */}
      {showSection('narratives', filterChip) && (
        <div style={{ marginBottom: 24 }}>
          <TrendingNarratives category={filter} />
        </div>
      )}

      {/* 70/30 Split — Main Feed + Sidebar */}
      <div
        className="tf-discover-feed-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 3fr)',
          gap: 32,
          alignItems: 'start',
        }}
      >
        {/* Left: Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Social feed content */}
          {showSection('ideas', filterChip) && (
            <ChartIdeasFeed zenMode={zenMode} onPostIdea={openCompose} />
          )}

          {showSection('polls', filterChip) && activePolls.length > 0 && (
            <div style={{ padding: '0 16px' }}>
              <PollCard pollId={activePolls[0].id} compact={false} inFeed={true} />
            </div>
          )}

          {showSection('topPosts', filterChip) && (
            <TopPostsFeed category={filter} zenMode={zenMode} />
          )}

          {/* Following feed — show when social chip or if user has followers */}
          {filterChip === 'social' && followingCount > 0 && (
            <FollowingFeed zenMode={zenMode} />
          )}

          {/* Sentiment/News feed */}
          {showSection('news', filterChip) && (
            <div style={{ marginTop: 8 }}>
              <SentimentNewsFeed compact={false} />
            </div>
          )}
        </div>

        {/* Right: Sidebar */}
        <div
          className="tf-discover-sidebar"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            position: 'sticky',
            top: 80,
          }}
        >
          {showSection('signals', filterChip) && <SignalAlertPanel />}
          {showSection('leaderboard', filterChip) && <TraderLeaderboard />}
          {showSection('news', filterChip) && <SentimentNewsFeed compact />}
        </div>
      </div>
    </div>
  );
}

export { FeedSection };
