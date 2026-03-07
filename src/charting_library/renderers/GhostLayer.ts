// ═══════════════════════════════════════════════════════════════════
// charEdge — Ghost Layer for Trade Markers (F5.3)
//
// Canvas renderer that draws trade markers at 20% opacity, with
// proximity-fade to 100% at 80px cursor distance. Uses squared
// Euclidean distance for performance (no sqrt).
// ═══════════════════════════════════════════════════════════════════

export interface TradeMarker {
  /** X position on canvas (pixel) */
  x: number;
  /** Y position on canvas (pixel) */
  y: number;
  /** Color hex for the marker */
  color: string;
  /** 'long' or 'short' */
  side: 'long' | 'short';
  /** Trade label (symbol, P&L, etc.) */
  label?: string;
  /** Marker radius */
  radius?: number;
}

const GHOST_OPACITY = 0.20;
const FULL_OPACITY = 1.0;
const FADE_DISTANCE = 80;
const FADE_DISTANCE_SQ = FADE_DISTANCE * FADE_DISTANCE;
const DEFAULT_RADIUS = 6;

/**
 * Compute opacity for a marker based on cursor distance.
 * Uses squared distance to avoid expensive sqrt.
 */
function computeOpacity(
  markerX: number,
  markerY: number,
  cursorX: number,
  cursorY: number,
): number {
  const dx = markerX - cursorX;
  const dy = markerY - cursorY;
  const distSq = dx * dx + dy * dy;

  if (distSq <= 0) return FULL_OPACITY;
  if (distSq >= FADE_DISTANCE_SQ) return GHOST_OPACITY;

  // Linear interpolation based on squared distance ratio
  const t = 1 - distSq / FADE_DISTANCE_SQ;
  return GHOST_OPACITY + t * (FULL_OPACITY - GHOST_OPACITY);
}

/**
 * Parse hex color to RGB components.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

/**
 * Render trade markers with ghost-layer proximity fade.
 *
 * @param ctx - Canvas 2D context
 * @param markers - Array of trade markers to render
 * @param cursorX - Current cursor X (or -1 if no cursor)
 * @param cursorY - Current cursor Y (or -1 if no cursor)
 * @param dpr - Device pixel ratio
 */
export function renderGhostLayer(
  ctx: CanvasRenderingContext2D,
  markers: TradeMarker[],
  cursorX: number,
  cursorY: number,
  dpr: number = 1,
): void {
  if (!markers.length) return;

  const hasCursor = cursorX >= 0 && cursorY >= 0;

  ctx.save();
  ctx.scale(dpr, dpr);

  for (const marker of markers) {
    const opacity = hasCursor
      ? computeOpacity(marker.x, marker.y, cursorX, cursorY)
      : GHOST_OPACITY;

    const { r, g, b } = hexToRgb(marker.color);
    const radius = marker.radius || DEFAULT_RADIUS;

    // Draw marker circle
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    ctx.fill();

    // Draw direction arrow
    ctx.beginPath();
    const arrowSize = radius * 0.6;
    if (marker.side === 'long') {
      // Up arrow
      ctx.moveTo(marker.x, marker.y - arrowSize);
      ctx.lineTo(marker.x - arrowSize * 0.6, marker.y + arrowSize * 0.3);
      ctx.lineTo(marker.x + arrowSize * 0.6, marker.y + arrowSize * 0.3);
    } else {
      // Down arrow
      ctx.moveTo(marker.x, marker.y + arrowSize);
      ctx.lineTo(marker.x - arrowSize * 0.6, marker.y - arrowSize * 0.3);
      ctx.lineTo(marker.x + arrowSize * 0.6, marker.y - arrowSize * 0.3);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.9})`;
    ctx.fill();

    // Draw label if visible enough
    if (opacity > 0.4 && marker.label) {
      ctx.font = '500 10px var(--tf-mono, monospace)';
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(marker.label, marker.x, marker.y + radius + 4);
    }
  }

  ctx.restore();
}

export default renderGhostLayer;
