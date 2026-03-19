// ═══════════════════════════════════════════════════════════════════
// charEdge — Streaming Chat Engine (AI Copilot Sprint 13)
//
// Core chat logic — framework-agnostic, no React dependency.
// Handles message routing, streaming, history, and search.
//
// Usage:
//   import { streamingChat } from './StreamingChatEngine';
//   await streamingChat.sendMessage('What do you see?', 'analysis', ctx);
// ═══════════════════════════════════════════════════════════════════

import { promptAssembler } from './PromptAssembler';
import type { ChartContext, PromptMode } from './PromptAssembler';

// ─── Types ──────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  mode: PromptMode;
  timestamp: number;
  latencyMs?: number;
  model?: string;
  streaming?: boolean;
}

export type OnTokenCallback = (token: string, fullText: string) => void;
export type OnMessageCallback = (message: ChatMessage) => void;

// ─── Engine ─────────────────────────────────────────────────────

export class StreamingChatEngine {
  private _history: ChatMessage[] = [];
  private _listeners = new Set<OnMessageCallback>();
  private _maxHistory = 100;

  /**
   * Send a message and get a response.
   * Uses L1 templates for quick mode, routes to AIRouter for LLM modes.
   */
  async sendMessage(
    text: string,
    mode: PromptMode = 'analysis',
    chartContext?: ChartContext | null,
    onToken?: OnTokenCallback,
  ): Promise<ChatMessage> {
    // Add user message
    const userMsg = this._createMessage('user', text, mode);
    this._addMessage(userMsg);

    const start = performance.now();

    // Quick mode — L1 template response
    if (mode === 'quick') {
      const response = this._quickResponse(text, chartContext);
      const assistantMsg = this._createMessage('assistant', response, mode);
      assistantMsg.latencyMs = Math.round(performance.now() - start);
      assistantMsg.model = 'L1-template';
      this._addMessage(assistantMsg);
      return assistantMsg;
    }

    // LLM modes — assemble prompt and route
    const conversationCtx = this._getRecentHistory(6).map(m => ({
      role: m.role,
      content: m.content,
    }));

    const assembled = promptAssembler.assemble(
      mode,
      chartContext,
      text,
      undefined, // RAG context — injected by slash commands
      conversationCtx,
    );

    // Create streaming placeholder
    const assistantMsg = this._createMessage('assistant', '', mode);
    assistantMsg.streaming = true;
    this._addMessage(assistantMsg);

    try {
      // Try to use AIRouter for LLM response
      const { aiRouter } = await import('./AIRouter');
      const result = await aiRouter.route({
        type: 'chat',
        messages: assembled.messages as any,
        maxTokens: 512,
        temperature: mode === 'coaching' ? 0.5 : 0.3,
        stream: false,
      });

      assistantMsg.content = result.content;
      assistantMsg.model = result.model;
      assistantMsg.latencyMs = Math.round(performance.now() - start);
      assistantMsg.streaming = false;

      if (onToken) onToken(result.content, result.content);
      this._notifyListeners(assistantMsg);
      return assistantMsg;
    } catch {
      // Fallback to template-based response
      const fallback = this._fallbackResponse(text, mode, chartContext);
      assistantMsg.content = fallback;
      assistantMsg.model = 'L1-fallback';
      assistantMsg.latencyMs = Math.round(performance.now() - start);
      assistantMsg.streaming = false;

      if (onToken) onToken(fallback, fallback);
      this._notifyListeners(assistantMsg);
      return assistantMsg;
    }
  }

  /**
   * Get full message history.
   */
  getHistory(): ChatMessage[] {
    return [...this._history];
  }

  /**
   * Search history by text.
   */
  searchHistory(query: string): ChatMessage[] {
    const lower = query.toLowerCase();
    return this._history.filter(m =>
      m.content.toLowerCase().includes(lower)
    );
  }

  /**
   * Clear chat history.
   */
  clearHistory(): void {
    this._history = [];
  }

  /**
   * Subscribe to new messages.
   */
  onMessage(cb: OnMessageCallback): () => void {
    this._listeners.add(cb);
    return () => this._listeners.delete(cb);
  }

  /**
   * Get message count.
   */
  get messageCount(): number {
    return this._history.length;
  }

  // ── Quick (L1) Responses ────────────────────────────────────

  private _quickResponse(text: string, ctx?: ChartContext | null): string {
    const lower = text.toLowerCase();

    if (lower.includes('what do you see') || lower.includes('what\'s happening')) {
      if (ctx) {
        return `${ctx.symbol} on ${ctx.timeframe}: Price at $${ctx.price.toLocaleString()}${ctx.regime ? `, ${ctx.regime}` : ''}${ctx.rsi ? `, RSI ${ctx.rsi.toFixed(0)}` : ''}.`;
      }
      return 'No chart context available. Open a chart to get AI insights.';
    }

    if (lower.includes('should i') || lower.includes('trade this')) {
      if (ctx?.rsi) {
        if (ctx.rsi > 70) return `${ctx.symbol} RSI is ${ctx.rsi.toFixed(0)} — overbought territory. Consider waiting for pullback.`;
        if (ctx.rsi < 30) return `${ctx.symbol} RSI is ${ctx.rsi.toFixed(0)} — oversold territory. Watch for reversal signals.`;
        return `${ctx.symbol} RSI at ${ctx.rsi.toFixed(0)} — neutral zone. Look for confluence with other signals.`;
      }
      return 'Need chart context to assess this setup. Switch to Analysis mode for deeper insight.';
    }

    if (lower.includes('risk')) {
      return ctx?.openPosition
        ? `Open ${ctx.openPosition.side} on ${ctx.symbol}: P&L $${ctx.openPosition.pnl.toFixed(2)}.`
        : 'No open positions detected.';
    }

    return 'Switch to Analysis mode for a detailed response, or try a slash command like `/scan` or `/dna`.';
  }

  private _fallbackResponse(text: string, mode: PromptMode, ctx?: ChartContext | null): string {
    if (mode === 'coaching') {
      return 'I\'d need a loaded LLM model for coaching advice. Try loading a model in settings, or switch to Quick mode for instant insights.';
    }
    if (mode === 'journal') {
      return 'Journal search requires LLM processing. Try `/journal [query]` after loading a model.';
    }
    return this._quickResponse(text, ctx);
  }

  // ── Internal ────────────────────────────────────────────────

  private _createMessage(role: ChatMessage['role'], content: string, mode: PromptMode): ChatMessage {
    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role,
      content,
      mode,
      timestamp: Date.now(),
    };
  }

  private _addMessage(msg: ChatMessage): void {
    this._history.push(msg);
    if (this._history.length > this._maxHistory) {
      this._history = this._history.slice(-this._maxHistory);
    }
    this._notifyListeners(msg);
  }

  private _getRecentHistory(n: number): ChatMessage[] {
    return this._history.slice(-n);
  }

  private _notifyListeners(msg: ChatMessage): void {
    for (const cb of this._listeners) {
      try { cb(msg); } catch { /* ignore */ }
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const streamingChat = new StreamingChatEngine();
export default streamingChat;
