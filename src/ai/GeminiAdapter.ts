// ═══════════════════════════════════════════════════════════════════
// charEdge — Gemini Free Tier Adapter (Sprint 67)
//
// Google Gemini Flash 2.0 REST adapter.
// Free tier: 1,500 req/day, 15 req/min, 1M token context.
//
// Usage:
//   import { geminiAdapter } from './GeminiAdapter';
//   const result = await geminiAdapter.chat(messages, { maxTokens: 200 });
//   for await (const token of geminiAdapter.stream(messages)) { ... }
// ═══════════════════════════════════════════════════════════════════

import { getApiKey } from '../data/providers/ApiKeyStore.js';
import { apiMeter } from '../data/ApiMetering.js';

// ─── Types ───────────────────────────────────────────────────────

interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface GeminiChatOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
  systemInstruction?: string;
}

interface GeminiChatResult {
  content: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  provider: 'gemini';
}

// ─── Constants ──────────────────────────────────────────────────

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-2.0-flash-lite';
const MODELS = {
  flash: 'gemini-2.0-flash-lite',      // Fast, free, 1M context
  flashFull: 'gemini-2.0-flash',        // Larger, free, 1M context
  pro: 'gemini-1.5-pro',               // Most capable, limited free
} as const;

// ─── Adapter ────────────────────────────────────────────────────

class GeminiAdapter {
  private _model = DEFAULT_MODEL;

  /** Check if Gemini API key is configured */
  get isAvailable(): boolean {
    return getApiKey('gemini').length > 0;
  }

  /** Get the currently selected model */
  get model(): string {
    return this._model;
  }

  /** Set the model to use */
  setModel(model: string): void {
    this._model = model;
  }

  /**
   * Convert charEdge message format → Gemini format.
   * Gemini uses 'model' instead of 'assistant' and 'parts' arrays.
   */
  private _convertMessages(
    messages: { role: string; content: string }[],
  ): { systemInstruction: string | null; contents: GeminiMessage[] } {
    let systemInstruction: string | null = null;
    const contents: GeminiMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = msg.content;
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    // Gemini requires alternating user/model turns — ensure first is user
    if (contents.length > 0 && contents[0].role !== 'user') {
      contents.unshift({ role: 'user', parts: [{ text: '.' }] });
    }

    return { systemInstruction, contents };
  }

  /**
   * Send a chat request to Gemini.
   */
  async chat(
    messages: { role: string; content: string }[],
    opts: GeminiChatOptions = {},
  ): Promise<GeminiChatResult> {
    const apiKey = getApiKey('gemini');
    if (!apiKey) throw new Error('Gemini API key not configured');

    const model = opts.model || this._model;
    const { systemInstruction, contents } = this._convertMessages(messages);

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: opts.maxTokens || 256,
        temperature: opts.temperature ?? 0.4,
      },
    };

    if (systemInstruction || opts.systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: opts.systemInstruction || systemInstruction }],
      };
    }

    const start = performance.now();
    apiMeter.record('gemini');

    const res = await fetch(
      `${BASE_URL}/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    const latencyMs = Math.round(performance.now() - start);

    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const tokensUsed =
      (data.usageMetadata?.promptTokenCount || 0) +
      (data.usageMetadata?.candidatesTokenCount || 0);

    return {
      content: text,
      model,
      tokensUsed,
      latencyMs,
      provider: 'gemini',
    };
  }

  /**
   * Stream tokens from Gemini using server-sent events.
   */
  async *stream(
    messages: { role: string; content: string }[],
    opts: GeminiChatOptions = {},
  ): AsyncGenerator<string, void, undefined> {
    const apiKey = getApiKey('gemini');
    if (!apiKey) throw new Error('Gemini API key not configured');

    const model = opts.model || this._model;
    const { systemInstruction, contents } = this._convertMessages(messages);

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: opts.maxTokens || 256,
        temperature: opts.temperature ?? 0.4,
      },
    };

    if (systemInstruction || opts.systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: opts.systemInstruction || systemInstruction }],
      };
    }

    apiMeter.record('gemini');

    const res = await fetch(
      `${BASE_URL}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Gemini stream ${res.status}: ${err.slice(0, 200)}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (!json || json === '[DONE]') continue;

          try {
            const chunk = JSON.parse(json);
            const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) yield text;
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /** Get available models */
  getModels() {
    return MODELS;
  }
}

// ─── Singleton + Exports ────────────────────────────────────────

export const geminiAdapter = new GeminiAdapter();
export { GeminiAdapter };
export default geminiAdapter;
