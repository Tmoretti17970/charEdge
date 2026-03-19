// ═══════════════════════════════════════════════════════════════════
// charEdge — Conversation Learning (AI Copilot Sprint 18)
//
// Implicit feedback loop: tracks question patterns, detects
// unhelpful responses, builds FAQ cache, generates quality reports.
//
// Usage:
//   import { conversationLearning } from './ConversationLearning';
//   conversationLearning.recordInteraction(question, response, engagement);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface InteractionRecord {
  question: string;
  questionHash: string;
  response: string;
  mode: string;
  timestamp: number;
  followUpDepth: number;     // How many follow-ups after this
  timeSpentMs: number;       // How long user read response
  reAsked: boolean;          // Did user re-ask same thing
  engagement: 'high' | 'medium' | 'low';
}

export interface FAQEntry {
  questionPattern: string;
  frequency: number;
  lastAsked: number;
  avgEngagement: number;     // 0-1
  suggestedTemplate?: string;
}

export interface QualityReport {
  totalInteractions: number;
  avgEngagement: number;
  reAskRate: number;          // % of questions re-asked
  topQuestions: FAQEntry[];
  improvementAreas: string[];
}

const STORAGE_KEY = 'charEdge_convLearning';
const MAX_RECORDS = 500;

// ─── Learning Engine ────────────────────────────────────────────

export class ConversationLearning {
  private _records: InteractionRecord[] = [];
  private _faqCache = new Map<string, FAQEntry>();

  constructor() {
    this._load();
  }

  /**
   * Record a conversation interaction.
   */
  recordInteraction(
    question: string,
    response: string,
    mode: string,
    engagement: InteractionRecord['engagement'] = 'medium',
    followUpDepth = 0,
    timeSpentMs = 0,
  ): void {
    const hash = this._hashQuestion(question);
    const reAsked = this._isReAsk(hash);

    const record: InteractionRecord = {
      question,
      questionHash: hash,
      response,
      mode,
      timestamp: Date.now(),
      followUpDepth,
      timeSpentMs,
      reAsked,
      engagement,
    };

    this._records.push(record);
    if (this._records.length > MAX_RECORDS) {
      this._records = this._records.slice(-MAX_RECORDS);
    }

    this._updateFAQ(record);
    this._save();
  }

  /**
   * Get top N most asked questions.
   */
  getTopQuestions(n = 10): FAQEntry[] {
    return [...this._faqCache.values()]
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, n);
  }

  /**
   * Get questions that should be promoted to L1 templates.
   */
  getImprovedTemplates(): FAQEntry[] {
    return [...this._faqCache.values()]
      .filter(f => f.frequency >= 3 && f.avgEngagement > 0.5)
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Get quality report.
   */
  getQualityReport(): QualityReport {
    const total = this._records.length;
    if (total === 0) {
      return {
        totalInteractions: 0,
        avgEngagement: 0,
        reAskRate: 0,
        topQuestions: [],
        improvementAreas: [],
      };
    }

    const engagementMap = { high: 1, medium: 0.5, low: 0 };
    const avgEngagement = this._records.reduce((s, r) => s + engagementMap[r.engagement], 0) / total;
    const reAskCount = this._records.filter(r => r.reAsked).length;
    const reAskRate = reAskCount / total;

    const improvements: string[] = [];
    if (reAskRate > 0.2) improvements.push('High re-ask rate — responses may not be addressing questions fully');
    if (avgEngagement < 0.4) improvements.push('Low engagement — consider more concise, actionable responses');

    const lowEngagementModes = this._findLowEngagementModes();
    for (const mode of lowEngagementModes) {
      improvements.push(`${mode} mode has below-average engagement`);
    }

    return {
      totalInteractions: total,
      avgEngagement: Math.round(avgEngagement * 100) / 100,
      reAskRate: Math.round(reAskRate * 100) / 100,
      topQuestions: this.getTopQuestions(5),
      improvementAreas: improvements,
    };
  }

  /**
   * Get learning summary for AI context.
   */
  getLearningForAI(): string {
    const top = this.getTopQuestions(3);
    if (top.length === 0) return '';

    const lines = top.map(q => `"${q.questionPattern}" (asked ${q.frequency}x)`);
    return `--- User FAQ Patterns ---\n${lines.join('\n')}`;
  }

  /**
   * Get total interaction count.
   */
  get totalInteractions(): number {
    return this._records.length;
  }

  /**
   * Reset all learning data.
   */
  reset(): void {
    this._records = [];
    this._faqCache.clear();
    this._save();
  }

  // ── Internal ────────────────────────────────────────────────

  private _hashQuestion(question: string): string {
    // Simple hash: lowercase, strip filler words, take first 50 chars
    return question.toLowerCase()
      .replace(/\b(the|a|an|is|are|was|were|do|does|did|can|could|would|should|my|i|me)\b/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50);
  }

  private _isReAsk(hash: string): boolean {
    // Was this same question asked in the last 5 interactions?
    const recent = this._records.slice(-5);
    return recent.some(r => r.questionHash === hash);
  }

  private _updateFAQ(record: InteractionRecord): void {
    const existing = this._faqCache.get(record.questionHash);
    const engScore = record.engagement === 'high' ? 1 : record.engagement === 'medium' ? 0.5 : 0;

    if (existing) {
      existing.frequency++;
      existing.lastAsked = record.timestamp;
      existing.avgEngagement = (existing.avgEngagement * (existing.frequency - 1) + engScore) / existing.frequency;
    } else {
      this._faqCache.set(record.questionHash, {
        questionPattern: record.question.slice(0, 80),
        frequency: 1,
        lastAsked: record.timestamp,
        avgEngagement: engScore,
      });
    }
  }

  private _findLowEngagementModes(): string[] {
    const modeStats: Record<string, { total: number; score: number }> = {};
    const engMap = { high: 1, medium: 0.5, low: 0 };

    for (const r of this._records) {
      if (!modeStats[r.mode]) modeStats[r.mode] = { total: 0, score: 0 };
      modeStats[r.mode].total++;
      modeStats[r.mode].score += engMap[r.engagement];
    }

    const overall = this._records.length > 0
      ? this._records.reduce((s, r) => s + engMap[r.engagement], 0) / this._records.length
      : 0.5;

    const low: string[] = [];
    for (const [mode, stats] of Object.entries(modeStats)) {
      if (stats.total >= 3 && (stats.score / stats.total) < overall * 0.7) {
        low.push(mode);
      }
    }
    return low;
  }

  // ── Persistence ─────────────────────────────────────────────

  private _load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this._records = data.records || [];
        if (data.faq) {
          for (const [k, v] of Object.entries(data.faq)) {
            this._faqCache.set(k, v as FAQEntry);
          }
        }
      }
    } catch { /* ignore */ }
  }

  private _save(): void {
    try {
      const faq: Record<string, FAQEntry> = {};
      for (const [k, v] of this._faqCache) faq[k] = v;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        records: this._records.slice(-MAX_RECORDS),
        faq,
      }));
    } catch { /* ignore */ }
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const conversationLearning = new ConversationLearning();
export default conversationLearning;
