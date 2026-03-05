// ═══════════════════════════════════════════════════════════════════
// charEdge — Types Barrel Export
//
// Phase 2 Task 2.3.6: Module APIs via barrel exports.
// Import types from '@/types' instead of individual type files.
// ═══════════════════════════════════════════════════════════════════

export type {
    Bar,
    BarArrays,
    Timeframe,
    Trade,
    TradeSide,
    TradeStatus,
    Playbook,
    PlaybookRule,
    Note,
    TradePlan,
    PlanStatus,
    StorageResult,
    AnalyticsResult,
    UserSettings,
    ApiResponse,
} from './data.js';

export type {
    WSConnectionState,
    WSMessage,
    WSTrade,
    WSKline,
    WSDepthUpdate,
    WSTicker,
    WSSubscribe,
    WSStatus,
    WSDataQuality,
    WSInboundMessage,
    WSOutboundMessage,
} from './ws.js';

export type {
    ChartType,
    ChartProps,
    ChartCallbacks,
    ChartClickEvent,
    CrosshairEvent,
    VisibleRange,
    IndicatorPane,
    IndicatorConfig,
    DrawingToolType,
    DrawingPoint,
    DrawingState,
    ChartTheme,
    ChartEngineAPI,
} from './chart.js';

export type {
    JournalStore,
    UIStore,
    UserStore,
    ChartStore,
    ConsentStore,
    AnalyticsStore,
    GamificationStore,
    NotificationStore,
    WatchlistStore,
} from './store.js';
