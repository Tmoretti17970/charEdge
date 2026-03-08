/* eslint-env node */
/* global fetch, AbortSignal */
// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — LLM Proxy Route (Task 1A.1)
//
// Server-side proxy for LLM API calls. Keeps OpenAI/Anthropic API
// keys on the server — the client never sees them.
//
// POST /api/proxy/llm
//   Body: { provider, messages, model?, maxTokens?, temperature? }
//   Returns: upstream LLM response JSON
// ═══════════════════════════════════════════════════════════════════

import { Router } from 'express';

/**
 * Creates the LLM proxy router.
 * Reads OPENAI_API_KEY / ANTHROPIC_API_KEY from process.env (no VITE_ prefix).
 * @returns {import('express').Router}
 */
export function createLlmRouter() {
    const router = Router();

    router.post('/api/proxy/llm', async (req, res) => {
        const { provider, messages, model, maxTokens = 1024, temperature = 0.3 } = req.body || {};

        if (!provider || !messages || !Array.isArray(messages)) {
            return res.status(400).json({ ok: false, error: 'Missing provider or messages' });
        }

        try {
            if (provider === 'openai') {
                const apiKey = process.env.OPENAI_API_KEY;
                if (!apiKey) {
                    return res.status(503).json({ ok: false, error: 'OpenAI API key not configured on server' });
                }

                const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model: model || 'gpt-4o-mini',
                        messages,
                        max_tokens: maxTokens,
                        temperature,
                    }),
                    signal: AbortSignal.timeout(30_000),
                });

                if (!upstream.ok) {
                    const text = await upstream.text();
                    return res.status(upstream.status).json({ ok: false, error: `OpenAI ${upstream.status}: ${text}` });
                }

                return res.json(await upstream.json());

            } else if (provider === 'anthropic') {
                const apiKey = process.env.ANTHROPIC_API_KEY;
                if (!apiKey) {
                    return res.status(503).json({ ok: false, error: 'Anthropic API key not configured on server' });
                }

                // Extract system message for Anthropic's API format
                const systemMsg = messages.find(m => m.role === 'system')?.content || '';
                const userMessages = messages.filter(m => m.role !== 'system');

                const upstream = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                    },
                    body: JSON.stringify({
                        model: model || 'claude-3-haiku-20240307',
                        system: systemMsg,
                        messages: userMessages,
                        max_tokens: maxTokens,
                        temperature,
                    }),
                    signal: AbortSignal.timeout(30_000),
                });

                if (!upstream.ok) {
                    const text = await upstream.text();
                    return res.status(upstream.status).json({ ok: false, error: `Anthropic ${upstream.status}: ${text}` });
                }

                return res.json(await upstream.json());

            } else {
                return res.status(400).json({ ok: false, error: `Unsupported LLM provider: ${provider}` });
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return res.status(200).json({ ok: false, error: `LLM proxy error: ${msg}` });
        }
    });

    return router;
}
