// ═══════════════════════════════════════════════════════════════════
// charEdge — Model Settings (AI Copilot Sprint 11)
//
// Persists user's model preferences: selected model, auto-upgrade
// toggle, and model usage statistics.
//
// Usage:
//   import { modelSettings } from './ModelSettings';
//   modelSettings.setPreferredModel('large');
// ═══════════════════════════════════════════════════════════════════

import type { ModelTier } from './WebLLMProvider';

// ─── Types ──────────────────────────────────────────────────────

export interface ModelPreferences {
  preferredTier: ModelTier;
  autoUpgrade: boolean;          // Auto-suggest upgrade when model is too small
  lastLoadedModel: string | null;
  totalTokensGenerated: number;
  totalInferences: number;
}

const STORAGE_KEY = 'charEdge_modelSettings';

const DEFAULTS: ModelPreferences = {
  preferredTier: 'small',
  autoUpgrade: true,
  lastLoadedModel: null,
  totalTokensGenerated: 0,
  totalInferences: 0,
};

// ─── Settings Manager ───────────────────────────────────────────

export class ModelSettings {
  private _prefs: ModelPreferences;

  constructor() {
    this._prefs = this._load();
  }

  get preferences(): ModelPreferences {
    return { ...this._prefs };
  }

  getPreferredTier(): ModelTier {
    return this._prefs.preferredTier;
  }

  setPreferredModel(tier: ModelTier): void {
    this._prefs.preferredTier = tier;
    this._save();
  }

  setAutoUpgrade(enabled: boolean): void {
    this._prefs.autoUpgrade = enabled;
    this._save();
  }

  recordInference(tokensUsed: number): void {
    this._prefs.totalInferences++;
    this._prefs.totalTokensGenerated += tokensUsed;
    this._save();
  }

  setLastLoadedModel(modelId: string): void {
    this._prefs.lastLoadedModel = modelId;
    this._save();
  }

  /**
   * Should we suggest upgrading to a larger model?
   */
  shouldSuggestUpgrade(): boolean {
    return (
      this._prefs.autoUpgrade &&
      this._prefs.preferredTier === 'small' &&
      this._prefs.totalInferences >= 10
    );
  }

  /**
   * Get usage summary for AI context.
   */
  getUsageSummary(): string {
    return `Model: ${this._prefs.preferredTier} | Inferences: ${this._prefs.totalInferences} | Tokens: ${this._prefs.totalTokensGenerated}`;
  }

  reset(): void {
    this._prefs = { ...DEFAULTS };
    this._save();
  }

  // ── Persistence ─────────────────────────────────────────────

  private _load(): ModelPreferences {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { ...DEFAULTS };
  }

  private _save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._prefs));
    } catch { /* ignore */ }
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const modelSettings = new ModelSettings();
export default modelSettings;
