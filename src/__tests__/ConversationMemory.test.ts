// ═══════════════════════════════════════════════════════════════════
// charEdge — ConversationMemory Tests (AI Copilot Sprint 2)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationMemory } from '../ai/ConversationMemory';

describe('ConversationMemory', () => {
  let memory: ConversationMemory;

  beforeEach(() => {
    memory = new ConversationMemory();
  });

  it('starts a new session with correct defaults', async () => {
    const session = await memory.startSession('Test Session');
    expect(session.id).toMatch(/^session-/);
    expect(session.title).toBe('Test Session');
    expect(session.messages).toHaveLength(0);
    expect(session.summary).toBe('');
    expect(session.createdAt).toBeGreaterThan(0);
  });

  it('adds messages to the current session', async () => {
    await memory.startSession('Chat');
    await memory.addMessage('user', 'What do you see on BTC?');
    await memory.addMessage('assistant', 'BTC is showing a bullish divergence on the RSI.');

    expect(memory.messageCount).toBe(2);
    const context = memory.getRecentContext();
    expect(context).toHaveLength(2);
    expect(context[0]?.role).toBe('user');
    expect(context[1]?.role).toBe('assistant');
  });

  it('caps messages at rolling window (20)', async () => {
    await memory.startSession('Many messages');

    // Add 25 messages
    for (let i = 0; i < 25; i++) {
      await memory.addMessage(
        i % 2 === 0 ? 'user' : 'assistant',
        `Message ${i}`,
      );
    }

    // Should be capped at 20
    expect(memory.messageCount).toBe(20);

    // First message should be message 5 (oldest 5 were trimmed)
    const ctx = memory.getRecentContext(20);
    expect(ctx[0]?.content).toBe('Message 5');
    expect(ctx[ctx.length - 1]?.content).toBe('Message 24');
  });

  it('getRecentContext returns correct subset', async () => {
    await memory.startSession('Context test');

    for (let i = 0; i < 10; i++) {
      await memory.addMessage('user', `Question ${i}`);
    }

    // Request last 3
    const recent = memory.getRecentContext(3);
    expect(recent).toHaveLength(3);
    expect(recent[0]?.content).toBe('Question 7');
    expect(recent[2]?.content).toBe('Question 9');
  });

  it('returns empty context when no session exists', () => {
    const context = memory.getRecentContext();
    expect(context).toHaveLength(0);
  });

  it('generates session summary with topics', async () => {
    await memory.startSession('Risk session');

    // Add messages about risk management (triggers the topic keyword match)
    for (let i = 0; i < 5; i++) {
      await memory.addMessage('user', 'What should my stop loss be for this BTCUSDT trade?');
      // At 5 messages, summary auto-generates
    }

    const session = await memory.getCurrentSession();
    expect(session.summary).toContain('risk management');
  });

  it('tracks message metadata', async () => {
    await memory.startSession('Meta test');
    await memory.addMessage('user', 'Analyze BTC', {
      symbol: 'BTCUSDT',
      timeframe: '1H',
      requestType: 'analyze',
    });

    const context = memory.getRecentContext(1);
    expect(context[0]?.metadata?.symbol).toBe('BTCUSDT');
    expect(context[0]?.metadata?.timeframe).toBe('1H');
  });

  it('auto-creates session when adding message without one', async () => {
    // No startSession call — should auto-create
    await memory.addMessage('user', 'Hello AI');
    expect(memory.currentSessionId).toBeTruthy();
    expect(memory.messageCount).toBe(1);
  });

  it('getContextForAI returns formatted string', async () => {
    await memory.startSession('AI context test');
    await memory.addMessage('user', 'What pattern is forming on ETH?');
    await memory.addMessage('assistant', 'ETH is forming a descending wedge pattern.');

    const context = await memory.getContextForAI();
    expect(context).toContain('Recent Conversation');
    expect(context).toContain('User:');
    expect(context).toContain('AI:');
  });

  it('extractSessionInsights finds actionable advice', async () => {
    await memory.startSession('Insights test');
    await memory.addMessage('assistant', 'You should consider reducing your position size during high volatility periods.');
    await memory.addMessage('assistant', 'Your biggest weakness is letting winners turn into losers by not trailing stops.');

    const session = await memory.getCurrentSession();
    const insights = memory._extractSessionInsights(session);
    expect(insights.length).toBeGreaterThan(0);
  });

  it('currentSessionId returns null when no session', () => {
    expect(memory.currentSessionId).toBeNull();
  });
});
