// ═══════════════════════════════════════════════════════════════════
// charEdge — Battery-Aware Rendering Mode
//
// Reduces rendering intensity when device battery is low:
//   ≥ 20%  → Full mode (60fps, all animations)
//   < 20%  → Reduced mode (30fps, simplified animations)
//   < 10%  → Minimal mode (15fps, no animations, reduced ticks)
//
// Uses the Battery Status API (navigator.getBattery).
// Falls back gracefully on unsupported platforms.
// ═══════════════════════════════════════════════════════════════════

export type BatteryMode = 'full' | 'reduced' | 'minimal';

export interface BatteryStatus {
    mode: BatteryMode;
    level: number;           // 0.0 – 1.0
    charging: boolean;
    targetFps: number;
    animationsEnabled: boolean;
    reducedTicks: boolean;
    supported: boolean;
}

interface BatteryConfig {
    /** Battery level below which reduced mode activates (default: 0.20) */
    reducedThreshold: number;
    /** Battery level below which minimal mode activates (default: 0.10) */
    minimalThreshold: number;
}

const DEFAULT_CONFIG: BatteryConfig = {
    reducedThreshold: 0.20,
    minimalThreshold: 0.10,
};

const MODE_DETAILS: Record<BatteryMode, Omit<BatteryStatus, 'mode' | 'level' | 'charging' | 'supported'>> = {
    full: {
        targetFps: 60,
        animationsEnabled: true,
        reducedTicks: false,
    },
    reduced: {
        targetFps: 30,
        animationsEnabled: true,
        reducedTicks: false,
    },
    minimal: {
        targetFps: 15,
        animationsEnabled: false,
        reducedTicks: true,
    },
};

type BatteryChangeCallback = (status: BatteryStatus) => void;

export class BatteryAware {
    private config: BatteryConfig;
    private currentMode: BatteryMode = 'full';
    private batteryLevel = 1.0;
    private isCharging = true;
    private supported = false;
    private changeCallbacks: Set<BatteryChangeCallback> = new Set();
    private battery: BatteryManager | null = null;

    constructor(config: Partial<BatteryConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Initialize battery monitoring.
     * Returns immediately if Battery API is not available.
     */
    async init(): Promise<void> {
        try {
            if (typeof navigator === 'undefined') return;
            if (!('getBattery' in navigator)) return;

            this.battery = await (navigator as NavigatorWithBattery).getBattery();
            this.supported = true;

            // Read initial state
            this.batteryLevel = this.battery.level;
            this.isCharging = this.battery.charging;
            this.updateMode();

            // Listen for changes
            this.battery.addEventListener('levelchange', () => {
                this.batteryLevel = this.battery!.level;
                this.updateMode();
            });

            this.battery.addEventListener('chargingchange', () => {
                this.isCharging = this.battery!.charging;
                this.updateMode();
            });
        } catch {
            // Battery API not available — stay in full mode
            this.supported = false;
        }
    }

    /** Get current battery-aware rendering status */
    getStatus(): BatteryStatus {
        return {
            mode: this.currentMode,
            level: this.batteryLevel,
            charging: this.isCharging,
            supported: this.supported,
            ...MODE_DETAILS[this.currentMode],
        };
    }

    /** Get the current mode */
    getMode(): BatteryMode {
        return this.currentMode;
    }

    /** Subscribe to mode changes */
    onChange(callback: BatteryChangeCallback): () => void {
        this.changeCallbacks.add(callback);
        return () => { this.changeCallbacks.delete(callback); };
    }

    /** Force a specific mode (for testing/user override) */
    forceMode(mode: BatteryMode): void {
        this.currentMode = mode;
        this.notifyCallbacks();
    }

    private updateMode(): void {
        let newMode: BatteryMode;

        // Always full when charging
        if (this.isCharging) {
            newMode = 'full';
        } else if (this.batteryLevel < this.config.minimalThreshold) {
            newMode = 'minimal';
        } else if (this.batteryLevel < this.config.reducedThreshold) {
            newMode = 'reduced';
        } else {
            newMode = 'full';
        }

        if (newMode !== this.currentMode) {
            this.currentMode = newMode;
            this.notifyCallbacks();
        }
    }

    private notifyCallbacks(): void {
        const status = this.getStatus();
        for (const cb of this.changeCallbacks) {
            cb(status);
        }
    }
}

// ─── Battery Manager Type (not all browsers expose this) ────────

interface BatteryManager extends EventTarget {
    charging: boolean;
    level: number;
    chargingTime: number;
    dischargingTime: number;
}

interface NavigatorWithBattery extends Navigator {
    getBattery(): Promise<BatteryManager>;
}

export const batteryAware = new BatteryAware();
