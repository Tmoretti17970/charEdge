// ═══════════════════════════════════════════════════════════════════
// charEdge — LOD (Level of Detail) Manager
//
// Zoom-adaptive rendering that reduces detail as bars shrink.
// Thresholds based on barSpacing (pixels per bar):
//
//   Level 0  (≥8px)  — Full candles: body, wicks, shadows, fills
//   Level 1  (4–8px) — Simplified bars: body + thin wick, no fills
//   Level 2  (2–4px) — Dots: single-pixel color-coded points
//   Level 3  (<2px)  — Blocks: aggregated N-bar summary rectangles
// ═══════════════════════════════════════════════════════════════════

export type LODLevel = 0 | 1 | 2 | 3;

export interface LODConfig {
    /** Render mode for current LOD level */
    level: LODLevel;
    /** Human-readable label */
    label: string;
    /** Whether to draw candle wicks */
    drawWicks: boolean;
    /** Whether to draw candle body fills/gradients */
    drawBodyFills: boolean;
    /** Whether to draw volume bars */
    drawVolume: boolean;
    /** Whether to draw indicator overlays */
    drawIndicators: boolean;
    /** Whether to use instanced rendering (vs aggregated) */
    instanced: boolean;
    /** Number of bars to aggregate at this LOD (1 = no aggregation) */
    aggregationFactor: number;
    /** Minimum pixel width for a bar at this level */
    minBarWidth: number;
}

interface LODThresholds {
    /** barSpacing above which Level 0 is used (default: 8) */
    fullDetail: number;
    /** barSpacing above which Level 1 is used (default: 4) */
    simplifiedBars: number;
    /** barSpacing above which Level 2 is used (default: 2) */
    dots: number;
    /** Hysteresis band to prevent rapid switching (default: 0.5px) */
    hysteresis: number;
}

const DEFAULT_THRESHOLDS: LODThresholds = {
    fullDetail: 8,
    simplifiedBars: 4,
    dots: 2,
    hysteresis: 0.5,
};

const LOD_CONFIGS: Record<LODLevel, Omit<LODConfig, 'level'>> = {
    0: {
        label: 'Full Candles',
        drawWicks: true,
        drawBodyFills: true,
        drawVolume: true,
        drawIndicators: true,
        instanced: true,
        aggregationFactor: 1,
        minBarWidth: 3,
    },
    1: {
        label: 'Simplified Bars',
        drawWicks: true,
        drawBodyFills: false,
        drawVolume: true,
        drawIndicators: true,
        instanced: true,
        aggregationFactor: 1,
        minBarWidth: 1,
    },
    2: {
        label: 'Dots',
        drawWicks: false,
        drawBodyFills: false,
        drawVolume: false,
        drawIndicators: false,
        instanced: true,
        aggregationFactor: 1,
        minBarWidth: 1,
    },
    3: {
        label: 'Aggregated Blocks',
        drawWicks: false,
        drawBodyFills: false,
        drawVolume: false,
        drawIndicators: false,
        instanced: true,
        aggregationFactor: 4,
        minBarWidth: 1,
    },
};

export class LODManager {
    private thresholds: LODThresholds;
    private currentLevel: LODLevel = 0;
    private transitionCallbacks: Set<(config: LODConfig) => void> = new Set();

    constructor(thresholds: Partial<LODThresholds> = {}) {
        this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    }

    /**
     * Determine the LOD level for a given barSpacing.
     * Uses hysteresis to prevent rapid switching at boundaries.
     */
    computeLevel(barSpacing: number): LODConfig {
        const t = this.thresholds;
        let newLevel: LODLevel;

        // Add hysteresis: when transitioning UP, require crossing threshold + hysteresis
        // When transitioning DOWN, use threshold directly
        const h = t.hysteresis;

        if (barSpacing >= t.fullDetail + (this.currentLevel > 0 ? h : 0)) {
            newLevel = 0;
        } else if (barSpacing >= t.simplifiedBars + (this.currentLevel > 1 ? h : 0)) {
            newLevel = 1;
        } else if (barSpacing >= t.dots + (this.currentLevel > 2 ? h : 0)) {
            newLevel = 2;
        } else {
            newLevel = 3;
        }

        const levelChanged = newLevel !== this.currentLevel;
        this.currentLevel = newLevel;

        const config: LODConfig = {
            level: newLevel,
            ...LOD_CONFIGS[newLevel],
        };

        if (levelChanged) {
            for (const cb of this.transitionCallbacks) {
                cb(config);
            }
        }

        return config;
    }

    /** Get current LOD level */
    getLevel(): LODLevel {
        return this.currentLevel;
    }

    /** Get config for current level */
    getConfig(): LODConfig {
        return { level: this.currentLevel, ...LOD_CONFIGS[this.currentLevel] };
    }

    /** Subscribe to LOD level changes */
    onTransition(callback: (config: LODConfig) => void): () => void {
        this.transitionCallbacks.add(callback);
        return () => { this.transitionCallbacks.delete(callback); };
    }

    /** Force a specific LOD level (for testing/debugging) */
    forceLevel(level: LODLevel): LODConfig {
        this.currentLevel = level;
        const config: LODConfig = { level, ...LOD_CONFIGS[level] };
        for (const cb of this.transitionCallbacks) {
            cb(config);
        }
        return config;
    }
}

export const lodManager = new LODManager();
