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
export function animateViewport(engine, targetOffset, targetZoom, duration = 200) {
  if (!engine) return () => {};
  const startOffset = engine.getOffset?.() || 0;
  const startZoom = engine.getZoom?.() || 1;

  return animateValue(
    0,
    1,
    duration,
    (t) => {
      const offset = startOffset + (targetOffset - startOffset) * t;
      const zoom = startZoom + (targetZoom - startZoom) * t;
      engine.setOffset?.(offset);
      engine.setZoom?.(zoom);
    },
    'easeOutCubic',
  );
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

    if (elapsed < duration * 3) {
      // 3 pulses
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
  // --motion-base
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
  element.style.transition = 'opacity 120ms cubic-bezier(0.16,1,0.3,1), transform 120ms cubic-bezier(0.16,1,0.3,1)';
  element.style.opacity = '0';
  element.style.transform = 'translateY(4px)';

  requestAnimationFrame(() => {
    element.style.opacity = '1';
    element.style.transform = 'translateY(0)';
  });
}

const EASINGS = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeOutCubic: (t) => --t * t * t + 1,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeOutBack: (t) => {
    const s = 1.70158;
    return --t * t * ((s + 1) * t + s) + 1;
  },
  easeOutBounce: (t) => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  },
  spring: (t) => 1 - Math.cos(t * 4.5 * Math.PI) * Math.exp(-t * 6),
};

export { EASINGS };

/**
 * Spring-based crosshair tooltip snap animation.
 * Smoothly animates tooltip position when snapping to data points.
 * Uses damped spring physics for a premium feel.
 * @param {{ x: number, y: number }} current - Current tooltip position
 * @param {{ x: number, y: number }} target - Target snap position
 * @param {(pos: { x: number, y: number }) => void} onUpdate
 * @param {Object} [options]
 * @param {number} [options.stiffness=400] - Spring stiffness (higher = snappier)
 * @param {number} [options.damping=30] - Damping (higher = less oscillation)
 */
export function animateCrosshairSnap(current, target, onUpdate, options = {}) {
  const { stiffness = 400, damping = 30 } = options;
  let vx = 0,
    vy = 0;
  let cx = current.x,
    cy = current.y;
  let rafId;
  let lastTime = performance.now();

  function tick() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.064);
    lastTime = now;

    // Spring force
    const fx = -stiffness * (cx - target.x) - damping * vx;
    const fy = -stiffness * (cy - target.y) - damping * vy;

    vx += fx * dt;
    vy += fy * dt;
    cx += vx * dt;
    cy += vy * dt;

    onUpdate({ x: cx, y: cy });

    // Settle check
    const settled =
      Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5 && Math.abs(cx - target.x) < 0.5 && Math.abs(cy - target.y) < 0.5;

    if (settled) {
      onUpdate(target);
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}

// ═══════════════════════════════════════════════════════════════════
// Sprint 19: Animation System Overhaul
// ═══════════════════════════════════════════════════════════════════

/**
 * Sprint 19: Candle entrance animation — bars slide up from bottom.
 * Only plays on first load and symbol change (300ms max, easeOutCubic).
 * @param {CanvasRenderingContext2D} ctx
 * @param {Function} drawFn - Receives (progress) to control bar Y offset
 * @param {Object} options
 * @param {number} [options.durationMs=300] - Max animation duration
 * @param {number} [options.staggerMs=8] - Stagger per bar index
 */
export function animateCandleEntrance(ctx, drawFn, options = {}) {
  const { durationMs = 300, staggerMs = 8 } = options;
  const start = performance.now();
  let rafId;

  function tick() {
    const elapsed = performance.now() - start;
    const progress = Math.min(elapsed / durationMs, 1);
    const easedProgress = EASINGS.easeOutCubic(progress);

    ctx.save();
    drawFn(easedProgress, staggerMs);
    ctx.restore();

    if (progress < 1) {
      rafId = requestAnimationFrame(tick);
    }
  }

  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}

/**
 * Sprint 19: Chart type transition — crossfade between old and new render.
 * Captures old frame as ImageBitmap, fades to new rendering.
 * @param {CanvasRenderingContext2D} ctx
 * @param {ImageBitmap|HTMLCanvasElement} oldFrame - Previous frame capture
 * @param {Function} drawNewFrame - Draws the new chart type
 * @param {number} [durationMs=250]
 */
export function animateChartTypeTransition(ctx, oldFrame, drawNewFrame, durationMs = 200) {
  const start = performance.now();
  let rafId;

  function tick() {
    const elapsed = performance.now() - start;
    const progress = Math.min(elapsed / durationMs, 1);
    const easedProgress = EASINGS.easeOutCubic(progress);

    ctx.save();
    // Draw old frame fading out
    ctx.globalAlpha = 1 - easedProgress;
    if (oldFrame) {
      ctx.drawImage(oldFrame, 0, 0);
    }
    // Draw new frame fading in
    ctx.globalAlpha = easedProgress;
    drawNewFrame();
    ctx.restore();

    if (progress < 1) {
      rafId = requestAnimationFrame(tick);
    }
  }

  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}

/**
 * Sprint 19: Spring-physics zoom animation.
 * Replaces linear zoom lerp with a spring-damped oscillation.
 * @param {number} startZoom
 * @param {number} targetZoom
 * @param {Function} onUpdate - (currentZoom) => void
 * @param {Object} [options]
 * @param {number} [options.stiffness=180]
 * @param {number} [options.damping=12]
 */
export function animateSpringZoom(startZoom, targetZoom, onUpdate, options = {}) {
  const { stiffness = 180, damping = 12 } = options;
  let velocity = 0;
  let currentZoom = startZoom;
  let rafId;
  let lastTime = performance.now();

  function tick() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.064); // Cap dt at ~16fps
    lastTime = now;

    const displacement = currentZoom - targetZoom;
    const springForce = -stiffness * displacement;
    const dampingForce = -damping * velocity;
    const acceleration = springForce + dampingForce;

    velocity += acceleration * dt;
    currentZoom += velocity * dt;

    onUpdate(currentZoom);

    // Stop when settled (velocity ~0 and close to target)
    if (Math.abs(velocity) < 0.001 && Math.abs(currentZoom - targetZoom) < 0.0001) {
      onUpdate(targetZoom);
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}

/**
 * Sprint 19: Price line glow effect — animated gradient glow on current price line.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} y - Y position of price line (bitmap coords)
 * @param {number} width - Canvas width (bitmap)
 * @param {string} color - Glow color
 * @param {number} pr - Pixel ratio
 */
export function drawPriceLineGlow(ctx, y, width, color = '#26A69A', pr = 1) {
  const glowH = Math.round(12 * pr);
  const gradient = ctx.createLinearGradient(0, y - glowH, 0, y + glowH);
  gradient.addColorStop(0, 'transparent');
  gradient.addColorStop(0.4, color + '30');
  gradient.addColorStop(0.5, color + '60');
  gradient.addColorStop(0.6, color + '30');
  gradient.addColorStop(1, 'transparent');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, y - glowH, width, glowH * 2);
}

/**
 * Sprint 19: Shimmer loading effect — CSS-style shimmer sweep for placeholder bars.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x: number, y: number, w: number, h: number}} rect - Area to shimmer
 * @param {number} [durationMs=1500]
 */
export function createShimmerEffect(ctx, rect, durationMs = 1500) {
  const start = performance.now();
  let rafId;

  function tick() {
    const elapsed = performance.now() - start;
    const progress = (elapsed % durationMs) / durationMs;
    const sweepX = rect.x + rect.w * progress;
    const sweepW = rect.w * 0.3;

    const gradient = ctx.createLinearGradient(sweepX - sweepW, 0, sweepX + sweepW, 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();

    if (elapsed < durationMs * 3) {
      rafId = requestAnimationFrame(tick);
    }
  }

  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}
