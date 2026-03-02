// ═══════════════════════════════════════════════════════════════════
// charEdge — SpringAnimator
//
// Physics-based spring animations for all UI transitions.
// Replaces lerp-based animation (_animLerp) with critically-damped
// and under-damped spring motion for natural, Apple-quality feel.
//
// Based on the analytical solution to the damped harmonic oscillator:
//   m·x'' + c·x' + k·x = 0
//   where m = mass, c = damping, k = stiffness
//
// Presets:
//   SNAP   → stiff, fast settle (crosshair snap, tooltip)
//   EASE   → smooth, gentle (zoom, scroll deceleration)
//   BOUNCE → playful, slight overshoot (entrance animations)
// ═══════════════════════════════════════════════════════════════════

/** @typedef {{ stiffness: number, damping: number, mass: number, precision: number }} SpringConfig */

/** Built-in spring presets */
export const SPRING_PRESETS = {
  /** Stiff, fast settle — crosshair snap, tooltip repositioning */
  SNAP: { stiffness: 400, damping: 30, mass: 1, precision: 0.01 },

  /** Smooth, gentle — zoom, scroll deceleration, pane resize */
  EASE: { stiffness: 170, damping: 26, mass: 1, precision: 0.01 },

  /** Playful, slight overshoot — entrance animations, value counters */
  BOUNCE: { stiffness: 200, damping: 12, mass: 1, precision: 0.01 },
};

/**
 * A single-axis spring animator.
 *
 * Usage:
 *   const spring = new SpringAnimator({ preset: 'EASE' });
 *   spring.setTarget(100);
 *   // In rAF loop:
 *   const { value, velocity, settled } = spring.tick(dt);
 */
export class SpringAnimator {
  /**
   * @param {Object} [opts]
   * @param {string} [opts.preset]     - Preset name (SNAP, EASE, BOUNCE)
   * @param {number} [opts.stiffness]  - Spring constant k (default: 170)
   * @param {number} [opts.damping]    - Damping coefficient c (default: 26)
   * @param {number} [opts.mass]       - Mass m (default: 1)
   * @param {number} [opts.precision]  - Settle threshold (default: 0.01)
   * @param {number} [opts.initial]    - Initial position (default: 0)
   */
  constructor(opts = {}) {
    const preset = opts.preset ? SPRING_PRESETS[opts.preset] : null;
    const cfg = preset || {};

    /** @type {number} Spring constant */
    this.stiffness = opts.stiffness ?? cfg.stiffness ?? 170;
    /** @type {number} Damping coefficient */
    this.damping = opts.damping ?? cfg.damping ?? 26;
    /** @type {number} Mass */
    this.mass = opts.mass ?? cfg.mass ?? 1;
    /** @type {number} Precision threshold for "settled" */
    this.precision = opts.precision ?? cfg.precision ?? 0.01;

    /** Current value */
    this._value = opts.initial ?? 0;
    /** Current velocity */
    this._velocity = 0;
    /** Target value */
    this._target = this._value;
    /** Whether the spring has settled */
    this._settled = true;
  }

  /**
   * Set a new target value. Starts or redirects the animation.
   *
   * @param {number} target
   */
  setTarget(target) {
    if (target === this._target) return;
    this._target = target;
    this._settled = false;
  }

  /**
   * Instantly set the current value without animation.
   *
   * @param {number} value
   */
  setValue(value) {
    this._value = value;
    this._target = value;
    this._velocity = 0;
    this._settled = true;
  }

  /**
   * Advance the spring simulation by dt seconds.
   * Uses a semi-implicit Euler integrator (stable, cheap).
   *
   * @param {number} dt - Time step in seconds (e.g. 1/60)
   * @returns {{ value: number, velocity: number, settled: boolean }}
   */
  tick(dt) {
    if (this._settled) {
      return { value: this._value, velocity: 0, settled: true };
    }

    // Clamp dt to avoid instability with large time gaps
    const step = Math.min(dt, 1 / 30);

    // Spring force: F = -k * (x - target) - c * v
    const displacement = this._value - this._target;
    const springForce = -this.stiffness * displacement;
    const dampingForce = -this.damping * this._velocity;
    const acceleration = (springForce + dampingForce) / this.mass;

    // Semi-implicit Euler: update velocity first, then position
    this._velocity += acceleration * step;
    this._value += this._velocity * step;

    // Check if settled
    if (
      Math.abs(this._velocity) < this.precision &&
      Math.abs(this._value - this._target) < this.precision
    ) {
      this._value = this._target;
      this._velocity = 0;
      this._settled = true;
    }

    return {
      value: this._value,
      velocity: this._velocity,
      settled: this._settled,
    };
  }

  /** Current animated value */
  get value() { return this._value; }

  /** Current velocity */
  get velocity() { return this._velocity; }

  /** Target value */
  get target() { return this._target; }

  /** Whether the spring has settled at the target */
  get settled() { return this._settled; }
}

/**
 * A 2D spring animator (x, y).
 * Convenience wrapper for animating points.
 */
export class SpringAnimator2D {
  /**
   * @param {Object} [opts] - Same options as SpringAnimator
   */
  constructor(opts = {}) {
    this.x = new SpringAnimator({ ...opts, initial: opts.initialX ?? 0 });
    this.y = new SpringAnimator({ ...opts, initial: opts.initialY ?? 0 });
  }

  /**
   * Set 2D target.
   * @param {number} tx
   * @param {number} ty
   */
  setTarget(tx, ty) {
    this.x.setTarget(tx);
    this.y.setTarget(ty);
  }

  /**
   * Advance both axes.
   * @param {number} dt
   * @returns {{ x: number, y: number, settled: boolean }}
   */
  tick(dt) {
    const rx = this.x.tick(dt);
    const ry = this.y.tick(dt);
    return {
      x: rx.value,
      y: ry.value,
      settled: rx.settled && ry.settled,
    };
  }

  get settled() { return this.x.settled && this.y.settled; }
}
