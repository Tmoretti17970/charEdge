// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Feature Gate (Sprint 99)
//
// Progressive disclosure of AI features based on user readiness.
// Tracks onboarding progress and unlocks tiers.
//
// Usage:
//   import { aiFeatureGate } from './AIFeatureGate';
//   if (aiFeatureGate.canAccess('monteCarlo')) { ... }
//   const progress = aiFeatureGate.getOnboardingProgress();
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export type FeatureTier = 'basic' | 'pro' | 'expert';

export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  tier: FeatureTier;
}

export interface OnboardingProgress {
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  percentage: number;
  currentTier: FeatureTier;
  nextTierUnlockAt: number;
}

// ─── Feature Map ────────────────────────────────────────────────

const FEATURE_TIERS: Record<string, FeatureTier> = {
  // Basic — available immediately
  journal: 'basic',
  charts: 'basic',
  watchlist: 'basic',
  copilot: 'basic',
  aiInsights: 'basic',

  // Pro — after 10+ trades and journal entries
  tradeCorrelation: 'pro',
  setupScoring: 'pro',
  tradeReplay: 'pro',
  chartQuery: 'pro',
  semanticSearch: 'pro',
  watchlistTemplates: 'pro',

  // Expert — after API keys + 50+ trades
  monteCarlo: 'expert',
  mtfConfluence: 'expert',
  strategyGenerator: 'expert',
  featureImportance: 'expert',
  personalModel: 'expert',
  tradeClustering: 'expert',
  morningBrief: 'expert',
};

// ─── Constants ──────────────────────────────────────────────────

const STORAGE_KEY = 'charEdge-onboarding';

// ─── Gate ───────────────────────────────────────────────────────

class AIFeatureGate {
  private _state: Record<string, boolean>;

  constructor() {
    this._state = this._load();
  }

  /**
   * Check if a feature is accessible at the user's current tier.
   */
  canAccess(featureId: string): boolean {
    const requiredTier = FEATURE_TIERS[featureId];
    if (!requiredTier) return true; // Unknown features are allowed

    const currentTier = this.getCurrentTier();
    const tierOrder: FeatureTier[] = ['basic', 'pro', 'expert'];
    return tierOrder.indexOf(currentTier) >= tierOrder.indexOf(requiredTier);
  }

  /**
   * Get the user's current tier based on completed steps.
   */
  getCurrentTier(): FeatureTier {
    const progress = this.getOnboardingProgress();
    if (progress.percentage >= 80) return 'expert';
    if (progress.percentage >= 40) return 'pro';
    return 'basic';
  }

  /**
   * Get full onboarding progress.
   */
  getOnboardingProgress(): OnboardingProgress {
    const steps = this._getSteps();
    const completed = steps.filter(s => s.completed).length;
    const pct = Math.round((completed / steps.length) * 100);
    const currentTier = pct >= 80 ? 'expert' : pct >= 40 ? 'pro' : 'basic';

    const tierOrder: FeatureTier[] = ['basic', 'pro', 'expert'];
    const nextIdx = tierOrder.indexOf(currentTier) + 1;
    const nextUnlock = nextIdx >= tierOrder.length ? 100 : nextIdx === 1 ? 40 : 80;

    return {
      steps,
      completedCount: completed,
      totalCount: steps.length,
      percentage: pct,
      currentTier,
      nextTierUnlockAt: nextUnlock,
    };
  }

  /**
   * Complete an onboarding step.
   */
  completeStep(stepId: string): void {
    this._state[stepId] = true;
    this._save();
  }

  /**
   * Check if a step is completed.
   */
  isStepComplete(stepId: string): boolean {
    return this._state[stepId] === true;
  }

  /**
   * Reset all onboarding progress.
   */
  reset(): void {
    this._state = {};
    this._save();
  }

  // ─── Steps Definition ───────────────────────────────────────

  private _getSteps(): OnboardingStep[] {
    return [
      { id: 'first-trade', label: 'Log Your First Trade', description: 'Add a trade to your journal', completed: !!this._state['first-trade'], tier: 'basic' },
      { id: 'first-journal', label: 'Write a Journal Entry', description: 'Add notes to a trade', completed: !!this._state['first-journal'], tier: 'basic' },
      { id: 'add-watchlist', label: 'Build Your Watchlist', description: 'Add symbols to watch', completed: !!this._state['add-watchlist'], tier: 'basic' },
      { id: 'view-chart', label: 'Explore Charts', description: 'Open and interact with a chart', completed: !!this._state['view-chart'], tier: 'basic' },
      { id: 'use-copilot', label: 'Try the AI Copilot', description: 'Ask the copilot a question', completed: !!this._state['use-copilot'], tier: 'basic' },
      { id: 'ten-trades', label: 'Log 10 Trades', description: 'Build enough history for analytics', completed: !!this._state['ten-trades'], tier: 'pro' },
      { id: 'setup-api-key', label: 'Configure an API Key', description: 'Add a Gemini or Groq key in Settings', completed: !!this._state['setup-api-key'], tier: 'pro' },
      { id: 'run-analysis', label: 'Run Full Analysis', description: 'Use the AI for a full trade analysis', completed: !!this._state['run-analysis'], tier: 'pro' },
      { id: 'fifty-trades', label: 'Log 50 Trades', description: 'Unlock expert-level analytics', completed: !!this._state['fifty-trades'], tier: 'expert' },
      { id: 'explore-advanced', label: 'Explore Advanced AI', description: 'Use Monte Carlo, correlation, or clustering', completed: !!this._state['explore-advanced'], tier: 'expert' },
    ];
  }

  // ─── Persistence ────────────────────────────────────────────

  private _load(): Record<string, boolean> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch { return {}; }
  }

  private _save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state));
    } catch { /* */ }
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const aiFeatureGate = new AIFeatureGate();
export default aiFeatureGate;
