// ═══════════════════════════════════════════════════════════════════
// charEdge — Regime Stage Overlay (Sprint 40)
//
// Canvas-level background tinting based on ML regime classification.
// Draws subtle color bands behind candles to visualize the current
// market regime (uptrend, downtrend, consolidation, breakout, etc.).
//
// Works with both:
//   • ML regime (from MLPipeline.classifyRegime) — preferred
//   • Heuristic regime (from LocalInsightEngine) — fallback
//
// Usage (from chart render loop):
//   const overlay = new RegimeStage(ctx);
//   overlay.update(regimeResult, visibleRange);
//   overlay.draw();  // Call in chart paint cycle
// ═══════════════════════════════════════════════════════════════════

import { REGIME_CONFIG } from '../ai/MLPipeline.js';

// ─── Constants ──────────────────────────────────────────────────

const DEFAULT_ALPHA = 0.04; // Very subtle background
const TRANSITION_BARS = 3; // Fade over 3 bars on regime change
const LABEL_FONT = "10px 'JetBrains Mono', 'SF Mono', monospace";
const BADGE_HEIGHT = 18;
const BADGE_PADDING = 8;
const BADGE_RADIUS = 4;

// ─── Regime Stage ───────────────────────────────────────────────

export class RegimeStage {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} [config]
   */
  constructor(ctx, config = {}) {
    this.ctx = ctx;
    this.alpha = config.alpha ?? DEFAULT_ALPHA;
    this.showLabel = config.showLabel ?? true;
    this.showBadge = config.showBadge ?? true;

    /** @type {{ label: string, color: string, emoji: string, confidence: number, source: string } | null} */
    this.regime = null;

    /** @type {{ label: string, color: string, alpha: number } | null} */
    this._prevRegime = null;
    this._transitionProgress = 1; // 0→1 (1 = fully transitioned)

    /** Visible chart bounds */
    this._bounds = { x: 0, y: 0, width: 0, height: 0 };
  }

  /**
   * Update the regime data and visible bounds.
   * @param {Object} regimeResult - { label, confidence, config?, source? }
   * @param {{ x: number, y: number, width: number, height: number }} bounds
   */
  update(regimeResult, bounds) {
    if (bounds) {
      this._bounds = bounds;
    }

    if (!regimeResult) return;

    const config = regimeResult.config || REGIME_CONFIG[regimeResult.label] || REGIME_CONFIG['Consolidation'];
    const newLabel = regimeResult.label;

    // Detect regime change → start transition
    if (this.regime && this.regime.label !== newLabel) {
      this._prevRegime = {
        label: this.regime.label,
        color: this.regime.color,
        alpha: this.alpha,
      };
      this._transitionProgress = 0;
    }

    this.regime = {
      label: newLabel,
      color: config.color,
      emoji: config.emoji,
      confidence: regimeResult.confidence ?? 0,
      source: regimeResult.source || 'heuristic',
    };

    // Advance transition
    if (this._transitionProgress < 1) {
      this._transitionProgress = Math.min(1, this._transitionProgress + 1 / TRANSITION_BARS);
    }
  }

  /**
   * Draw the regime background tint and optional badge.
   * Call this BEFORE drawing candles so it sits behind them.
   */
  draw() {
    if (!this.regime || !this.ctx) return;

    const { ctx } = this;
    const { x, y, width, height } = this._bounds;
    if (width <= 0 || height <= 0) return;

    ctx.save();

    // ─── Background tint ────────────────────────────────
    const t = this._transitionProgress;

    if (this._prevRegime && t < 1) {
      // Crossfade: draw old regime fading out
      ctx.fillStyle = this._prevRegime.color;
      ctx.globalAlpha = this.alpha * (1 - t);
      ctx.fillRect(x, y, width, height);
    }

    // Draw current regime
    ctx.fillStyle = this.regime.color;
    ctx.globalAlpha = this.alpha * (t < 1 ? t : 1);
    ctx.fillRect(x, y, width, height);

    // ─── Gradient fade at edges ─────────────────────────
    ctx.globalAlpha = 1;
    const edgeGrad = ctx.createLinearGradient(x, y, x, y + 40);
    edgeGrad.addColorStop(0, `${this.regime.color}15`);
    edgeGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(x, y, width, 40);

    // ─── Regime badge (top-right) ───────────────────────
    if (this.showBadge) {
      this._drawBadge(ctx, x + width, y);
    }

    ctx.restore();
  }

  /**
   * Draw regime badge in top-right corner.
   * @private
   */
  _drawBadge(ctx, rightX, topY) {
    const { regime } = this;
    if (!regime) return;

    const _dpr = window.devicePixelRatio || 1;
    ctx.font = LABEL_FONT;

    const text = `${regime.emoji} ${regime.label}`;
    const confText = regime.confidence > 0 ? ` ${(regime.confidence * 100).toFixed(0)}%` : '';
    const fullText = text + confText;
    const metrics = ctx.measureText(fullText);
    const badgeWidth = metrics.width + BADGE_PADDING * 2;
    const badgeX = rightX - badgeWidth - 12;
    const badgeY = topY + 10;

    // Badge background
    ctx.fillStyle = `${regime.color}15`;
    ctx.strokeStyle = `${regime.color}40`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    this._roundRect(ctx, badgeX, badgeY, badgeWidth, BADGE_HEIGHT, BADGE_RADIUS);
    ctx.fill();
    ctx.stroke();

    // Badge text
    ctx.fillStyle = regime.color;
    ctx.globalAlpha = 0.8;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, badgeX + BADGE_PADDING, badgeY + BADGE_HEIGHT / 2);

    // Confidence subtext
    if (confText) {
      ctx.globalAlpha = 0.5;
      ctx.fillText(confText, badgeX + BADGE_PADDING + ctx.measureText(text).width, badgeY + BADGE_HEIGHT / 2);
    }

    // ML source indicator (small dot)
    if (regime.source === 'ml') {
      const dotX = badgeX + badgeWidth - 6;
      const dotY = badgeY + 6;
      ctx.fillStyle = '#31d158';
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Clear the overlay state.
   */
  clear() {
    this.regime = null;
    this._prevRegime = null;
    this._transitionProgress = 1;
  }

  // ─── Helpers ────────────────────────────────────────────────

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

export default RegimeStage;
