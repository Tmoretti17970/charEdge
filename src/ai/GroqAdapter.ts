// ═══════════════════════════════════════════════════════════════════
// charEdge — Groq Free Tier Adapter (Sprint 68)
//
// Groq Cloud API adapter (OpenAI-compatible format).
// Free tier: 14,400 req/day Llama, 2,000 req/day Whisper.
//
// Usage:
//   import { groqAdapter } from './GroqAdapter';
//   const result = await groqAdapter.chat(messages);
//   const text = await groqAdapter.transcribe(audioBlob);
// ═══════════════════════════════════════════════════════════════════

import { getApiKey } from '../data/providers/ApiKeyStore.js';
import { apiMeter } from '../data/ApiMetering.js';

// ─── Types ───────────────────────────────────────────────────────

interface GroqChatOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

interface GroqChatResult {
  content: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  provider: 'groq';
}

interface GroqTranscribeResult {
  text: string;
  language: string;
  duration: number;
  latencyMs: number;
}

// ─── Constants ──────────────────────────────────────────────────

const BASE_URL = 'https://api.groq.com/openai/v1';
const CHAT_MODEL = 'llama-3.3-70b-versatile';
const WHISPER_MODEL = 'whisper-large-v3-turbo';

const MODELS = {
  llama70b: 'llama-3.3-70b-versatile',
  llama8b: 'llama-3.1-8b-instant',       // Faster, lower quality
  mixtral: 'mixtral-8x7b-32768',          // Good balance
  whisper: 'whisper-large-v3-turbo',       // STT
} as const;

// ─── Adapter ────────────────────────────────────────────────────

class GroqAdapter {
  private _chatModel = CHAT_MODEL;

  /** Check if Groq API key is configured */
  get isAvailable(): boolean {
    return getApiKey('groq').length > 0;
  }

  /** Get current chat model */
  get model(): string {
    return this._chatModel;
  }

  /** Set chat model */
  setModel(model: string): void {
    this._chatModel = model;
  }

  /**
   * Send a chat completion request to Groq.
   * Uses OpenAI-compatible format — minimal conversion needed.
   */
  async chat(
    messages: { role: string; content: string }[],
    opts: GroqChatOptions = {},
  ): Promise<GroqChatResult> {
    const apiKey = getApiKey('groq');
    if (!apiKey) throw new Error('Groq API key not configured');

    const model = opts.model || this._chatModel;
    const start = performance.now();
    apiMeter.record('groq');

    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts.maxTokens || 256,
        temperature: opts.temperature ?? 0.4,
        stream: false,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Groq ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    const latencyMs = Math.round(performance.now() - start);

    return {
      content: data.choices?.[0]?.message?.content || '',
      model,
      tokensUsed:
        (data.usage?.prompt_tokens || 0) +
        (data.usage?.completion_tokens || 0),
      latencyMs,
      provider: 'groq',
    };
  }

  /**
   * Stream chat tokens from Groq.
   */
  async *stream(
    messages: { role: string; content: string }[],
    opts: GroqChatOptions = {},
  ): AsyncGenerator<string, void, undefined> {
    const apiKey = getApiKey('groq');
    if (!apiKey) throw new Error('Groq API key not configured');

    const model = opts.model || this._chatModel;
    apiMeter.record('groq');

    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts.maxTokens || 256,
        temperature: opts.temperature ?? 0.4,
        stream: true,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Groq stream ${res.status}: ${err.slice(0, 200)}`);
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
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            // Skip malformed chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Transcribe audio using Groq Whisper.
   * Accepts audio Blob (webm, wav, mp3, etc).
   */
  async transcribe(
    audioBlob: Blob,
    language = 'en',
  ): Promise<GroqTranscribeResult> {
    const apiKey = getApiKey('groq');
    if (!apiKey) throw new Error('Groq API key not configured');

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', WHISPER_MODEL);
    formData.append('language', language);
    formData.append('response_format', 'verbose_json');

    const start = performance.now();
    apiMeter.record('groq-whisper');

    const res = await fetch(`${BASE_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Groq Whisper ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    const latencyMs = Math.round(performance.now() - start);

    return {
      text: data.text || '',
      language: data.language || language,
      duration: data.duration || 0,
      latencyMs,
    };
  }

  /** Get available models */
  getModels() {
    return MODELS;
  }
}

// ─── Singleton + Exports ────────────────────────────────────────

export const groqAdapter = new GroqAdapter();
export { GroqAdapter };
export default groqAdapter;
