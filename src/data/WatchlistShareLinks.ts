// ═══════════════════════════════════════════════════════════════════
// charEdge — Watchlist Share Links (Sprint 93)
//
// Encode watchlist symbols into shareable URL links. Decode on
// page load from ?watchlist= query parameter.
//
// Usage:
//   import { watchlistShareLinks } from './WatchlistShareLinks';
//   const url = watchlistShareLinks.encode(['AAPL', 'NVDA', 'TSLA']);
//   const symbols = watchlistShareLinks.decode(url);
// ═══════════════════════════════════════════════════════════════════

// ─── Constants ──────────────────────────────────────────────────

const PARAM_KEY = 'watchlist';
const MAX_URL_LENGTH = 2048;

// ─── Share Links ────────────────────────────────────────────────

class WatchlistShareLinks {
  /**
   * Encode symbols into a shareable URL.
   */
  encode(symbols: string[]): string {
    const clean = symbols
      .filter(Boolean)
      .map(s => s.toUpperCase().trim())
      .filter((s, i, arr) => arr.indexOf(s) === i); // Deduplicate

    if (clean.length === 0) return window.location.origin;

    // Compress: comma-separated, then base64
    const payload = clean.join(',');
    const encoded = this._toBase64(payload);

    const url = new URL(window.location.origin);
    url.searchParams.set(PARAM_KEY, encoded);

    // Check URL length limit
    if (url.toString().length > MAX_URL_LENGTH) {
      // Truncate symbols to fit
      const truncated = clean.slice(0, Math.floor(clean.length * 0.7));
      return this.encode(truncated);
    }

    return url.toString();
  }

  /**
   * Decode symbols from a URL string or current page URL.
   */
  decode(url?: string): string[] | null {
    try {
      const u = new URL(url || window.location.href);
      const encoded = u.searchParams.get(PARAM_KEY);
      if (!encoded) return null;

      const payload = this._fromBase64(encoded);
      const symbols = payload
        .split(',')
        .map(s => s.toUpperCase().trim())
        .filter(s => s.length >= 1 && s.length <= 10 && /^[A-Z0-9./-]+$/.test(s));

      return symbols.length > 0 ? symbols : null;
    } catch {
      return null;
    }
  }

  /**
   * Check if the current URL contains a shared watchlist.
   */
  hasSharedWatchlist(): boolean {
    return this.decode() !== null;
  }

  /**
   * Copy share link to clipboard.
   */
  async copyToClipboard(symbols: string[]): Promise<boolean> {
    try {
      const url = this.encode(symbols);
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear the watchlist param from current URL (after import).
   */
  clearFromURL(): void {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete(PARAM_KEY);
      window.history.replaceState({}, '', url.toString());
    } catch { /* */ }
  }

  // ─── Base64 Helpers ──────────────────────────────────────────

  private _toBase64(str: string): string {
    try {
      return btoa(unescape(encodeURIComponent(str)));
    } catch {
      return btoa(str);
    }
  }

  private _fromBase64(str: string): string {
    try {
      return decodeURIComponent(escape(atob(str)));
    } catch {
      return atob(str);
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────

export const watchlistShareLinks = new WatchlistShareLinks();
export default watchlistShareLinks;
