// ═══════════════════════════════════════════════════════════════════
// charEdge — PostHog Analytics Backend (Task 3.6.3)
//
// Production backend for the analytics service.
// Sends events to PostHog for feature adoption, funnels, and retention.
//
// Usage:
//   import { posthogBackend } from './posthogBackend.ts';
//   import { analytics } from './analytics.ts';
//   analytics.init(posthogBackend);
//
// Requires: VITE_POSTHOG_KEY and optionally VITE_POSTHOG_HOST env vars.
// Falls back to noop if PostHog is not configured.
// ═══════════════════════════════════════════════════════════════════

import type { AnalyticsBackend, AnalyticsEvent } from './analytics.ts';
// @ts-expect-error — .ts imports resolved by Vite
import { logger } from '@/observability/logger.ts';

// ─── Types ──────────────────────────────────────────────────────

interface PostHogInstance {
    capture(eventName: string, properties?: Record<string, unknown>): void;
    identify(distinctId: string, properties?: Record<string, unknown>): void;
    reset(): void;
    shutdown(): void;
    opt_out_capturing(): void;
    opt_in_capturing(): void;
    register(properties: Record<string, unknown>): void;
}

// ─── Configuration ──────────────────────────────────────────────

const POSTHOG_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_POSTHOG_KEY as string) || '';
const POSTHOG_HOST = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_POSTHOG_HOST as string) || 'https://us.i.posthog.com';

// ─── Lazy Loading ───────────────────────────────────────────────

let _posthog: PostHogInstance | null = null;
let _loading = false;

// eslint-disable-next-line @typescript-eslint/naming-convention
async function _loadPostHog(): Promise<PostHogInstance | null> {
    if (_posthog) return _posthog;
    if (_loading) return null;
    if (!POSTHOG_KEY) {
        logger.ui.info('[PostHog] No VITE_POSTHOG_KEY — analytics disabled');
        return null;
    }

    _loading = true;
    try {
        const { default: posthog } = await import('posthog-js');
        posthog.init(POSTHOG_KEY, {
            api_host: POSTHOG_HOST,
            autocapture: false,            // We use explicit event tracking
            capture_pageview: false,       // SPA — we handle page views manually
            capture_pageleave: true,       // Track bounces
            persistence: 'localStorage',
            loaded: () => {
                logger.ui.info('[PostHog] Initialized');
            },
        });
        _posthog = posthog as unknown as PostHogInstance;
        return _posthog;
    } catch {
        logger.ui.warn('[PostHog] Failed to load posthog-js — analytics disabled');
        return null;
    } finally {
        _loading = false;
    }
}

// ─── Backend Implementation ─────────────────────────────────────

export const posthogBackend: AnalyticsBackend = {
    name: 'posthog',

    track(event: AnalyticsEvent): void {
        // Fire-and-forget async load + track
        _loadPostHog().then(ph => {
            ph?.capture(event.name, {
                ...event.properties,
                _timestamp: event.timestamp,
            });
        }).catch(() => { /* noop */ });
    },

    identify(userId: string, traits?: Record<string, unknown>): void {
        _loadPostHog().then(ph => {
            ph?.identify(userId, traits);
        }).catch(() => { /* noop */ });
    },

    flush(): void {
        // PostHog auto-flushes, but we can trigger shutdown for clean exit
        _posthog?.shutdown();
    },
};

// ─── Opt-in/Opt-out (GDPR) ─────────────────────────────────────

export function optOutAnalytics(): void {
    _posthog?.opt_out_capturing();
}

export function optInAnalytics(): void {
    _posthog?.opt_in_capturing();
}

// ─── Super Properties (session-level) ───────────────────────────

export function registerSuperProperties(properties: Record<string, unknown>): void {
    _posthog?.register(properties);
}

export default posthogBackend;
