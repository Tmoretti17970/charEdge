// ═══════════════════════════════════════════════════════════════════
// charEdge — Zustand Store Types
//
// Phase 2 Task 2.1.3: Type ALL Zustand store actions and selectors.
// ═══════════════════════════════════════════════════════════════════

import type { Trade, Playbook, Note, TradePlan, Timeframe, UserSettings, AnalyticsResult } from './data.js';

// ─── Journal Store ───────────────────────────────────────────────

export interface JournalState {
    trades: Trade[];
    loaded: boolean;
    loading: boolean;
    error: string | null;
}

export interface JournalActions {
    loadTrades(): Promise<void>;
    addTrade(trade: Omit<Trade, 'id' | 'createdAt' | 'updatedAt'>): Promise<Trade>;
    updateTrade(id: string, updates: Partial<Trade>): Promise<void>;
    deleteTrade(id: string): Promise<void>;
    importTrades(trades: Trade[]): Promise<number>;
    exportTrades(): Trade[];
    clearAll(): Promise<void>;
}

export type JournalStore = JournalState & JournalActions;

// ─── UI Store ────────────────────────────────────────────────────

export type PageName = 'journal' | 'charts' | 'discover' | 'coach' | 'insights' | 'privacy' | 'landing';

export interface UIState {
    page: PageName;
    settingsOpen: boolean;
    sidebarCollapsed: boolean;
    commandPaletteOpen: boolean;
    quickAddOpen: boolean;
    theme: 'dark' | 'light' | 'system';
}

export interface UIActions {
    setPage(page: PageName): void;
    toggleSettings(): void;
    toggleSidebar(): void;
    toggleCommandPalette(): void;
    toggleQuickAdd(): void;
}

export type UIStore = UIState & UIActions;

// ─── User Store ──────────────────────────────────────────────────

export interface UserState {
    theme: 'dark' | 'light' | 'system';
    density: 'compact' | 'comfortable' | 'spacious';
    persona: 'beginner' | 'intermediate' | 'advanced' | 'pro';
    onboardingComplete: boolean;
    discovered: Record<string, boolean>;
    settings: UserSettings;
}

export interface UserActions {
    hydrate(): void;
    init(): void;
    setTheme(theme: 'dark' | 'light' | 'system'): void;
    setDensity(density: 'compact' | 'comfortable' | 'spacious'): void;
    updateFromTrades(trades: Trade[]): void;
    markDiscovered(key: string): void;
    isDiscovered(key: string): boolean;
}

export type UserStore = UserState & UserActions;

// ─── Chart Store ─────────────────────────────────────────────────

export interface ChartState {
    symbol: string;
    timeframe: Timeframe;
    chartType: string;
    indicators: Array<{ id: string; type: string; params: Record<string, unknown> }>;
    drawings: Array<{ id: string; type: string; points: Array<{ time: number; price: number }> }>;
}

export interface ChartActions {
    setSymbol(symbol: string): void;
    setTimeframe(tf: Timeframe): void;
    setChartType(type: string): void;
    addIndicator(type: string, params?: Record<string, unknown>): string;
    removeIndicator(id: string): void;
    addDrawing(type: string, points: Array<{ time: number; price: number }>): string;
    removeDrawing(id: string): void;
    clearAllDrawings(): void;
}

export type ChartStore = ChartState & ChartActions;

// ─── Consent Store ───────────────────────────────────────────────

export interface ConsentState {
    necessary: true;
    analytics: boolean | null;
    consentedAt: string | null;
    services: {
        posthog: boolean | null;
        sentry: boolean | null;
        vercelAnalytics: boolean | null;
        speedInsights: boolean | null;
    };
    doNotSell: boolean;
}

export interface ConsentActions {
    needsConsent(): boolean;
    acceptAll(): void;
    rejectAll(): void;
    setPreference(key: string, val: boolean): void;
    setServicePreference(service: string, enabled: boolean): void;
    setDoNotSell(val: boolean): void;
    resetConsent(): void;
}

export type ConsentStore = ConsentState & ConsentActions;

// ─── Analytics Store ─────────────────────────────────────────────

export interface AnalyticsState {
    result: AnalyticsResult | null;
    computing: boolean;
}

export interface AnalyticsActions {
    compute(trades: Trade[]): void;
    reset(): void;
}

export type AnalyticsStore = AnalyticsState & AnalyticsActions;

// ─── Gamification Store ──────────────────────────────────────────

export interface GamificationState {
    enabled: boolean;
    xp: number;
    level: number;
    streaks: {
        currentWin: number;
        currentLoss: number;
        maxWin: number;
        maxLoss: number;
        dailyLogins: number;
    };
    achievements: Array<{ id: string; name: string; unlockedAt: string }>;
    pendingAchievements: Array<{ id: string; name: string }>;
    notificationPrefs: {
        achievements: boolean;
        levelUp: boolean;
        streaks: boolean;
    };
}

export interface GamificationActions {
    awardXP(amount: number, reason: string): void;
    updateStreaks(trades: Trade[]): void;
    evaluateAchievements(trades: Trade[]): void;
    evaluateMilestones(trades: Trade[]): void;
    updateChallengeProgress(trades: Trade[]): void;
    updateWeeklyChallengeProgress(trades: Trade[]): void;
    evaluateQuestProgress(trades: Trade[]): void;
    consumePendingAchievements(): Array<{ id: string; name: string }>;
}

export type GamificationStore = GamificationState & GamificationActions;

// ─── Notification Store ──────────────────────────────────────────

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message?: string;
    timestamp: string;
    read: boolean;
}

export interface NotificationState {
    items: Notification[];
    panelOpen: boolean;
    unreadCount: number;
}

export interface NotificationActions {
    add(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void;
    markRead(id: string): void;
    markAllRead(): void;
    clear(): void;
    togglePanel(): void;
}

export type NotificationStore = NotificationState & NotificationActions;

// ─── Watchlist Store ─────────────────────────────────────────────

export interface WatchlistItem {
    symbol: string;
    name?: string;
    addedAt: string;
}

export interface WatchlistState {
    items: WatchlistItem[];
    activeSymbol: string | null;
}

export interface WatchlistActions {
    add(symbol: string, name?: string): void;
    remove(symbol: string): void;
    setActive(symbol: string): void;
    reorder(from: number, to: number): void;
}

export type WatchlistStore = WatchlistState & WatchlistActions;
