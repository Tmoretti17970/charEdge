// ═══════════════════════════════════════════════════════════════════
// charEdge — SecurityMaster (Task 2.4.1)
//
// Canonical instrument identifier system. Normalizes different
// representations of the same asset ("BTCUSDT", "BTC/USDT",
// "BTC-USD", "btcusdt") into a single canonical ID.
//
// Usage:
//   const id = securityMaster.normalize('BTC/USDT');  // → 'BTCUSDT'
//   const info = securityMaster.resolve('btc-usd');
//   // → { id: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', type: 'crypto' }
//
// ═══════════════════════════════════════════════════════════════════

// ─── Types ─────────────────────────────────────────────────────

export type AssetType = 'crypto' | 'forex' | 'equity' | 'index' | 'commodity';

export interface InstrumentInfo {
  id: string;          // Canonical ID (e.g. 'BTCUSDT')
  baseAsset: string;   // Base asset (e.g. 'BTC')
  quoteAsset: string;  // Quote asset (e.g. 'USDT')
  type: AssetType;
  exchange?: string;   // Primary exchange
  displayName?: string; // Human-readable name
}

// ─── SecurityMaster ────────────────────────────────────────────

class _SecurityMaster {
  /** canonical ID → InstrumentInfo */
  private _instruments: Map<string, InstrumentInfo> = new Map();

  /** alias → canonical ID (lowercase alias → canonical) */
  private _aliases: Map<string, string> = new Map();

  constructor() {
    this._seedDefaults();
  }

  // ── Core API ───────────────────────────────────────────────

  /**
   * Normalize any symbol representation to canonical form.
   * Strips separators, uppercases, collapses known aliases.
   */
  normalize(rawSymbol: string): string {
    if (!rawSymbol) return '';

    // Strip common separators and uppercase
    const cleaned = rawSymbol
      .toUpperCase()
      .replace(/[\/\-_.\s]/g, '');

    // Check alias map
    const alias = this._aliases.get(cleaned.toLowerCase());
    if (alias) return alias;

    // Check if it matches a known canonical ID directly
    if (this._instruments.has(cleaned)) return cleaned;

    return cleaned;
  }

  /**
   * Get instrument info by canonical ID.
   */
  getInfo(canonicalId: string): InstrumentInfo | null {
    return this._instruments.get(canonicalId) || null;
  }

  /**
   * Resolve any symbol representation to full InstrumentInfo.
   */
  resolve(anySymbol: string): InstrumentInfo | null {
    const canonical = this.normalize(anySymbol);
    return this._instruments.get(canonical) || null;
  }

  /**
   * Register a new instrument with aliases.
   */
  register(
    canonicalId: string,
    aliases: string[],
    info: Omit<InstrumentInfo, 'id'>,
  ): void {
    const fullInfo: InstrumentInfo = { ...info, id: canonicalId };
    this._instruments.set(canonicalId, fullInfo);

    // Register aliases (lowercase for case-insensitive lookup)
    this._aliases.set(canonicalId.toLowerCase(), canonicalId);
    for (const alias of aliases) {
      this._aliases.set(alias.toLowerCase().replace(/[\/\-_.\s]/g, ''), canonicalId);
    }
  }

  /**
   * Check if a symbol is known.
   */
  isKnown(symbol: string): boolean {
    const canonical = this.normalize(symbol);
    return this._instruments.has(canonical);
  }

  /**
   * Get the asset type for a symbol.
   */
  getType(symbol: string): AssetType | null {
    const info = this.resolve(symbol);
    return info?.type || null;
  }

  /**
   * Get all known instruments of a specific type.
   */
  getByType(type: AssetType): InstrumentInfo[] {
    const result: InstrumentInfo[] = [];
    for (const info of this._instruments.values()) {
      if (info.type === type) result.push(info);
    }
    return result;
  }

  /**
   * Get all known canonical IDs.
   */
  getAllIds(): string[] {
    return [...this._instruments.keys()];
  }

  /**
   * Get total count of registered instruments.
   */
  get count(): number {
    return this._instruments.size;
  }

  // ── Default Instruments ────────────────────────────────────

  /** @private */
  private _seedDefaults(): void {
    // ── Top Crypto Pairs ──
    const cryptoPairs: Array<{
      id: string;
      base: string;
      quote: string;
      aliases: string[];
      display?: string;
    }> = [
      { id: 'BTCUSDT', base: 'BTC', quote: 'USDT', aliases: ['BTC/USDT', 'BTC-USDT', 'BTC-USD', 'BTCUSD', 'XBTUSD'], display: 'Bitcoin' },
      { id: 'ETHUSDT', base: 'ETH', quote: 'USDT', aliases: ['ETH/USDT', 'ETH-USDT', 'ETH-USD', 'ETHUSD'], display: 'Ethereum' },
      { id: 'SOLUSDT', base: 'SOL', quote: 'USDT', aliases: ['SOL/USDT', 'SOL-USDT', 'SOL-USD', 'SOLUSD'], display: 'Solana' },
      { id: 'XRPUSDT', base: 'XRP', quote: 'USDT', aliases: ['XRP/USDT', 'XRP-USDT', 'XRP-USD', 'XRPUSD'], display: 'Ripple' },
      { id: 'BNBUSDT', base: 'BNB', quote: 'USDT', aliases: ['BNB/USDT', 'BNB-USDT', 'BNB-USD', 'BNBUSD'], display: 'BNB' },
      { id: 'ADAUSDT', base: 'ADA', quote: 'USDT', aliases: ['ADA/USDT', 'ADA-USDT', 'ADA-USD', 'ADAUSD'], display: 'Cardano' },
      { id: 'DOGEUSDT', base: 'DOGE', quote: 'USDT', aliases: ['DOGE/USDT', 'DOGE-USDT', 'DOGE-USD', 'DOGEUSD'], display: 'Dogecoin' },
      { id: 'AVAXUSDT', base: 'AVAX', quote: 'USDT', aliases: ['AVAX/USDT', 'AVAX-USDT'], display: 'Avalanche' },
      { id: 'DOTUSDT', base: 'DOT', quote: 'USDT', aliases: ['DOT/USDT', 'DOT-USDT'], display: 'Polkadot' },
      { id: 'LINKUSDT', base: 'LINK', quote: 'USDT', aliases: ['LINK/USDT', 'LINK-USDT'], display: 'Chainlink' },
      { id: 'MATICUSDT', base: 'MATIC', quote: 'USDT', aliases: ['MATIC/USDT', 'MATIC-USDT', 'POLUSDT', 'POL/USDT'], display: 'Polygon' },
      { id: 'ATOMUSDT', base: 'ATOM', quote: 'USDT', aliases: ['ATOM/USDT', 'ATOM-USDT'], display: 'Cosmos' },
      { id: 'UNIUSDT', base: 'UNI', quote: 'USDT', aliases: ['UNI/USDT', 'UNI-USDT'], display: 'Uniswap' },
      { id: 'LTCUSDT', base: 'LTC', quote: 'USDT', aliases: ['LTC/USDT', 'LTC-USDT', 'LTC-USD', 'LTCUSD'], display: 'Litecoin' },
      { id: 'NEARUSDT', base: 'NEAR', quote: 'USDT', aliases: ['NEAR/USDT', 'NEAR-USDT'], display: 'NEAR Protocol' },
      { id: 'APTUSDT', base: 'APT', quote: 'USDT', aliases: ['APT/USDT', 'APT-USDT'], display: 'Aptos' },
      { id: 'SUIUSDT', base: 'SUI', quote: 'USDT', aliases: ['SUI/USDT', 'SUI-USDT'], display: 'Sui' },
      { id: 'ARBUSDT', base: 'ARB', quote: 'USDT', aliases: ['ARB/USDT', 'ARB-USDT'], display: 'Arbitrum' },
      { id: 'OPUSDT', base: 'OP', quote: 'USDT', aliases: ['OP/USDT', 'OP-USDT'], display: 'Optimism' },
      { id: 'TRXUSDT', base: 'TRX', quote: 'USDT', aliases: ['TRX/USDT', 'TRX-USDT'], display: 'Tron' },
      { id: 'AAVEUSDT', base: 'AAVE', quote: 'USDT', aliases: ['AAVE/USDT', 'AAVE-USDT'], display: 'Aave' },
      { id: 'MKRUSDT', base: 'MKR', quote: 'USDT', aliases: ['MKR/USDT', 'MKR-USDT'], display: 'Maker' },
      { id: 'INJUSDT', base: 'INJ', quote: 'USDT', aliases: ['INJ/USDT', 'INJ-USDT'], display: 'Injective' },
      { id: 'FILUSDT', base: 'FIL', quote: 'USDT', aliases: ['FIL/USDT', 'FIL-USDT'], display: 'Filecoin' },
      { id: 'PEPEUSDT', base: 'PEPE', quote: 'USDT', aliases: ['PEPE/USDT', 'PEPE-USDT'], display: 'Pepe' },
    ];

    for (const pair of cryptoPairs) {
      this.register(pair.id, pair.aliases, {
        baseAsset: pair.base,
        quoteAsset: pair.quote,
        type: 'crypto',
        exchange: 'binance',
        displayName: pair.display,
      });
    }

    // ── Major Forex ──
    const forexPairs = [
      { id: 'EURUSD', base: 'EUR', quote: 'USD', aliases: ['EUR/USD', 'EUR-USD'] },
      { id: 'GBPUSD', base: 'GBP', quote: 'USD', aliases: ['GBP/USD', 'GBP-USD'] },
      { id: 'USDJPY', base: 'USD', quote: 'JPY', aliases: ['USD/JPY', 'USD-JPY'] },
      { id: 'AUDUSD', base: 'AUD', quote: 'USD', aliases: ['AUD/USD', 'AUD-USD'] },
      { id: 'USDCAD', base: 'USD', quote: 'CAD', aliases: ['USD/CAD', 'USD-CAD'] },
      { id: 'USDCHF', base: 'USD', quote: 'CHF', aliases: ['USD/CHF', 'USD-CHF'] },
      { id: 'NZDUSD', base: 'NZD', quote: 'USD', aliases: ['NZD/USD', 'NZD-USD'] },
    ];

    for (const pair of forexPairs) {
      this.register(pair.id, pair.aliases, {
        baseAsset: pair.base,
        quoteAsset: pair.quote,
        type: 'forex',
      });
    }

    // ── Major Indices ──
    const indices = [
      { id: 'SPX', aliases: ['S&P500', 'SP500', '.SPX', 'SPY'], display: 'S&P 500' },
      { id: 'NDX', aliases: ['NASDAQ', 'QQQ', '.NDX', 'NQ'], display: 'Nasdaq 100' },
      { id: 'DJI', aliases: ['DJIA', 'DOW', '.DJI', 'DIA'], display: 'Dow Jones' },
    ];

    for (const idx of indices) {
      this.register(idx.id, idx.aliases, {
        baseAsset: idx.id,
        quoteAsset: 'USD',
        type: 'index',
        displayName: idx.display,
      });
    }

    // ── Commodities ──
    const commodities = [
      { id: 'XAUUSD', aliases: ['GOLD', 'GC', 'XAU/USD'], display: 'Gold' },
      { id: 'XAGUSD', aliases: ['SILVER', 'SI', 'XAG/USD'], display: 'Silver' },
      { id: 'WTIUSD', aliases: ['OIL', 'CL', 'WTI', 'CRUDE'], display: 'Crude Oil' },
    ];

    for (const com of commodities) {
      this.register(com.id, com.aliases, {
        baseAsset: com.id.slice(0, 3),
        quoteAsset: 'USD',
        type: 'commodity',
        displayName: com.display,
      });
    }
  }
}

// ─── Singleton + Exports ──────────────────────────────────────

export const SecurityMaster = _SecurityMaster;
export const securityMaster = new _SecurityMaster();
export default securityMaster;
