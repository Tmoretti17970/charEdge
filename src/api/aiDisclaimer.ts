// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Financial Disclaimer Middleware
//
// Injects a financial disclaimer into all AI-generated responses.
// Required for regulatory compliance on AI-powered financial tools.
// ═══════════════════════════════════════════════════════════════════

import type { Request, Response, NextFunction } from 'express';

export const AI_DISCLAIMER =
    'This is AI-generated content and does not constitute financial advice. ' +
    'Past performance does not guarantee future results. ' +
    'Trading involves substantial risk of loss and is not suitable for every investor. ' +
    'Always do your own research and consult a qualified financial advisor.';

/**
 * Middleware that wraps `res.json()` to inject a disclaimer
 * field into AI endpoint responses.
 */
export function aiDisclaimer() {
    return (req: Request, res: Response, next: NextFunction): void => {
        const originalJson = res.json.bind(res);

        res.json = function (body: unknown) {
            if (body && typeof body === 'object' && !Array.isArray(body)) {
                return originalJson({
                    ...(body as Record<string, unknown>),
                    _disclaimer: AI_DISCLAIMER,
                    _ai_generated: true,
                });
            }
            return originalJson(body);
        } as Response['json'];

        next();
    };
}
