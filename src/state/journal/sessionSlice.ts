// ═══════════════════════════════════════════════════════════════════
// Session Slice — trading day state machine
// Previously: useSessionStore.js
// ═══════════════════════════════════════════════════════════════════

// ─── State Definitions ───────────────────────────────────────────

export const SESSION_STATES = {
  PRE_MARKET: {
    id: 'pre-market',
    label: 'Pre-Market',
    emoji: '🌅',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    gradient: (C) => `linear-gradient(135deg, ${C.b}08, ${C.p}06)`,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    borderColor: (C) => `${C.b}20`,
    coaching: 'Review your plan. Set your risk limits. Visualize success.',
    actions: ['review-plan', 'set-alerts', 'checklist'],
  },
  ACTIVE: {
    id: 'active',
    label: 'Active Session',
    emoji: '📊',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    gradient: (C) => `linear-gradient(135deg, ${C.g}08, ${C.b}06)`,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    borderColor: (C) => `${C.g}20`,
    coaching: 'Execute with discipline. Follow your plan.',
    actions: ['add-trade', 'quick-add', 'check-risk'],
  },
  COOLING_DOWN: {
    id: 'cooling-down',
    label: 'Cooling Down',
    emoji: '🧊',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    gradient: (C) => `linear-gradient(135deg, ${C.r}08, ${C.y}06)`,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    borderColor: (C) => `${C.y}20`,
    coaching: 'Step away. Breathe. Your next trade can wait.',
    actions: ['breathing', 'review-rules'],
  },
  POST_MARKET: {
    id: 'post-market',
    label: 'Post-Market',
    emoji: '🌙',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    gradient: (C) => `linear-gradient(135deg, ${C.p}08, ${C.b}06)`,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    borderColor: (C) => `${C.p}20`,
    coaching: 'Markets closed. Time to reflect on execution.',
    actions: ['debrief', 'review-trades', 'plan-tomorrow'],
  },
  DEBRIEF: {
    id: 'debrief',
    label: 'Debrief',
    emoji: '📝',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    gradient: (C) => `linear-gradient(135deg, ${C.y}08, ${C.g}06)`,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    borderColor: (C) => `${C.y}20`,
    coaching: 'What did you learn today? Write it down.',
    actions: ['journal', 'grade-trades', 'set-goals'],
  },
};

// ─── Automatic State Detection ───────────────────────────────────

function detectState(_trades = [], opts = {}) {
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;

  if (opts.consecLosses >= 3) {
    return 'COOLING_DOWN';
  }

  if (h < 9.5) return 'PRE_MARKET';
  if (h < 16) return 'ACTIVE';
  return 'POST_MARKET';
}

export const createSessionSlice = (set, get) => ({
  // Current session state
  sessionState: detectState(),

  // Manual override
  sessionOverride: null,

  // Session metrics
  sessionStart: null,
  breakTimer: null,

  // Get current state config
  getConfig: () => {
    const stateKey = get().sessionOverride || get().sessionState;
    return SESSION_STATES[stateKey] || SESSION_STATES.POST_MARKET;
  },

  // Update state based on current conditions
  tick: (trades, opts = {}) => {
    const override = get().sessionOverride;
    if (override) return;

    const newState = detectState(trades, opts);
    if (newState !== get().sessionState) {
      set({ sessionState: newState });
    }
  },

  // Manual state transitions
  startDebrief: () => set({ sessionOverride: 'DEBRIEF' }),
  endDebrief: () => set({ sessionOverride: null }),
  startCooldown: () => set({ sessionOverride: 'COOLING_DOWN' }),
  endCooldown: () => set({ sessionOverride: null }),

  // Reset
  resetSession: () => set({ sessionState: detectState(), sessionOverride: null }),
});
