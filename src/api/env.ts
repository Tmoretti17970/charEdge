// ═══════════════════════════════════════════════════════════════════
// charEdge — Environment Variable Validation (TypeScript)
//
// Validates all required environment variables at startup using Zod.
// Crashes immediately with human-readable errors on invalid config.
// Import this at the top of server.js before anything else.
// ═══════════════════════════════════════════════════════════════════

import { z } from 'zod';

const envSchema = z.object({
    // ── Required ────────────────────────────────────────────
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),

    // ── Security ────────────────────────────────────────────
    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('dev-secret-change-in-production!'),
    CORS_ORIGINS: z.string().optional().default(''),

    // ── Database ────────────────────────────────────────────
    DB_PATH: z.string().optional().default('./data/charedge.db'),

    // ── Sentry ──────────────────────────────────────────────
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),

    // ── External APIs ───────────────────────────────────────
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),

    // ── Data Provider API Keys (server-side proxy) ───────────
    ALPACA_KEY_ID: z.string().optional(),
    ALPACA_SECRET: z.string().optional(),
    POLYGON_API_KEY: z.string().optional(),
    FMP_API_KEY: z.string().optional(),
    TIINGO_API_TOKEN: z.string().optional(),
    ALPHAVANTAGE_API_KEY: z.string().optional(),
    FRED_API_KEY: z.string().optional(),
    FINNHUB_API_KEY: z.string().optional(),

    // ── Feature Flags ───────────────────────────────────────
    ENABLE_SOCIAL: z.coerce.boolean().default(false),
    ENABLE_AI: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

/**
 * Validate and parse environment variables.
 * Call once at startup — crashes with clear errors on invalid config.
 */
export function validateEnv(): Env {
    if (_env) return _env;

    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        const errors = result.error.issues.map(
            (issue) => `  ✗ ${issue.path.join('.')}: ${issue.message}`
        );
        console.error('\n╔══════════════════════════════════════════════╗');
        console.error('║  Environment Variable Validation Failed      ║');
        console.error('╚══════════════════════════════════════════════╝\n');
        console.error(errors.join('\n'));
        console.error('\nFix the above issues and restart the server.\n');
        process.exit(1);
    }

    // Warn if using default JWT secret in production
    if (result.data.NODE_ENV === 'production' && result.data.JWT_SECRET === 'dev-secret-change-in-production!') {
        console.error('\n⚠️  WARNING: Using default JWT_SECRET in production! Set a secure value.\n');
        process.exit(1);
    }

    // Warn about missing data provider keys
    const apiKeyChecks: Array<[string, keyof Env]> = [
        ['Alpaca (best equity data)', 'ALPACA_KEY_ID'],
        ['Polygon.io', 'POLYGON_API_KEY'],
        ['FMP', 'FMP_API_KEY'],
        ['Tiingo', 'TIINGO_API_TOKEN'],
        ['Alpha Vantage', 'ALPHAVANTAGE_API_KEY'],
        ['FRED', 'FRED_API_KEY'],
        ['Finnhub', 'FINNHUB_API_KEY'],
    ];

    const missing = apiKeyChecks.filter(([, key]) => !result.data[key]);
    if (missing.length > 0) {
        console.warn('\n⚠️  Missing data provider API keys (charts will use fallback providers):');
        for (const [name] of missing) {
            console.warn(`   • ${name}`);
        }
        console.warn('   Set keys in .env.local — see .env.example for details.\n');
    }

    _env = result.data;
    return _env;
}

/**
 * Get the validated environment. Must call validateEnv() first.
 */
export function getEnv(): Env {
    if (!_env) throw new Error('Environment not validated. Call validateEnv() at startup.');
    return _env;
}
