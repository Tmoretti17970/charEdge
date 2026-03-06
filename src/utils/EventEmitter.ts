// ═══════════════════════════════════════════════════════════════════
// charEdge — Lightweight EventEmitter
//
// Browser-compatible typed event emitter. Used by ReplayEngine
// and other non-DOM components that need pub/sub.
// ═══════════════════════════════════════════════════════════════════

type Listener = (...args: any[]) => void;

export class EventEmitter {
    private listeners: Map<string, Set<Listener>> = new Map();

    on(event: string, listener: Listener): this {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(listener);
        return this;
    }

    off(event: string, listener: Listener): this {
        this.listeners.get(event)?.delete(listener);
        return this;
    }

    once(event: string, listener: Listener): this {
        const wrapper = (...args: any[]) => {
            this.off(event, wrapper);
            listener(...args);
        };
        return this.on(event, wrapper);
    }

    emit(event: string, ...args: any[]): boolean {
        const set = this.listeners.get(event);
        if (!set || set.size === 0) return false;
        for (const listener of set) {
            try {
                listener(...args);
            } catch (_) {
                /* don't let a listener crash the emitter */
            }
        }
        return true;
    }

    removeAllListeners(event?: string): this {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
        return this;
    }

    listenerCount(event: string): number {
        return this.listeners.get(event)?.size ?? 0;
    }
}
