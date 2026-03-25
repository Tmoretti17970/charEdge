// ═══════════════════════════════════════════════════════════════════
// charEdge — InputManager Constants
// Physics and animation tuning constants for the InputManager.
// ═══════════════════════════════════════════════════════════════════

// Inertia / pan constants
export const FRICTION = 0.96; // Legacy — unused (quintic-out replaced friction model)
export const MIN_VELOCITY = 0.15; // Stop threshold (bars/frame) — lowered for smoother settling
export const OVERSCROLL_MAX = 40; // Max overscroll in bars beyond edge
export const OVERSCROLL_SPRING = 0.88; // Spring-back factor per frame — softer bounce-back
export const RIGHT_MARGIN_FRAC = 0.5; // Allow scrolling past last bar by this fraction of visibleBars

// Velocity-dependent inertia duration scaling
// Creates "flick fast = long glide, nudge = quick stop" feel
export const INERTIA_DURATION_SCALE = 150; // ms per unit velocity (was 120)
export const INERTIA_DURATION_MIN = 350; // minimum coast duration ms (was 400)
export const INERTIA_DURATION_MAX = 1400; // maximum coast duration ms (was 1200)

// Zoom constants
export const ZOOM_LERP = 0.25; // Zoom easing speed (0–1) — snappier feel
export const ZOOM_SNAP = 0.5; // Stop easing when within this many bars
export const PREFETCH_THRESHOLD = 50; // Dispatch prefetch when within this many bars of left edge

// Y-axis spring physics constants
export const PRICE_FRICTION = 0.94; // Smoother Y-axis decay (was 0.92)
export const MIN_PRICE_VELOCITY = 0.0001; // Stop threshold for price velocity
export const PRICE_SPRING_BACK = 0.15; // Spring-back stiffness when overscrolled

// Zoom momentum constants
export const ZOOM_MOMENTUM_WINDOW = 120; // ms — consecutive wheel events within this window accumulate
export const ZOOM_MOMENTUM_DECAY = 0.92; // Exponential decay per frame for zoom velocity
