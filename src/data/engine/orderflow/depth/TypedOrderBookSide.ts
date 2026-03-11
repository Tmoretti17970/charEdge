// ═══════════════════════════════════════════════════════════════════
// TypedArray Sorted Order Book Side
//
// High-performance order book side (bid or ask).
// Uses paired Float64Arrays for prices and quantities — always kept sorted.
// Binary search insert / remove — O(log n) per level update.
// ═══════════════════════════════════════════════════════════════════

export class TypedOrderBookSide {
  _capacity: number;
  _prices: Float64Array;
  _quantities: Float64Array;
  _count: number;
  _descending: boolean;

  constructor(capacity: number, descending = false) {
    this._capacity = capacity;
    this._prices = new Float64Array(capacity);
    this._quantities = new Float64Array(capacity);
    this._count = 0;
    this._descending = descending;
  }

  /**
   * Full replacement update from an array of [priceStr, qtyStr] pairs.
   * This is the hot path — called on every WS depth message.
   */
  updateFromArray(entries: [string, string][]): { totalQty: number; wallPrice: number } {
    this._count = 0;
    let totalQty = 0;
    let maxQty = 0;
    let wallPrice = 0;

    const limit = Math.min(entries.length, this._capacity);

    for (let i = 0; i < limit; i++) {
      const price = parseFloat(entries[i][0]);
      const qty = parseFloat(entries[i][1]);
      if (qty <= 0 || !isFinite(price) || !isFinite(qty)) continue;

      this._prices[this._count] = price;
      this._quantities[this._count] = qty;
      this._count++;
      totalQty += qty;
      if (qty > maxQty) { maxQty = qty; wallPrice = price; }
    }

    this._sortInPlace();

    return { totalQty, wallPrice };
  }

  /**
   * In-place insertion sort — fast for nearly-sorted data from exchanges.
   */
  _sortInPlace(): void {
    const n = this._count;
    const desc = this._descending;

    for (let i = 1; i < n; i++) {
      const keyP = this._prices[i];
      const keyQ = this._quantities[i];
      let j = i - 1;

      while (j >= 0 && (desc ? this._prices[j] < keyP : this._prices[j] > keyP)) {
        this._prices[j + 1] = this._prices[j];
        this._quantities[j + 1] = this._quantities[j];
        j--;
      }
      this._prices[j + 1] = keyP;
      this._quantities[j + 1] = keyQ;
    }
  }

  /**
   * Get snapshot as array of { price, qty, cumQty } — pre-sorted, pre-cumulated.
   */
  getSnapshot(): { price: number; qty: number; cumQty: number }[] {
    const levels = new Array(this._count);
    let cum = 0;
    for (let i = 0; i < this._count; i++) {
      cum += this._quantities[i];
      levels[i] = {
        price: this._prices[i],
        qty: this._quantities[i],
        cumQty: cum,
      };
    }
    return levels;
  }

  bestPrice(): number {
    return this._count > 0 ? this._prices[0] : 0;
  }

  totalQuantity(): number {
    let sum = 0;
    for (let i = 0; i < this._count; i++) sum += this._quantities[i];
    return sum;
  }

  get count(): number { return this._count; }

  priceAt(i: number): number { return i < this._count ? this._prices[i] : 0; }
  qtyAt(i: number): number { return i < this._count ? this._quantities[i] : 0; }

  toMap(): Map<number, number> {
    const m = new Map<number, number>();
    for (let i = 0; i < this._count; i++) {
      m.set(this._prices[i], this._quantities[i]);
    }
    return m;
  }

  has(price: number): boolean {
    for (let i = 0; i < this._count; i++) {
      if (this._prices[i] === price) return true;
    }
    return false;
  }
}
