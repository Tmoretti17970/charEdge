// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Keyboard Navigation
//
// Keyboard-driven chart interaction for accessibility:
//   ← → : Move crosshair left/right by one bar
//   ↑ ↓ : Move crosshair up/down by price step
//   Enter: Open bar detail popup
//   Escape: Dismiss popups / exit drawing mode
//   + / = : Zoom in
//   - / _ : Zoom out
//   Home  : Jump to first visible bar
//   End   : Jump to last bar (most recent)
// ═══════════════════════════════════════════════════════════════════

export interface KeyNavCallbacks {
    /** Move crosshair by (dx, dy) bars/price steps */
    onMove?: (dx: number, dy: number) => void;
    /** Open detail for current bar */
    onSelect?: () => void;
    /** Dismiss current popup or mode */
    onDismiss?: () => void;
    /** Zoom in/out by delta (+1 in, -1 out) */
    onZoom?: (delta: number) => void;
    /** Jump to first visible bar */
    onJumpStart?: () => void;
    /** Jump to last (most recent) bar */
    onJumpEnd?: () => void;
}

export interface KeyNavConfig {
    /** Enable/disable keyboard nav (default: true) */
    enabled: boolean;
    /** Bars to skip per keypress with Shift held (default: 10) */
    shiftMultiplier: number;
}

const DEFAULT_CONFIG: KeyNavConfig = {
    enabled: true,
    shiftMultiplier: 10,
};

export class ChartKeyboardNav {
    private config: KeyNavConfig;
    private callbacks: KeyNavCallbacks;
    private boundHandler: ((e: KeyboardEvent) => void) | null = null;
    private target: HTMLElement | null = null;

    constructor(callbacks: KeyNavCallbacks, config: Partial<KeyNavConfig> = {}) {
        this.callbacks = callbacks;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Attach keyboard listeners to a chart container element.
     * The element must be focusable (add tabindex="0" if needed).
     */
    attach(element: HTMLElement): void {
        this.detach();
        this.target = element;

        // Ensure element is focusable
        if (!element.getAttribute('tabindex')) {
            element.setAttribute('tabindex', '0');
        }

        // Add ARIA attributes for accessibility
        if (!element.getAttribute('role')) {
            element.setAttribute('role', 'application');
        }
        if (!element.getAttribute('aria-label')) {
            element.setAttribute('aria-label', 'Interactive price chart. Use arrow keys to navigate, Enter for details.');
        }

        this.boundHandler = this.handleKeyDown.bind(this);
        element.addEventListener('keydown', this.boundHandler);
    }

    /** Detach keyboard listeners */
    detach(): void {
        if (this.target && this.boundHandler) {
            this.target.removeEventListener('keydown', this.boundHandler);
        }
        this.boundHandler = null;
        this.target = null;
    }

    /** Enable/disable keyboard navigation */
    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
    }

    /** Update callbacks */
    setCallbacks(callbacks: Partial<KeyNavCallbacks>): void {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    private handleKeyDown(e: KeyboardEvent): void {
        if (!this.config.enabled) return;

        const multiplier = e.shiftKey ? this.config.shiftMultiplier : 1;

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                this.callbacks.onMove?.(-1 * multiplier, 0);
                break;

            case 'ArrowRight':
                e.preventDefault();
                this.callbacks.onMove?.(1 * multiplier, 0);
                break;

            case 'ArrowUp':
                e.preventDefault();
                this.callbacks.onMove?.(0, -1 * multiplier);
                break;

            case 'ArrowDown':
                e.preventDefault();
                this.callbacks.onMove?.(0, 1 * multiplier);
                break;

            case 'Enter':
                e.preventDefault();
                this.callbacks.onSelect?.();
                break;

            case 'Escape':
                e.preventDefault();
                this.callbacks.onDismiss?.();
                break;

            case '+':
            case '=':
                e.preventDefault();
                this.callbacks.onZoom?.(1);
                break;

            case '-':
            case '_':
                e.preventDefault();
                this.callbacks.onZoom?.(-1);
                break;

            case 'Home':
                e.preventDefault();
                this.callbacks.onJumpStart?.();
                break;

            case 'End':
                e.preventDefault();
                this.callbacks.onJumpEnd?.();
                break;

            default:
                return; // Don't prevent default for unhandled keys
        }
    }
}
