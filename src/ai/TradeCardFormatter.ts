// ═══════════════════════════════════════════════════════════════════
// charEdge — Trade Card Formatter (Sprint 31)
//
// Formats trade objects into rich markdown cards for copilot display.
// Used by AIRouter.journal_search and journal handlers.
//
// Usage:
//   import { tradeCardFormatter } from './TradeCardFormatter';
//   const md = tradeCardFormatter.formatTrades(trades);
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface TradeForCard {
  id?: string;
  symbol: string;
  side: 'long' | 'short' | string;
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
  setup?: string;
  timeframe?: string;
  entryDate?: string | number;
  exitDate?: string | number;
  notes?: string;
  status?: 'open' | 'closed' | string;
}

// ─── Formatter ──────────────────────────────────────────────────

export class TradeCardFormatter {
  /**
   * Format a single trade as a markdown card.
   */
  formatCard(trade: TradeForCard): string {
    const side = (trade.side || 'long').toUpperCase();
    const sideEmoji = side === 'SHORT' ? '🔴' : '🟢';
    const setup = trade.setup ? ` · ${trade.setup}` : '';

    const parts: string[] = [];

    // Header
    parts.push(`${sideEmoji} **${trade.symbol} ${side}**${setup}`);

    // Prices
    const entry = `Entry $${this._formatPrice(trade.entryPrice)}`;
    if (trade.exitPrice) {
      parts.push(`${entry} → Exit $${this._formatPrice(trade.exitPrice)}`);
    } else {
      parts.push(`${entry} (Open)`);
    }

    // P&L
    if (trade.pnl !== undefined) {
      const pnlSign = trade.pnl >= 0 ? '+' : '';
      const pnlEmoji = trade.pnl >= 0 ? '✅' : '❌';
      parts.push(`P&L: ${pnlSign}$${trade.pnl.toFixed(2)} ${pnlEmoji}`);
    }

    // Date & duration
    if (trade.entryDate) {
      const entryStr = this._formatDate(trade.entryDate);
      if (trade.exitDate) {
        const duration = this._calcDuration(trade.entryDate, trade.exitDate);
        parts.push(`${entryStr} · Held ${duration}`);
      } else {
        parts.push(entryStr);
      }
    }

    // Notes (truncated)
    if (trade.notes) {
      const note = trade.notes.length > 80 ? trade.notes.slice(0, 77) + '…' : trade.notes;
      parts.push(`*${note}*`);
    }

    return parts.join('\n');
  }

  /**
   * Format multiple trades as markdown with separators.
   */
  formatTrades(trades: TradeForCard[], limit = 5): string {
    if (!trades.length) return '*No matching trades found.*';

    const cards = trades.slice(0, limit).map((t) => this.formatCard(t));
    const result = cards.join('\n\n---\n\n');

    if (trades.length > limit) {
      return result + `\n\n*...and ${trades.length - limit} more trades.*`;
    }

    return result;
  }

  /**
   * Create a summary header for trade search results.
   */
  formatSearchResults(query: string, trades: TradeForCard[]): string {
    const header = `📓 **Journal Search:** "${query}"\n*Found ${trades.length} matching trade${trades.length !== 1 ? 's' : ''}*\n\n---\n\n`;
    return header + this.formatTrades(trades);
  }

  // ── Helpers ─────────────────────────────────────────────────

  private _formatPrice(price: number): string {
    if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(2);
    return price.toFixed(4);
  }

  private _formatDate(date: string | number): string {
    try {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return String(date);
    }
  }

  private _calcDuration(start: string | number, end: string | number): string {
    try {
      const ms = new Date(end).getTime() - new Date(start).getTime();
      if (ms < 0) return '—';
      const mins = Math.floor(ms / 60_000);
      if (mins < 60) return `${mins}m`;
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      if (hours < 24) return `${hours}h ${remMins}m`;
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    } catch {
      return '—';
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const tradeCardFormatter = new TradeCardFormatter();
export default tradeCardFormatter;
