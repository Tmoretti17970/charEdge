// ═══════════════════════════════════════════════════════════════════
// charEdge — Voice Command Processor (Sprint 69)
//
// Parses transcribed voice input into structured chart commands.
// Supports: symbol navigation, indicator addition, trade grading,
// alert creation, timeframe switching.
//
// Usage:
//   const cmd = voiceProcessor.parse("switch to NVDA 15 minute");
//   // → { action: 'navigate', symbol: 'NVDA', timeframe: '15' }
// ═══════════════════════════════════════════════════════════════════

// ─── Types ───────────────────────────────────────────────────────

export interface VoiceCommand {
  action: 'navigate' | 'indicator' | 'grade' | 'alert' | 'timeframe' | 'copilot' | 'unknown';
  symbol?: string;
  timeframe?: string;
  indicator?: string;
  price?: number;
  rawText: string;
  confidence: number;
}

// ─── Command Patterns ───────────────────────────────────────────

const NAVIGATE_PATTERNS = [
  /(?:switch|go|change|show|open|load)\s+(?:to\s+)?([A-Z]{1,6}(?:USDT?)?)/i,
  /^([A-Z]{2,6}(?:USDT?)?)$/i,
];

const TIMEFRAME_PATTERNS = [
  /(?:switch|change|go)\s+(?:to\s+)?(\d+)\s*(?:min(?:ute)?|m)/i,
  /(?:switch|change|go)\s+(?:to\s+)?(\d+)\s*(?:hour|h)/i,
  /(?:switch|change|go)\s+(?:to\s+)?(?:daily|1d)/i,
  /(?:switch|change|go)\s+(?:to\s+)?(?:weekly|1w)/i,
];

const INDICATOR_PATTERNS = [
  /(?:add|show|enable|put)\s+(?:the\s+)?(?:an?\s+)?(rsi|macd|bollinger|vwap|ema|sma|atr|obv|ichimoku|supertrend)/i,
  /(?:remove|hide|disable|take off)\s+(?:the\s+)?(rsi|macd|bollinger|vwap|ema|sma|atr|obv|ichimoku|supertrend)/i,
];

const ALERT_PATTERNS = [
  /(?:set|create|add)\s+(?:an?\s+)?alert\s+(?:at|for)\s+\$?([\d,.]+)/i,
  /alert\s+(?:at|when)\s+\$?([\d,.]+)/i,
];

const GRADE_PATTERNS = [
  /(?:grade|score|rate|analyze)\s+(?:my\s+)?(?:last\s+)?(?:trade|position)/i,
  /(?:how\s+did\s+(?:my|that|the)\s+trade)/i,
];

const COPILOT_PATTERNS = [
  /(?:ask|tell|hey)\s+(?:ai|copilot|assistant)/i,
  /(?:what\s+(?:do\s+you|should\s+I)\s+think)/i,
  /(?:market\s+(?:pulse|summary|analysis))/i,
];

// ─── Known Symbols (fuzzy matching) ─────────────────────────────

const COMMON_SYMBOLS: Record<string, string> = {
  'bitcoin': 'BTCUSDT', 'btc': 'BTCUSDT',
  'ethereum': 'ETHUSDT', 'eth': 'ETHUSDT',
  'solana': 'SOLUSDT', 'sol': 'SOLUSDT',
  'nvidia': 'NVDA', 'apple': 'AAPL',
  'tesla': 'TSLA', 'amazon': 'AMZN',
  'google': 'GOOGL', 'microsoft': 'MSFT',
  'meta': 'META', 'spy': 'SPY',
  'ripple': 'XRPUSDT', 'xrp': 'XRPUSDT',
  'dogecoin': 'DOGEUSDT', 'doge': 'DOGEUSDT',
};

// ─── Processor ──────────────────────────────────────────────────

class VoiceCommandProcessor {
  // Phase 3 Task #40: Sync symbols with user watchlist
  /**
   * Refresh the symbol lookup table with the user's current watchlist.
   * Call this when the watchlist changes or on app init.
   */
  refreshSymbols(): void {
    try {
      // Dynamic import to avoid circular deps — fire-and-forget
      import('@/state/useWatchlistStore.js').then(({ useWatchlistStore }) => {
        const items = useWatchlistStore.getState()?.items;
        if (Array.isArray(items)) {
          for (const item of items) {
            const sym = typeof item === 'string' ? item : (item as Record<string, unknown>)?.symbol;
            if (typeof sym === 'string' && sym.length >= 2) {
              const key = sym.toLowerCase().replace(/usdt?$/i, '');
              if (!COMMON_SYMBOLS[key]) {
                COMMON_SYMBOLS[key] = sym.toUpperCase();
              }
            }
          }
        }
      }).catch(() => { /* watchlist store not available */ });
    } catch { /* non-critical */ }
  }
  /**
   * Parse transcribed text into a structured command.
   */
  parse(text: string): VoiceCommand {
    const cleaned = text.trim();
    if (!cleaned) return { action: 'unknown', rawText: text, confidence: 0 };

    // Try each pattern type in priority order
    const gradeCmd = this._tryGrade(cleaned);
    if (gradeCmd) return gradeCmd;

    const alertCmd = this._tryAlert(cleaned);
    if (alertCmd) return alertCmd;

    const indicatorCmd = this._tryIndicator(cleaned);
    if (indicatorCmd) return indicatorCmd;

    const tfCmd = this._tryTimeframe(cleaned);
    if (tfCmd) return tfCmd;

    const navCmd = this._tryNavigate(cleaned);
    if (navCmd) return navCmd;

    const copilotCmd = this._tryCopilot(cleaned);
    if (copilotCmd) return copilotCmd;

    // Couldn't parse — send to copilot as freeform
    return {
      action: 'copilot',
      rawText: cleaned,
      confidence: 0.3,
    };
  }

  private _tryNavigate(text: string): VoiceCommand | null {
    // Check common names first
    const lower = text.toLowerCase();
    for (const [name, symbol] of Object.entries(COMMON_SYMBOLS)) {
      if (lower.includes(name)) {
        return { action: 'navigate', symbol, rawText: text, confidence: 0.9 };
      }
    }

    for (const pattern of NAVIGATE_PATTERNS) {
      const m = text.match(pattern);
      if (m) {
        return {
          action: 'navigate',
          symbol: m[1].toUpperCase(),
          rawText: text,
          confidence: 0.85,
        };
      }
    }
    return null;
  }

  private _tryTimeframe(text: string): VoiceCommand | null {
    for (const pattern of TIMEFRAME_PATTERNS) {
      const m = text.match(pattern);
      if (m) {
        const tf = m[1] || (text.match(/daily|1d/i) ? '1D' : text.match(/weekly|1w/i) ? '1W' : m[1]);
        return { action: 'timeframe', timeframe: tf, rawText: text, confidence: 0.9 };
      }
    }
    return null;
  }

  private _tryIndicator(text: string): VoiceCommand | null {
    for (const pattern of INDICATOR_PATTERNS) {
      const m = text.match(pattern);
      if (m) {
        return {
          action: 'indicator',
          indicator: m[1].toUpperCase(),
          rawText: text,
          confidence: 0.9,
        };
      }
    }
    return null;
  }

  private _tryAlert(text: string): VoiceCommand | null {
    for (const pattern of ALERT_PATTERNS) {
      const m = text.match(pattern);
      if (m) {
        return {
          action: 'alert',
          price: parseFloat(m[1].replace(/,/g, '')),
          rawText: text,
          confidence: 0.85,
        };
      }
    }
    return null;
  }

  private _tryGrade(text: string): VoiceCommand | null {
    for (const pattern of GRADE_PATTERNS) {
      if (pattern.test(text)) {
        return { action: 'grade', rawText: text, confidence: 0.9 };
      }
    }
    return null;
  }

  private _tryCopilot(text: string): VoiceCommand | null {
    for (const pattern of COPILOT_PATTERNS) {
      if (pattern.test(text)) {
        return { action: 'copilot', rawText: text, confidence: 0.7 };
      }
    }
    return null;
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const voiceProcessor = new VoiceCommandProcessor();
export { VoiceCommandProcessor };
export default voiceProcessor;
