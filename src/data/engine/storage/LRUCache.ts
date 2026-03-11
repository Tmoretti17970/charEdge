// ═══════════════════════════════════════════════════════════════════
// charEdge — Generic LRU Cache
//
// Sprint 9 #71: Extracted from TimeSeriesStore.ts.
// Map-based LRU with O(1) get/set and automatic eviction.
// ═══════════════════════════════════════════════════════════════════

export class LRUCache<V> {
    private _map = new Map<string, V>();
    private _maxSize: number;

    constructor(maxSize: number) {
        this._maxSize = maxSize;
    }

    get(key: string): V | undefined {
        if (!this._map.has(key)) return undefined;
        const value = this._map.get(key)!;
        this._map.delete(key);
        this._map.set(key, value);
        return value;
    }

    set(key: string, value: V): void {
        if (this._map.has(key)) this._map.delete(key);
        this._map.set(key, value);
        while (this._map.size > this._maxSize) {
            const firstKey = this._map.keys().next().value;
            if (firstKey != null) this._map.delete(firstKey);
        }
    }

    has(key: string): boolean {
        return this._map.has(key);
    }

    delete(key: string): boolean {
        return this._map.delete(key);
    }

    clear(): void {
        this._map.clear();
    }

    get size(): number {
        return this._map.size;
    }

    /** Get all keys for iteration */
    keys(): IterableIterator<string> {
        return this._map.keys();
    }
}
