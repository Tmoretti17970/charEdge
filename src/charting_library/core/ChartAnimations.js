// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Micro-Interactions & Animations (Sprint 22)
// CSS animations and canvas animation helpers for chart interactions.
// ═══════════════════════════════════════════════════════════════════

/**
 * Animate a value from start to end using requestAnimationFrame.
 * Returns a cancel function.
 */
export function animateValue(startVal, endVal, durationMs, onUpdate, easing = 'easeOutExpo') {
  const start = performance.now();
  const easingFn = EASINGS[easing] || EASINGS.easeOutExpo;
  let rafId;

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / durationMs, 1);
    const easedProgress = easingFn(progress);
    const currentVal = startVal + (endVal - startVal) * easedProgress;

    onUpdate(currentVal, progress);

    if (progress < 1) {
      rafId = requestAnimationFrame(tick);
    }
  }

  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}

/**
 * Smoothly animate pan/zoom transitions.
 */
export function animateViewport(engine, targetOffset, targetZoom, duration = 300) {
  if (!engine) return () => {};
  const startOffset = engine.getOffset?.() || 0;
  const startZoom = engine.getZoom?.() || 1;

  return animateValue(0, 1, duration, (t) => {
    const offset = startOffset + (targetOffset - startOffset) * t;
    const zoom = startZoom + (targetZoom - startZoom) * t;
    engine.setOffset?.(offset);
    engine.setZoom?.(zoom);
  }, 'easeOutCubic');
}

/**
 * Pulse animation for price alerts and breakout markers.
 */
export function createPulseAnimation(ctx, x, y, color = '#2962FF', maxRadius = 20) {
  let startTime = null;
  const duration = 1000;

  function render(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = (elapsed % duration) / duration;
    const radius = maxRadius * progress;
    const opacity = 1 - progress;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = opacity;
    ctx.stroke();
    ctx.restore();

    if (elapsed < duration * 3) { // 3 pulses
      return requestAnimationFrame((t) => render(t));
    }
    return null;
  }

  return requestAnimationFrame((t) => render(t));
}

/**
 * Drawing entry animation — lines fade in from thin to full width.
 */
export function animateDrawingEntry(ctx, drawFn, durationMs = 200) {
  const start = performance.now();

  function tick() {
    const elapsed = performance.now() - start;
    const progress = Math.min(elapsed / durationMs, 1);
    const eased = EASINGS.easeOutCubic(progress);

    ctx.save();
    ctx.globalAlpha = eased;
    drawFn(eased); // Pass progress so the draw function can scale width etc.
    ctx.restore();

    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

/**
 * Tooltip hover animation.
 */
export function createTooltipTransition(element) {
  if (!element) return;
  element.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
  element.style.opacity = '0';
  element.style.transform = 'translateY(4px)';

  requestAnimationFrame(() => {
    element.style.opacity = '1';
    element.style.transform = 'translateY(0)';
  });
}

// ─── Easing Functions ────────────────────────────────────────

const EASINGS = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeOutCubic: (t) => (--t) * t * t + 1,
  easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeOutExpo: (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeOutBack: (t) => { const s = 1.70158; return --t * t * ((s + 1) * t + s) + 1; },
  easeOutBounce: (t) => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },
  spring: (t) => 1 - Math.cos(t * 4.5 * Math.PI) * Math.exp(-t * 6),
};

export { EASINGS };
