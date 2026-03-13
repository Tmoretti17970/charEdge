// ═══════════════════════════════════════════════════════════════════
// charEdge — Webhook Delivery Service (Phase C1)
//
// POSTs alert payloads to user-configured webhook URLs when alerts
// fire. Supports HMAC-SHA256 signing, retries with exponential
// backoff, and configurable timeouts.
// ═══════════════════════════════════════════════════════════════════

import crypto from 'crypto';

// ─── Types ──────────────────────────────────────────────────────

export interface WebhookConfig {
    url: string;
    secret?: string;                     // HMAC-SHA256 signing key
    headers?: Record<string, string>;    // Custom headers
    enabled: boolean;
}

interface WebhookPayload {
    event: 'alert.triggered';
    alert: {
        id: string;
        symbol: string;
        condition: string;
        price: number;
        note?: string;
    };
    triggerPrice: number;
    timestamp: string;
}

// ─── Config ─────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const TIMEOUT_MS = 5000;
const INITIAL_BACKOFF_MS = 500;

// ─── Service ────────────────────────────────────────────────────

export class WebhookDelivery {
    /**
     * Sign a payload with HMAC-SHA256 using the webhook secret.
     */
    private sign(body: string, secret: string): string {
        return crypto
            .createHmac('sha256', secret)
            .update(body)
            .digest('hex');
    }

    /**
     * Send a webhook with retries and exponential backoff.
     */
    async deliver(
        config: WebhookConfig,
        alert: { id: string; symbol: string; condition: string; price: number; note?: string },
        triggerPrice: number,
    ): Promise<boolean> {
        if (!config.enabled || !config.url) return false;

        const payload: WebhookPayload = {
            event: 'alert.triggered',
            alert: {
                id: alert.id,
                symbol: alert.symbol,
                condition: alert.condition,
                price: alert.price,
                note: alert.note,
            },
            triggerPrice,
            timestamp: new Date().toISOString(),
        };

        const body = JSON.stringify(payload);

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'User-Agent': 'charEdge-Webhook/1.0',
            ...(config.headers || {}),
        };

        // HMAC signature
        if (config.secret) {
            headers['X-CharEdge-Signature'] = `sha256=${this.sign(body, config.secret)}`;
        }

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

                const response = await fetch(config.url, {
                    method: 'POST',
                    headers,
                    body,
                    signal: controller.signal,
                });

                clearTimeout(timeout);

                if (response.ok) {
                    return true;
                }

                // Non-retryable client errors (4xx except 429)
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    console.error(`[Webhook] Non-retryable error ${response.status} for ${config.url}`);
                    return false;
                }
            } catch (err) {
                if (attempt === MAX_RETRIES - 1) {
                    console.error(`[Webhook] Failed after ${MAX_RETRIES} retries for ${config.url}:`, err);
                    return false;
                }
            }

            // Exponential backoff
            const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
            await new Promise((resolve) => setTimeout(resolve, backoff));
        }

        return false;
    }
}

export default WebhookDelivery;
