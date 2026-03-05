// ═══════════════════════════════════════════════════════════════════
// charEdge — GPU Memory Budget Tracker
//
// Tracks WebGL buffer allocations and enforces a memory budget.
// Implements LRU eviction when approaching the budget limit.
//
// Usage:
//   const budget = new GPUMemoryBudget(gpu);
//   budget.allocate('candles', 2048 * 32);
//   budget.allocate('volume', 1024 * 16);
//   budget.getUsage(); // → { used: 65536, budget: 268435456, percent: 0.02 }
// ═══════════════════════════════════════════════════════════════════

export interface AllocationEntry {
    id: string;
    bytes: number;
    lastAccessedAt: number;
    category: string;
}

export interface BudgetStatus {
    usedBytes: number;
    budgetBytes: number;
    usagePercent: number;
    allocationCount: number;
    warningLevel: 'ok' | 'warning' | 'critical';
}

type WarningCallback = (status: BudgetStatus) => void;

interface BudgetConfig {
    /** Maximum GPU memory budget in bytes (default: 256MB) */
    budgetBytes: number;
    /** Percent threshold for warning callback (default: 75) */
    warningThreshold: number;
    /** Percent threshold for critical callback (default: 90) */
    criticalThreshold: number;
}

const DEFAULT_CONFIG: BudgetConfig = {
    budgetBytes: 256 * 1024 * 1024, // 256MB
    warningThreshold: 75,
    criticalThreshold: 90,
};

export class GPUMemoryBudget {
    private config: BudgetConfig;
    private allocations: Map<string, AllocationEntry> = new Map();
    private warningCallbacks: Set<WarningCallback> = new Set();
    private lastWarningLevel: 'ok' | 'warning' | 'critical' = 'ok';

    constructor(config: Partial<BudgetConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Record a GPU buffer allocation.
     * @param id - Unique identifier for this allocation
     * @param bytes - Size in bytes
     * @param category - Category for grouping (e.g., 'candles', 'indicators')
     * @returns true if within budget, false if would exceed
     */
    allocate(id: string, bytes: number, category = 'general'): boolean {
        const existing = this.allocations.get(id);
        const delta = existing ? bytes - existing.bytes : bytes;

        // Check if allocation would exceed budget
        const projectedUsage = this.getUsedBytes() + delta;
        if (projectedUsage > this.config.budgetBytes) {
            // Try LRU eviction
            const freed = this.evictLRU(delta);
            if (this.getUsedBytes() + delta - freed > this.config.budgetBytes) {
                return false; // Still over budget after eviction
            }
        }

        this.allocations.set(id, {
            id,
            bytes,
            lastAccessedAt: performance.now(),
            category,
        });

        this.checkThresholds();
        return true;
    }

    /** Mark an allocation as recently accessed (updates LRU timestamp) */
    touch(id: string): void {
        const entry = this.allocations.get(id);
        if (entry) {
            entry.lastAccessedAt = performance.now();
        }
    }

    /** Release a GPU buffer allocation */
    release(id: string): void {
        this.allocations.delete(id);
        this.checkThresholds();
    }

    /** Get total allocated bytes */
    getUsedBytes(): number {
        let total = 0;
        for (const entry of this.allocations.values()) {
            total += entry.bytes;
        }
        return total;
    }

    /** Get full budget status */
    getStatus(): BudgetStatus {
        const usedBytes = this.getUsedBytes();
        const usagePercent = (usedBytes / this.config.budgetBytes) * 100;

        let warningLevel: 'ok' | 'warning' | 'critical' = 'ok';
        if (usagePercent >= this.config.criticalThreshold) {
            warningLevel = 'critical';
        } else if (usagePercent >= this.config.warningThreshold) {
            warningLevel = 'warning';
        }

        return {
            usedBytes,
            budgetBytes: this.config.budgetBytes,
            usagePercent: Math.round(usagePercent * 100) / 100,
            allocationCount: this.allocations.size,
            warningLevel,
        };
    }

    /** Subscribe to warning level changes */
    onWarning(callback: WarningCallback): () => void {
        this.warningCallbacks.add(callback);
        return () => { this.warningCallbacks.delete(callback); };
    }

    /**
     * Evict least-recently-used allocations to free at least `targetBytes`.
     * @returns Number of bytes freed
     */
    evictLRU(targetBytes: number): number {
        const sorted = [...this.allocations.entries()]
            .sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);

        let freed = 0;
        for (const [id, entry] of sorted) {
            if (freed >= targetBytes) break;
            freed += entry.bytes;
            this.allocations.delete(id);
        }

        return freed;
    }

    /** Get breakdown by category */
    getCategoryBreakdown(): Record<string, { bytes: number; count: number }> {
        const breakdown: Record<string, { bytes: number; count: number }> = {};

        for (const entry of this.allocations.values()) {
            if (!breakdown[entry.category]) {
                breakdown[entry.category] = { bytes: 0, count: 0 };
            }
            breakdown[entry.category]!.bytes += entry.bytes;
            breakdown[entry.category]!.count++;
        }

        return breakdown;
    }

    /** Reset all allocations */
    reset(): void {
        this.allocations.clear();
        this.lastWarningLevel = 'ok';
    }

    private checkThresholds(): void {
        const status = this.getStatus();
        if (status.warningLevel !== this.lastWarningLevel) {
            this.lastWarningLevel = status.warningLevel;
            for (const cb of this.warningCallbacks) {
                cb(status);
            }
        }
    }
}

export const gpuMemoryBudget = new GPUMemoryBudget();
