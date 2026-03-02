// ═══════════════════════════════════════════════════════════════════
// Follow Slice — follow/unfollow traders
// Previously: useFollowStore.js
// ═══════════════════════════════════════════════════════════════════

export const createFollowSlice = (set, get) => ({
  following: [],

  followUser: (userId) => {
    const { following } = get();
    if (!following.includes(userId)) {
      set({ following: [...following, userId] });
    }
  },

  unfollowUser: (userId) => {
    set({ following: get().following.filter((id) => id !== userId) });
  },

  toggleFollow: (userId) => {
    const { following } = get();
    if (following.includes(userId)) {
      set({ following: following.filter((id) => id !== userId) });
    } else {
      set({ following: [...following, userId] });
    }
  },

  isFollowing: (userId) => get().following.includes(userId),

  getFollowingCount: () => get().following.length,
});
