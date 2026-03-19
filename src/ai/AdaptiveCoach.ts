// ═══════════════════════════════════════════════════════════════════
// charEdge — Adaptive Coaching Personality (AI Copilot Sprint 4)
//
// Learns user receptiveness to coaching messages. Tracks dismiss vs.
// acknowledge per category, adjusts tone/frequency/verbosity.
// Wraps CoachingEngine to make recommendations more effective.
//
// Usage:
//   import { adaptiveCoach } from './AdaptiveCoach';
//   adaptiveCoach.recordInteraction('risk', 'acknowledged');
//   const msg = adaptiveCoach.formatMessage('Tighten your stops', 'risk');
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export type CoachingTone = 'direct' | 'supportive' | 'analytical';
export type CoachingVerbosity = 'brief' | 'normal' | 'detailed';
export type CoachingFrequency = 'high' | 'medium' | 'low';
export type InteractionAction = 'dismissed' | 'acknowledged' | 'expanded' | 'acted';

export type CoachingCategory =
  | 'risk'
  | 'psychology'
  | 'timing'
  | 'performance'
  | 'improvement'
  | 'tilt'
  | 'overtrading';

export interface CoachingPreferences {
  tone: CoachingTone;
  verbosity: CoachingVerbosity;
  frequency: CoachingFrequency;
}

interface CategoryStats {
  dismissed: number;
  acknowledged: number;
  expanded: number;
  acted: number;
  lastInteraction: number;
}

interface StoredData {
  categories: Record<string, CategoryStats>;
  globalPrefs: CoachingPreferences;
  totalInteractions: number;
  updatedAt: number;
}

// ─── Constants ──────────────────────────────────────────────────

const STORAGE_KEY = 'charEdge-coaching-prefs';
const ALL_CATEGORIES: CoachingCategory[] = [
  'risk', 'psychology', 'timing', 'performance', 'improvement', 'tilt', 'overtrading',
];

const DEFAULT_STATS: CategoryStats = {
  dismissed: 0, acknowledged: 0, expanded: 0, acted: 0, lastInteraction: 0,
};

// ─── Tone Templates ─────────────────────────────────────────────

const TONE_PREFIXES: Record<CoachingTone, string[]> = {
  direct: [
    'Action needed:',
    'Key issue:',
    'Fix this:',
    'Bottom line:',
  ],
  supportive: [
    'Something worth considering:',
    'A gentle reminder:',
    'You might find it helpful to',
    'Here\'s an opportunity:',
  ],
  analytical: [
    'Data shows:',
    'Pattern detected:',
    'Analysis suggests:',
    'Statistically:',
  ],
};

// ─── Store Class ────────────────────────────────────────────────

export class AdaptiveCoach {
  private _data: StoredData;

  constructor() {
    this._data = this._load();
  }

  // ── Interaction Recording ───────────────────────────────────

  /**
   * Record a user's response to a coaching message.
   */
  recordInteraction(category: CoachingCategory, action: InteractionAction): void {
    const stats = this._getCategoryStats(category);
    stats[action]++;
    stats.lastInteraction = Date.now();
    this._data.totalInteractions++;
    this._data.updatedAt = Date.now();

    // Recalculate global preferences based on patterns
    this._recalculatePreferences();
    this._save();
  }

  // ── Preference Access ───────────────────────────────────────

  /**
   * Get current adaptive preferences.
   */
  getPreferences(): CoachingPreferences {
    return { ...this._data.globalPrefs };
  }

  /**
   * Get the best tone for a specific category based on history.
   */
  getToneForCategory(category: CoachingCategory): CoachingTone {
    const stats = this._getCategoryStats(category);
    const total = stats.dismissed + stats.acknowledged + stats.expanded + stats.acted;

    if (total < 3) return this._data.globalPrefs.tone; // Not enough data

    const engagementRate = (stats.acknowledged + stats.expanded + stats.acted) / total;

    // If they mostly dismiss this category, try a different tone
    if (engagementRate < 0.3) {
      // Low engagement — switch to analytical (data-driven might work better)
      return 'analytical';
    } else if (engagementRate > 0.7 && stats.acted > stats.acknowledged) {
      // High engagement + action — keep it direct
      return 'direct';
    } else if (engagementRate > 0.5) {
      // Moderate engagement — supportive works
      return 'supportive';
    }

    return this._data.globalPrefs.tone;
  }

  // ── Message Formatting ──────────────────────────────────────

  /**
   * Apply adaptive formatting to a coaching message.
   */
  formatMessage(rawMessage: string, category: CoachingCategory): string {
    const tone = this.getToneForCategory(category);
    const verbosity = this._data.globalPrefs.verbosity;

    // Apply tone prefix
    const prefixes = TONE_PREFIXES[tone];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)] || '';

    // Apply verbosity
    let message = rawMessage;
    if (verbosity === 'brief') {
      // Truncate to first sentence
      const firstSentence = rawMessage.match(/^[^.!?]+[.!?]/);
      if (firstSentence) message = firstSentence[0];
    } else if (verbosity === 'detailed') {
      // Keep full message as-is
      message = rawMessage;
    }

    return `${prefix} ${message}`.trim();
  }

  /**
   * Check if a coaching message should be shown based on frequency preferences.
   */
  shouldShowMessage(category: CoachingCategory): boolean {
    const stats = this._getCategoryStats(category);
    const frequency = this._data.globalPrefs.frequency;

    // Check cooldown based on frequency setting
    const cooldowns: Record<CoachingFrequency, number> = {
      high: 5 * 60 * 1000,       // 5 minutes
      medium: 30 * 60 * 1000,    // 30 minutes
      low: 2 * 60 * 60 * 1000,   // 2 hours
    };

    const cooldown = cooldowns[frequency];
    if (stats.lastInteraction && Date.now() - stats.lastInteraction < cooldown) {
      return false;
    }

    // Suppress if they've dismissed this category 3+ times recently
    if (stats.dismissed > 3 && stats.acknowledged === 0) {
      return false;
    }

    return true;
  }

  // ── Effectiveness Report ────────────────────────────────────

  /**
   * Get effectiveness scores per category.
   */
  getEffectivenessReport(): Record<string, {
    engagementRate: number;
    actionRate: number;
    total: number;
    bestTone: CoachingTone;
  }> {
    const report: Record<string, {
      engagementRate: number;
      actionRate: number;
      total: number;
      bestTone: CoachingTone;
    }> = {};

    for (const category of ALL_CATEGORIES) {
      const stats = this._getCategoryStats(category);
      const total = stats.dismissed + stats.acknowledged + stats.expanded + stats.acted;

      report[category] = {
        engagementRate: total > 0
          ? (stats.acknowledged + stats.expanded + stats.acted) / total
          : 0,
        actionRate: total > 0 ? stats.acted / total : 0,
        total,
        bestTone: this.getToneForCategory(category),
      };
    }

    return report;
  }

  /**
   * Get a formatted summary for AI context.
   */
  getCoachingSummaryForAI(): string {
    const prefs = this._data.globalPrefs;
    const report = this.getEffectivenessReport();

    const lines: string[] = [];
    lines.push(`Coaching preferences: ${prefs.tone} tone, ${prefs.verbosity} verbosity, ${prefs.frequency} frequency`);

    // Find most/least receptive categories
    const entries = Object.entries(report).filter(([, r]) => r.total >= 3);
    if (entries.length > 0) {
      const best = entries.sort((a, b) => b[1].engagementRate - a[1].engagementRate)[0];
      const worst = entries.sort((a, b) => a[1].engagementRate - b[1].engagementRate)[0];

      if (best) lines.push(`Most receptive to: ${best[0]} coaching (${(best[1].engagementRate * 100).toFixed(0)}% engagement)`);
      if (worst && worst[0] !== best?.[0]) {
        lines.push(`Least receptive to: ${worst[0]} coaching (${(worst[1].engagementRate * 100).toFixed(0)}% engagement)`);
      }
    }

    return lines.join('. ');
  }

  /** Total recorded interactions */
  get totalInteractions(): number {
    return this._data.totalInteractions;
  }

  /** Reset all coaching data */
  reset(): void {
    this._data = this._defaultData();
    this._save();
  }

  // ── Internal ────────────────────────────────────────────────

  private _getCategoryStats(category: CoachingCategory): CategoryStats {
    if (!this._data.categories[category]) {
      this._data.categories[category] = { ...DEFAULT_STATS };
    }
    return this._data.categories[category];
  }

  private _recalculatePreferences(): void {
    let totalDismissed = 0;
    let totalEngaged = 0;
    let totalExpanded = 0;

    for (const cat of ALL_CATEGORIES) {
      const stats = this._data.categories[cat];
      if (!stats) continue;
      totalDismissed += stats.dismissed;
      totalEngaged += stats.acknowledged + stats.acted;
      totalExpanded += stats.expanded;
    }

    const total = totalDismissed + totalEngaged + totalExpanded;
    if (total < 5) return; // Not enough data

    const engagementRate = (totalEngaged + totalExpanded) / total;

    // Adjust verbosity
    if (totalExpanded > totalEngaged * 0.5) {
      this._data.globalPrefs.verbosity = 'detailed'; // They want more detail
    } else if (totalDismissed > totalEngaged * 2) {
      this._data.globalPrefs.verbosity = 'brief'; // They find it too much
    } else {
      this._data.globalPrefs.verbosity = 'normal';
    }

    // Adjust frequency
    if (engagementRate > 0.7) {
      this._data.globalPrefs.frequency = 'high';
    } else if (engagementRate < 0.3) {
      this._data.globalPrefs.frequency = 'low';
    } else {
      this._data.globalPrefs.frequency = 'medium';
    }

    // Adjust tone based on most successful interactions
    // (expanded + acted = they want data; acknowledged = supportive is fine)
    if (totalExpanded > totalEngaged) {
      this._data.globalPrefs.tone = 'analytical';
    } else if (totalDismissed < totalEngaged * 0.3) {
      this._data.globalPrefs.tone = 'direct';
    } else {
      this._data.globalPrefs.tone = 'supportive';
    }
  }

  // ── Persistence ─────────────────────────────────────────────

  private _load(): StoredData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return this._defaultData();
  }

  private _save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
    } catch { /* non-critical */ }
  }

  private _defaultData(): StoredData {
    return {
      categories: {},
      globalPrefs: { tone: 'supportive', verbosity: 'normal', frequency: 'medium' },
      totalInteractions: 0,
      updatedAt: 0,
    };
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const adaptiveCoach = new AdaptiveCoach();
export default adaptiveCoach;
