// ═══════════════════════════════════════════════════════════════════
// charEdge — Webhook Service (Phase 5)
//
// Implements the WebhookEmitter interface defined in routes.ts.
// Delivers event notifications to user-configured webhook URLs
// with retry logic, signature verification, and rate limiting.
//
// Supports: trade events, alert triggers, snapshot creation.
// Compatible with Discord, Slack, Telegram, and generic HTTP.
// ═══════════════════════════════════════════════════════════════════

import { createHmac } from 'node:crypto';
import { logger } from '../../observability/logger.js';

// ─── Types ──────────────────────────────────────────────────────

export interface WebhookSubscription {
  id: string;
  userId: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: string;
  failCount: number;
  lastDelivery: string | null;
}

interface DeliveryResult {
  ok: boolean;
  statusCode?: number;
  error?: string;
  durationMs: number;
}

// ─── Configuration ──────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s
const DELIVERY_TIMEOUT_MS = 10_000;
const MAX_FAIL_COUNT = 10; // Disable webhook after 10 consecutive failures
const MAX_HOOKS_PER_USER = 5;

// ─── In-Memory Store (upgrade to SQLite for production) ─────────

const subscriptions = new Map<string, WebhookSubscription>();

// ─── Service ────────────────────────────────────────────────────

export class WebhookEmitterService {
  /**
   * Subscribe to webhook events.
   */
  subscribe(userId: string, url: string, events: string[]): WebhookSubscription {
    // Enforce per-user limit
    const userHooks = this.getSubscriptions(userId);
    if (userHooks.length >= MAX_HOOKS_PER_USER) {
      throw new Error(`Maximum ${MAX_HOOKS_PER_USER} webhooks per user`);
    }

    const id = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const secret = createHmac('sha256', `${id}-${Date.now()}`).update(userId).digest('hex').slice(0, 32);

    const hook: WebhookSubscription = {
      id,
      userId,
      url,
      events,
      secret,
      active: true,
      createdAt: new Date().toISOString(),
      failCount: 0,
      lastDelivery: null,
    };

    subscriptions.set(id, hook);
    logger.data.info(`[Webhook] Created ${id} for user ${userId}: ${events.join(', ')}`);
    return hook;
  }

  /**
   * Unsubscribe a webhook.
   */
  unsubscribe(userId: string, hookId: string): boolean {
    const hook = subscriptions.get(hookId);
    if (!hook || hook.userId !== userId) return false;
    subscriptions.delete(hookId);
    return true;
  }

  /**
   * Get all subscriptions for a user.
   */
  getSubscriptions(userId: string): WebhookSubscription[] {
    const results: WebhookSubscription[] = [];
    for (const hook of subscriptions.values()) {
      if (hook.userId === userId) {
        results.push({ ...hook, secret: hook.secret.slice(0, 8) + '...' });
      }
    }
    return results;
  }

  /**
   * Emit an event to all matching subscribers.
   */
  async emit(event: string, userId: string, data: unknown): Promise<void> {
    const matching: WebhookSubscription[] = [];
    for (const hook of subscriptions.values()) {
      if (hook.active && hook.userId === userId && hook.events.includes(event)) {
        matching.push(hook);
      }
    }

    if (matching.length === 0) return;

    // Fire-and-forget delivery (don't block the API response)
    for (const hook of matching) {
      this.deliver(hook, event, data).catch((err) => {
        logger.data.warn(`[Webhook] Delivery failed for ${hook.id}:`, err.message);
      });
    }
  }

  /**
   * Deliver a webhook with retry logic.
   */
  async deliver(hook: WebhookSubscription, event: string, data: unknown): Promise<DeliveryResult> {
    const payload = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data,
    });

    // Generate HMAC signature for verification
    const signature = createHmac('sha256', hook.secret).update(payload).digest('hex');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': event,
      'X-Webhook-Signature': `sha256=${signature}`,
      'X-Webhook-ID': hook.id,
      'User-Agent': 'charEdge-Webhook/1.0',
    };

    // Detect platform-specific formatting
    const isDiscord = hook.url.includes('discord.com/api/webhooks');
    const isSlack = hook.url.includes('hooks.slack.com');

    let body = payload;
    if (isDiscord) {
      body = JSON.stringify({
        content: null,
        embeds: [
          {
            title: `charEdge: ${event}`,
            description: typeof data === 'object' ? JSON.stringify(data, null, 2).slice(0, 2000) : String(data),
            color: event.includes('created') ? 0x26a69a : event.includes('deleted') ? 0xef5350 : 0x2962ff,
            timestamp: new Date().toISOString(),
            footer: { text: 'charEdge Webhook' },
          },
        ],
      });
    } else if (isSlack) {
      body = JSON.stringify({
        text: `*charEdge: ${event}*\n\`\`\`${JSON.stringify(data, null, 2).slice(0, 2000)}\`\`\``,
      });
    }

    // Retry loop
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

        const response = await fetch(hook.url, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        const durationMs = Date.now() - start;

        if (response.ok) {
          // Success — reset fail count
          hook.failCount = 0;
          hook.lastDelivery = new Date().toISOString();
          return { ok: true, statusCode: response.status, durationMs };
        }

        // Non-retryable status codes
        if (response.status === 401 || response.status === 403 || response.status === 404) {
          hook.failCount++;
          if (hook.failCount >= MAX_FAIL_COUNT) {
            hook.active = false;
            logger.data.warn(`[Webhook] ${hook.id} disabled after ${MAX_FAIL_COUNT} failures`);
          }
          return { ok: false, statusCode: response.status, error: `HTTP ${response.status}`, durationMs };
        }

        // Retryable error — wait and try again
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt] || 5000));
        }
      } catch (err) {
        const durationMs = Date.now() - start;
        if (attempt >= MAX_RETRIES) {
          hook.failCount++;
          if (hook.failCount >= MAX_FAIL_COUNT) {
            hook.active = false;
            logger.data.warn(`[Webhook] ${hook.id} disabled after ${MAX_FAIL_COUNT} failures`);
          }
          return { ok: false, error: (err as Error).message, durationMs };
        }
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt] || 5000));
      }
    }

    return { ok: false, error: 'Max retries exceeded', durationMs: 0 };
  }
}

// Singleton
export const webhookEmitter = new WebhookEmitterService();
export default webhookEmitter;
