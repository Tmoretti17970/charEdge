// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade Replay Engine (Sprint 77)
//
// Step through historical trades bar-by-bar with AI commentary
// at key decision points (entry, midpoint, exit, hindsight).
//
// Usage:
//   import { tradeReplayEngine } from './TradeReplayEngine';
//   const session = await tradeReplayEngine.createSession(trade, bars);
//   const commentary = await session.getCommentary('entry');
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface ReplayBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ReplaySession {
  trade: Record<string, unknown>;
  bars: ReplayBar[];
  entryIdx: number;
  exitIdx: number;
  currentIdx: number;
  isPlaying: boolean;
  speed: number; // ms per bar
  commentaryCache: Map<string, string>;
  step: (delta?: number) => void;
  play: () => void;
  pause: () => void;
  setSpeed: (ms: number) => void;
  getCommentary: (point: 'entry' | 'midpoint' | 'exit' | 'hindsight') => Promise<string>;
  // Phase 3 Task #38: Cleanup/destroy
  destroy: () => void;
}

// ─── Engine ─────────────────────────────────────────────────────

class TradeReplayEngine {
  /**
   * Create a replay session for a trade.
   */
  createSession(trade: Record<string, unknown>, bars: ReplayBar[]): ReplaySession {
    const entryTime = this._parseTime(trade.entryTime || trade.date);
    const exitTime = this._parseTime(trade.exitTime);

    // Find entry/exit bar indices
    let entryIdx = 0;
    let exitIdx = bars.length - 1;

    if (entryTime) {
      entryIdx = bars.findIndex((b) => b.time >= entryTime);
      if (entryIdx < 0) entryIdx = 0;
    }
    if (exitTime) {
      exitIdx = bars.findIndex((b) => b.time >= exitTime);
      if (exitIdx < 0) exitIdx = bars.length - 1;
    }

    let playInterval: ReturnType<typeof setInterval> | null = null;
    const commentaryCache = new Map<string, string>();

    const session: ReplaySession = {
      trade,
      bars,
      entryIdx,
      exitIdx,
      currentIdx: Math.max(0, entryIdx - 20), // Start 20 bars before entry
      isPlaying: false,
      speed: 200,
      commentaryCache,

      step(delta = 1) {
        session.currentIdx = Math.max(0, Math.min(bars.length - 1, session.currentIdx + delta));
      },

      play() {
        session.isPlaying = true;
        playInterval = setInterval(() => {
          if (session.currentIdx >= session.exitIdx + 10) {
            session.pause();
            return;
          }
          session.step();
        }, session.speed);
      },

      pause() {
        session.isPlaying = false;
        if (playInterval) {
          clearInterval(playInterval);
          playInterval = null;
        }
      },

      setSpeed(ms: number) {
        session.speed = ms;
        if (session.isPlaying) {
          session.pause();
          session.play();
        }
      },

      getCommentary: async (point) => {
        if (commentaryCache.has(point)) return commentaryCache.get(point)!;

        const commentary = await generateCommentary(trade, bars, entryIdx, exitIdx, point);
        commentaryCache.set(point, commentary);
        return commentary;
      },

      // Phase 3 Task #38: Cleanup/destroy
      destroy() {
        session.pause();
        commentaryCache.clear();
        session.currentIdx = 0;
        session.isPlaying = false;
      },
    };

    return session;
  }

  private _parseTime(v: unknown): number | null {
    if (!v) return null;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d.getTime();
    }
    return null;
  }
}

// ─── Commentary Generator ───────────────────────────────────────

async function generateCommentary(
  trade: Record<string, unknown>,
  bars: ReplayBar[],
  entryIdx: number,
  exitIdx: number,
  point: string,
): Promise<string> {
  const barIdx =
    point === 'entry'
      ? entryIdx
      : point === 'exit'
        ? exitIdx
        : point === 'midpoint'
          ? Math.floor((entryIdx + exitIdx) / 2)
          : exitIdx;

  const contextBars = bars.slice(Math.max(0, barIdx - 5), barIdx + 1);
  const barSummary = contextBars
    .map(
      (b) =>
        `O:${b.open.toFixed(2)} H:${b.high.toFixed(2)} L:${b.low.toFixed(2)} C:${b.close.toFixed(2)} V:${b.volume}`,
    )
    .join(' | ');

  const prompt = `Analyze this ${point} point of a ${trade.side || '?'} trade on ${trade.symbol || '?'}.
Entry: $${trade.entryPrice || '?'} | Exit: $${trade.exitPrice || '?'} | P&L: $${typeof trade.pnl === 'number' ? (trade.pnl as number).toFixed(2) : '?'}

Recent bars at ${point} point:
${barSummary}

${
  point === 'entry'
    ? 'Was this a good entry? What was the price action saying?'
    : point === 'midpoint'
      ? 'How was the trade managed at this point? Any warning signs?'
      : point === 'exit'
        ? 'Was the exit well-timed? Could it have been better?'
        : 'With hindsight, what would the optimal play have been?'
}

1-2 sentences max.`;

  try {
    const { aiRouter } = await import('./AIRouter');
    const result = await aiRouter.route({
      type: 'coach',
      messages: [
        {
          role: 'system',
          content: 'You are a trading replay coach. Brief, specific commentary at each decision point.',
        },
        { role: 'user', content: prompt },
      ],
      maxTokens: 100,
      temperature: 0.3,
    });
    return result.content;
  } catch {
    return `[${point}] Commentary unavailable.`;
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const tradeReplayEngine = new TradeReplayEngine();
export default tradeReplayEngine;
