// ═══════════════════════════════════════════════════════════════════
// charEdge — SSRF Protection (TypeScript)
//
// Validates webhook/callback URLs to prevent Server-Side Request
// Forgery. Rejects private IPs, localhost, and non-HTTPS URLs.
// ═══════════════════════════════════════════════════════════════════

import { URL } from 'node:url';

// ─── Private IP Ranges ──────────────────────────────────────────

const PRIVATE_RANGES = [
    // IPv4
    /^127\./,                      // Loopback
    /^10\./,                       // Class A private
    /^172\.(1[6-9]|2\d|3[01])\./,  // Class B private
    /^192\.168\./,                 // Class C private
    /^169\.254\./,                 // Link-local
    /^0\./,                        // Current network
    // IPv6
    /^::1$/,                       // Loopback
    /^fe80:/i,                     // Link-local
    /^fc00:/i,                     // Unique local
    /^fd/i,                        // Unique local
];

/**
 * Check if an IP address is in a private/reserved range.
 */
function isPrivateIP(ip: string): boolean {
    return PRIVATE_RANGES.some(re => re.test(ip));
}

// ─── Blocked Hostnames ──────────────────────────────────────────

const BLOCKED_HOSTS = new Set([
    'localhost',
    'localhost.localdomain',
    '0.0.0.0',
    '[::1]',
    'metadata.google.internal',     // GCP metadata
    '169.254.169.254',              // AWS/GCP/Azure metadata
    '169.254.170.2',                // AWS container credentials
]);

// ─── Public API ─────────────────────────────────────────────────

export interface SsrfValidationResult {
    valid: boolean;
    reason?: string;
}

/**
 * Validate a URL for SSRF safety.
 *
 * Rules:
 * - Must be a valid URL
 * - Must use HTTPS (HTTP rejected in production)
 * - Hostname must not resolve to a private IP
 * - Hostname must not be localhost or metadata endpoints
 */
export function validateWebhookUrl(
    rawUrl: string,
    options: { allowHttp?: boolean } = {}
): SsrfValidationResult {
    // Parse URL
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return { valid: false, reason: 'Invalid URL format.' };
    }

    // Protocol check
    const isProduction = process.env.NODE_ENV === 'production';
    const allowHttp = options.allowHttp && !isProduction;

    if (parsed.protocol !== 'https:' && !(allowHttp && parsed.protocol === 'http:')) {
        return { valid: false, reason: 'URL must use HTTPS.' };
    }

    // Hostname checks
    const hostname = parsed.hostname.toLowerCase();

    if (BLOCKED_HOSTS.has(hostname)) {
        return { valid: false, reason: 'URL points to a blocked host.' };
    }

    // IP address check
    if (isPrivateIP(hostname)) {
        return { valid: false, reason: 'URL resolves to a private/reserved IP address.' };
    }

    // Port check — block non-standard ports that might target internal services
    if (parsed.port) {
        const port = parseInt(parsed.port, 10);
        if (port < 80 || port === 6379 || port === 3306 || port === 5432 || port === 27017) {
            return { valid: false, reason: 'URL uses a suspicious port.' };
        }
    }

    return { valid: true };
}

/**
 * Express middleware that validates webhook URLs in req.body.url.
 */
export function ssrfGuard() {
    return (
        req: import('express').Request,
        res: import('express').Response,
        next: import('express').NextFunction
    ): void => {
        const url = req.body?.url;
        if (!url || typeof url !== 'string') {
            next();
            return;
        }

        const result = validateWebhookUrl(url);
        if (!result.valid) {
            res.status(400).json({
                ok: false,
                error: {
                    code: 'SSRF_BLOCKED',
                    message: result.reason || 'URL validation failed.',
                },
            });
            return;
        }

        next();
    };
}
