// ═══════════════════════════════════════════════════════════════════
// charEdge — Zustand Store Type Definitions
//
// Ambient type declarations for the core Zustand stores.
// These enable IDE autocomplete and type-checking when used with
// @ts-check in .js files, or when importing from .ts files.
//
// NOTE: These types describe the PUBLIC interface of each store.
// Internal implementation details (hydrate internals, migration
// functions) are intentionally excluded.
// ═══════════════════════════════════════════════════════════════════

// ─── Trade / Journal Types ────────────────────────────────────────

export interface Trade {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entry: number;
  exit?: number;
  qty?: number;
  pnl?: number;
  date?: string;
  notes?: string;
  tags?: string[];
  setup?: string;
  emotion?: string;
  grade?: string;
  screenshots?: string[];
  [key: string]: unknown;
}

export interface Playbook {
  id: string;
  name: string;
  rules?: string[];
  [key: string]: unknown;
}

export interface Note {
  id: string;
  text: string;
  date?: string;
  [key: string]: unknown;
}

export interface TradePlan {
  id: string;
  symbol?: string;
  notes?: string;
  [key: string]: unknown;
}

// ─── UI Store ─────────────────────────────────────────────────────

export type PageName =
  | 'dashboard'
  | 'journal'
  | 'charts'
  | 'discover'
  | 'coach'
  | 'insights'
  | 'community'
  | 'settings'
  | 'pricing'
  | 'terms'
  | 'privacy'
  | 'changelog'
  | string;

export interface ModalData {
  type: string;
  [key: string]: unknown;
}

export interface ConfirmDialogData {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  [key: string]: unknown;
}

export interface UIStoreState {
  page: PageName;
  modal: ModalData | null;
  confirmDialog: ConfirmDialogData | null;
  zenMode: boolean;
  cmdPaletteOpen: boolean;
  shortcutsOpen: boolean;
  quickTradeOpen: boolean;
  settingsOpen: boolean;
  recentSymbols: string[];

  setPage: (page: PageName) => void;
  addRecentSymbol: (sym: string) => void;
  openModal: (data: ModalData) => void;
  closeModal: () => void;
  openConfirm: (data: ConfirmDialogData) => void;
  closeConfirm: () => void;
  toggleZen: () => void;
  toggleCmdPalette: () => void;
  closeCmdPalette: () => void;
  toggleShortcuts: () => void;
  closeShortcuts: () => void;
  openQuickTrade: () => void;
  closeQuickTrade: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  toggleSettings: () => void;
  closeAll: () => void;
}

// ─── User Store ───────────────────────────────────────────────────

export type ThemeName = 'dark' | 'light' | 'system';
export type DensityMode = 'compact' | 'comfortable' | 'spacious';
export type DisplayUnit = 'usd' | 'btc' | 'sats' | 'pct';

export interface UserStoreState {
  // Auth slice
  isAuthenticated: boolean;
  user: { id?: string; name?: string; email?: string } | null;

  // Theme slice
  theme: ThemeName;
  accentColor: string;
  fontSize: number;
  chartColorPreset: string;

  // Density slice
  mode: DensityMode;

  // Display unit slice
  displayUnit: DisplayUnit;

  // Settings slice
  simpleMode: boolean;

  // Onboarding slice
  discovered: Record<string, boolean>;
  isDiscovered: (key: string) => boolean;
  markDiscovered: (key: string) => void;

  // Actions
  hydrate: () => void;
  init: () => void;
  setTheme: (theme: ThemeName) => void;
  setAccentColor: (color: string) => void;
  setFontSize: (size: number) => void;
  setChartColorPreset: (preset: string) => void;
  setDensity: (mode: DensityMode) => void;
  setDisplayUnit: (unit: DisplayUnit) => void;
  toggleSimpleMode: () => void;
}

// ─── Chart Store ──────────────────────────────────────────────────

export type ChartTypeName =
  | 'candlestick'
  | 'hollow'
  | 'heikinashi'
  | 'footprint'
  | 'line'
  | 'area'
  | 'renko'
  | 'range'
  | string;

export type ScaleModeName = 'linear' | 'log' | 'percent' | 'indexed';

export interface ChartStoreState {
  // Core slice
  symbol: string;
  tf: string;
  chartType: ChartTypeName;
  scaleMode: ScaleModeName;
  logScale: boolean;

  setSymbol: (symbol: string) => void;
  setTf: (tf: string) => void;
  setChartType: (type: ChartTypeName) => void;
  setScaleMode: (mode: ScaleModeName) => void;
  setCandleMode: (mode: string) => void;
  toggleLogScale: () => void;
  getSmartTimeframe: () => string;
}

// ─── Journal Store ────────────────────────────────────────────────

export interface JournalStoreState {
  // Trade slice
  trades: Trade[];
  playbooks: Playbook[];
  notes: Note[];
  tradePlans: TradePlan[];
  loaded: boolean;

  addTrade: (trade: Trade) => void;
  addTrades: (trades: Trade[]) => void;
  deleteTrade: (id: string) => void;
  updateTrade: (id: string, updates: Partial<Trade>) => void;
  addPlaybook: (pb: Playbook) => void;
  deletePlaybook: (id: string) => void;
  addNote: (note: Note) => void;
  deleteNote: (id: string) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  addTradePlan: (plan: TradePlan) => void;
  deleteTradePlan: (id: string) => void;
  updateTradePlan: (id: string, updates: Partial<TradePlan>) => void;
  hydrate: (data?: Record<string, unknown>) => void;
  reset: (demoTrades?: Trade[], demoPb?: Playbook[]) => void;
}

// ─── Gamification Store ───────────────────────────────────────────

export interface RankInfo {
  level: number;
  name: string;
  emoji: string;
  minXP: number;
  color: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
  check: (trades: Trade[]) => boolean;
  [key: string]: unknown;
}

export interface DailyChallenge {
  id: string;
  title: string;
  goal: number;
  xpReward: number;
  [key: string]: unknown;
}

export interface GamificationStoreState {
  // Core state
  xp: number;
  xpHistory: Array<{ amount: number; source: string; ts: number }>;
  unlockedAchievements: Record<string, number>;
  streak: number;
  lastTradeDate: string | null;
  longestStreak: number;
  checklistsCompleted: number;
  goalsHit: number;

  // Daily challenges
  dailyChallenge: DailyChallenge | null;
  dailyChallengeProgress: number;
  dailyChallengeDate: string | null;

  // Weekly challenges
  weeklyChallenge: DailyChallenge | null;
  weeklyChallengeProgress: number;
  weeklyChallengeStartDate: string | null;

  // Milestones & Quests
  completedMilestones: Record<string, number>;
  activeQuests: Record<string, { step: number; progress: number; startedAt: number }>;
  completedQuests: Record<string, number>;

  // Settings
  enabled: boolean;
  notificationPrefs: {
    levelUp: boolean;
    achievements: boolean;
  };

  // Transient UI state
  _pendingLevelUp: { oldRank: RankInfo; newRank: RankInfo } | null;
  _pendingAchievements: Achievement[];
  _pendingMilestone: { id: string; title: string; emoji: string } | null;

  // Actions
  getLevel: () => RankInfo;
  getXPProgress: () => { current: number; needed: number; pct: number };
  awardXP: (amount: number, source: string) => void;
  clearPendingLevelUp: () => void;
  consumePendingAchievements: () => Achievement[];
  updateStreaks: (trades: Trade[]) => void;
  evaluateAchievements: (trades: Trade[]) => void;
  updateChallengeProgress: (trades: Trade[]) => void;
  updateWeeklyChallengeProgress: (trades: Trade[]) => void;
  evaluateMilestones: (trades: Trade[]) => void;
  evaluateQuestProgress: (trades: Trade[]) => void;
  incrementChecklistCount: () => void;
  incrementGoalsHit: () => void;
  toggleEnabled: () => void;
  setNotificationPref: (key: string, val: boolean) => void;
  resetProgress: () => void;
  hydrate: (saved?: Record<string, unknown>) => void;
  toJSON: () => Record<string, unknown>;
}

// ─── Data Store ───────────────────────────────────────────────────

export interface DataStoreState {
  // Discover slice state (market discovery features)
  [key: string]: unknown;
}
