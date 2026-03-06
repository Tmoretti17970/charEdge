// ═══════════════════════════════════════════════════════════════════
// charEdge — Onboarding Slice
// Extracted from useOnboardingStore for useUserStore consolidation.
// ═══════════════════════════════════════════════════════════════════

const ONBOARDING_DEFAULTS = {
  wizardComplete: false,
  wizardStep: 0,
  ahaReached: false,
  skipCount: 0,
  dismissedTips: [],
  discoveredFeatures: [],
  tourStep: -1,
  tourCompleted: false,
};

export const createOnboardingSlice = (set, get) => ({
  ...ONBOARDING_DEFAULTS,

  // Wizard
  setWizardStep: (step) => set({ wizardStep: step }),
  completeWizard: () => set({ wizardComplete: true, wizardStep: -1 }),
  resetWizard: () => set({ wizardComplete: false, wizardStep: 0 }),

  // Tips
  dismissTip: (tipId) =>
    set((s) => ({
      dismissedTips: [...new Set([...s.dismissedTips, tipId])],
    })),
  isTipDismissed: (tipId) => get().dismissedTips.includes(tipId),
  resetTips: () => set({ dismissedTips: [] }),

  // Feature discovery
  markDiscovered: (featureId) =>
    set((s) => ({
      discoveredFeatures: [...new Set([...s.discoveredFeatures, featureId])],
    })),
  isDiscovered: (featureId) => get().discoveredFeatures.includes(featureId),

  // Guided Tour
  startTour: () => set({ tourStep: 0, tourCompleted: false }),
  nextTourStep: () => {
    const step = get().tourStep;
    if (step >= 4) {
      set({ tourStep: -1, tourCompleted: true });
    } else {
      set({ tourStep: step + 1 });
    }
  },
  skipTour: () => set({ tourStep: -1, tourCompleted: true }),
  resetTour: () => set({ tourStep: -1, tourCompleted: false }),
  isTourActive: () => get().tourStep >= 0,

  // Persistence
  hydrateOnboarding: (saved = {}) => set({ ...ONBOARDING_DEFAULTS, ...saved }),
  onboardingToJSON: () => {
    const { wizardComplete, dismissedTips, discoveredFeatures, tourCompleted } = get();
    return { wizardComplete, dismissedTips, discoveredFeatures, tourCompleted };
  },
});
