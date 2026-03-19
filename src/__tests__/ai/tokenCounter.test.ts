// ═══════════════════════════════════════════════════════════════════
// charEdge — TokenCounter Tests (Sprint 29)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  countTokens,
  countMessagesTokens,
  tokenBudgetReport,
  trimToTokenBudget,
} from '../../ai/TokenCounter';

describe('TokenCounter', () => {
  describe('countTokens', () => {
    it('returns 0 for empty string', () => {
      expect(countTokens('')).toBe(0);
    });

    it('estimates ~1 token per 4 characters', () => {
      expect(countTokens('Hello world')).toBe(3); // 11 chars / 4 ≈ 3
    });

    it('handles long text', () => {
      const longText = 'a'.repeat(400);
      expect(countTokens(longText)).toBe(100);
    });
  });

  describe('countMessagesTokens', () => {
    it('counts tokens across messages with overhead', () => {
      const messages = [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hi there' },
      ];
      const count = countMessagesTokens(messages);
      // 4 overhead per msg + content tokens
      expect(count).toBeGreaterThan(0);
      expect(count).toBe(4 + Math.ceil(16/4) + 4 + Math.ceil(8/4));
    });
  });

  describe('tokenBudgetReport', () => {
    it('calculates usage percentage', () => {
      const messages = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Hello' },
      ];
      const report = tokenBudgetReport(messages, 100);
      expect(report.usagePercent).toBeGreaterThan(0);
      expect(report.usagePercent).toBeLessThanOrEqual(100);
    });

    it('detects over-budget', () => {
      const messages = [
        { role: 'system', content: 'x'.repeat(200) },
        { role: 'user', content: 'x'.repeat(200) },
      ];
      const report = tokenBudgetReport(messages, 10); // Very small window
      expect(report.overBudget).toBe(true);
    });

    it('shows headroom when under budget', () => {
      const messages = [{ role: 'user', content: 'Hi' }];
      const report = tokenBudgetReport(messages, 4096);
      expect(report.headroom).toBeGreaterThan(0);
    });

    it('breaks down by role', () => {
      const messages = [
        { role: 'system', content: 'System text' },
        { role: 'user', content: 'Earlier query' },
        { role: 'assistant', content: 'Previous response' },
        { role: 'user', content: 'Current query' },
      ];
      const report = tokenBudgetReport(messages, 4096);
      expect(report.breakdown.system).toBeGreaterThan(0);
      expect(report.breakdown.user).toBeGreaterThan(0);
      expect(report.breakdown.history).toBeGreaterThan(0);
    });
  });

  describe('trimToTokenBudget', () => {
    it('returns text unchanged if within budget', () => {
      expect(trimToTokenBudget('Hello', 100)).toBe('Hello');
    });

    it('trims text to budget', () => {
      const longText = 'a'.repeat(400);
      const trimmed = trimToTokenBudget(longText, 10);
      expect(trimmed.length).toBeLessThanOrEqual(41); // 10*4 = 40 + "…"
    });

    it('returns empty for empty input', () => {
      expect(trimToTokenBudget('', 100)).toBe('');
    });
  });
});
