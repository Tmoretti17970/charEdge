// ═══════════════════════════════════════════════════════════════════
// charEdge — Phase 3 Tests (AI Copilot Sprints 11–20)
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Provide localStorage shim for test env
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
}

// ─── Sprint 11: ModelSettings ───────────────────────────────────

import { ModelSettings } from '../ai/ModelSettings';

describe('ModelSettings', () => {
  let ms: ModelSettings;

  beforeEach(() => {
    localStorage.clear();
    ms = new ModelSettings();
  });

  it('defaults to small model', () => {
    expect(ms.getPreferredTier()).toBe('small');
  });

  it('persists preferred model', () => {
    ms.setPreferredModel('large');
    expect(ms.getPreferredTier()).toBe('large');
  });

  it('records inferences', () => {
    ms.recordInference(100);
    ms.recordInference(200);
    expect(ms.preferences.totalInferences).toBe(2);
    expect(ms.preferences.totalTokensGenerated).toBe(300);
  });

  it('suggests upgrade after 10 inferences on small model', () => {
    for (let i = 0; i < 10; i++) ms.recordInference(50);
    expect(ms.shouldSuggestUpgrade()).toBe(true);
  });

  it('does not suggest upgrade on large model', () => {
    ms.setPreferredModel('large');
    for (let i = 0; i < 10; i++) ms.recordInference(50);
    expect(ms.shouldSuggestUpgrade()).toBe(false);
  });

  it('reset clears all data', () => {
    ms.recordInference(100);
    ms.reset();
    expect(ms.preferences.totalInferences).toBe(0);
  });
});

// ─── Sprint 11: WebLLMProvider Catalog ──────────────────────────

import { MODEL_CATALOG } from '../ai/WebLLMProvider';

describe('WebLLMProvider - Model Catalog', () => {
  it('has 3 model tiers', () => {
    expect(Object.keys(MODEL_CATALOG)).toHaveLength(3);
  });

  it('includes Qwen2.5 as large tier', () => {
    expect(MODEL_CATALOG.large.id).toContain('Qwen2.5');
    expect(MODEL_CATALOG.large.contextWindow).toBe(4096);
  });

  it('all models have required fields', () => {
    for (const model of Object.values(MODEL_CATALOG)) {
      expect(model.id).toBeTruthy();
      expect(model.label).toBeTruthy();
      expect(model.sizeBytes).toBeGreaterThan(0);
      expect(model.contextWindow).toBeGreaterThan(0);
    }
  });
});

// ─── Sprint 12: PromptAssembler ─────────────────────────────────

import { PromptAssembler } from '../ai/PromptAssembler';

describe('PromptAssembler', () => {
  const pa = new PromptAssembler();
  const chartCtx = { symbol: 'BTC', timeframe: '1H', price: 64200, regime: 'Uptrend', rsi: 72 };

  it('assembles prompt with all sections', () => {
    const result = pa.assemble('analysis', chartCtx, 'What do you see?');
    expect(result.sections).toContain('mode_template');
    expect(result.sections).toContain('chart_context');
    expect(result.sections).toContain('user_query');
    expect(result.messages.length).toBeGreaterThanOrEqual(2);
  });

  it('quick mode uses minimal budget', () => {
    const budget = pa.getTokenBudget(2048, 'quick');
    expect(budget.rag).toBe(0);
  });

  it('journal mode allocates most to RAG', () => {
    const budget = pa.getTokenBudget(4096, 'journal');
    expect(budget.rag).toBeGreaterThan(budget.chart);
  });

  it('includes chart context in system prompt', () => {
    const result = pa.assemble('analysis', chartCtx, 'test');
    const system = result.messages[0].content;
    expect(system).toContain('BTC');
    expect(system).toContain('64,200');
  });

  it('handles no chart context', () => {
    const result = pa.assemble('quick', null, 'hello');
    expect(result.sections).not.toContain('chart_context');
  });
});

// ─── Sprint 13: StreamingChatEngine ─────────────────────────────

import { StreamingChatEngine } from '../ai/StreamingChatEngine';

describe('StreamingChatEngine', () => {
  let chat: StreamingChatEngine;

  beforeEach(() => {
    chat = new StreamingChatEngine();
  });

  it('quick mode returns instant L1 response', async () => {
    const msg = await chat.sendMessage('What do you see?', 'quick', { symbol: 'BTC', timeframe: '1H', price: 50000 });
    expect(msg.role).toBe('assistant');
    expect(msg.content).toContain('BTC');
    expect(msg.model).toBe('L1-template');
  });

  it('keeps message history', async () => {
    await chat.sendMessage('hi', 'quick');
    expect(chat.messageCount).toBe(2); // user + assistant
  });

  it('searches history', async () => {
    await chat.sendMessage('Bitcoin analysis', 'quick');
    const results = chat.searchHistory('Bitcoin');
    expect(results.length).toBeGreaterThan(0);
  });

  it('clears history', async () => {
    await chat.sendMessage('test', 'quick');
    chat.clearHistory();
    expect(chat.messageCount).toBe(0);
  });

  it('subscribes to messages', async () => {
    const received: string[] = [];
    chat.onMessage((m) => received.push(m.content));
    await chat.sendMessage('hello', 'quick');
    expect(received.length).toBeGreaterThan(0);
  });
});

// ─── Sprint 14: ConversationModes ───────────────────────────────

import { ConversationModes } from '../ai/ConversationModes';

describe('ConversationModes', () => {
  let modes: ConversationModes;

  beforeEach(() => {
    localStorage.clear();
    modes = new ConversationModes();
  });

  it('defaults to analysis mode', () => {
    expect(modes.getMode()).toBe('analysis');
  });

  it('switches modes', () => {
    modes.setMode('coaching');
    expect(modes.getMode()).toBe('coaching');
  });

  it('returns config for each mode', () => {
    const config = modes.getModeConfig('quick');
    expect(config.emoji).toBe('🏃');
    expect(config.requiresLLM).toBe(false);
  });

  it('returns all 4 modes', () => {
    expect(modes.getAllModes()).toHaveLength(4);
  });

  it('quick mode does not require LLM', () => {
    expect(modes.requiresLLM('quick')).toBe(false);
    expect(modes.requiresLLM('analysis')).toBe(true);
  });

  it('returns data sources per mode', () => {
    expect(modes.getDataSources('journal')).toContain('journalRAG');
  });
});

// ─── Sprint 15: SlashCommandParser ──────────────────────────────

import { SlashCommandParser } from '../ai/SlashCommandParser';

describe('SlashCommandParser', () => {
  const parser = new SlashCommandParser();

  it('parses valid command', () => {
    const result = parser.parse('/scan');
    expect(result.isCommand).toBe(true);
    expect(result.command).toBe('scan');
  });

  it('parses command with args', () => {
    const result = parser.parse('/journal BTC winning trades');
    expect(result.command).toBe('journal');
    expect(result.args).toEqual(['BTC', 'winning', 'trades']);
  });

  it('resolves aliases', () => {
    const result = parser.parse('/s');
    expect(result.isCommand).toBe(true);
    expect(result.command).toBe('scan');
  });

  it('returns isCommand=false for non-commands', () => {
    expect(parser.parse('hello').isCommand).toBe(false);
    expect(parser.parse('what is bitcoin?').isCommand).toBe(false);
  });

  it('suggests commands for partial input', () => {
    const suggestions = parser.getCommandSuggestions('/sc');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].name).toBe('scan');
  });

  it('help command returns all commands', async () => {
    const parsed = parser.parse('/help');
    const result = await parser.executeCommand(parsed);
    expect(result.success).toBe(true);
    expect(result.output).toContain('Available Commands');
  });

  it('has all 11 commands', () => {
    expect(parser.getCommands()).toHaveLength(11);
  });
});

// ─── Sprint 16: ActionDispatcher ────────────────────────────────

import { CapabilityRegistry, ActionDispatcher } from '../ai/ActionDispatcher';

describe('ActionDispatcher', () => {
  let registry: CapabilityRegistry;
  let dispatcher: ActionDispatcher;

  beforeEach(() => {
    registry = new CapabilityRegistry();
    dispatcher = new ActionDispatcher(registry);
  });

  it('registers and executes capabilities', async () => {
    registry.register('test_action', 'Test', ['param1'], async (p) => `Got ${p.param1}`);
    const result = await dispatcher.dispatch('test_action', { param1: 'hello' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('hello');
  });

  it('fails for unknown actions', async () => {
    const result = await dispatcher.dispatch('unknown');
    expect(result.success).toBe(false);
  });

  it('parses action blocks from text', () => {
    const text = 'I set an alert [ACTION: set_alert | symbol=BTC,price=65000] for you.';
    const actions = dispatcher.parseActionsFromResponse(text);
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe('set_alert');
    expect(actions[0].params.price).toBe(65000);
  });

  it('parses multiple action blocks', () => {
    const text = '[ACTION: set_alert | symbol=BTC,price=65000] and [ACTION: add_journal | content=test]';
    expect(dispatcher.parseActionsFromResponse(text)).toHaveLength(2);
  });

  it('formats capabilities for prompt', () => {
    registry.register('test', 'Do test', ['x'], async () => 'ok');
    expect(registry.getCapabilitiesForPrompt()).toContain('test');
  });
});

// ─── Sprint 17: QuickAskEngine ──────────────────────────────────

import { QuickAskEngine } from '../ai/QuickAskEngine';

describe('QuickAskEngine', () => {
  const engine = new QuickAskEngine();

  it('returns chart quick asks', () => {
    const asks = engine.getQuickAsks('chart');
    expect(asks.length).toBeGreaterThan(0);
    expect(asks[0].emoji).toBeTruthy();
  });

  it('returns dashboard quick asks', () => {
    expect(engine.getQuickAsks('dashboard').length).toBeGreaterThan(0);
  });

  it('finds quick ask by id', () => {
    const ask = engine.getQuickAskById('chart_see');
    expect(ask?.label).toBe('What do you see?');
  });

  it('returns null for unknown id', () => {
    expect(engine.getQuickAskById('nonexistent')).toBeNull();
  });

  it('has 5 view contexts', () => {
    expect(engine.getAvailableContexts()).toHaveLength(5);
  });
});

// ─── Sprint 18: ConversationLearning ────────────────────────────

import { ConversationLearning } from '../ai/ConversationLearning';

describe('ConversationLearning', () => {
  let cl: ConversationLearning;

  beforeEach(() => {
    localStorage.clear();
    cl = new ConversationLearning();
  });

  it('records interactions', () => {
    cl.recordInteraction('What is RSI?', 'RSI measures momentum', 'analysis');
    expect(cl.totalInteractions).toBe(1);
  });

  it('tracks FAQ patterns', () => {
    cl.recordInteraction('What is RSI?', 'answer', 'analysis');
    cl.recordInteraction('What is RSI?', 'answer', 'analysis');
    cl.recordInteraction('What is RSI?', 'answer', 'analysis');
    const top = cl.getTopQuestions(1);
    expect(top[0].frequency).toBe(3);
  });

  it('generates quality report', () => {
    cl.recordInteraction('q1', 'a1', 'analysis', 'high');
    cl.recordInteraction('q2', 'a2', 'analysis', 'low');
    const report = cl.getQualityReport();
    expect(report.totalInteractions).toBe(2);
    expect(report.avgEngagement).toBe(0.5);
  });

  it('identifies templates from frequent questions', () => {
    for (let i = 0; i < 3; i++) {
      cl.recordInteraction('What is RSI?', 'answer', 'analysis', 'high');
    }
    const templates = cl.getImprovedTemplates();
    expect(templates.length).toBeGreaterThan(0);
  });

  it('reset clears all data', () => {
    cl.recordInteraction('test', 'test', 'analysis');
    cl.reset();
    expect(cl.totalInteractions).toBe(0);
  });
});

// ─── Sprint 19: VoiceInput ──────────────────────────────────────

import { VoiceInput } from '../ai/VoiceInput';

describe('VoiceInput', () => {
  it('reports not supported in test env', () => {
    const vi2 = new VoiceInput();
    expect(vi2.isSupported()).toBe(false);
  });

  it('returns error status when starting without support', () => {
    const vi2 = new VoiceInput();
    const started = vi2.startListening(() => {});
    expect(started).toBe(false);
  });

  it('has correct initial status', () => {
    const vi2 = new VoiceInput();
    expect(vi2.status.listening).toBe(false);
    expect(vi2.status.speaking).toBe(false);
  });
});

// ─── Sprint 20: ProactiveInsightManager ─────────────────────────

import { ProactiveInsightManager } from '../ai/ProactiveInsightManager';

describe('ProactiveInsightManager', () => {
  let mgr: ProactiveInsightManager;

  beforeEach(() => {
    mgr = new ProactiveInsightManager();
  });

  it('queues regime shift events', () => {
    const insight = mgr.onChartEvent({
      type: 'regime_change', symbol: 'BTC', data: { newRegime: 'Uptrend' },
    });
    expect(insight).not.toBeNull();
    expect(mgr.getPendingCount()).toBe(1);
  });

  it('filters low-significance volume events', () => {
    const insight = mgr.onChartEvent({
      type: 'volume_anomaly', symbol: 'BTC', data: { zScore: 1.5 },
    });
    expect(insight).toBeNull();
    expect(mgr.getPendingCount()).toBe(0);
  });

  it('accepts high-significance volume events', () => {
    const insight = mgr.onChartEvent({
      type: 'volume_anomaly', symbol: 'BTC', data: { zScore: 4.5 },
    });
    expect(insight).not.toBeNull();
    expect(insight!.priority).toBe('high');
  });

  it('dismisses insights', () => {
    const insight = mgr.onChartEvent({
      type: 'regime_change', symbol: 'BTC', data: { newRegime: 'Downtrend' },
    });
    mgr.dismissInsight(insight!.id);
    expect(mgr.getPendingCount()).toBe(0);
  });

  it('deduplicates same type + symbol within 5 min', () => {
    mgr.onChartEvent({ type: 'regime_change', symbol: 'BTC', data: { newRegime: 'Up' } });
    mgr.onChartEvent({ type: 'regime_change', symbol: 'BTC', data: { newRegime: 'Down' } });
    expect(mgr.getPendingCount()).toBe(1);
  });

  it('respects enabled toggle', () => {
    mgr.setEnabled(false);
    const insight = mgr.onChartEvent({
      type: 'regime_change', symbol: 'BTC', data: {},
    });
    expect(insight).toBeNull();
  });

  it('subscribes to new insights', () => {
    const received: string[] = [];
    mgr.onInsight((i) => received.push(i.title));
    mgr.onChartEvent({ type: 'regime_change', symbol: 'ETH', data: { newRegime: 'Down' } });
    expect(received.length).toBe(1);
  });
});
