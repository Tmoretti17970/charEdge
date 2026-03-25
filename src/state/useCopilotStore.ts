// ═══════════════════════════════════════════════════════════════════
// charEdge — Copilot Chat Store (Phase 3: Task #33 — Fully Typed)
//
// Zustand store for the conversational AI copilot.
// Manages message history, streaming state, context injection,
// and persistent conversation memory via IndexedDB.
//
// Sprint 6: PromptAssembler for DNA-enriched prompts.
// Sprint 7: Trade journal context injection — detects trade-related
// queries, fetches RAG context from JournalRAG, injects recent
// trades, and auto-indexes the journal in the background.
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';

const MAX_MESSAGES = 100;

// ─── Types ──────────────────────────────────────────────────────

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tier?: 'L1' | 'L3' | 'brief' | 'insight' | string;
  journalContext?: boolean;
}

export interface CopilotContext {
  symbol: string | null;
  timeframe: string | null;
  lastPrice: number | null;
  indicators: Record<string, unknown>;
}

export interface CopilotChatState {
  // ── State ──────────────────────────────────────────────
  messages: CopilotMessage[];
  isStreaming: boolean;
  streamingText: string;
  panelOpen: boolean;
  error: string | null;
  historyLoaded: boolean;
  dnaLoaded: boolean;
  journalIndexed: boolean;
  lastResponseTier: string | null;
  modelPromptShown: boolean;
  modelDownloading: boolean;
  modelProgress: number;
  modelProgressText: string;
  pendingMessage: string | null;
  insightsEnabled: boolean;
  upgradeSuggested: boolean;
  _abortController: AbortController | null;
  context: CopilotContext;

  // ── Actions ────────────────────────────────────────────
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  updateContext: (ctx: Partial<CopilotContext>) => void;
  clearMessages: () => void;
  downloadModel: () => Promise<void>;
  dismissModelPrompt: () => void;
  stopGeneration: () => void;
  addSystemMessage: (content: string) => void;
  retryLast: () => void;
  analyzeChartPattern: (pattern: string) => void;
  toggleInsights: () => void;
  recordFeedback: (msgId: string, direction: 'positive' | 'negative') => void;
  loadHistory: () => Promise<void>;
  newConversation: () => Promise<void>;
  clearAllHistory: () => Promise<void>;
  indexJournal: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
}

// ─── Sprint 7: Trade Query Intent Detection ─────────────────────

/** Keywords/patterns that indicate the user is asking about their trades. */
const TRADE_PATTERNS = [
  /\bmy\s+trade/i,
  /\bbest\s+trade/i,
  /\bworst\s+trade/i,
  /\blast\s+trade/i,
  /\brecent\s+trade/i,
  /\bfirst\s+trade/i,
  /\btrades?\s+(this|last|on|from|in)\b/i,
  /\bwin\s*rate/i,
  /\blose?\s*rate/i,
  /\bstrike\s*rate/i,
  /\btrading\s+(history|record|log|stats|performance)/i,
  /\bjournal/i,
  /\blogbook/i,
  /\bhow\s+(did|am|was)\s+i\s+(do|doing|trade|trading)/i,
  /\bwhat\s+did\s+i\s+(do|trade)/i,
  /\bshow\s+me\s+my/i,
  /\breview\s+(my|the|this|last)/i,
  /\bmy\s+(p\s*[&/]\s*l|pnl|profit|loss|performance|results|streak|history)/i,
  /\b(this|last)\s+(week|month|day|session)/i,
  /\b(average|avg)\s+(hold|trade|win|loss)/i,
  /\bovertrading/i,
  /\brevenge\s+trad/i,
  /\bsetup\s+(type|pattern|quality)/i,
  /\bmy\s+(eth|btc|sol|bnb|xrp|ada|doge|dot|avax|matic)\b/i,
  /\b(eth|btc|sol)\s+trades?\b/i,
  /🏆\s*best\s+trade/i, // Preset chip pattern
];

/**
 * Detect whether a user message is asking about their trade history.
 * Exported for testing.
 */
export function isTradeQuery(text: string): boolean {
  return TRADE_PATTERNS.some((p) => p.test(text));
}

/**
 * Format recent trades into a concise context string for the LLM.
 * Exported for testing.
 */
export function formatRecentTrades(trades: Array<Record<string, unknown>> | null | undefined, limit = 10): string {
  if (!trades || trades.length === 0) return '';

  // Filter to closed trades (have pnl), sort newest first
  const closed = trades
    .filter((t) => typeof t.pnl === 'number' && !isNaN(t.pnl as number))
    .sort((a, b) => {
      const dateA = new Date((a.exitDate || a.entryDate || a.date || 0) as string).getTime();
      const dateB = new Date((b.exitDate || b.entryDate || b.date || 0) as string).getTime();
      return dateB - dateA;
    })
    .slice(0, limit);

  if (closed.length === 0) return '';

  const lines = closed.map((t, i) => {
    const sideStr = String(t.side || '');
    const side = sideStr.charAt(0).toUpperCase() + sideStr.slice(1).toLowerCase();
    const symbol = String(t.symbol || 'Unknown').toUpperCase();
    const pnlNum = t.pnl as number;
    const pnl = pnlNum >= 0 ? `+$${pnlNum.toFixed(2)}` : `-$${Math.abs(pnlNum).toFixed(2)}`;
    const date = (t.exitDate || t.entryDate || t.date) as string | undefined;
    const dateStr = date ? new Date(date).toLocaleDateString() : '';
    const setup = (t.setup || t.setupType || t.strategy || '') as string;
    return `${i + 1}. ${side} ${symbol} ${setup ? `(${setup}) ` : ''}${pnl}${dateStr ? ` — ${dateStr}` : ''}`;
  });

  return `--- Recent Trades (${closed.length}) ---\n${lines.join('\n')}`;
}

// ─── Store ──────────────────────────────────────────────────────

const useCopilotChat = create<CopilotChatState>((set, get) => ({
  // ─── State ──────────────────────────────────────────────
  messages: [],
  isStreaming: false,
  streamingText: '',
  panelOpen: false,
  error: null,
  historyLoaded: false,
  dnaLoaded: false,
  journalIndexed: false,
  lastResponseTier: null,
  modelPromptShown: false,
  modelDownloading: false,
  modelProgress: 0,
  modelProgressText: '',
  pendingMessage: null,
  insightsEnabled: true,
  upgradeSuggested: false,
  _abortController: null,

  // ─── Context (auto-injected from chart state) ──────────
  context: {
    symbol: null,
    timeframe: null,
    lastPrice: null,
    indicators: {},
  },

  // ─── Actions ────────────────────────────────────────────

  togglePanel() {
    set((s) => ({ panelOpen: !s.panelOpen }));
  },

  openPanel() {
    set({ panelOpen: true });
  },

  closePanel() {
    set({ panelOpen: false, modelPromptShown: false });
  },

  updateContext(ctx: Partial<CopilotContext>) {
    set((s) => ({ context: { ...s.context, ...ctx } }));
  },

  clearMessages() {
    set({ messages: [], streamingText: '', error: null, modelPromptShown: false, pendingMessage: null });
  },

  // ── Sprint 26: Model Auto-Load ─────────────────────────

  async downloadModel() {
    set({ modelDownloading: true, modelProgress: 0, modelProgressText: 'Initializing...' });

    try {
      const { webLLMProvider } = await import('@/ai/WebLLMProvider');

      const unsub = webLLMProvider.onStatusChange((status) => {
        set({
          modelProgress: status.progress,
          modelProgressText: status.progressText,
        });
      });

      await webLLMProvider.loadModel();
      unsub();

      set({ modelDownloading: false, modelProgress: 100, modelProgressText: 'Ready' });

      // Auto-retry pending message
      const pending = get().pendingMessage;
      if (pending) {
        set({ pendingMessage: null, modelPromptShown: false });
        setTimeout(() => {
          get().sendMessage(pending);
        }, 300);
      }
    } catch (err) {
      set({
        modelDownloading: false,
        modelProgressText: `Failed: ${(err as Error)?.message || 'Unknown error'}`,
        error: 'Model download failed. You can try again or continue with template responses.',
      });
    }
  },

  dismissModelPrompt() {
    const pending = get().pendingMessage;
    set({ modelPromptShown: false, pendingMessage: null });

    if (pending) {
      get().sendMessage(pending);
    }
  },

  // ── Sprint 28: Stop Generation ─────────────────────────

  stopGeneration() {
    const state = get();
    const controller = state._abortController;
    if (controller) controller.abort();

    const partial = state.streamingText;
    if (partial) {
      const aiMsg: CopilotMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: partial + '\n\n*[Generation stopped]*',
        timestamp: Date.now(),
        tier: 'L3',
      };
      set((s) => ({
        messages: [...s.messages, aiMsg].slice(-MAX_MESSAGES),
        isStreaming: false,
        streamingText: '',
        _abortController: null,
      }));
    } else {
      set({ isStreaming: false, streamingText: '', _abortController: null });
    }
  },

  addSystemMessage(content: string) {
    const msg: CopilotMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      tier: 'L1',
    };
    set((s) => ({
      messages: [...s.messages, msg].slice(-MAX_MESSAGES),
    }));
  },

  retryLast() {
    const { messages } = get();
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      set({ error: null });
      get().sendMessage(lastUser.content);
    }
  },

  // ─── Sprint 32: Chart Pattern Analysis ──────────────────

  analyzeChartPattern(pattern: string) {
    get().sendMessage(`Analyze this ${pattern} pattern`);
  },

  // ─── Sprint 33: Insights Toggle ────────────────────────

  toggleInsights() {
    set({ insightsEnabled: !get().insightsEnabled });
  },

  // ─── Sprint 48: Conversation Feedback ──────────────────

  recordFeedback(msgId: string, direction: 'positive' | 'negative') {
    const state = get();
    const msg = state.messages.find((m) => m.id === msgId);
    if (!msg) return;

    const idx = state.messages.indexOf(msg);
    const userMsg = state.messages
      .slice(0, idx)
      .reverse()
      .find((m) => m.role === 'user');

    import('@/ai/ConversationLearning')
      .then(({ conversationLearning }) => {
        conversationLearning.recordInteraction(
          userMsg?.content || '',
          msg.content,
          'copilot',
          direction === 'positive' ? 'high' : 'low',
        );
      })
      .catch(() => {});
  },

  // ─── Sprint 3: Conversation Memory ────────────────────

  async loadHistory() {
    if (get().historyLoaded) return;
    try {
      const { conversationMemory } = await import('@/ai/ConversationMemory');
      const session = await conversationMemory.getCurrentSession();

      if (session && session.messages.length > 0) {
        const restored: CopilotMessage[] = session.messages.map((m: Record<string, unknown>, i: number) => ({
          id: `restored-${i}-${m.timestamp}`,
          role: m.role as CopilotMessage['role'],
          content: m.content as string,
          timestamp: m.timestamp as number,
          tier:
            ((m.metadata as Record<string, unknown>)?.tier as string) || (m.role === 'assistant' ? 'L3' : undefined),
          journalContext: ((m.metadata as Record<string, unknown>)?.journalContext as boolean) || false,
        }));
        set({ messages: restored, historyLoaded: true });
      } else {
        set({ historyLoaded: true });
      }
    } catch {
      set({ historyLoaded: true });
    }

    // Sprint 30: Preload preferred model in background
    import('@/ai/WebLLMProvider')
      .then(({ webLLMProvider }) => {
        webLLMProvider.preloadIfOptedIn();
      })
      .catch(() => {});

    // Sprint 33: Subscribe to proactive insights
    import('@/ai/ProactiveInsightManager')
      .then(({ proactiveInsightManager }) => {
        proactiveInsightManager.onInsight((insight: { message: string }) => {
          const state = get();
          if (!state.insightsEnabled) return;
          state.addSystemMessage(`💡 ${insight.message}`);
        });
      })
      .catch(() => {});

    // Sprint 34: Morning brief on first app open each day
    const briefKey = `charEdge-brief-${new Date().toDateString()}`;
    if (!localStorage.getItem(briefKey)) {
      import('@/ai/AIBriefService')
        .then(async ({ aiBriefService }) => {
          try {
            const brief = await aiBriefService.generate();
            const briefContent = brief.marketOverview
              ? `☀️ **Good Morning**\n\n${brief.marketOverview}${brief.focusTrades ? `\n\n**Focus:** ${brief.focusTrades}` : ''}${brief.riskNotes ? `\n\n⚠️ ${brief.riskNotes}` : ''}`
              : brief.raw || 'Morning brief unavailable.';
            const state = get();
            const briefMsg: CopilotMessage = {
              id: `brief-${Date.now()}`,
              role: 'assistant',
              content: briefContent,
              timestamp: Date.now(),
              tier: 'brief',
            };
            set({ messages: [briefMsg, ...state.messages] });
            localStorage.setItem(briefKey, 'true');
          } catch {
            /* non-critical */
          }
        })
        .catch(() => {});
    }
  },

  async newConversation() {
    set({ messages: [], streamingText: '', error: null });
    try {
      const { conversationMemory } = await import('@/ai/ConversationMemory');
      await conversationMemory.startSession();
    } catch {
      // Non-critical
    }
  },

  async clearAllHistory() {
    set({ messages: [], streamingText: '', error: null, historyLoaded: false });
    try {
      const { conversationMemory } = await import('@/ai/ConversationMemory');
      await conversationMemory.reset();
    } catch {
      // Non-critical
    }
  },

  // ─── Sprint 7: Journal Indexing ────────────────────────

  async indexJournal() {
    if (get().journalIndexed) return;
    set({ journalIndexed: true });

    try {
      const { default: useJournalStore } = await import('@/state/useJournalStore');
      const { journalRAG } = await import('@/ai/JournalRAG');
      const trades = useJournalStore.getState().trades || [];

      if (trades.length > 0) {
        const count = await journalRAG.indexAllTrades(trades);
        if (count > 0) {
          console.info(`[Copilot] 📓 Indexed ${count} trades into VectorStore`);
        }
      }
    } catch {
      // Non-critical — RAG will just have empty results
    }
  },

  async sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    // ── Sprint 3: Slash Command Interception ──────────────
    if (trimmed.startsWith('/')) {
      const { slashCommandParser } = await import('@/ai/SlashCommandParser');
      const parsed = slashCommandParser.parse(trimmed);

      const cmdMsg: CopilotMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      };
      set((s) => ({
        messages: [...s.messages, cmdMsg].slice(-MAX_MESSAGES),
      }));

      const result = await slashCommandParser.executeCommand(parsed);

      if (result.command === 'clear' && result.data && (result.data as Record<string, unknown>).action === 'clear') {
        get().clearMessages();
        return;
      }
      if (result.command === 'mode' && result.data && (result.data as Record<string, unknown>).mode) {
        try {
          const { conversationModes } = await import('@/ai/ConversationModes');
          conversationModes.setMode((result.data as Record<string, unknown>).mode as string);
        } catch {
          /* non-critical */
        }
      }

      const resultMsg: CopilotMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.output,
        timestamp: Date.now(),
        tier: 'L1',
      };
      set((s) => ({
        messages: [...s.messages, resultMsg].slice(-MAX_MESSAGES),
      }));
      return;
    }

    // ── Regular message flow ─────────────────────────────
    const userMsg: CopilotMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };

    // Sprint 26: Check if model is loaded — show download prompt on first use
    const state = get();
    if (!state.modelPromptShown && !state.modelDownloading) {
      try {
        const { webLLMProvider } = await import('@/ai/WebLLMProvider');
        if (!webLLMProvider.isLoaded && !webLLMProvider.isLoading) {
          set((s) => ({
            messages: [...s.messages, userMsg].slice(-MAX_MESSAGES),
            modelPromptShown: true,
            pendingMessage: trimmed,
          }));
          return;
        }
      } catch {
        // WebLLM not available — continue with L1
      }
    }

    set((s) => ({
      messages: [...s.messages, userMsg].slice(-MAX_MESSAGES),
      isStreaming: true,
      streamingText: '',
      error: null,
    }));

    // Persist user message to IndexedDB (fire-and-forget)
    import('@/ai/ConversationMemory')
      .then(({ conversationMemory }) => {
        conversationMemory.addMessage('user', trimmed).catch(() => {});
      })
      .catch(() => {});

    // Sprint 7: Trigger background journal indexing on first message
    if (!get().journalIndexed) {
      get().indexJournal();
    }

    try {
      const { aiRouter } = await import('@/ai/AIRouter');
      const { promptAssembler } = await import('@/ai/PromptAssembler');
      const { context, messages: history } = get();

      // Sprint 6: Build chart context for PromptAssembler
      const chartContext = context.symbol
        ? {
            symbol: context.symbol,
            timeframe: context.timeframe || '1H',
            price: context.lastPrice || 0,
          }
        : null;

      const conversationHistory = history.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // ── Sprint 7: Trade Journal Context ────────────────
      let ragContext = '';
      let usedJournalContext = false;

      if (isTradeQuery(trimmed)) {
        try {
          const { journalRAG } = await import('@/ai/JournalRAG');
          const ragResult = await journalRAG.getContextForPrompt(trimmed, 5);
          if (ragResult) ragContext = ragResult;
        } catch {
          // RAG not available
        }

        try {
          const { default: useJournalStore } = await import('@/state/useJournalStore');
          const trades = useJournalStore.getState().trades || [];
          const recentCtx = formatRecentTrades(trades, 10);
          if (recentCtx) {
            ragContext = ragContext ? `${ragContext}\n\n${recentCtx}` : recentCtx;
          }
        } catch {
          // Journal store not available
        }

        usedJournalContext = ragContext.length > 0;
      }

      // Sprint 5: Use ConversationModes for dynamic mode selection
      let mode: 'quick' | 'analysis' | 'coaching' | 'journal' = 'analysis';
      let modeMaxTokens = 400;
      let modeTemperature = 0.5;
      try {
        const { conversationModes } = await import('@/ai/ConversationModes');
        mode = conversationModes.getMode();
        const constraints = conversationModes.getResponseConstraints(mode);
        modeMaxTokens = constraints.maxTokens;
        modeTemperature = constraints.temperature;
      } catch {
        /* fallback defaults */
      }

      if (usedJournalContext) mode = 'journal';

      const aiMessages = promptAssembler.assembleForChat(trimmed, {
        mode,
        chartContext,
        ragContext: ragContext || undefined,
        conversationHistory,
      });

      if (!get().dnaLoaded && promptAssembler.hasDNA()) {
        set({ dnaLoaded: true });
      }

      // Try streaming first
      let fullText = '';
      const abortController = new AbortController();
      set({ _abortController: abortController });
      try {
        for await (const token of aiRouter.stream({
          type: 'chat',
          messages: aiMessages,
          maxTokens: modeMaxTokens,
          temperature: modeTemperature,
          signal: abortController.signal,
        })) {
          if (abortController.signal.aborted) break;
          fullText += token;
          set({ streamingText: fullText });
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_streamErr: unknown) {
        if (abortController.signal.aborted) {
          return;
        }
        const result = await aiRouter.route({
          type: 'chat',
          messages: aiMessages,
          maxTokens: modeMaxTokens,
          temperature: modeTemperature,
          signal: abortController.signal,
        });
        fullText = result.content;
      }

      const aiMsg: CopilotMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fullText,
        timestamp: Date.now(),
        tier: 'L3',
        journalContext: usedJournalContext,
      };

      set((s) => ({
        messages: [...s.messages, aiMsg].slice(-MAX_MESSAGES),
        isStreaming: false,
        streamingText: '',
        lastResponseTier: 'L3',
      }));

      // Sprint 27: Track response quality and maybe suggest upgrade
      try {
        const { modelQualityTracker } = await import('@/ai/ModelQualityTracker');
        const latencyMs = Date.now() - (userMsg.timestamp || Date.now());
        modelQualityTracker.recordInteraction(fullText, latencyMs, 'small');

        if (!get().upgradeSuggested && modelQualityTracker.shouldSuggestUpgrade()) {
          const summary = modelQualityTracker.getSummary();
          const upgradeMsg: CopilotMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `💡 **Model Upgrade Suggested**\n\n${summary.upgradeReason}\n\nUpgrade in **Settings → Intelligence** to unlock richer analysis, coaching, and trade reviews.`,
            timestamp: Date.now(),
            tier: 'L1',
          };
          set((s) => ({
            messages: [...s.messages, upgradeMsg].slice(-MAX_MESSAGES),
            upgradeSuggested: true,
          }));
        }
      } catch {
        /* non-critical */
      }

      // Persist assistant message to IndexedDB (fire-and-forget)
      import('@/ai/ConversationMemory')
        .then(({ conversationMemory }) => {
          conversationMemory
            .addMessage('assistant', fullText, {
              tier: 'L3',
              journalContext: usedJournalContext,
            })
            .catch(() => {});
        })
        .catch(() => {});
    } catch (err) {
      set({
        isStreaming: false,
        streamingText: '',
        error: (err as Error)?.message || 'AI response failed',
      });
    }
  },
}));

export { useCopilotChat };
export default useCopilotChat;
