// ═══════════════════════════════════════════════════════════════════
// charEdge — Animation Budget Enforcement (P2-8)
//
// Tracks active CSS animations/transitions and enforces a maximum
// concurrent animation count to prevent jank on lower-end devices.
// Respects prefers-reduced-motion automatically.
// ═══════════════════════════════════════════════════════════════════

import { logger } from './logger.js';

// ─── Types ───────────────────────────────────────────────────────

interface AnimationBudgetConfig {
    /** Maximum concurrent CSS animations allowed (default: 8) */
    maxConcurrentAnimations: number;
    /** Whether to automatically suppress animations when budget exceeded */
    autoSuppress: boolean;
    /** CSS class added to body when animations are suppressed */
    suppressClass: string;
}

// ─── Default Config ──────────────────────────────────────────────

const DEFAULT_CONFIG: AnimationBudgetConfig = {
    maxConcurrentAnimations: 8,
    autoSuppress: true,
    suppressClass: 'animations-suppressed',
};

// ─── Animation Budget Manager ────────────────────────────────────

class _AnimationBudget {
    private _config: AnimationBudgetConfig;
    private _activeCount = 0;
    private _suppressed = false;
    private _prefersReduced = false;
    private _mediaQuery: MediaQueryList | null = null;
    private _listeners = new Set<(stats: AnimationStats) => void>();
    private _started = false;

    constructor(config?: Partial<AnimationBudgetConfig>) {
        this._config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Start monitoring animations.
     * Sets up animation event listeners and prefers-reduced-motion detection.
     */
    start(): void {
        if (this._started || typeof document === 'undefined') return;
        this._started = true;

        // Detect prefers-reduced-motion
        if (typeof window !== 'undefined' && window.matchMedia) {
            this._mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            this._prefersReduced = this._mediaQuery.matches;
            this._mediaQuery.addEventListener('change', (e) => {
                this._prefersReduced = e.matches;
                if (this._prefersReduced) this._suppress();
                else this._unsuppress();
            });

            // Immediately suppress if user prefers reduced motion
            if (this._prefersReduced) {
                this._suppress();
            }
        }

        // Track animation start/end globally
        document.addEventListener('animationstart', this._onAnimStart);
        document.addEventListener('animationend', this._onAnimEnd);
        document.addEventListener('animationcancel', this._onAnimEnd);
        document.addEventListener('transitionstart', this._onAnimStart);
        document.addEventListener('transitionend', this._onAnimEnd);
        document.addEventListener('transitioncancel', this._onAnimEnd);
    }

    /**
     * Stop monitoring.
     */
    stop(): void {
        if (!this._started) return;
        this._started = false;

        document.removeEventListener('animationstart', this._onAnimStart);
        document.removeEventListener('animationend', this._onAnimEnd);
        document.removeEventListener('animationcancel', this._onAnimEnd);
        document.removeEventListener('transitionstart', this._onAnimStart);
        document.removeEventListener('transitionend', this._onAnimEnd);
        document.removeEventListener('transitioncancel', this._onAnimEnd);
    }

    /**
     * Set the animation budget.
     */
    setBudget(maxConcurrent: number): void {
        this._config.maxConcurrentAnimations = maxConcurrent;
        this._checkBudget();
    }

    /**
     * Get current animation stats.
     */
    getStats(): AnimationStats {
        return {
            activeAnimations: this._activeCount,
            budget: this._config.maxConcurrentAnimations,
            suppressed: this._suppressed,
            prefersReducedMotion: this._prefersReduced,
            utilizationPct: this._config.maxConcurrentAnimations > 0
                ? this._activeCount / this._config.maxConcurrentAnimations
                : 0,
        };
    }

    /**
     * Subscribe to budget pressure events.
     */
    onBudgetChange(callback: (stats: AnimationStats) => void): () => void {
        this._listeners.add(callback);
        return () => this._listeners.delete(callback);
    }

    /**
     * Check if a new animation is allowed.
     */
    isAllowed(): boolean {
        if (this._prefersReduced) return false;
        return this._activeCount < this._config.maxConcurrentAnimations;
    }

    // ─── Internal ──────────────────────────────────────────────────

    private _onAnimStart = (): void => {
        this._activeCount++;
        this._checkBudget();
    };

    private _onAnimEnd = (): void => {
        this._activeCount = Math.max(0, this._activeCount - 1);
        // Unsuppress when back under budget
        if (this._suppressed && this._activeCount < this._config.maxConcurrentAnimations && !this._prefersReduced) {
            this._unsuppress();
        }
        this._emit();
    };

    private _checkBudget(): void {
        if (this._activeCount >= this._config.maxConcurrentAnimations && this._config.autoSuppress) {
            this._suppress();
        }
        this._emit();
    }

    private _suppress(): void {
        if (this._suppressed) return;
        this._suppressed = true;
        if (typeof document !== 'undefined') {
            document.body.classList.add(this._config.suppressClass);
        }
        logger.ui.debug(`Animation budget exceeded (${this._activeCount}/${this._config.maxConcurrentAnimations}), suppressing`);
    }

    private _unsuppress(): void {
        if (!this._suppressed) return;
        this._suppressed = false;
        if (typeof document !== 'undefined') {
            document.body.classList.remove(this._config.suppressClass);
        }
    }

    private _emit(): void {
        const stats = this.getStats();
        for (const listener of this._listeners) {
            try { listener(stats); } catch { /* swallow */ }
        }
    }
}

// ─── Types ───────────────────────────────────────────────────────

export interface AnimationStats {
    activeAnimations: number;
    budget: number;
    suppressed: boolean;
    prefersReducedMotion: boolean;
    utilizationPct: number;
}

// ─── Singleton ───────────────────────────────────────────────────

export const animationBudget = new _AnimationBudget();
export default animationBudget;
