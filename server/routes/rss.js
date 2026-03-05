// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — RSS Feed Proxy Route
// Lightweight proxy to fetch RSS feeds that don't support CORS.
// Includes: domain allowlist, SSRF prevention, rate limiting.
// ═══════════════════════════════════════════════════════════════════

import { lookup } from 'node:dns/promises';
import { Router } from 'express';
import { checkRateLimit, RATE_LIMIT_WINDOW_MS } from '../middleware/rateLimiter.js';

const ALLOWED_RSS_DOMAINS = [
    'finance.yahoo.com', 'news.google.com', 'efts.sec.gov',
    'feeds.reuters.com', 'rss.nytimes.com',
];

/**
 * Check if an IP address is in a private/reserved range.
 * Blocks SSRF attacks that try to reach internal services.
 * @param {string} ip
 * @returns {boolean}
 */
function _isPrivateIP(ip) {
    if (
        ip.startsWith('10.') ||
        ip.startsWith('127.') ||
        ip.startsWith('0.') ||
        ip.startsWith('169.254.') ||
        ip.startsWith('192.168.')
    ) return true;
    if (ip.startsWith('172.')) {
        const second = parseInt(ip.split('.')[1], 10);
        if (second >= 16 && second <= 31) return true;
    }
    if (
        ip === '::1' ||
        ip.startsWith('fc') ||
        ip.startsWith('fd') ||
        ip.startsWith('fe80:') ||
        ip === '::'
    ) return true;
    return false;
}

/**
 * Creates RSS proxy router.
 * @returns {import('express').Router}
 */
export function createRssRouter() {
    const router = Router();

    router.get('/api/proxy/rss', async (req, res) => {
        const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
        if (!checkRateLimit(clientIp)) {
            res.setHeader('Retry-After', Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));
            return res.status(429).json({
                error: 'Too many requests. Limit: 30 per minute.',
                retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
            });
        }

        const targetUrl = req.query.url;
        if (!targetUrl) return res.status(400).json({ error: 'Missing url parameter' });

        try {
            const parsed = new URL(targetUrl);

            if (parsed.protocol !== 'https:') {
                return res.status(400).json({ error: 'Only HTTPS URLs are allowed' });
            }
            if (parsed.port && parsed.port !== '443') {
                return res.status(400).json({ error: 'Non-standard ports are not allowed' });
            }
            const decodedPath = decodeURIComponent(parsed.pathname);
            if (decodedPath.includes('..') || parsed.pathname.includes('%2e') || parsed.pathname.includes('%2E')) {
                return res.status(400).json({ error: 'Path traversal not allowed' });
            }
            if (!ALLOWED_RSS_DOMAINS.some(d => parsed.hostname.endsWith(d))) {
                return res.status(403).json({ error: 'Domain not allowed' });
            }

            // SSRF Prevention: resolve hostname and block private/reserved IPs
            try {
                const resolved = await lookup(parsed.hostname);
                if (_isPrivateIP(resolved.address)) {
                    return res.status(403).json({ error: 'Internal addresses are not allowed' });
                }
            } catch {
                return res.status(400).json({ error: 'Unable to resolve hostname' });
            }

            const resp = await fetch(parsed.href, {
                headers: { 'User-Agent': 'charEdge/11.0' },
                signal: AbortSignal.timeout(5000),
                redirect: 'error',
            });
            if (!resp.ok) return res.status(resp.status).json({ error: 'Upstream error' });

            const text = await resp.text();
            res.setHeader('Content-Type', 'application/xml');
            res.setHeader('Cache-Control', 'public, max-age=300');
            res.send(text);
        } catch {
            res.status(500).json({ error: 'RSS proxy error' });
        }
    });

    return router;
}
