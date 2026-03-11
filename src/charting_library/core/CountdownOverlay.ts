// ═══════════════════════════════════════════════════════════════════
// charEdge — Countdown Overlay
//
// Sprint 18 #115: Standalone DOM overlay for the bar close countdown.
// Extracted from UIStage to avoid forcing full UIStage repaints
// every second. Uses its own rAF/setTimeout loop at 1/s cadence.
//
// The overlay is a lightweight <div> positioned over the last candle
// using CSS transforms, rendering the countdown text from
// barCountdown.js utilities.
// ═══════════════════════════════════════════════════════════════════

import { tfToMs, formatCountdown } from './barCountdown.js';

/**
 * Configuration for the countdown overlay.
 */
interface CountdownConfig {
  /** CSS font for the countdown text */
  font?: string;
  /** Text color */
  color?: string;
  /** Background color */
  background?: string;
  /** Padding in px */
  padding?: number;
  /** Border radius in px */
  borderRadius?: number;
}

const DEFAULT_CONFIG: Required<CountdownConfig> = {
  font: '11px Inter, sans-serif',
  color: 'rgba(255, 255, 255, 0.85)',
  background: 'rgba(42, 46, 57, 0.8)',
  padding: 4,
  borderRadius: 3,
};

/**
 * Lightweight DOM overlay that shows the candle close countdown timer.
 * Owns its own update loop (rAF gated to 1/s) — does NOT force any
 * canvas repaint on the main chart.
 */
export class CountdownOverlay {
  private _el: HTMLDivElement;
  private _config: Required<CountdownConfig>;
  private _timeframe: string = '';
  private _lastBarTime: number = 0;
  private _animFrameId: number = 0;
  private _intervalId: ReturnType<typeof setTimeout> | null = null;
  private _visible: boolean = false;
  private _x: number = 0;
  private _y: number = 0;

  /**
   * @param container - Parent element to append the countdown overlay to.
   * @param config    - Styling overrides.
   */
  constructor(container: HTMLElement, config: CountdownConfig = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config };

    // Create DOM element
    this._el = document.createElement('div');
    this._el.style.position = 'absolute';
    this._el.style.pointerEvents = 'none';
    this._el.style.zIndex = '10';
    this._el.style.font = this._config.font;
    this._el.style.color = this._config.color;
    this._el.style.background = this._config.background;
    this._el.style.padding = `${this._config.padding}px`;
    this._el.style.borderRadius = `${this._config.borderRadius}px`;
    this._el.style.whiteSpace = 'nowrap';
    this._el.style.willChange = 'transform';
    this._el.style.display = 'none';
    this._el.setAttribute('data-test', 'countdown-overlay');

    container.appendChild(this._el);
  }

  /**
   * Update the countdown with the current timeframe and last bar time.
   * @param timeframe  - e.g. '1m', '5m', '1h', '1D'
   * @param lastBarTime - Timestamp of the last bar (ms)
   */
  setContext(timeframe: string, lastBarTime: number): void {
    this._timeframe = timeframe;
    this._lastBarTime = lastBarTime;
  }

  /**
   * Set the position of the overlay (CSS coordinates).
   * @param x - Left position in px
   * @param y - Top position in px
   */
  setPosition(x: number, y: number): void {
    this._x = x;
    this._y = y;
    this._el.style.transform = `translate(${x}px, ${y}px)`;
  }

  /**
   * Start the countdown loop.
   * Uses setTimeout at 1/s + rAF for paint timing.
   */
  start(): void {
    if (this._intervalId) return;
    this._visible = true;
    this._el.style.display = 'block';
    this._tick();
    this._intervalId = setInterval(() => this._tick(), 1000);
  }

  /**
   * Stop the countdown loop.
   */
  stop(): void {
    this._visible = false;
    this._el.style.display = 'none';
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = 0;
    }
  }

  /**
   * Internal: update the countdown text.
   */
  private _tick(): void {
    if (!this._visible || !this._timeframe || !this._lastBarTime) return;

    const tfMs = tfToMs(this._timeframe);
    if (tfMs <= 0) return;

    const now = Date.now();
    const nextBarTime = this._lastBarTime + tfMs;
    const remaining = nextBarTime - now;
    const text = formatCountdown(remaining);

    // Batch DOM write into rAF for paint coalescing
    this._animFrameId = requestAnimationFrame(() => {
      this._el.textContent = text;
      this._el.style.transform = `translate(${this._x}px, ${this._y}px)`;
    });
  }

  /**
   * Remove the overlay from the DOM and clean up timers.
   */
  dispose(): void {
    this.stop();
    this._el.remove();
  }
}
