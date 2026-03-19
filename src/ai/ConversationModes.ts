// ═══════════════════════════════════════════════════════════════════
// charEdge — Conversation Modes (AI Copilot Sprint 14)
//
// Mode selector: quick / analysis / coaching / journal.
// Each mode configures prompt templates, data injection, and
// response constraints (length, tone, format).
//
// Usage:
//   import { conversationModes } from './ConversationModes';
//   conversationModes.setMode('coaching');
//   const config = conversationModes.getModeConfig();
// ═══════════════════════════════════════════════════════════════════

import type { PromptMode } from './PromptAssembler';

// ─── Types ──────────────────────────────────────────────────────

export interface ModeConfig {
  id: PromptMode;
  label: string;
  emoji: string;
  description: string;
  maxResponseTokens: number;
  temperature: number;
  tone: string;
  dataSources: string[];    // Which data to inject
  requiresLLM: boolean;     // True = needs loaded model
}

// ─── Mode Definitions ───────────────────────────────────────────

const MODES: Record<PromptMode, ModeConfig> = {
  quick: {
    id: 'quick',
    label: 'Quick',
    emoji: '🏃',
    description: 'Instant 1-2 sentence answers from templates',
    maxResponseTokens: 64,
    temperature: 0,
    tone: 'concise',
    dataSources: ['chart'],
    requiresLLM: false,
  },
  analysis: {
    id: 'analysis',
    label: 'Analysis',
    emoji: '🔬',
    description: 'Deep chart analysis with indicators and context',
    maxResponseTokens: 512,
    temperature: 0.3,
    tone: 'professional',
    dataSources: ['chart', 'traderDNA', 'indicators', 'patterns'],
    requiresLLM: true,
  },
  coaching: {
    id: 'coaching',
    label: 'Coaching',
    emoji: '🎯',
    description: 'Personalized trading mentor based on your history',
    maxResponseTokens: 512,
    temperature: 0.5,
    tone: 'mentor',
    dataSources: ['traderDNA', 'pastTrades', 'coachingPrefs', 'chart'],
    requiresLLM: true,
  },
  journal: {
    id: 'journal',
    label: 'Journal',
    emoji: '📓',
    description: 'Search and analyze your past trades',
    maxResponseTokens: 512,
    temperature: 0.2,
    tone: 'analytical',
    dataSources: ['journalRAG', 'traderDNA', 'pastTrades'],
    requiresLLM: true,
  },
};

const STORAGE_KEY = 'charEdge_conversationMode';

// ─── Mode Manager ───────────────────────────────────────────────

export class ConversationModes {
  private _currentMode: PromptMode;

  constructor() {
    this._currentMode = this._loadMode();
  }

  /**
   * Get current mode.
   */
  getMode(): PromptMode {
    return this._currentMode;
  }

  /**
   * Set active mode.
   */
  setMode(mode: PromptMode): void {
    this._currentMode = mode;
    this._saveMode(mode);
  }

  /**
   * Cycle to the next mode: quick → analysis → coaching → journal → quick.
   */
  cycleMode(): PromptMode {
    const order: PromptMode[] = ['quick', 'analysis', 'coaching', 'journal'];
    const idx = order.indexOf(this._currentMode);
    const next = order[(idx + 1) % order.length] || 'analysis';
    this.setMode(next as PromptMode);
    return next;
  }

  /**
   * Get config for current or specified mode.
   */
  getModeConfig(mode?: PromptMode): ModeConfig {
    return { ...MODES[mode || this._currentMode] };
  }

  /**
   * Get all available modes.
   */
  getAllModes(): ModeConfig[] {
    return Object.values(MODES).map(m => ({ ...m }));
  }

  /**
   * Get mode-specific response constraints.
   */
  getResponseConstraints(mode?: PromptMode): {
    maxTokens: number; temperature: number; tone: string;
  } {
    const m = MODES[mode || this._currentMode];
    return {
      maxTokens: m.maxResponseTokens,
      temperature: m.temperature,
      tone: m.tone,
    };
  }

  /**
   * Get which data sources to inject for this mode.
   */
  getDataSources(mode?: PromptMode): string[] {
    return [...MODES[mode || this._currentMode].dataSources];
  }

  /**
   * Check if current mode needs an LLM model loaded.
   */
  requiresLLM(mode?: PromptMode): boolean {
    return MODES[mode || this._currentMode].requiresLLM;
  }

  /**
   * Get mode summary for AI context.
   */
  getModeSummaryForAI(): string {
    const m = MODES[this._currentMode];
    return `Conversation mode: ${m.label} (${m.emoji}) — ${m.tone} tone, ${m.dataSources.join(', ')}`;
  }

  // ── Persistence ─────────────────────────────────────────────

  private _loadMode(): PromptMode {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored in MODES) return stored as PromptMode;
    } catch { /* ignore */ }
    return 'analysis';
  }

  private _saveMode(mode: PromptMode): void {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch { /* ignore */ }
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const conversationModes = new ConversationModes();
export default conversationModes;
