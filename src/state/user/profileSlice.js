// ═══════════════════════════════════════════════════════════════════
// charEdge — Profile Slice (Sprint 2: Profile Hero Card)
//
// Manages user profile identity: avatar, display name, username,
// bio, trading experience, preferred markets, timezone, social links.
// Persisted via useUserStore's zustand persist middleware.
// ═══════════════════════════════════════════════════════════════════

// @ts-check

const AVATAR_OPTIONS = ['🔥', '🐂', '🐻', '🦈', '🦅', '🐺', '🦁', '🐲', '🦊', '🎯', '💎', '⚡', '🌊', '🏔️', '🎲', '🧠'];

const EXPERIENCE_LEVELS = [
  { id: 'beginner', label: 'Beginner', hint: 'Learning the basics' },
  { id: 'intermediate', label: 'Intermediate', hint: '1-3 years of trading' },
  { id: 'advanced', label: 'Advanced', hint: '3+ years, consistent strategy' },
  { id: 'professional', label: 'Professional', hint: 'Full-time trader' },
];

const MARKET_OPTIONS = [
  { id: 'stocks', label: 'Stocks', emoji: '📈' },
  { id: 'options', label: 'Options', emoji: '📊' },
  { id: 'futures', label: 'Futures', emoji: '📉' },
  { id: 'crypto', label: 'Crypto', emoji: '₿' },
  { id: 'forex', label: 'Forex', emoji: '💱' },
];

const TRADING_STYLES = [
  { id: 'day', label: 'Day Trader' },
  { id: 'swing', label: 'Swing Trader' },
  { id: 'position', label: 'Position Trader' },
  { id: 'scalper', label: 'Scalper' },
];

/**
 * Default profile state.
 */
function getDefaultProfile() {
  return {
    avatar: '🔥',
    avatarType: 'emoji',      // 'emoji' | 'image' | 'initials'
    avatarImage: '',           // base64 data URL for image type
    avatarColor: '#E8590C',    // bg color for initials type
    displayName: '',
    username: '',
    email: '',
    bio: '',
    memberSince: Date.now(),
    lastPasswordChange: null,
    twoFactorEnabled: false,
    twoFactorSetupDate: null,
    recoveryEmail: '',
    backupCodesRemaining: 0,
    tradingExperience: '',
    tradingStyle: '',
    preferredMarkets: [],
    timezone: typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC',
    socialLinks: {
      twitter: '',
      discord: '',
      tradingview: '',
    },
  };
}

/**
 * Calculate profile completeness (0-100).
 */
function calcCompleteness(profile) {
  const hasCustomAvatar = profile.avatarType === 'image'
    || profile.avatarType === 'initials'
    || profile.avatar !== '🔥';
  const fields = [
    !!profile.displayName,
    !!profile.username,
    !!profile.bio,
    !!profile.tradingExperience,
    !!profile.tradingStyle,
    (profile.preferredMarkets || []).length > 0,
    hasCustomAvatar,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

/**
 * Create the profile slice for useUserStore.
 */
export function createProfileSlice(set, get) {
  return {
    profile: getDefaultProfile(),

    updateProfile: (updates) =>
      set((state) => ({
        profile: { ...state.profile, ...updates },
      })),

    getProfileCompleteness: () => {
      const state = get();
      return calcCompleteness(state.profile || getDefaultProfile());
    },

    resetProfile: () =>
      set({ profile: getDefaultProfile() }),
  };
}

// Export constants for use in UI components
export {
  AVATAR_OPTIONS,
  EXPERIENCE_LEVELS,
  MARKET_OPTIONS,
  TRADING_STYLES,
  calcCompleteness,
};
