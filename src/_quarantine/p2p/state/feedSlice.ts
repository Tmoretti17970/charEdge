// ═══════════════════════════════════════════════════════════════════
// Social Feed Slice — profiles, feed, leaderboard, bookmarks, seasons
// ═══════════════════════════════════════════════════════════════════

import { LOCAL_USER_ID } from '../../data/socialMockData.js';
import SocialService from '../../data/SocialService.js';

export const createFeedSlice = (set, get) => ({
  // Current user
  myUserId: LOCAL_USER_ID,
  myProfile: null,
  profileLoading: false,

  // Feed
  feed: [],
  feedLoading: false,
  feedSort: 'recent',
  feedTotal: 0,

  // Leaderboard
  leaderboard: [],
  leaderboardLoading: false,
  leaderboardMetric: 'pnl',
  leaderboardPeriod: '30d',

  // Profile cache
  profileCache: {},

  // Active snapshot / profile
  activeSnapshotId: null,
  activeProfileId: null,

  // Bookmarks
  bookmarks: [],

  // Search
  searchQuery: '',

  // Seasons
  season: null,
  leagueHistory: [],

  // ─── Profile ──────────────────────────────────────────

  loadMyProfile: async () => {
    set({ profileLoading: true });
    const res = await SocialService.getProfile(get().myUserId);
    if (res.ok) {
      set({ myProfile: res.data, profileLoading: false });
    } else {
      set({ profileLoading: false });
    }
  },

  updateMyProfile: async (updates) => {
    const res = await SocialService.updateProfile(get().myUserId, updates);
    if (res.ok) set({ myProfile: res.data });
    return res;
  },

  getCachedProfile: (userId) => get().profileCache[userId] || null,

  fetchProfile: async (userId) => {
    if (get().profileCache[userId]) return get().profileCache[userId];
    const res = await SocialService.getProfile(userId);
    if (res.ok) {
      set((s) => ({
        profileCache: { ...s.profileCache, [userId]: res.data },
      }));
      return res.data;
    }
    return null;
  },

  setActiveProfile: (id) => set({ activeProfileId: id }),

  // ─── Bookmarks ────────────────────────────────────────

  toggleBookmark: (snapshotId) => {
    const { bookmarks } = get();
    if (bookmarks.includes(snapshotId)) {
      set({ bookmarks: bookmarks.filter((id) => id !== snapshotId) });
    } else {
      set({ bookmarks: [...bookmarks, snapshotId] });
    }
  },

  isBookmarked: (snapshotId) => get().bookmarks.includes(snapshotId),

  // ─── Search ───────────────────────────────────────────

  setSearchQuery: (query) => set({ searchQuery: query }),

  // ─── Feed ─────────────────────────────────────────────

  loadFeed: async ({ reset = false } = {}) => {
    const { feed, feedSort } = get();
    const offset = reset ? 0 : feed.length;
    set({ feedLoading: true });

    const res = await SocialService.getFeed({
      limit: 20,
      offset,
      sortBy: feedSort,
    });

    if (res.ok) {
      set({
        feed: reset ? res.data : [...feed, ...res.data],
        feedTotal: res.total,
        feedLoading: false,
      });
    } else {
      set({ feedLoading: false });
    }
  },

  setFeedSort: (sort) => {
    set({ feedSort: sort, feed: [] });
    get().loadFeed({ reset: true });
  },

  // ─── Snapshots ────────────────────────────────────────

  createSnapshot: async (snapshot) => {
    const res = await SocialService.createSnapshot({
      ...snapshot,
      authorId: get().myUserId,
    });
    if (res.ok) {
      set((s) => ({ feed: [res.data, ...s.feed] }));
    }
    return res;
  },

  deleteSnapshot: async (snapshotId) => {
    const res = await SocialService.deleteSnapshot(snapshotId, get().myUserId);
    if (res.ok) {
      set((s) => ({ feed: s.feed.filter((f) => f.id !== snapshotId) }));
    }
    return res;
  },

  toggleLike: async (snapshotId) => {
    const res = await SocialService.toggleLike(snapshotId, get().myUserId);
    if (res.ok) {
      set((s) => ({
        feed: s.feed.map((f) => (f.id === snapshotId ? { ...f, likes: res.data.count } : f)),
      }));
    }
    return res;
  },

  setActiveSnapshot: (id) => set({ activeSnapshotId: id }),

  // ─── Leaderboard ──────────────────────────────────────

  loadLeaderboard: async () => {
    const { leaderboardMetric, leaderboardPeriod } = get();
    set({ leaderboardLoading: true });

    const res = await SocialService.getLeaderboard({
      metric: leaderboardMetric,
      period: leaderboardPeriod,
      limit: 20,
    });

    if (res.ok) {
      set({ leaderboard: res.data, leaderboardLoading: false });
    } else {
      set({ leaderboardLoading: false });
    }
  },

  setLeaderboardMetric: (metric) => {
    set({ leaderboardMetric: metric });
    get().loadLeaderboard();
  },

  setLeaderboardPeriod: (period) => {
    set({ leaderboardPeriod: period });
    get().loadLeaderboard();
  },

  // ─── Seasons ──────────────────────────────────────────

  getCurrentSeason: () => {
    const now = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const name = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const daysLeft = Math.max(0, Math.ceil((endDate - now) / 86400000));

    const { leaderboard, myUserId } = get();
    const myEntry = leaderboard.find(e => e.userId === myUserId);
    const position = myEntry?.rank || leaderboard.length + 1;

    let league;
    if (position <= 1) league = { name: 'Master', emoji: '👑', color: '#FFD700' };
    else if (position <= 3) league = { name: 'Diamond', emoji: '💎', color: '#B9F2FF' };
    else if (position <= 5) league = { name: 'Platinum', emoji: '🏆', color: '#E5E4E2' };
    else if (position <= 10) league = { name: 'Gold', emoji: '🥇', color: '#FFD700' };
    else if (position <= 15) league = { name: 'Silver', emoji: '🥈', color: '#C0C0C0' };
    else league = { name: 'Bronze', emoji: '🥉', color: '#CD7F32' };

    return { name, startDate, endDate, daysLeft, league, position };
  },

  processSeasonEnd: () => {
    const season = get().getCurrentSeason();
    const history = get().leagueHistory;

    if (history.some(h => h.season === season.name)) return;

    let movement;
    if (season.position <= 3) movement = 'promoted';
    else if (season.position > 12) movement = 'demoted';
    else movement = 'stayed';

    const entry = {
      season: season.name,
      league: season.league.name,
      position: season.position,
      movement,
      timestamp: Date.now(),
    };

    set({ leagueHistory: [...history, entry].slice(-12) });
  },
});
