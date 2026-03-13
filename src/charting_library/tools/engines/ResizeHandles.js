// ═══════════════════════════════════════════════════════════════════
// charEdge — ResizeHandles
// Compute, hit-test, and apply 8-handle resize for shape drawings.
//
// Handle layout on a bounding box:
//   TL ──── T ──── TR
//   │              │
//   L    (body)    R
//   │              │
//   BL ──── B ──── BR
//
// Corners (TL,TR,BL,BR) → free resize (both axes)
// Edges   (T,B)         → vertical-only resize
// Edges   (L,R)         → horizontal-only resize
// ═══════════════════════════════════════════════════════════════════

// Tools that get 8-handle treatment (bounding-box shapes with 2 anchor points)
export const RESIZABLE_TOOLS = new Set([
  'rect', 'ellipse', 'measure', 'pricerange', 'alertzone', 'note',
]);

// Handle type → cursor CSS
export const HANDLE_CURSORS = {
  tl: 'nwse-resize',
  tr: 'nesw-resize',
  bl: 'nesw-resize',
  br: 'nwse-resize',
  t:  'ns-resize',
  b:  'ns-resize',
  l:  'ew-resize',
  r:  'ew-resize',
};

const HANDLE_RADIUS = 4; // CSS pixels (hit radius)

/**
 * Compute the 8 resize handles for a 2-point bounding-box shape.
 *
 * @param {Array<{x:number,y:number}>} pixelPoints  2 pixel-space anchor points
 * @returns {Array<{type:string, x:number, y:number, cursor:string, isEdge:boolean}>}
 */
export function computeResizeHandles(pixelPoints) {
  if (!pixelPoints || pixelPoints.length < 2) return [];

  const [p0, p1] = pixelPoints;
  const left = Math.min(p0.x, p1.x);
  const right = Math.max(p0.x, p1.x);
  const top = Math.min(p0.y, p1.y);
  const bottom = Math.max(p0.y, p1.y);
  const midX = (left + right) / 2;
  const midY = (top + bottom) / 2;

  return [
    // Corners (circles)
    { type: 'tl', x: left,  y: top,    cursor: HANDLE_CURSORS.tl, isEdge: false },
    { type: 'tr', x: right, y: top,    cursor: HANDLE_CURSORS.tr, isEdge: false },
    { type: 'bl', x: left,  y: bottom, cursor: HANDLE_CURSORS.bl, isEdge: false },
    { type: 'br', x: right, y: bottom, cursor: HANDLE_CURSORS.br, isEdge: false },
    // Edge midpoints (squares)
    { type: 't',  x: midX,  y: top,    cursor: HANDLE_CURSORS.t,  isEdge: true },
    { type: 'b',  x: midX,  y: bottom, cursor: HANDLE_CURSORS.b,  isEdge: true },
    { type: 'l',  x: left,  y: midY,   cursor: HANDLE_CURSORS.l,  isEdge: true },
    { type: 'r',  x: right, y: midY,   cursor: HANDLE_CURSORS.r,  isEdge: true },
  ];
}

/**
 * Hit-test resize handles — returns the first handle within radius, or null.
 *
 * @param {Array} handles  from computeResizeHandles
 * @param {number} mouseX  CSS pixel X
 * @param {number} mouseY  CSS pixel Y
 * @returns {{ type:string, cursor:string } | null}
 */
export function hitTestResizeHandle(handles, mouseX, mouseY) {
  const threshold = HANDLE_RADIUS + 3; // generous hit area
  for (const h of handles) {
    const dx = mouseX - h.x;
    const dy = mouseY - h.y;
    if (dx * dx + dy * dy <= threshold * threshold) {
      return h;
    }
  }
  return null;
}

/**
 * Apply a resize drag — returns new price/time anchor points.
 *
 * @param {string} handleType  'tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r'
 * @param {Array<{price:number,time:number}>} originalPoints  original 2 anchor points
 * @param {{price:number,time:number}} mouseAnchor  current mouse in price/time space
 * @returns {Array<{price:number,time:number}>}  new 2 anchor points
 */
export function applyHandleDrag(handleType, originalPoints, mouseAnchor) {
  if (originalPoints.length < 2) return originalPoints;

  // p0 = "start" point, p1 = "end" point
  const p0 = { ...originalPoints[0] };
  const p1 = { ...originalPoints[1] };

  // Determine which edges are anchored vs free
  // For shapes: p0 and p1 define a bounding box
  // We need to figure out which is top-left vs bottom-right
  const leftTime = Math.min(p0.time, p1.time);
  const rightTime = Math.max(p0.time, p1.time);
  const topPrice = Math.max(p0.price, p1.price);   // Higher price = top of chart
  const bottomPrice = Math.min(p0.price, p1.price); // Lower price = bottom

  let newLeftTime = leftTime, newRightTime = rightTime;
  let newTopPrice = topPrice, newBottomPrice = bottomPrice;

  switch (handleType) {
    case 'tl':
      newLeftTime = mouseAnchor.time;
      newTopPrice = mouseAnchor.price;
      break;
    case 'tr':
      newRightTime = mouseAnchor.time;
      newTopPrice = mouseAnchor.price;
      break;
    case 'bl':
      newLeftTime = mouseAnchor.time;
      newBottomPrice = mouseAnchor.price;
      break;
    case 'br':
      newRightTime = mouseAnchor.time;
      newBottomPrice = mouseAnchor.price;
      break;
    case 't':
      newTopPrice = mouseAnchor.price;
      break;
    case 'b':
      newBottomPrice = mouseAnchor.price;
      break;
    case 'l':
      newLeftTime = mouseAnchor.time;
      break;
    case 'r':
      newRightTime = mouseAnchor.time;
      break;
  }

  // Reconstruct the two anchor points in the same order as original
  // p0 was the first point placed, p1 the second
  // We need to map back: if p0 had the smaller time, it was "left"
  const p0WasLeft = p0.time <= p1.time;
  const p0WasTop = p0.price >= p1.price;

  return [
    {
      time: p0WasLeft ? newLeftTime : newRightTime,
      price: p0WasTop ? newTopPrice : newBottomPrice,
    },
    {
      time: p0WasLeft ? newRightTime : newLeftTime,
      price: p0WasTop ? newBottomPrice : newTopPrice,
    },
  ];
}

/**
 * Render the 8 resize handles on a canvas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} handles  from computeResizeHandles
 * @param {number} pr  pixel ratio
 * @param {string|null} hoveredType  currently hovered handle type (for glow)
 */
export function renderResizeHandles(ctx, handles, pr, hoveredType = null) {
  for (const h of handles) {
    const bx = Math.round(h.x * pr);
    const by = Math.round(h.y * pr);
    const isHovered = h.type === hoveredType;

    ctx.save();

    if (isHovered) {
      ctx.shadowColor = '#2962FF';
      ctx.shadowBlur = 8 * pr;
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 3 * pr;
    }

    if (h.isEdge) {
      // ■ Square handle for edge midpoints
      const size = Math.round((isHovered ? 5.5 : 4) * pr);
      // Blue border
      ctx.fillStyle = '#2962FF';
      ctx.fillRect(bx - size - Math.round(1.5 * pr), by - size - Math.round(1.5 * pr),
                   (size + Math.round(1.5 * pr)) * 2, (size + Math.round(1.5 * pr)) * 2);
      // White fill
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(bx - size, by - size, size * 2, size * 2);
    } else {
      // ● Circle handle for corners
      const r = Math.round((isHovered ? 5.5 : 4) * pr);
      // Blue border
      ctx.beginPath();
      ctx.arc(bx, by, r + Math.round(1.5 * pr), 0, Math.PI * 2);
      ctx.fillStyle = '#2962FF';
      ctx.fill();
      // White fill
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }

    ctx.restore();
  }
}
