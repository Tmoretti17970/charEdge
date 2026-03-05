import { logger } from '../../utils/logger';

// ═══════════════════════════════════════════════════════════════════
// charEdge — RenderQuality
//
// Premium rendering quality system.
// Provides adaptive quality, GPU tier detection, Display P3 color,
// progressive rendering, and perceptual polish utilities.
//
// Features:
//   - GPU tier detection (low/mid/high) via WebGL capabilities
//   - Adaptive LOD based on detected tier
//   - Display P3 wide color gamut support
//   - Temporal anti-aliasing settings
//   - Progressive center-first rendering
//   - Predictive pre-rendering
// ═══════════════════════════════════════════════════════════════════

// ─── GPU Tier Detection ──────────────────────────────────────

/**
 * Detect the GPU performance tier of the current device.
 * Uses WebGL renderer info and benchmark heuristics.
 *
 * @returns {{ tier: 'low'|'mid'|'high', info: Object }}
 */
export function detectGPUTier() {
  const info = {
    renderer: 'unknown',
    vendor: 'unknown',
    maxTextureSize: 0,
    maxInstances: 0,
    supportsWebGL2: false,
    supportsWebGPU: false,
    supportsP3: false,
    devicePixelRatio: window.devicePixelRatio || 1,
  };

  try {
    const canvas = document.createElement('canvas');

    // WebGL 2 check
    const gl = canvas.getContext('webgl2');
    if (gl) {
      info.supportsWebGL2 = true;
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        info.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown';
        info.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'unknown';
      }
      info.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      info.maxInstances = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS);

      // Release context
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }

    // WebGPU check
    info.supportsWebGPU = !!navigator.gpu;

    // Display P3 check
    info.supportsP3 = window.matchMedia('(color-gamut: p3)').matches;

    // Release canvas
    canvas.width = 0;
    canvas.height = 0;
  } catch (e) {
    // Swallow
  }

  // Tier classification
  let tier = 'mid';
  const rendererLower = info.renderer.toLowerCase();

  // High tier indicators
  const highTierGPUs = ['nvidia', 'geforce', 'rtx', 'gtx', 'radeon rx', 'apple m1', 'apple m2', 'apple m3', 'apple m4', 'apple gpu'];
  if (highTierGPUs.some(g => rendererLower.includes(g))) {
    tier = 'high';
  }

  // Low tier indicators
  const lowTierGPUs = ['intel hd', 'intel uhd', 'mesa', 'llvmpipe', 'swiftshader', 'software', 'mali-4', 'adreno 3'];
  if (lowTierGPUs.some(g => rendererLower.includes(g))) {
    tier = 'low';
  }

  // Override by texture size
  if (info.maxTextureSize >= 16384 && tier !== 'low') tier = 'high';
  if (info.maxTextureSize < 4096) tier = 'low';

  return { tier, info };
}

// ─── Adaptive Quality Settings ───────────────────────────────

/**
 * Get quality settings based on GPU tier.
 *
 * @param {'low'|'mid'|'high'} tier
 * @returns {Object} Quality settings object
 */
export function getQualitySettings(tier) {
  switch (tier) {
    case 'high':
      return {
        maxVisibleBarsBeforeDecimation: 5000,
        enableWebGL: true,
        enableWebGPU: true,
        enableWideColorGamut: true,
        antiAliasing: 'subpixel',
        lineRenderQuality: 'high',     // Gaussian AA
        candleRoundedCorners: true,
        volumeGradient: true,
        shadowEffects: true,
        maxIndicators: 10,
        maxDrawings: 100,
        enableAnimations: true,
        enablePredictiveRendering: true,
        enableProgressiveRendering: true,
        heatmapResolution: 'full',
        textRendering: 'optimizeLegibility',
      };

    case 'mid':
      return {
        maxVisibleBarsBeforeDecimation: 2000,
        enableWebGL: true,
        enableWebGPU: false,
        enableWideColorGamut: false,
        antiAliasing: 'standard',
        lineRenderQuality: 'medium',
        candleRoundedCorners: true,
        volumeGradient: true,
        shadowEffects: false,
        maxIndicators: 6,
        maxDrawings: 50,
        enableAnimations: true,
        enablePredictiveRendering: false,
        enableProgressiveRendering: false,
        heatmapResolution: '0.5x',
        textRendering: 'auto',
      };

    case 'low':
    default:
      return {
        maxVisibleBarsBeforeDecimation: 500,
        enableWebGL: false,
        enableWebGPU: false,
        enableWideColorGamut: false,
        antiAliasing: 'none',
        lineRenderQuality: 'low',
        candleRoundedCorners: false,
        volumeGradient: false,
        shadowEffects: false,
        maxIndicators: 3,
        maxDrawings: 20,
        enableAnimations: false,
        enablePredictiveRendering: false,
        enableProgressiveRendering: false,
        heatmapResolution: '0.25x',
        textRendering: 'optimizeSpeed',
      };
  }
}

// ─── Display P3 Wide Color Gamut ─────────────────────────────

/**
 * Create a Display P3 canvas context if supported.
 * Falls back to sRGB if not available.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {CanvasRenderingContext2D}
 */
export function createP3Context(canvas) {
  // Check for Display P3 support
  if (window.matchMedia('(color-gamut: p3)').matches) {
    try {
      const ctx = canvas.getContext('2d', { colorSpace: 'display-p3' });
      if (ctx) {
        logger.engine.info('[RenderQuality] Using Display P3 wide color gamut');
        return ctx;
      }
    } catch (e) {
      // Fallback
    }
  }
  return canvas.getContext('2d');
}

/**
 * Convert sRGB hex color to Display P3 color() syntax.
 * This expands the available color range for vivid candle colors.
 *
 * @param {string} hex — sRGB hex color (#RRGGBB)
 * @returns {string} — CSS color() value or original hex as fallback
 */
export function toP3Color(hex) {
  if (!hex || !hex.startsWith('#')) return hex;

  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  return `color(display-p3 ${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)})`;
}

// ─── Progressive Center-First Rendering ──────────────────────

/**
 * Generate render priority order: center of viewport first,
 * then expand outward. This gives perceived instant rendering.
 *
 * @param {number} startIdx — first visible bar index
 * @param {number} endIdx — last visible bar index
 * @param {number} centerIdx — center bar index (e.g., under cursor)
 * @returns {Int32Array} — indices in render-priority order
 */
export function generateRenderOrder(startIdx, endIdx, centerIdx) {
  const count = endIdx - startIdx;
  if (count <= 0) return new Int32Array(0);

  const order = new Int32Array(count);
  const center = Math.max(startIdx, Math.min(endIdx - 1, centerIdx || Math.floor((startIdx + endIdx) / 2)));

  let idx = 0;
  order[idx++] = center;

  for (let d = 1; d < count; d++) {
    const left = center - d;
    const right = center + d;
    if (left >= startIdx) order[idx++] = left;
    if (right < endIdx) order[idx++] = right;
    if (idx >= count) break;
  }

  return order.subarray(0, idx);
}

// ─── Predictive Pre-Rendering ────────────────────────────────

/**
 * Predict scroll direction from velocity and pre-compute
 * which bars to render next.
 *
 * @param {number} velocity — current scroll velocity (bars/frame)
 * @param {number} visibleStart — current visible start index
 * @param {number} visibleEnd — current visible end index
 * @param {number} totalBars — total number of bars
 * @param {number} [bufferSize=100] — extra bars to pre-render
 * @returns {{start: number, end: number}} — expanded range
 */
export function predictiveRange(velocity, visibleStart, visibleEnd, totalBars, bufferSize = 100) {
  const visibleCount = visibleEnd - visibleStart;
  const buffer = Math.min(bufferSize, visibleCount);

  let expandLeft = buffer;
  let expandRight = buffer;

  // Bias expansion toward scroll direction
  if (velocity > 0.5) {
    // Scrolling right → pre-render right edge
    expandRight = buffer * 2;
    expandLeft = Math.floor(buffer * 0.5);
  } else if (velocity < -0.5) {
    // Scrolling left → pre-render left edge
    expandLeft = buffer * 2;
    expandRight = Math.floor(buffer * 0.5);
  }

  return {
    start: Math.max(0, visibleStart - expandLeft),
    end: Math.min(totalBars, visibleEnd + expandRight),
  };
}

// ─── Smooth Line Anti-Aliasing ───────────────────────────────

/**
 * Draw a high-quality anti-aliased line using Gaussian sub-pixel
 * rendering. Produces smoother lines than the default Canvas AA.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x: number, y: number}>} points
 * @param {string} color
 * @param {number} width — line width in CSS pixels
 * @param {number} pixelRatio
 */
export function drawGaussianLine(ctx, points, color, width, pixelRatio) {
  if (!points || points.length < 2) return;

  const pr = pixelRatio;
  const w = width * pr;

  // Multi-pass rendering for Gaussian-quality AA
  const passes = w < 2 ? 3 : 2;
  const alphaStep = 1 / passes;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let pass = passes - 1; pass >= 0; pass--) {
    const expandedWidth = w + pass * 0.8 * pr;
    const alpha = pass === 0 ? 1 : alphaStep * (passes - pass) * 0.3;

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = expandedWidth;

    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const x = points[i].x * pr;
      const y = points[i].y * pr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Temporal Anti-Aliasing Helper ───────────────────────────

/**
 * Apply temporal anti-aliasing by blending the current frame
 * with the previous frame during zoom/pan animations.
 * This eliminates shimmer artifacts.
 *
 * @param {CanvasRenderingContext2D} ctx — current frame context
 * @param {HTMLCanvasElement} previousFrame — previous frame snapshot
 * @param {number} blendFactor — 0 to 1 (0 = all previous, 1 = all current)
 */
export function applyTemporalAA(ctx, previousFrame, blendFactor = 0.7) {
  if (!previousFrame || blendFactor >= 1) return;

  ctx.save();
  ctx.globalAlpha = 1 - blendFactor;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(previousFrame, 0, 0);
  ctx.restore();
}
