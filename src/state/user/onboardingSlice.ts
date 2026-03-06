// ═══════════════════════════════════════════════════════════════════
// charEdge — Onboarding Slice
// Extracted from useOnboardingStore for useUserStore consolidation.
// Includes skill-level adaptive onboarding (Batch 16: 3.1.7).
// ═══════════════════════════════════════════════════════════════════

import type { SkillLevel } from '../../config/coachmarkRegistry';
import { getCoachmarksForLevel } from '../../config/coachmarkRegistry';

const ONBOARDING_DEFAULTS = {
  wizardComplete: false,
  wizardStep: 0,
  ahaReached: false,
  skipCount: 0,
  dismissedTips: [] as string[],
  discoveredFeatures: [] as string[],
  tourStep: -1,
  tourCompleted: false,
  skillLevel: 'beginner' as SkillLevel,      // Batch 16: skill-adaptive onboarding
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
    const { wizardComplete, dismissedTips, discoveredFeatures, tourCompleted, skillLevel } = get();
    return { wizardComplete, dismissedTips, discoveredFeatures, tourCompleted, skillLevel };
  },

  // ─── Skill-Adaptive (Batch 16: 3.1.7) ─────────────────────────
  setSkillLevel: (level: SkillLevel) => set({ skillLevel: level }),
  getSkillLevel: (): SkillLevel => get().skillLevel || 'beginner',
  getVisibleCoachmarks: () => {
    const level: SkillLevel = get().skillLevel || 'beginner';
    const dismissed: string[] = get().dismissedTips || [];
    return getCoachmarksForLevel(level).filter(c => !dismissed.includes(c.id));
  },
});
