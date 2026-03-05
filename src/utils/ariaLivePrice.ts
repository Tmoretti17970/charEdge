// ═══════════════════════════════════════════════════════════════════
// charEdge — ARIA Live Price Announcer
//
// Announces significant price changes to screen readers via
// an aria-live region. Debounced to avoid overwhelming
// assistive technology.
//
// Usage:
//   import { ariaLivePrice } from './ariaLivePrice';
//   ariaLivePrice.announce('BTCUSDT', 97523.50);
//   ariaLivePrice.mount();  // creates the live region in DOM
//   ariaLivePrice.unmount(); // cleanup
// ═══════════════════════════════════════════════════════════════════

export interface AnnounceConfig {
    /** Minimum price change % to trigger announcement (default: 0.5) */
    significantChangePercent: number;
    /** Minimum time between announcements in ms (default: 5000) */
    debounceMs: number;
    /** aria-live politeness level (default: 'polite') */
    politeness: 'polite' | 'assertive';
}

const DEFAULT_CONFIG: AnnounceConfig = {
    significantChangePercent: 0.5,
    debounceMs: 5000,
    politeness: 'polite',
};

export class AriaLivePrice {
    private config: AnnounceConfig;
    private element: HTMLElement | null = null;
    private lastPrices: Map<string, number> = new Map();
    private lastAnnounceAt: Map<string, number> = new Map();

    constructor(config: Partial<AnnounceConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Mount the ARIA live region into the DOM.
     * Creates a visually hidden element that screen readers will monitor.
     */
    mount(container: HTMLElement = document.body): void {
        if (this.element) return;

        this.element = document.createElement('div');
        this.element.setAttribute('aria-live', this.config.politeness);
        this.element.setAttribute('aria-atomic', 'true');
        this.element.setAttribute('role', 'status');
        this.element.id = 'charEdge-price-announcer';

        // Visually hidden but accessible to screen readers
        Object.assign(this.element.style, {
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: '0',
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: '0',
        });

        container.appendChild(this.element);
    }

    /**
     * Unmount the ARIA live region from the DOM.
     */
    unmount(): void {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
        this.lastPrices.clear();
        this.lastAnnounceAt.clear();
    }

    /**
     * Announce a price update if it's significant enough.
     * @param symbol - Trading symbol (e.g., 'BTCUSDT')
     * @param price - Current price
     * @returns true if announcement was made
     */
    announce(symbol: string, price: number): boolean {
        if (!this.element) return false;

        const now = performance.now();
        const lastAnnounce = this.lastAnnounceAt.get(symbol) ?? 0;

        // Debounce: skip if too soon after last announcement
        if (now - lastAnnounce < this.config.debounceMs) {
            return false;
        }

        const lastPrice = this.lastPrices.get(symbol);

        // First price — announce it
        if (lastPrice === undefined) {
            this.lastPrices.set(symbol, price);
            this.setText(`${symbol} price: ${this.formatPrice(price)}`);
            this.lastAnnounceAt.set(symbol, now);
            return true;
        }

        // Check if change is significant
        const changePercent = Math.abs((price - lastPrice) / lastPrice) * 100;
        if (changePercent < this.config.significantChangePercent) {
            return false;
        }

        // Announce with direction
        const direction = price > lastPrice ? 'up' : 'down';
        const changeStr = changePercent.toFixed(2);
        this.setText(
            `${symbol} ${direction} ${changeStr}% to ${this.formatPrice(price)}`,
        );

        this.lastPrices.set(symbol, price);
        this.lastAnnounceAt.set(symbol, now);
        return true;
    }

    /** Get the current announcement text (for testing) */
    getText(): string {
        return this.element?.textContent ?? '';
    }

    private setText(text: string): void {
        if (this.element) {
            // Clear first, then set — forces screen reader to re-announce
            this.element.textContent = '';
            requestAnimationFrame(() => {
                if (this.element) {
                    this.element.textContent = text;
                }
            });
        }
    }

    private formatPrice(price: number): string {
        if (price >= 1) {
            return price.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
        }
        // Crypto micro-prices
        return price.toPrecision(6);
    }
}

export const ariaLivePrice = new AriaLivePrice();
