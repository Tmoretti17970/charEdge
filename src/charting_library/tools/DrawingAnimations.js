// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Micro-Animations (Sprint 24)
//
// Subtle, delightful animations for drawing lifecycle events:
//   - Creation: line "grows" from first point
//   - Selection: subtle glow pulse
//   - Deletion: fade-out + scale-down
//   - Snap: blue flash dot on snap target
//   - Tool switch: cursor morph
//
// All animations use requestAnimationFrame for 60fps.
// ═══════════════════════════════════════════════════════════════════

/**
 * Animate a drawing line growing from point A to B.
 * Returns a cancel function.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 * @param {string} color
 * @param {number} lineWidth
 * @param {number} durationMs
 * @param {() => void} onComplete
 */
export function animateLineGrow(ctx, from, to, color, lineWidth = 2, durationMs = 250, onComplete) {
  const start = performance.now();
  let rafId = null;

  function frame(now) {
    const elapsed = now - start;
    const t = Math.min(elapsed / durationMs, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - t, 3);

    const currentX = from.x + (to.x - from.x) * eased;
    const currentY = from.y + (to.y - from.y) * eased;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = 0.3 + 0.7 * eased;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();
    ctx.restore();

    if (t < 1) {
      rafId = requestAnimationFrame(frame);
    } else {
      onComplete?.();
    }
  }

  rafId = requestAnimationFrame(frame);
  return () => { if (rafId) cancelAnimationFrame(rafId); };
}

/**
 * Render a selection glow pulse effect.
 * Call each frame while drawing is selected.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }[]} points - drawing anchor points
 * @param {string} color
 */
export function renderSelectionGlow(ctx, points, color) {
  if (!points || points.length === 0) return;

  const now = performance.now();
  // Pulse: 0.3 → 0.6 over 1.2 seconds
  const pulse = 0.3 + 0.3 * Math.sin(now / 300);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.globalAlpha = pulse;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Animate a drawing fading out + scaling down on deletion.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }[]} points
 * @param {string} color
 * @param {number} lineWidth
 * @param {number} durationMs
 * @param {() => void} onComplete
 */
export function animateDeletion(ctx, points, color, lineWidth = 2, durationMs = 200, onComplete) {
  if (!points || points.length === 0) { onComplete?.(); return; }

  const start = performance.now();
  // Center of gravity
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  let rafId = null;

  function frame(now) {
    const elapsed = now - start;
    const t = Math.min(elapsed / durationMs, 1);
    // Ease-in quad
    const eased = t * t;

    const scale = 1 - eased * 0.3; // Scale down to 0.7
    const alpha = 1 - eased;       // Fade to 0

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.restore();

    if (t < 1) {
      rafId = requestAnimationFrame(frame);
    } else {
      onComplete?.();
    }
  }

  rafId = requestAnimationFrame(frame);
  return () => { if (rafId) cancelAnimationFrame(rafId); };
}

/**
 * Flash a blue dot at a snap point.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {string} color
 * @param {number} durationMs
 */
export function flashSnapDot(ctx, x, y, color = '#2962FF', durationMs = 300) {
  const start = performance.now();
  let rafId = null;

  function frame(now) {
    const elapsed = now - start;
    const t = Math.min(elapsed / durationMs, 1);

    // Expand from 3 → 8, fade from 1 → 0
    const radius = 3 + t * 5;
    const alpha = 1 - t;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (t < 1) {
      rafId = requestAnimationFrame(frame);
    }
  }

  rafId = requestAnimationFrame(frame);
  return () => { if (rafId) cancelAnimationFrame(rafId); };
}
