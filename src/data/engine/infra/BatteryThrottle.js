// ═══════════════════════════════════════════════════════════════════
// charEdge — Battery-Aware Throttle (Phase 6: Polish & Optimize)
//
// Uses the Battery Status API to dynamically reduce P2P relay
// frequency when the device is on battery or low charge.
//
// Throttle tiers:
//   > 50% battery OR plugged in:  1.0x  (no throttle)
//   30-50% battery (unplugged):   0.5x  (half relay rate)
//   10-30% battery (unplugged):   0.25x (quarter relay rate)
//   < 10% battery (unplugged):    0.0x  (stop relaying entirely)
//
// Falls back gracefully when Battery API is unavailable.
// ═══════════════════════════════════════════════════════════════════

// ─── Throttle Tiers ─────────────────────────────────────────────

const TIERS = [
  { minLevel: 0.50, multiplier: 1.0,  label: 'none' },
  { minLevel: 0.30, multiplier: 0.5,  label: 'light' },
  { minLevel: 0.10, multiplier: 0.25, label: 'moderate' },
  { minLevel: 0.00, multiplier: 0.0,  label: 'severe' },
];

// ═══════════════════════════════════════════════════════════════════
// BatteryThrottle Class
// ═══════════════════════════════════════════════════════════════════

export class BatteryThrottle extends EventTarget {
  constructor() {
    super();

    /** @type {BatteryManager|null} */
    this._battery = null;

    /** Whether the Battery API is available */
    this._apiAvailable = false;

    /** Current state */
    this._charging = true;
    this._level = 1.0;
    this._multiplier = 1.0;
    this._tier = 'none';

    /** Bound handlers for cleanup */
    this._onChargingChange = this._handleChargingChange.bind(this);
    this._onLevelChange = this._handleLevelChange.bind(this);

    this._initialized = false;
  }

  // ─── Lifecycle ───────────────────────────────────────────────

  /**
   * Initialize the battery monitor.
   * Call this once at startup. Returns a promise that resolves
   * when battery state is known (or immediately if API unavailable).
   */
  async init() {
    if (this._initialized) return;
    this._initialized = true;

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.getBattery === 'function') {
        this._battery = await navigator.getBattery();
        this._apiAvailable = true;

        // Read initial state
        this._charging = this._battery.charging;
        this._level = this._battery.level;
        this._recalculate();

        // Listen for changes
        this._battery.addEventListener('chargingchange', this._onChargingChange);
        this._battery.addEventListener('levelchange', this._onLevelChange);
      }
    } catch {
      // Battery API not available — remain at defaults (no throttle)
      this._apiAvailable = false;
    }
  }

  /**
   * Clean up event listeners.
   */
  destroy() {
    if (this._battery) {
      this._battery.removeEventListener('chargingchange', this._onChargingChange);
      this._battery.removeEventListener('levelchange', this._onLevelChange);
      this._battery = null;
    }
    this._initialized = false;
  }

  // ─── Public API ─────────────────────────────────────────────

  /**
   * Whether relay should be throttled at all.
   * @returns {boolean}
   */
  shouldThrottle() {
    return this._multiplier < 1.0;
  }

  /**
   * Get the current throttle multiplier (0.0 to 1.0).
   * Use this to scale relay rate or skip relay operations.
   *
   * Example:
   *   if (Math.random() > throttle.getMultiplier()) return; // probabilistic skip
   *
   * @returns {number}
   */
  getMultiplier() {
    return this._multiplier;
  }

  /**
   * Get the current throttle tier label.
   * @returns {'none'|'light'|'moderate'|'severe'}
   */
  getTier() {
    return this._tier;
  }

  /**
   * Get the full battery state.
   * @returns {{ available: boolean, charging: boolean, level: number, multiplier: number, tier: string }}
   */
  getState() {
    return {
      available: this._apiAvailable,
      charging: this._charging,
      level: this._level,
      multiplier: this._multiplier,
      tier: this._tier,
    };
  }

  /**
   * Check if a relay operation should proceed based on throttle.
   * Uses probabilistic skipping: at 0.5x multiplier, ~50% of calls return true.
   * At 0.0x, always returns false. At 1.0x, always returns true.
   *
   * @returns {boolean} true if the operation should proceed
   */
  allowRelay() {
    if (this._multiplier >= 1.0) return true;
    if (this._multiplier <= 0.0) return false;
    return Math.random() < this._multiplier;
  }

  /**
   * Whether the Battery API is available on this device.
   * @returns {boolean}
   */
  get isAvailable() {
    return this._apiAvailable;
  }

  // ─── Internal ───────────────────────────────────────────────

  /** @private */
  _handleChargingChange() {
    this._charging = this._battery.charging;
    this._recalculate();
  }

  /** @private */
  _handleLevelChange() {
    this._level = this._battery.level;
    this._recalculate();
  }

  /** @private */
  _recalculate() {
    const prevMultiplier = this._multiplier;

    // If charging, no throttle
    if (this._charging) {
      this._multiplier = 1.0;
      this._tier = 'none';
    } else {
      // Find the matching tier
      for (const tier of TIERS) {
        if (this._level >= tier.minLevel) {
          this._multiplier = tier.multiplier;
          this._tier = tier.label;
          break;
        }
      }
    }

    // Emit change event if multiplier changed
    if (prevMultiplier !== this._multiplier) {
      this.dispatchEvent(new CustomEvent('throttle-change', {
        detail: this.getState(),
      }));
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────

let _instance = null;

/**
 * Get (or create) the global BatteryThrottle singleton.
 * @returns {BatteryThrottle}
 */
export function getBatteryThrottle() {
  if (!_instance) _instance = new BatteryThrottle();
  return _instance;
}

export default BatteryThrottle;
