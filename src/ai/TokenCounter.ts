// ═══════════════════════════════════════════════════════════════════
// charEdge — Token Counter (Sprint 29)
//
// Lightweight token estimation for prompt assembly.
// Uses a ~4 chars/token heuristic (accurate within ±10% for English).
// No external tokenizer dependency — keeps bundle lean.
//
// Usage:
//   import { countTokens, tokenBudgetReport } from './TokenCounter';
//   const n = countTokens('Hello world');  // ~3
//   const report = tokenBudgetReport(messages, 4096);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface TokenBreakdown {
  system: number;
  user: number;
  context: number;      // RAG + chart + DNA combined
  history: number;      // conversation history
}

export interface TokenReport {
  totalTokens: number;
  contextWindow: number;
  usagePercent: number;   // 0-100
  breakdown: TokenBreakdown;
  overBudget: boolean;
  headroom: number;       // remaining tokens
}

// ─── Core ───────────────────────────────────────────────────────

const CHARS_PER_TOKEN = 4;

/**
 * Estimate token count for a string.
 * Uses the ~4 chars/token heuristic common for English text.
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Count tokens across an array of chat messages.
 */
export function countMessagesTokens(
  messages: Array<{ role: string; content: string }>,
): number {
  let total = 0;
  for (const msg of messages) {
    // Each message has ~4 tokens overhead (role, formatting)
    total += 4 + countTokens(msg.content);
  }
  return total;
}

/**
 * Generate a token budget report for a set of messages against a context window.
 */
export function tokenBudgetReport(
  messages: Array<{ role: string; content: string }>,
  contextWindow: number,
): TokenReport {
  const breakdown: TokenBreakdown = { system: 0, user: 0, context: 0, history: 0 };

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg) continue;
    const tokens = 4 + countTokens(msg.content);

    if (msg.role === 'system') {
      // System prompt includes DNA, chart, RAG context
      breakdown.system += tokens;
    } else if (msg.role === 'user') {
      if (i === messages.length - 1) {
        // Last user message = current query
        breakdown.user += tokens;
      } else {
        // Earlier user messages = conversation history
        breakdown.history += tokens;
      }
    } else if (msg.role === 'assistant') {
      breakdown.history += tokens;
    }
  }

  const totalTokens = breakdown.system + breakdown.user + breakdown.context + breakdown.history;
  const usagePercent = contextWindow > 0 ? Math.round((totalTokens / contextWindow) * 100) : 0;

  return {
    totalTokens,
    contextWindow,
    usagePercent: Math.min(usagePercent, 100),
    breakdown,
    overBudget: totalTokens > contextWindow,
    headroom: Math.max(0, contextWindow - totalTokens),
  };
}

/**
 * Trim text to fit within a token budget.
 * Preserves complete sentences where possible.
 */
export function trimToTokenBudget(text: string, maxTokens: number): string {
  if (!text) return '';
  const currentTokens = countTokens(text);
  if (currentTokens <= maxTokens) return text;

  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const trimmed = text.slice(0, maxChars);

  // Try to break at last sentence boundary
  const lastPeriod = trimmed.lastIndexOf('. ');
  const lastNewline = trimmed.lastIndexOf('\n');
  const breakAt = Math.max(lastPeriod, lastNewline);

  if (breakAt > maxChars * 0.5) {
    return trimmed.slice(0, breakAt + 1) + '…';
  }

  return trimmed + '…';
}
