// ═══════════════════════════════════════════════════════════════════
// charEdge — MiniEmitter (isomorphic EventEmitter)
//
// Tiny event emitter compatible with both Node and browser.
// Used by D1/D2/D3 services so they can run client-side without
// polyfilling Node's 'events' module.
// ═══════════════════════════════════════════════════════════════════

export class MiniEmitter {
    private _handlers: Map<string, Set<Function>> = new Map();

    on(event: string, handler: Function): this {
        let set = this._handlers.get(event);
        if (!set) { set = new Set(); this._handlers.set(event, set); }
        set.add(handler);
        return this;
    }

    off(event: string, handler: Function): this {
        this._handlers.get(event)?.delete(handler);
        return this;
    }

    emit(event: string, ...args: unknown[]): boolean {
        const set = this._handlers.get(event);
        if (!set || set.size === 0) return false;
        for (const fn of set) fn(...args);
        return true;
    }

    removeAllListeners(): this {
        this._handlers.clear();
        return this;
    }
}

export default MiniEmitter;
