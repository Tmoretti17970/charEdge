// ═══════════════════════════════════════════════════════════════════
// charEdge — Product Analytics Service
//
// Lightweight event tracking with pluggable backends.
//   - Development: logs to console
//   - Production:  sends to PostHog (when configured)
//   - Test:        noop
//
// Respects user consent preferences via useConsentStore.
// ═══════════════════════════════════════════════════════════════════

export interface AnalyticsEvent {
    name: string;
    properties?: Record<string, unknown>;
    timestamp: number;
}

export interface AnalyticsBackend {
    name: string;
    track(event: AnalyticsEvent): void;
    identify?(userId: string, traits?: Record<string, unknown>): void;
    flush?(): void;
}

// ─── Built-in Backends ──────────────────────────────────────────

export const consoleBackend: AnalyticsBackend = {
    name: 'console',
    track(event) {
        // eslint-disable-next-line no-console
        console.info(`[Analytics] ${event.name}`, event.properties ?? '');
    },
    identify(userId, traits) {
        // eslint-disable-next-line no-console
        console.info(`[Analytics] identify: ${userId}`, traits ?? '');
    },
};

export const noopBackend: AnalyticsBackend = {
    name: 'noop',
    track() { },
    identify() { },
};

// ─── Core Events ────────────────────────────────────────────────

export const EVENTS = {
    // Chart
    CHART_LOADED: 'chart_loaded',
    TIMEFRAME_CHANGED: 'timeframe_changed',
    INDICATOR_ADDED: 'indicator_added',
    DRAWING_CREATED: 'drawing_created',

    // Trading
    TRADE_LOGGED: 'trade_logged',
    TRADE_UPDATED: 'trade_updated',
    TRADE_DELETED: 'trade_deleted',
    BACKTEST_RUN: 'backtest_run',

    // Journal
    JOURNAL_WRITTEN: 'journal_written',
    PLAYBOOK_CREATED: 'playbook_created',
    CHECKLIST_COMPLETED: 'checklist_completed',

    // User
    SESSION_START: 'session_start',
    SESSION_END: 'session_end',
    SETTINGS_CHANGED: 'settings_changed',
    THEME_TOGGLED: 'theme_toggled',

    // Features
    COMMAND_PALETTE_OPENED: 'command_palette_opened',
    AI_COACH_ASKED: 'ai_coach_asked',
    EXPORT_GENERATED: 'export_generated',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

// ─── Analytics Service ──────────────────────────────────────────

class AnalyticsService {
    private backend: AnalyticsBackend;
    private queue: AnalyticsEvent[] = [];
    private flushInterval: ReturnType<typeof setInterval> | null = null;
    private userId: string | null = null;
    private globalProperties: Record<string, unknown> = {};
    private _enabled = true;

    constructor(backend?: AnalyticsBackend) {
        this.backend = backend ?? noopBackend;
    }

    /** Initialize with a backend and start auto-flush */
    init(backend: AnalyticsBackend, options?: { flushIntervalMs?: number }) {
        this.backend = backend;
        const interval = options?.flushIntervalMs ?? 30_000;

        if (this.flushInterval) clearInterval(this.flushInterval);
        this.flushInterval = setInterval(() => this.flush(), interval);
    }

    /** Set global properties added to every event */
    setGlobalProperties(props: Record<string, unknown>) {
        this.globalProperties = { ...this.globalProperties, ...props };
    }

    /** Enable/disable tracking (for GDPR consent) */
    setEnabled(enabled: boolean) {
        this._enabled = enabled;
    }

    /** Identify the current user */
    identify(userId: string, traits?: Record<string, unknown>) {
        this.userId = userId;
        this.backend.identify?.(userId, traits);
    }

    /** Track an event */
    track(name: string, properties?: Record<string, unknown>) {
        if (!this._enabled) return;

        const event: AnalyticsEvent = {
            name,
            properties: {
                ...this.globalProperties,
                ...properties,
                ...(this.userId ? { userId: this.userId } : {}),
            },
            timestamp: Date.now(),
        };

        this.queue.push(event);
        this.backend.track(event);
    }

    /** Flush the event queue */
    flush() {
        if (this.queue.length === 0) return;
        this.backend.flush?.();
        this.queue = [];
    }

    /** Shutdown cleanly */
    destroy() {
        this.flush();
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
    }
}

// Singleton
export const analytics = new AnalyticsService();
export default analytics;
