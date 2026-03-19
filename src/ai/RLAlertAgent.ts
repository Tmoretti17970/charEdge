// ═══════════════════════════════════════════════════════════════════
// charEdge — RL Alert Agent (Sprint 87)
//
// Reinforcement learning agent using a Q-table to learn which
// alerts the user finds valuable. Promotes/demotes alerts based on
// user interaction (click = positive reward, dismiss = negative).
//
// ~10KB Q-table stored in localStorage.
//
// Usage:
//   import { rlAlertAgent } from './RLAlertAgent';
//   const priority = rlAlertAgent.getPriority(alertState);
//   rlAlertAgent.reward(alertState, 'clicked');
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface AlertState {
  alertType: string;     // price_cross, indicator, volume_spike, pattern
  sectorGroup: string;   // tech, crypto, energy, healthcare, etc.
  timeSlot: string;      // morning, midday, afternoon, evening
  volumeLevel: string;   // low, normal, high, extreme
}

export type UserAction = 'clicked' | 'dismissed' | 'ignored';

export interface AgentStats {
  totalRewards: number;
  totalPenalties: number;
  statesExplored: number;
  lastUpdate: number;
}

// ─── Constants ──────────────────────────────────────────────────

const STORAGE_KEY = 'charEdge-rl-qtable';
const LEARNING_RATE = 0.1;
const DISCOUNT_FACTOR = 0.9;
const EXPLORATION_RATE = 0.15;

const REWARD_MAP: Record<UserAction, number> = {
  clicked: 1.0,
  dismissed: -0.5,
  ignored: -0.1,
};

// ─── Agent ──────────────────────────────────────────────────────

class RLAlertAgent {
  private _qTable: Map<string, number>;
  private _stats: AgentStats;

  constructor() {
    this._qTable = new Map();
    this._stats = { totalRewards: 0, totalPenalties: 0, statesExplored: 0, lastUpdate: 0 };
    this._load();
  }

  /**
   * Get the priority score for an alert based on learned preferences.
   * Returns 0–100 (higher = more likely user cares about this alert).
   */
  getPriority(state: AlertState): number {
    const key = this._stateKey(state);
    const qValue = this._qTable.get(key) ?? 0;

    // Normalize Q-value to 0–100 range
    // Q-values typically range from -5 to +5 after many updates
    const normalized = Math.max(0, Math.min(100, 50 + qValue * 10));

    // Exploration: occasionally boost low-priority alerts
    if (Math.random() < EXPLORATION_RATE) {
      return Math.max(normalized, 40); // Give exploring alerts at least 40
    }

    return Math.round(normalized);
  }

  /**
   * Record reward/penalty based on user action.
   */
  reward(state: AlertState, action: UserAction): void {
    const key = this._stateKey(state);
    const currentQ = this._qTable.get(key) ?? 0;
    const reward = REWARD_MAP[action];

    // Q-learning update: Q(s) = Q(s) + α * (reward + γ * maxQ - Q(s))
    // Simplified since we don't have explicit next-state transitions
    const newQ = currentQ + LEARNING_RATE * (reward - currentQ * (1 - DISCOUNT_FACTOR));
    this._qTable.set(key, Math.max(-5, Math.min(5, newQ)));

    // Update stats
    if (reward > 0) this._stats.totalRewards++;
    if (reward < 0) this._stats.totalPenalties++;
    this._stats.statesExplored = this._qTable.size;
    this._stats.lastUpdate = Date.now();

    this._save();
  }

  /**
   * Classify time into slots.
   */
  static getTimeSlot(hour?: number): string {
    const h = hour ?? new Date().getHours();
    if (h < 10) return 'morning';
    if (h < 14) return 'midday';
    if (h < 18) return 'afternoon';
    return 'evening';
  }

  /**
   * Get agent statistics.
   */
  getStats(): AgentStats {
    return { ...this._stats };
  }

  /**
   * Get the top N most valued alert states.
   */
  getTopStates(n = 5): { state: string; qValue: number }[] {
    return [...this._qTable.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([state, qValue]) => ({ state, qValue: Math.round(qValue * 100) / 100 }));
  }

  /**
   * Reset all learned preferences.
   */
  reset(): void {
    this._qTable.clear();
    this._stats = { totalRewards: 0, totalPenalties: 0, statesExplored: 0, lastUpdate: 0 };
    this._save();
  }

  // ─── Internal ────────────────────────────────────────────────

  private _stateKey(state: AlertState): string {
    return `${state.alertType}|${state.sectorGroup}|${state.timeSlot}|${state.volumeLevel}`;
  }

  private _save(): void {
    try {
      const data = {
        q: Object.fromEntries(this._qTable),
        stats: this._stats,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* storage full — non-critical */ }
  }

  private _load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.q) {
        this._qTable = new Map(Object.entries(data.q));
      }
      if (data.stats) {
        this._stats = data.stats;
      }
    } catch { /* corrupted data — start fresh */ }
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const rlAlertAgent = new RLAlertAgent();
export default rlAlertAgent;
