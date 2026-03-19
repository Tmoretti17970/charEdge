// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Budget Manager (Sprint 70)
//
// Cross-provider daily/hourly budget tracking for free-tier APIs.
// Persists counters in localStorage with midnight UTC reset.
//
// Usage:
//   import { aiBudget } from './AIBudgetManager';
//   if (aiBudget.canUse('gemini')) { ... }
//   aiBudget.record('gemini');
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface ProviderBudget {
  dailyLimit: number;
  minuteLimit: number;
  dailyUsed: number;
  minuteUsed: number;
  lastResetDay: string;  // YYYY-MM-DD UTC
  minuteTimestamps: number[];
}

export interface BudgetSnapshot {
  provider: string;
  dailyUsed: number;
  dailyLimit: number;
  dailyPercent: number;
  minuteUsed: number;
  minuteLimit: number;
  available: boolean;
}

// ─── Budget Limits ──────────────────────────────────────────────

const BUDGETS: Record<string, { daily: number; perMinute: number }> = {
  gemini:        { daily: 1500,  perMinute: 15 },
  groq:          { daily: 14400, perMinute: 30 },
  'groq-whisper': { daily: 2000,  perMinute: 10 },
  webllm:        { daily: Infinity, perMinute: Infinity }, // local — unlimited
};

const STORAGE_KEY = 'charEdge-ai-budget';

// ─── Budget Manager ─────────────────────────────────────────────

class AIBudgetManager {
  private _data: Record<string, ProviderBudget> = {};
  private _loaded = false;

  constructor() {
    this._load();
  }

  /**
   * Check if a provider has remaining budget.
   */
  canUse(provider: string): boolean {
    this._ensureFresh();
    const budget = this._getOrCreate(provider);
    const limits = BUDGETS[provider];
    if (!limits) return true; // Unknown provider → no limit

    if (limits.daily !== Infinity && budget.dailyUsed >= limits.daily) return false;

    // Check per-minute rate
    const now = Date.now();
    const recentCalls = budget.minuteTimestamps.filter(t => now - t < 60_000).length;
    if (limits.perMinute !== Infinity && recentCalls >= limits.perMinute) return false;

    return true;
  }

  /**
   * Record an API call for a provider.
   */
  record(provider: string): void {
    this._ensureFresh();
    const budget = this._getOrCreate(provider);
    budget.dailyUsed++;
    budget.minuteTimestamps.push(Date.now());

    // Keep only last 5 minutes of timestamps
    const cutoff = Date.now() - 300_000;
    budget.minuteTimestamps = budget.minuteTimestamps.filter(t => t >= cutoff);

    this._save();
  }

  /**
   * Get usage snapshot for all providers (for settings UI).
   */
  getUsage(): BudgetSnapshot[] {
    this._ensureFresh();
    const results: BudgetSnapshot[] = [];

    for (const [provider, limits] of Object.entries(BUDGETS)) {
      if (limits.daily === Infinity) continue; // Skip unlimited

      const budget = this._getOrCreate(provider);
      const now = Date.now();
      const minuteUsed = budget.minuteTimestamps.filter(t => now - t < 60_000).length;

      results.push({
        provider,
        dailyUsed: budget.dailyUsed,
        dailyLimit: limits.daily,
        dailyPercent: Math.min(100, Math.round((budget.dailyUsed / limits.daily) * 100)),
        minuteUsed,
        minuteLimit: limits.perMinute,
        available: this.canUse(provider),
      });
    }

    return results.sort((a, b) => b.dailyPercent - a.dailyPercent);
  }

  /**
   * Get remaining calls for a provider today.
   */
  remaining(provider: string): number {
    this._ensureFresh();
    const budget = this._getOrCreate(provider);
    const limits = BUDGETS[provider];
    if (!limits || limits.daily === Infinity) return Infinity;
    return Math.max(0, limits.daily - budget.dailyUsed);
  }

  /**
   * Reset all budgets (manual reset for testing).
   */
  reset(): void {
    this._data = {};
    this._save();
  }

  // ─── Internal ────────────────────────────────────────────────

  private _getOrCreate(provider: string): ProviderBudget {
    if (!this._data[provider]) {
      this._data[provider] = {
        dailyLimit: BUDGETS[provider]?.daily || Infinity,
        minuteLimit: BUDGETS[provider]?.perMinute || Infinity,
        dailyUsed: 0,
        minuteUsed: 0,
        lastResetDay: this._todayUTC(),
        minuteTimestamps: [],
      };
    }
    return this._data[provider];
  }

  /**
   * Reset daily counters if we've crossed midnight UTC.
   */
  private _ensureFresh(): void {
    if (!this._loaded) this._load();

    const today = this._todayUTC();
    for (const [, budget] of Object.entries(this._data)) {
      if (budget.lastResetDay !== today) {
        budget.dailyUsed = 0;
        budget.lastResetDay = today;
        budget.minuteTimestamps = [];
      }
    }
  }

  private _todayUTC(): string {
    return new Date().toISOString().split('T')[0];
  }

  private _load(): void {
    this._loaded = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this._data = JSON.parse(raw);
      }
    } catch {
      this._data = {};
    }
  }

  private _save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
    } catch {
      // localStorage unavailable
    }
  }
}

// ─── Singleton + Exports ────────────────────────────────────────

export const aiBudget = new AIBudgetManager();
export { AIBudgetManager };
export default aiBudget;
