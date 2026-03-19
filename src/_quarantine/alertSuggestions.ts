// ═══════════════════════════════════════════════════════════════════
// charEdge — Context-Aware Alert Suggestions (Sprint 9)
//
// Proactively suggests alerts based on user behavior:
//   - After viewing a chart → suggest alert at current key levels
//   - After a trade entry → suggest stop-loss reminder alert
//   - After watchlist add → suggest 52W High/Low alerts
//   - Auto-detect support/resistance from price action
//
// Usage:
//   import { useSuggestions } from './alertSuggestions';
//   const { suggestions, dismiss, dismissType } = useSuggestions(symbol, price);
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ──────────────────────────────────────────────────────

export type SuggestionType = 
  | 'resistance'     // alert near resistance level
  | 'support'        // alert near support level
  | 'stopLoss'       // stop-loss reminder after trade
  | 'watchlist52w'   // 52W alerts for watchlist items
  | 'percentMove'    // alert on significant % move
  | 'roundNumber';   // alert at round price levels

export interface AlertSuggestion {
  id: string;
  type: SuggestionType;
  symbol: string;
  title: string;
  body: string;
  icon: string;
  /** Suggested alert price */
  price: number;
  /** Suggested alert condition */
  condition: string;
  /** When this suggestion was generated */
  timestamp: number;
  /** Context that triggered this suggestion */
  trigger: string;
}

// ─── Suggestion Store ───────────────────────────────────────────

interface SuggestionState {
  /** Active suggestions (max 5, newest first) */
  suggestions: AlertSuggestion[];
  /** Dismissed suggestion IDs (persisted) */
  dismissedIds: string[];
  /** Dismissed suggestion types per symbol (e.g. "AAPL:resistance") */
  dismissedTypes: string[];
  
  addSuggestion: (s: AlertSuggestion) => void;
  dismiss: (id: string) => void;
  dismissType: (symbol: string, type: SuggestionType) => void;
  clear: () => void;
  isDismissed: (id: string) => boolean;
  isTypeDismissed: (symbol: string, type: SuggestionType) => boolean;
}

const MAX_SUGGESTIONS = 5;

export const useSuggestionStore = create<SuggestionState>()(
  persist(
    (set, get) => ({
      suggestions: [],
      dismissedIds: [],
      dismissedTypes: [],

      addSuggestion: (s) => set((state) => {
        // Don't add if already dismissed
        if (state.dismissedIds.includes(s.id)) return state;
        if (state.dismissedTypes.includes(`${s.symbol}:${s.type}`)) return state;
        // Don't add duplicates
        if (state.suggestions.some((existing) => existing.id === s.id)) return state;
        
        const updated = [s, ...state.suggestions].slice(0, MAX_SUGGESTIONS);
        return { suggestions: updated };
      }),

      dismiss: (id) => set((state) => ({
        suggestions: state.suggestions.filter((s) => s.id !== id),
        dismissedIds: [...state.dismissedIds.slice(-50), id], // keep last 50
      })),

      dismissType: (symbol, type) => set((state) => ({
        suggestions: state.suggestions.filter((s) => !(s.symbol === symbol && s.type === type)),
        dismissedTypes: [...state.dismissedTypes.slice(-30), `${symbol}:${type}`],
      })),

      clear: () => set({ suggestions: [] }),

      isDismissed: (id) => get().dismissedIds.includes(id),
      isTypeDismissed: (symbol, type) => get().dismissedTypes.includes(`${symbol}:${type}`),
    }),
    {
      name: 'charEdge-alert-suggestions',
      partialize: (s) => ({ dismissedIds: s.dismissedIds, dismissedTypes: s.dismissedTypes }),
    },
  ),
);

// ─── Suggestion Generation ──────────────────────────────────────

/**
 * Generate alert suggestions based on price data.
 * Call this when viewing a chart or after price updates.
 */
export function generatePriceSuggestions(
  symbol: string, 
  currentPrice: number, 
  high52w?: number, 
  low52w?: number,
): void {
  const store = useSuggestionStore.getState();

  // 1. Round number alerts (nearest $10/$100/$1000 milestone)
  const magnitude = currentPrice > 1000 ? 100 : currentPrice > 100 ? 10 : 1;
  const nextRound = Math.ceil(currentPrice / magnitude) * magnitude;
  const prevRound = Math.floor(currentPrice / magnitude) * magnitude;
  
  if (nextRound !== currentPrice && !store.isTypeDismissed(symbol, 'roundNumber')) {
    const id = `${symbol}-round-${nextRound}`;
    if (!store.isDismissed(id)) {
      store.addSuggestion({
        id,
        type: 'roundNumber',
        symbol,
        title: `Set alert at $${nextRound.toLocaleString()}?`,
        body: `${symbol} is approaching the $${nextRound.toLocaleString()} level`,
        icon: '🎯',
        price: nextRound,
        condition: 'above',
        timestamp: Date.now(),
        trigger: 'chart_view',
      });
    }
  }

  // 2. Support level suggestion (5% below current)
  const supportLevel = Math.round(currentPrice * 0.95 * 100) / 100;
  if (!store.isTypeDismissed(symbol, 'support')) {
    const id = `${symbol}-support-${supportLevel}`;
    if (!store.isDismissed(id)) {
      store.addSuggestion({
        id,
        type: 'support',
        symbol,
        title: `Alert if ${symbol} drops 5%?`,
        body: `Set alert at $${supportLevel.toFixed(2)} as a support level warning`,
        icon: '📉',
        price: supportLevel,
        condition: 'below',
        timestamp: Date.now(),
        trigger: 'chart_view',
      });
    }
  }

  // 3. 52W High proximity
  if (high52w && currentPrice > high52w * 0.95 && !store.isTypeDismissed(symbol, 'resistance')) {
    const id = `${symbol}-52wh-${high52w}`;
    if (!store.isDismissed(id)) {
      store.addSuggestion({
        id,
        type: 'resistance',
        symbol,
        title: `Near 52-week high!`,
        body: `${symbol} is within ${((1 - currentPrice / high52w) * -100).toFixed(1)}% of its 52W high ($${high52w.toFixed(2)})`,
        icon: '🌟',
        price: high52w,
        condition: '52w_high',
        timestamp: Date.now(),
        trigger: 'proximity',
      });
    }
  }

  // 4. 52W Low proximity
  if (low52w && currentPrice < low52w * 1.05 && !store.isTypeDismissed(symbol, 'support')) {
    const id = `${symbol}-52wl-${low52w}`;
    if (!store.isDismissed(id)) {
      store.addSuggestion({
        id,
        type: 'support',
        symbol,
        title: `Near 52-week low`,
        body: `${symbol} is within ${((currentPrice / low52w - 1) * 100).toFixed(1)}% of its 52W low ($${low52w.toFixed(2)})`,
        icon: '⚠️',
        price: low52w,
        condition: '52w_low',
        timestamp: Date.now(),
        trigger: 'proximity',
      });
    }
  }
}

/**
 * Suggest a stop-loss alert after a trade entry.
 */
export function suggestStopLossAlert(
  symbol: string, 
  entryPrice: number, 
  side: 'long' | 'short' = 'long',
): void {
  const store = useSuggestionStore.getState();
  if (store.isTypeDismissed(symbol, 'stopLoss')) return;

  const slPercent = 0.02; // -2% default
  const slPrice = side === 'long' 
    ? Math.round(entryPrice * (1 - slPercent) * 100) / 100
    : Math.round(entryPrice * (1 + slPercent) * 100) / 100;
  
  const id = `${symbol}-sl-${slPrice}`;
  if (store.isDismissed(id)) return;

  store.addSuggestion({
    id,
    type: 'stopLoss',
    symbol,
    title: `Set stop-loss alert?`,
    body: `Alert if ${symbol} hits $${slPrice.toFixed(2)} (-${(slPercent * 100).toFixed(0)}% from entry)`,
    icon: '🛑',
    price: slPrice,
    condition: side === 'long' ? 'below' : 'above',
    timestamp: Date.now(),
    trigger: 'trade_entry',
  });
}

/**
 * Suggest 52W alerts when adding a symbol to watchlist.
 */
export function suggestWatchlistAlerts(symbol: string, currentPrice: number): void {
  const store = useSuggestionStore.getState();
  if (store.isTypeDismissed(symbol, 'watchlist52w')) return;

  const id = `${symbol}-watchlist-52w`;
  if (store.isDismissed(id)) return;

  store.addSuggestion({
    id,
    type: 'watchlist52w',
    symbol,
    title: `Enable 52W alerts for ${symbol}?`,
    body: `Get notified when ${symbol} hits a new 52-week high or low`,
    icon: '📊',
    price: currentPrice,
    condition: '52w_high',
    timestamp: Date.now(),
    trigger: 'watchlist_add',
  });
}

export default useSuggestionStore;
