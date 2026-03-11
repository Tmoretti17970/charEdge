// ═══════════════════════════════════════════════════════════════════
// Per-Symbol Depth State
//
// Manages order book state, analytics (imbalance ratio), and
// spoofing detection for a single symbol.
// ═══════════════════════════════════════════════════════════════════

import { TypedOrderBookSide } from './TypedOrderBookSide.ts';
import { MAX_LEVELS } from './depthConstants.ts';

export class DepthState {
  symbol: string;
  bids: TypedOrderBookSide;
  asks: TypedOrderBookSide;
  lastUpdate: number;
  imbalanceRatio: number;
  bidWallPrice: number | null;
  askWallPrice: number | null;
  totalBidDepth: number;
  totalAskDepth: number;
  spoofAlerts: unknown[];
  totalUpdates: number;

  private _prevBids: Map<number, number> | null;
  private _prevAsks: Map<number, number> | null;
  private _spoofCooldown: number;

  constructor(symbol: string) {
    this.symbol = symbol;
    this.bids = new TypedOrderBookSide(MAX_LEVELS, true);   // descending
    this.asks = new TypedOrderBookSide(MAX_LEVELS, false);  // ascending
    this.lastUpdate = 0;

    this.imbalanceRatio = 0.5;
    this.bidWallPrice = null;
    this.askWallPrice = null;
    this.totalBidDepth = 0;
    this.totalAskDepth = 0;

    this._prevBids = null;
    this._prevAsks = null;
    this.spoofAlerts = [];
    this._spoofCooldown = 0;

    this.totalUpdates = 0;
  }

  update(bidArray: [string, string][], askArray: [string, string][]): void {
    if (this.bids.count > 0) {
      this._prevBids = this.bids.toMap();
      this._prevAsks = this.asks.toMap();
    }

    const bidStats = this.bids.updateFromArray(bidArray);
    const askStats = this.asks.updateFromArray(askArray);

    this.totalBidDepth = bidStats.totalQty;
    this.totalAskDepth = askStats.totalQty;
    this.bidWallPrice = bidStats.wallPrice;
    this.askWallPrice = askStats.wallPrice;

    const total = this.totalBidDepth + this.totalAskDepth;
    this.imbalanceRatio = total > 0 ? this.totalBidDepth / total : 0.5;

    if (this._prevBids) {
      this._detectSpoofing();
    }

    this.lastUpdate = Date.now();
    this.totalUpdates++;
  }

  private _detectSpoofing(): void {
    if (Date.now() - this._spoofCooldown < 5000) return;

    const threshold = this.totalBidDepth * 0.05;

    for (const [price, qty] of this._prevBids!) {
      if (qty > threshold && !this.bids.has(price)) {
        this.spoofAlerts.push({
          time: Date.now(), side: 'bid', price, quantity: qty, type: 'large_bid_removed',
        });
        this._spoofCooldown = Date.now();
      }
    }

    for (const [price, qty] of this._prevAsks!) {
      if (qty > threshold && !this.asks.has(price)) {
        this.spoofAlerts.push({
          time: Date.now(), side: 'ask', price, quantity: qty, type: 'large_ask_removed',
        });
        this._spoofCooldown = Date.now();
      }
    }

    if (this.spoofAlerts.length > 50) {
      this.spoofAlerts = this.spoofAlerts.slice(-50);
    }
  }

  getSnapshot() {
    const bidSnap = this.bids.getSnapshot();
    const askSnap = this.asks.getSnapshot();
    const bestBid = this.bids.bestPrice();
    const bestAsk = this.asks.bestPrice();
    const hasBoth = bestBid > 0 && bestAsk > 0;

    return {
      bids: bidSnap,
      asks: askSnap,
      spread: hasBoth ? bestAsk - bestBid : 0,
      spreadPct: hasBoth ? ((bestAsk - bestBid) / bestBid) * 100 : 0,
      midPrice: hasBoth ? (bestAsk + bestBid) / 2 : 0,
      imbalanceRatio: this.imbalanceRatio,
      imbalanceLabel: this.imbalanceRatio > 0.6 ? 'buy_pressure' : this.imbalanceRatio < 0.4 ? 'sell_pressure' : 'balanced',
      bidWallPrice: this.bidWallPrice,
      askWallPrice: this.askWallPrice,
      totalBidDepth: this.totalBidDepth,
      totalAskDepth: this.totalAskDepth,
      spoofAlerts: this.spoofAlerts.slice(-5),
      time: this.lastUpdate,
    };
  }
}
