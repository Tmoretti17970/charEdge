// ═══════════════════════════════════════════════════════════════════
// charEdge — Per-Indicator Dirty Flags (Phase 5)
// Tracks which indicators need recomputation, enabling skip of
// unchanged indicators during render cycles.
// ═══════════════════════════════════════════════════════════════════

export type DirtyReason =
    | 'params_changed'
    | 'bars_appended'
    | 'bars_prepended'
    | 'source_changed'
    | 'visibility_changed'
    | 'style_changed'
    | 'forced';

interface DirtyEntry {
    reasons: Set<DirtyReason>;
    timestamp: number;
}

/**
 * DirtyTracker — per-indicator dirty flag manager.
 *
 * Tracks which indicators need recomputation and why.
 * Integrates with indicatorSlice — mutating actions call markDirty().
 * The compute loop only recomputes dirty indicators.
 */
export class DirtyTracker {
    private _flags = new Map<number, DirtyEntry>();
    private _globalDirty = false;

    /** Mark a specific indicator as dirty. */
    markDirty(idx: number, reason: DirtyReason): void {
        const existing = this._flags.get(idx);
        if (existing) {
            existing.reasons.add(reason);
            existing.timestamp = Date.now();
        } else {
            this._flags.set(idx, {
                reasons: new Set([reason]),
                timestamp: Date.now(),
            });
        }
    }

    /** Mark ALL indicators as dirty (e.g., new bars appended). */
    markAllDirty(reason: DirtyReason): void {
        this._globalDirty = true;
        this._globalReason = reason;
    }
    private _globalReason: DirtyReason = 'forced';

    /** Check if an indicator needs recomputation. */
    isDirty(idx: number): boolean {
        return this._globalDirty || this._flags.has(idx);
    }

    /** Check if a specific reason is flagged. */
    hasDirtyReason(idx: number, reason: DirtyReason): boolean {
        if (this._globalDirty && this._globalReason === reason) return true;
        const entry = this._flags.get(idx);
        return entry ? entry.reasons.has(reason) : false;
    }

    /** Get all dirty reasons for an indicator. */
    getReasons(idx: number): DirtyReason[] {
        const reasons: DirtyReason[] = [];
        if (this._globalDirty) reasons.push(this._globalReason);
        const entry = this._flags.get(idx);
        if (entry) reasons.push(...entry.reasons);
        return reasons;
    }

    /** Check if only style changed (no recompute needed, just redraw). */
    isStyleOnly(idx: number): boolean {
        if (this._globalDirty) return false;
        const entry = this._flags.get(idx);
        if (!entry) return false;
        return entry.reasons.size === 1 && entry.reasons.has('style_changed');
    }

    /** Clear dirty flag for a specific indicator. */
    clear(idx: number): void {
        this._flags.delete(idx);
    }

    /** Clear all dirty flags (call after full compute cycle). */
    clearAll(): void {
        this._flags.clear();
        this._globalDirty = false;
    }

    /** Get count of dirty indicators. */
    get dirtyCount(): number {
        return this._globalDirty ? Infinity : this._flags.size;
    }

    /** Get all dirty indicator indices. */
    get dirtyIndices(): number[] {
        return Array.from(this._flags.keys());
    }
}

/** Singleton instance for the application. */
export const dirtyTracker = new DirtyTracker();
