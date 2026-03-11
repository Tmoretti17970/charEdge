// ═══════════════════════════════════════════════════════════════════
// charEdge — InputManager Constants
// Physics and animation tuning constants for the InputManager.
// ═══════════════════════════════════════════════════════════════════

// Inertia / pan constants
export const FRICTION = 0.96;          // Inertia decay per frame (higher = longer momentum)
export const MIN_VELOCITY = 0.3;       // Stop threshold (bars/frame)
export const OVERSCROLL_MAX = 40;      // Max overscroll in bars beyond edge
export const OVERSCROLL_SPRING = 0.85; // Spring-back factor per frame
export const RIGHT_MARGIN_FRAC = 0.5;  // Allow scrolling past last bar by this fraction of visibleBars

// Zoom constants
export const ZOOM_LERP = 0.25;         // Zoom easing speed (0–1) — snappier feel
export const ZOOM_SNAP = 0.5;          // Stop easing when within this many bars
export const PREFETCH_THRESHOLD = 50;  // Dispatch prefetch when within this many bars of left edge

// Task 1.4.12: Y-axis spring physics constants
export const PRICE_FRICTION = 0.92;       // Faster decay than horizontal (tighter feel)
export const MIN_PRICE_VELOCITY = 0.0001; // Stop threshold for price velocity
export const PRICE_SPRING_BACK = 0.15;    // Spring-back stiffness when overscrolled

// Task 1.4.13: Zoom momentum constants
export const ZOOM_MOMENTUM_WINDOW = 120;  // ms — consecutive wheel events within this window accumulate
export const ZOOM_MOMENTUM_DECAY = 0.92;  // Exponential decay per frame for zoom velocity
