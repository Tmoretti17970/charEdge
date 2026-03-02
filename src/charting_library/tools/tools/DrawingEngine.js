// ═══════════════════════════════════════════════════════════════════
// charEdge — DrawingEngine
// State machine for drawing tool interactions.
//
// States:
//   IDLE     → No tool active, click selects/deselects drawings
//   CREATING → Tool active, clicking places anchor points
//   SELECTED → A drawing is selected, can drag anchors or delete
//   DRAGGING → An anchor point is being dragged
//   MOVING   → Entire drawing is being moved
//
// The engine does NOT render — it manages data and emits events.
// Rendering is handled by DrawingRenderer (separate file).
// ═══════════════════════════════════════════════════════════════════

import { createDrawing, TOOL_POINT_COUNT } from './DrawingModel.js';

/** Interaction states */
const STATE = {
  IDLE: 'idle',
  CREATING: 'creating',
  SELECTED: 'selected',
  DRAGGING: 'dragging',
  MOVING: 'moving',
};

/** Hit-test distance threshold in CSS pixels */
const HIT_THRESHOLD = 8;
const ANCHOR_RADIUS = 5;

/**
 * Create a DrawingEngine instance.
 *
 * @param {Object} [options]
 * @param {(drawings: Drawing[]) => void} [options.onChange] - Called when drawings change
 * @param {(state: string) => void} [options.onStateChange] - Called when interaction state changes
 * @returns {Object} DrawingEngine
 */
export function createDrawingEngine(options = {}) {
  const { onChange, onStateChange, magnetSnap } = options;

  // ── State ──
  /** @type {import('./DrawingModel.js').Drawing[]} */
  let drawings = [];
  let interactionState = STATE.IDLE;
  let activeTool = null; // Current tool type being created
  let activeDrawing = null; // Drawing currently being created or edited
  let selectedDrawingId = null; // ID of selected drawing
  let selectedDrawingIds = new Set(); // Sprint 13.3: Multi-select IDs
  let hoveredDrawingId = null; // ID of hovered drawing (for glow effect)
  let hoveredAnchorIdx = -1; // Sprint 13.2: Index of hovered anchor (for cursor)
  let dragAnchorIdx = -1; // Index of anchor being dragged
  let _dragStartPrice = 0; // Start price for whole-drawing moves
  let _dragStartTime = 0; // Start time for whole-drawing moves
  let dragPointOffsets = []; // Offsets for whole-drawing moves
  let clipboard = null; // Clipboard for copy/paste

  // ── Sticky mode ──
  let stickyMode = false; // When true, tool stays active after each drawing
  let stickyToolType = null; // Tool type to re-activate
  let stickyStyleOverrides = {}; // Style to re-apply
  /** Per-tool last-used style memory: { toolType: { color, lineWidth, ... } } */
  let toolStyleMemory = {};

  // Coordinate converters (set by the chart engine)
  let pixelToPrice = null; // (y) => price
  let pixelToTime = null; // (x) => time
  let priceToPixel = null; // (price) => y
  let timeToPixel = null; // (time) => x

  // ── Advanced Snap Data Sources ──
  /** Overlay indicator data for snap-to-indicator-value feature */
  let _indicatorData = []; // [ { label, outputs: [{ key, values: number[] }] } ]
  /** Current hover bar index for indicator value lookup */
  let _hoverBarIdx = -1;
  /** Grid tick values for snap-to-grid feature */
  let _gridTicks = [];
  /** Scene graph for spatial-index-accelerated hitTest (Phase 2) */
  let _sceneGraph = null;

  function emit() {
    if (onChange) onChange([...drawings]);
  }

  function emitState() {
    if (onStateChange) onStateChange(interactionState);
  }

  function setState(newState) {
    interactionState = newState;
    emitState();
  }

  // ═══════════════════════════════════════════════════════════════
  // Coordinate Conversion
  // ═══════════════════════════════════════════════════════════════

  /**
   * Update coordinate converters. Called by ChartEngine on every
   * viewport change (scroll, zoom, resize).
   */
  function setCoordinateConverters(converters) {
    pixelToPrice = converters.pixelToPrice;
    pixelToTime = converters.pixelToTime;
    priceToPixel = converters.priceToPixel;
    timeToPixel = converters.timeToPixel;
  }

  /**
   * Convert a drawing anchor point to pixel coordinates.
   * @param {import('./DrawingModel.js').AnchorPoint} point
   * @returns {{x: number, y: number}|null}
   */
  function anchorToPixel(point) {
    if (!priceToPixel || !timeToPixel) return null;
    return {
      x: timeToPixel(point.time),
      y: priceToPixel(point.price),
    };
  }

  /**
   * Convert pixel coordinates to a drawing anchor point.
   * @param {number} x - CSS pixel X
   * @param {number} y - CSS pixel Y
   * @returns {import('./DrawingModel.js').AnchorPoint}
   */
  function pixelToAnchor(x, y) {
    return {
      price: pixelToPrice ? pixelToPrice(y) : 0,
      time: pixelToTime ? pixelToTime(x) : Date.now(),
    };
  }

  /**
   * Enhanced magnet snap — snaps to OHLC, wick midpoints, body centers,
   * existing drawing endpoints, indicator values, round prices, and grid lines.
   * Returns { price, time, snapTarget, snapLabel } for visual feedback.
   */
  let snapStrength = 15; // Pixel radius for snap detection
  let angleSnap = false; // When true (Shift held), lock to 0°/15°/30°/45°/90°
  let smartGuides = true; // Show alignment lines to nearby drawings
  let lastSnapInfo = null; // For visual indicator rendering

  function setSnapStrength(val) { snapStrength = Math.max(3, Math.min(50, val)); }
  function setAngleSnap(val) { angleSnap = val; }
  function setSmartGuides(val) { smartGuides = val; }

  /**
   * Compute adaptive round-number snap levels for a given price.
   * Returns an array of nearby round numbers to snap to.
   * @param {number} price - Current cursor price
   * @returns {Array<{price: number, label: string}>}
   */
  function getRoundPriceLevels(price) {
    const absP = Math.abs(price);
    // Choose round intervals based on price magnitude
    let intervals;
    if (absP >= 10000)      intervals = [10000, 5000, 1000, 500]; // BTC, indices
    else if (absP >= 1000)  intervals = [1000, 500, 100, 50];
    else if (absP >= 100)   intervals = [100, 50, 25, 10];
    else if (absP >= 10)    intervals = [10, 5, 1, 0.5];
    else if (absP >= 1)     intervals = [1, 0.5, 0.25, 0.1];
    else                    intervals = [0.1, 0.05, 0.01, 0.005]; // Penny stocks, forex

    const levels = [];
    for (const iv of intervals) {
      const rounded = Math.round(price / iv) * iv;
      // Include rounded and the one above/below
      for (const r of [rounded - iv, rounded, rounded + iv]) {
        if (r > 0 && Math.abs(r - price) < absP * 0.03) { // Within 3% of price
          levels.push({ price: r, label: `$${formatRound(r)}` });
        }
      }
    }
    return levels;
  }

  /** Format a round number for display */
  function formatRound(n) {
    if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (n >= 1)    return n.toFixed(n % 1 === 0 ? 0 : 2);
    return n.toPrecision(3);
  }

  function doMagnetSnap(x, y, price, time) {
    lastSnapInfo = null;
    if (!magnetSnap && snapStrength <= 0) return { price, time };

    // Collect all candidate snap targets with pixel positions
    const candidates = [];

    // 1. External magnet snap (original OHLC from chart data) — highest priority
    if (magnetSnap) {
      const ext = magnetSnap(price, time);
      if (ext && (ext.price !== price || ext.time !== time)) {
        const py = priceToPixel ? Math.abs(y - priceToPixel(ext.price)) : 0;
        candidates.push({ price: ext.price, time: ext.time, label: ext.label || 'OHLC', type: 'ohlc', priority: 1, dist: py });
      }
    }

    // 2. Existing drawing endpoints — snap to anchor points of other drawings
    for (const d of drawings) {
      if (d === activeDrawing || !d.visible) continue;
      for (const pt of d.points || []) {
        const px = anchorToPixel(pt);
        if (!px) continue;
        const dist = Math.sqrt((x - px.x) ** 2 + (y - px.y) ** 2);
        if (dist < snapStrength) {
          candidates.push({ price: pt.price, time: pt.time, label: 'Drawing', type: 'drawing', priority: 2, dist });
        }
      }
    }

    // 3. Horizontal line levels from existing hline/hray drawings
    for (const d of drawings) {
      if (d === activeDrawing || !d.visible) continue;
      if ((d.type === 'hline' || d.type === 'hray') && d.points?.[0]) {
        const py = priceToPixel ? priceToPixel(d.points[0].price) : null;
        if (py !== null && Math.abs(y - py) < snapStrength) {
          candidates.push({ price: d.points[0].price, time, label: 'H-Line', type: 'drawing', priority: 3, dist: Math.abs(y - py) });
        }
      }
    }

    // 4. Round price numbers — adaptive based on price magnitude
    if (priceToPixel) {
      const roundLevels = getRoundPriceLevels(price);
      for (const lvl of roundLevels) {
        const py = priceToPixel(lvl.price);
        const dist = Math.abs(y - py);
        if (dist < snapStrength * 0.8) { // Slightly tighter threshold for round numbers
          candidates.push({ price: lvl.price, time, label: lvl.label, type: 'round', priority: 4, dist });
        }
      }
    }

    // 5. Indicator values — snap to overlay indicator lines at current bar
    if (_indicatorData.length > 0 && _hoverBarIdx >= 0 && priceToPixel) {
      for (const ind of _indicatorData) {
        for (const out of ind.outputs || []) {
          const vals = out.values;
          if (!vals || _hoverBarIdx >= vals.length) continue;
          const val = vals[_hoverBarIdx];
          if (isNaN(val) || val == null) continue;
          const py = priceToPixel(val);
          const dist = Math.abs(y - py);
          if (dist < snapStrength) {
            candidates.push({ price: val, time, label: ind.label || out.key, type: 'indicator', priority: 5, dist });
          }
        }
      }
    }

    // 6. Grid line values — snap to price axis grid
    if (_gridTicks.length > 0 && priceToPixel) {
      for (const tick of _gridTicks) {
        const py = priceToPixel(tick);
        const dist = Math.abs(y - py);
        if (dist < snapStrength * 0.6) { // Tightest threshold for grid
          candidates.push({ price: tick, time, label: 'Grid', type: 'grid', priority: 6, dist });
        }
      }
    }

    // Pick best candidate (lowest dist, then highest priority)
    if (candidates.length > 0) {
      candidates.sort((a, b) => (a.dist || 0) - (b.dist || 0) || a.priority - b.priority);
      const best = candidates[0];
      lastSnapInfo = { x, y, label: best.label, type: best.type || 'ohlc', price: best.price, time: best.time };
      return { price: best.price, time: best.time };
    }

    return { price, time };
  }

  /**
   * Apply angle snapping when Shift is held during trendline creation.
   * Locks to 0°, 15°, 30°, 45°, 60°, 75°, 90° increments.
   */
  function applyAngleSnap(startPx, endX, endY) {
    if (!angleSnap || !startPx) return { x: endX, y: endY };
    const dx = endX - startPx.x;
    const dy = endY - startPx.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 5) return { x: endX, y: endY };

    const angle = Math.atan2(dy, dx);
    const snapAngles = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, -15, -30, -45, -60, -75, -90, -105, -120, -135, -150, -165];
    const degAngle = (angle * 180) / Math.PI;
    let closest = 0;
    let minDiff = 360;
    for (const sa of snapAngles) {
      const diff = Math.abs(degAngle - sa);
      if (diff < minDiff) { minDiff = diff; closest = sa; }
    }
    const radSnapped = (closest * Math.PI) / 180;
    return {
      x: startPx.x + dist * Math.cos(radSnapped),
      y: startPx.y + dist * Math.sin(radSnapped),
    };
  }

  /**
   * Get smart guide lines for the current drawing position.
   * Returns alignment lines to nearby drawing anchors.
   */
  function getSmartGuides(x, y) {
    if (!smartGuides) return [];
    const guides = [];
    const threshold = 4; // pixel threshold for alignment

    for (const d of drawings) {
      if (d === activeDrawing || !d.visible) continue;
      for (const pt of d.points || []) {
        const px = anchorToPixel(pt);
        if (!px) continue;
        // Horizontal alignment
        if (Math.abs(y - px.y) < threshold) {
          guides.push({ type: 'horizontal', y: px.y, fromX: Math.min(x, px.x) - 20, toX: Math.max(x, px.x) + 20 });
        }
        // Vertical alignment
        if (Math.abs(x - px.x) < threshold) {
          guides.push({ type: 'vertical', x: px.x, fromY: Math.min(y, px.y) - 20, toY: Math.max(y, px.y) + 20 });
        }
      }
    }
    return guides;
  }

  // ═══════════════════════════════════════════════════════════════
  // Hit Testing
  // ═══════════════════════════════════════════════════════════════

  /**
 * Test if a pixel coordinate hits a drawing.
 * Returns the drawing and optionally which anchor point was hit.
 *
 * Uses SpatialIndex from the scene graph (if available) as a
 * fast broad-phase filter, then runs fine-grained hit-testing
 * only on candidates. Falls back to full O(n) iteration if
 * no scene graph is connected.
 *
 * @param {number} x - CSS pixel X
 * @param {number} y - CSS pixel Y
 * @returns {{drawing: Drawing, anchorIdx: number}|null}
 */
  function hitTest(x, y) {
    // Determine candidate set
    let candidates = null;
    if (_sceneGraph) {
      const nodes = _sceneGraph.queryPoint(x, y);
      if (nodes.length > 0) {
        const candidateIds = new Set(nodes.filter(n => n.type === 'drawing').map(n => n.data?.id));
        if (candidateIds.size > 0) {
          candidates = [];
          // Preserve reverse order (topmost first) like original
          for (let i = drawings.length - 1; i >= 0; i--) {
            if (candidateIds.has(drawings[i].id)) candidates.push(drawings[i]);
          }
        }
      }
    }

    // Fall back to full list if no scene graph or no candidates found
    const testList = candidates || drawings;
    const reverseOrder = !candidates; // candidates already reversed

    if (reverseOrder) {
      for (let i = testList.length - 1; i >= 0; i--) {
        const result = _hitTestSingle(testList[i], x, y);
        if (result) return result;
      }
    } else {
      for (const d of testList) {
        const result = _hitTestSingle(d, x, y);
        if (result) return result;
      }
    }
    return null;
  }

  function _hitTestSingle(d, x, y) {
    if (!d.visible || d.state === 'creating') return null;

    // Test anchor points first (higher priority)
    for (let j = 0; j < d.points.length; j++) {
      const px = anchorToPixel(d.points[j]);
      if (!px) continue;
      const dist = Math.sqrt((x - px.x) ** 2 + (y - px.y) ** 2);
      if (dist <= ANCHOR_RADIUS + 2) {
        return { drawing: d, anchorIdx: j };
      }
    }

    // Test the drawing body
    if (hitTestDrawing(d, x, y)) {
      return { drawing: d, anchorIdx: -1 };
    }
    return null;
  }

  /**
   * Hit-test a specific drawing's body (lines, rects, etc).
   */
  function hitTestDrawing(drawing, x, y) {
    const points = drawing.points.map((p) => anchorToPixel(p)).filter(Boolean);
    if (points.length === 0) return false;

    switch (drawing.type) {
      case 'trendline':
      case 'arrow':
      case 'ray':
      case 'extendedline':
        return points.length >= 2 && distToSegment(x, y, points[0], points[1]) < HIT_THRESHOLD;

      case 'hray':
      case 'hline':
        return points.length >= 1 && Math.abs(y - points[0].y) < HIT_THRESHOLD;

      case 'vline':
        return points.length >= 1 && Math.abs(x - points[0].x) < HIT_THRESHOLD;

      case 'crossline':
        return (
          points.length >= 1 && (Math.abs(y - points[0].y) < HIT_THRESHOLD || Math.abs(x - points[0].x) < HIT_THRESHOLD)
        );

      case 'fib': {
        if (points.length < 2) return false;
        // Hit test fib region (between the two price levels)
        const minY = Math.min(points[0].y, points[1].y);
        const maxY = Math.max(points[0].y, points[1].y);
        return y >= minY - HIT_THRESHOLD && y <= maxY + HIT_THRESHOLD;
      }

      case 'rect': {
        if (points.length < 2) return false;
        const left = Math.min(points[0].x, points[1].x);
        const right = Math.max(points[0].x, points[1].x);
        const top = Math.min(points[0].y, points[1].y);
        const bottom = Math.max(points[0].y, points[1].y);
        // Hit on edge or inside
        return (
          x >= left - HIT_THRESHOLD &&
          x <= right + HIT_THRESHOLD &&
          y >= top - HIT_THRESHOLD &&
          y <= bottom + HIT_THRESHOLD
        );
      }

      case 'channel':
        if (points.length < 2) return false;
        return distToSegment(x, y, points[0], points[1]) < HIT_THRESHOLD * 3;

      case 'triangle': {
        if (points.length < 3) return false;
        return (
          distToSegment(x, y, points[0], points[1]) < HIT_THRESHOLD ||
          distToSegment(x, y, points[1], points[2]) < HIT_THRESHOLD ||
          distToSegment(x, y, points[2], points[0]) < HIT_THRESHOLD
        );
      }

      case 'ellipse': {
        if (points.length < 2) return false;
        const minX = Math.min(points[0].x, points[1].x);
        const maxX = Math.max(points[0].x, points[1].x);
        const minY = Math.min(points[0].y, points[1].y);
        const maxY = Math.max(points[0].y, points[1].y);

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const radiusX = (maxX - minX) / 2;
        const radiusY = (maxY - minY) / 2;

        if (radiusX === 0 || radiusY === 0) return false;

        const dx = x - centerX;
        const dy = y - centerY;

        if (
          x >= minX - HIT_THRESHOLD &&
          x <= maxX + HIT_THRESHOLD &&
          y >= minY - HIT_THRESHOLD &&
          y <= maxY + HIT_THRESHOLD
        ) {
          const distToCenter = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);
          const expectedDist = Math.sqrt(
            1 / (Math.pow(Math.cos(angle) / radiusX, 2) + Math.pow(Math.sin(angle) / radiusY, 2)),
          );

          if (Math.abs(distToCenter - expectedDist) < HIT_THRESHOLD) return true;

          const style = drawing.style || {};
          if (style.fillColor && distToCenter <= expectedDist) return true;
        }
        return false;
      }

      case 'text':
      case 'callout': {
        if (points.length < 1) return false;
        const style = drawing.style || {};
        const text = drawing.meta?.text || (drawing.type === 'callout' ? 'Price Note' : 'Text');
        const fontSize = parseInt(style.font || '14');
        const padding = drawing.type === 'callout' ? 6 : 0;
        const pointerSize = drawing.type === 'callout' ? 8 : 0;

        const w = text.length * fontSize * 0.6 + padding * 2;
        const h = fontSize * 1.2 + padding * 2;

        let boxX, boxY;
        if (drawing.type === 'callout') {
          boxX = points[0].x + pointerSize;
          boxY = points[0].y - h - pointerSize;
        } else {
          boxX = points[0].x;
          boxY = points[0].y;
        }

        return (
          x >= boxX - HIT_THRESHOLD &&
          x <= boxX + w + HIT_THRESHOLD &&
          y >= boxY - HIT_THRESHOLD &&
          y <= boxY + h + HIT_THRESHOLD
        );
      }

      case 'pitchfork': {
        if (points.length < 3) return false;

        // Base line
        if (distToSegment(x, y, points[1], points[2]) < HIT_THRESHOLD) return true;

        const midX = (points[1].x + points[2].x) / 2;
        const midY = (points[1].y + points[2].y) / 2;

        const dx = midX - points[0].x;
        const dy = midY - points[0].y;
        const len = Math.sqrt(dx * dx + dy * dy);

        if (len > 0) {
          // A long enough segment to represent the infinite line for hit testing
          const scale = 10000 / len;
          const endX = points[0].x + dx * scale;
          const endY = points[0].y + dy * scale;

          // Median line
          if (distToSegment(x, y, points[0], { x: endX, y: endY }) < HIT_THRESHOLD) return true;

          // Parallel 1
          if (
            distToSegment(x, y, points[1], { x: points[1].x + dx * scale, y: points[1].y + dy * scale }) < HIT_THRESHOLD
          )
            return true;

          // Parallel 2
          if (
            distToSegment(x, y, points[2], { x: points[2].x + dx * scale, y: points[2].y + dy * scale }) < HIT_THRESHOLD
          )
            return true;
        }
        return false;
      }

      case 'measure': {
        if (points.length < 2) return false;
        const left = Math.min(points[0].x, points[1].x);
        const right = Math.max(points[0].x, points[1].x);
        const top = Math.min(points[0].y, points[1].y);
        const bottom = Math.max(points[0].y, points[1].y);
        return (
          x >= left - HIT_THRESHOLD &&
          x <= right + HIT_THRESHOLD &&
          y >= top - HIT_THRESHOLD &&
          y <= bottom + HIT_THRESHOLD
        );
      }

      case 'longposition':
      case 'shortposition': {
        if (points.length < 2) return false;
        // The bounds are determined by entry point X to some default width
        // For simplicity, we create a rectangular bounding box around the entry and target points
        const isLong = drawing.type === 'longposition';
        const entryHeight = points[0].y;
        const targetHeight = points[1].y;
        const stopHeight = entryHeight + (entryHeight - targetHeight); // Symmetric default stop

        const top = Math.min(targetHeight, stopHeight);
        const bottom = Math.max(targetHeight, stopHeight);
        const left = points[0].x;
        // Default width is about 100 pixels ahead, or distance to target
        const right = left + Math.max(100, Math.abs(points[1].x - left));

        return (
          x >= left - HIT_THRESHOLD &&
          x <= right + HIT_THRESHOLD &&
          y >= top - HIT_THRESHOLD &&
          y <= bottom + HIT_THRESHOLD
        );
      }

      case 'gannfan': {
        if (points.length < 2) return false;
        const origin = points[0];
        const target = points[1];
        const dx = target.x - origin.x;
        const dy = target.y - origin.y;

        // Base line is 1x1
        if (distToSegment(x, y, origin, { x: origin.x + dx * 10, y: origin.y + dy * 10 }) < HIT_THRESHOLD) return true;

        // Very basic hit test for the fan: check if it's generally within the fan area
        // More precise ray testing would check each Gann angle
        return distToSegment(x, y, origin, target) < HIT_THRESHOLD * 5;
      }

      case 'fibtimezone': {
        if (points.length < 2) return false;
        // We just need to check if we hit any of the vertical lines
        const dx = points[1].x - points[0].x;
        if (Math.abs(dx) < 1) return false; // Too narrow

        // Standard fib sequence
        const fibs = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55];

        for (const f of fibs) {
          const lineX = points[0].x + dx * f;
          if (Math.abs(x - lineX) < HIT_THRESHOLD) return true;
        }
        return false;
      }

      case 'alertzone': {
        if (points.length < 2) return false;
        const top = Math.min(points[0].y, points[1].y);
        const bottom = Math.max(points[0].y, points[1].y);
        return y >= top - HIT_THRESHOLD && y <= bottom + HIT_THRESHOLD;
      }

      case 'fibext': {
        // Fib extension uses 3 points; hit-test the price range spanned by all anchors
        if (points.length < 2) return false;
        const allY = points.map((p) => p.y);
        const minY = Math.min(...allY);
        const maxY = Math.max(...allY);
        return y >= minY - HIT_THRESHOLD && y <= maxY + HIT_THRESHOLD;
      }

      case 'elliott': {
        // Elliott wave: hit-test each connecting segment between wave points
        if (points.length < 2) return false;
        for (let i = 0; i < points.length - 1; i++) {
          if (distToSegment(x, y, points[i], points[i + 1]) < HIT_THRESHOLD) return true;
        }
        return false;
      }

      case 'infoline':
        return points.length >= 2 && distToSegment(x, y, points[0], points[1]) < HIT_THRESHOLD;

      case 'parallelchannel': {
        if (points.length < 2) return false;
        if (distToSegment(x, y, points[0], points[1]) < HIT_THRESHOLD) return true;
        if (points.length >= 3) {
          const dx = points[1].x - points[0].x;
          const dy = points[1].y - points[0].y;
          const p3end = { x: points[2].x + dx, y: points[2].y + dy };
          if (distToSegment(x, y, points[2], p3end) < HIT_THRESHOLD) return true;
        }
        return false;
      }

      case 'polyline': {
        if (points.length < 2) return false;
        for (let i = 0; i < points.length - 1; i++) {
          if (distToSegment(x, y, points[i], points[i + 1]) < HIT_THRESHOLD) return true;
        }
        return false;
      }

      case 'pricerange': {
        if (points.length < 2) return false;
        const prLeft = Math.min(points[0].x, points[1].x);
        const prRight = Math.max(points[0].x, points[1].x);
        const prTop = Math.min(points[0].y, points[1].y);
        const prBot = Math.max(points[0].y, points[1].y);
        return x >= prLeft - HIT_THRESHOLD && x <= prRight + HIT_THRESHOLD &&
               y >= prTop - HIT_THRESHOLD && y <= prBot + HIT_THRESHOLD;
      }

      case 'daterange': {
        if (points.length < 2) return false;
        const drLeft = Math.min(points[0].x, points[1].x);
        const drRight = Math.max(points[0].x, points[1].x);
        return x >= drLeft - HIT_THRESHOLD && x <= drRight + HIT_THRESHOLD;
      }

      case 'note': {
        if (points.length < 1) return false;
        const noteW = 140;
        const noteH = 60;
        return x >= points[0].x - HIT_THRESHOLD && x <= points[0].x + noteW + HIT_THRESHOLD &&
               y >= points[0].y - HIT_THRESHOLD && y <= points[0].y + noteH + HIT_THRESHOLD;
      }

      case 'signpost': {
        if (points.length < 1) return false;
        const dist = Math.sqrt((x - points[0].x) ** 2 + (y - points[0].y) ** 2);
        return dist < 20;
      }

      default:
        return false;
    }
  }

  /**
   * Distance from point to line segment.
   */
  function distToSegment(px, py, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) return Math.sqrt((px - a.x) ** 2 + (py - a.y) ** 2);

    let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = a.x + t * dx;
    const projY = a.y + t * dy;

    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  }

  // ═══════════════════════════════════════════════════════════════
  // Mouse Event Handlers
  // ═══════════════════════════════════════════════════════════════

  let clickDragStartX = 0;
  let clickDragStartY = 0;

  function onMouseDown(x, y) {
    if (interactionState === STATE.CREATING) {
      clickDragStartX = x;
      clickDragStartY = y;

      const p = pixelToAnchor(x, y);
      const snapP = doMagnetSnap(x, y, p.price, p.time);

      if (activeDrawing.points.length > activeDrawing._confirmedPoints) {
        activeDrawing.points[activeDrawing._confirmedPoints] = snapP;
      } else {
        activeDrawing.points.push(snapP);
      }
      activeDrawing._confirmedPoints++;

      const neededPoints = TOOL_POINT_COUNT[activeDrawing.type] || 2;

      if (activeDrawing._confirmedPoints >= neededPoints) {
        // Drawing complete — save style to per-tool memory
        if (activeDrawing.type && activeDrawing.style) {
          toolStyleMemory[activeDrawing.type] = { ...activeDrawing.style };
        }
        activeDrawing.state = 'idle';

        if (stickyMode && stickyToolType) {
          // Re-activate the same tool for the next drawing
          const prevDrawing = activeDrawing;
          activeDrawing = null;
          activeTool = stickyToolType;
          activeDrawing = createDrawing(stickyToolType, null, stickyStyleOverrides);
          activeDrawing._confirmedPoints = 0;
          drawings.push(activeDrawing);
          setState(STATE.CREATING);
        } else {
          activeDrawing = null;
          activeTool = null;
          setState(STATE.IDLE);
        }
      }

      emit();
      return true;
    }

    // Hit test
    const hit = hitTest(x, y);

    if (hit) {
      selectedDrawingId = hit.drawing.id;
      drawings.forEach((d) => (d.state = d.id === selectedDrawingId ? 'selected' : 'idle'));

      if (hit.anchorIdx >= 0 && !hit.drawing.locked) {
        // Start dragging anchor
        dragAnchorIdx = hit.anchorIdx;
        setState(STATE.DRAGGING);
      } else if (!hit.drawing.locked) {
        // Start moving entire drawing
        const anchor = pixelToAnchor(x, y);
        _dragStartPrice = anchor.price;
        _dragStartTime = anchor.time;
        dragPointOffsets = hit.drawing.points.map((p) => ({
          dPrice: p.price - anchor.price,
          dTime: p.time - anchor.time,
        }));
        setState(STATE.MOVING);
      } else {
        setState(STATE.SELECTED);
      }

      emit();
      return true;
    }

    // Click on empty space — deselect
    if (selectedDrawingId) {
      selectedDrawingId = null;
      drawings.forEach((d) => (d.state = 'idle'));
      setState(STATE.IDLE);
      emit();
    }

    return false;
  }

  /**
   * Handle mouse move.
   * @param {number} x
   * @param {number} y
   * @returns {boolean} True if consumed
   */
  function onMouseMove(x, y) {
    if (interactionState === STATE.CREATING && activeDrawing) {
      // Update the "ghost" point (last point follows cursor)
      const neededPoints = TOOL_POINT_COUNT[activeDrawing.type] || 2;
      const rawAnchor = pixelToAnchor(x, y);
      const anchor = doMagnetSnap(x, y, rawAnchor.price, rawAnchor.time);

      if (activeDrawing.points.length > 0 && activeDrawing.points.length < neededPoints) {
        // Replace or add temporary preview point
        if (activeDrawing.points.length === activeDrawing._confirmedPoints) {
          activeDrawing.points.push(anchor);
        } else {
          activeDrawing.points[activeDrawing.points.length - 1] = anchor;
        }
        emit();
      }
      return true;
    }

    if (interactionState === STATE.DRAGGING && selectedDrawingId) {
      const drawing = drawings.find((d) => d.id === selectedDrawingId);
      if (drawing && dragAnchorIdx >= 0) {
        const rawAnchor = pixelToAnchor(x, y);
        drawing.points[dragAnchorIdx] = doMagnetSnap(x, y, rawAnchor.price, rawAnchor.time);
        emit();
      }
      return true;
    }

    if (interactionState === STATE.MOVING && selectedDrawingId) {
      const drawing = drawings.find((d) => d.id === selectedDrawingId);
      if (drawing) {
        const anchor = pixelToAnchor(x, y);
        for (let i = 0; i < drawing.points.length; i++) {
          drawing.points[i] = {
            price: anchor.price + dragPointOffsets[i].dPrice,
            time: anchor.time + dragPointOffsets[i].dTime,
          };
        }
        emit();
      }
      return true;
    }

    // IDLE state: track hovered drawing and anchor for visual feedback
    if (interactionState === STATE.IDLE || interactionState === STATE.SELECTED) {
      const hit = hitTest(x, y);
      const newHoveredId = hit ? hit.drawing.id : null;
      let newAnchorIdx = -1;

      // Sprint 13.2: Check if hovering an anchor point (for cursor change)
      if (hit) {
        for (let ai = 0; ai < hit.drawing.points.length; ai++) {
          const ap = anchorToPixel(hit.drawing.points[ai]);
          if (!ap) continue;
          const dist = Math.sqrt((x - ap.x) ** 2 + (y - ap.y) ** 2);
          if (dist < 8) { newAnchorIdx = ai; break; }
        }
      }

      if (newHoveredId !== hoveredDrawingId || newAnchorIdx !== hoveredAnchorIdx) {
        hoveredDrawingId = newHoveredId;
        hoveredAnchorIdx = newAnchorIdx;
        emit();
      }
    }

    return false;
  }

  /**
   * Handle mouse up.
   * @param {number} [x]
   * @param {number} [y]
   * @returns {boolean}
   */
  function onMouseUp(x, y) {
    if (interactionState === STATE.CREATING && activeDrawing && activeDrawing._confirmedPoints > 0) {
      if (typeof x === 'number' && typeof y === 'number') {
        const dx = x - clickDragStartX;
        const dy = y - clickDragStartY;
        const distSq = dx * dx + dy * dy;

        // If dragged more than ~10 pixels, confirm the point
        if (distSq > 100) {
          const p = pixelToAnchor(x, y);
          const snapP = doMagnetSnap(x, y, p.price, p.time);

          if (activeDrawing.points.length > activeDrawing._confirmedPoints) {
            activeDrawing.points[activeDrawing._confirmedPoints] = snapP;
          } else {
            activeDrawing.points.push(snapP);
          }
          activeDrawing._confirmedPoints++;

          const neededPoints = TOOL_POINT_COUNT[activeDrawing.type] || 2;
          if (activeDrawing._confirmedPoints >= neededPoints) {
            // Save style to per-tool memory
            if (activeDrawing.type && activeDrawing.style) {
              toolStyleMemory[activeDrawing.type] = { ...activeDrawing.style };
            }
            activeDrawing.state = 'idle';

            if (stickyMode && stickyToolType) {
              activeDrawing = null;
              activeTool = stickyToolType;
              activeDrawing = createDrawing(stickyToolType, null, stickyStyleOverrides);
              activeDrawing._confirmedPoints = 0;
              drawings.push(activeDrawing);
              setState(STATE.CREATING);
            } else {
              activeDrawing = null;
              activeTool = null;
              setState(STATE.IDLE);
            }
          }

          emit();
          return true;
        }
      }
    }

    if (interactionState === STATE.DRAGGING || interactionState === STATE.MOVING) {
      setState(selectedDrawingId ? STATE.SELECTED : STATE.IDLE);
      dragAnchorIdx = -1;
      emit();
      return true;
    }
    return false;
  }

  /**
   * Handle double-click for editing drawings.
   * Text/callout: opens inline text editor.
   * All other types: fires edit-drawing event for the UI popup.
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  function onDoubleClick(x, y) {
    const hit = hitTest(x, y);
    if (!hit) return false;

    const drawing = hit.drawing;

    // Text/callout: open inline text editor
    if (drawing.type === 'text' || drawing.type === 'callout') {
      const px = anchorToPixel(drawing.points[0]);
      if (px) {
        window.dispatchEvent(new CustomEvent('charEdge:edit-drawing-text', {
          detail: {
            id: drawing.id,
            text: drawing.meta?.text || (drawing.type === 'callout' ? 'Price Note' : 'Text'),
            x: px.x,
            y: px.y,
            type: drawing.type,
          },
        }));
      }
    }

    // All drawing types: fire generic edit event for the popup
    const refPoint = anchorToPixel(drawing.points[0]);
    if (refPoint) {
      // Select the drawing
      selectedDrawingId = drawing.id;
      drawings.forEach((d) => (d.state = d.id === selectedDrawingId ? 'selected' : 'idle'));
      setState(STATE.SELECTED);
      emit();

      window.dispatchEvent(new CustomEvent('charEdge:edit-drawing', {
        detail: {
          id: drawing.id,
          type: drawing.type,
          points: drawing.points.map(p => ({ ...p })),
          style: { ...drawing.style },
          meta: drawing.meta ? { ...drawing.meta } : {},
          locked: drawing.locked,
          visible: drawing.visible,
          pixelX: x,
          pixelY: y,
        },
      }));
    }

    return true;
  }

  /**
   * Handle keyboard events.
   * @param {string} key
   * @returns {boolean}
   */
  function onKeyDown(key) {
    if (key === 'Escape') {
      // Escape always exits sticky mode
      if (stickyMode) {
        stickyMode = false;
        stickyToolType = null;
        stickyStyleOverrides = {};
      }
      if (interactionState === STATE.CREATING && activeDrawing) {
        // Cancel current drawing
        drawings = drawings.filter((d) => d.id !== activeDrawing.id);
        activeDrawing = null;
        activeTool = null;
        setState(STATE.IDLE);
        emit();
        return true;
      }
      if (selectedDrawingId) {
        selectedDrawingId = null;
        drawings.forEach((d) => (d.state = 'idle'));
        setState(STATE.IDLE);
        emit();
        return true;
      }
    }

    if ((key === 'Delete' || key === 'Backspace') && selectedDrawingId) {
      drawings = drawings.filter((d) => d.id !== selectedDrawingId);
      selectedDrawingId = null;
      setState(STATE.IDLE);
      emit();
      return true;
    }

    // Ctrl shortcuts
    if (key === 'c' && interactionState === STATE.SELECTED && selectedDrawingId) {
      // Ctrl+C: Copy selected drawing to clipboard
      const d = drawings.find((d) => d.id === selectedDrawingId);
      if (d) {
        clipboard = JSON.parse(JSON.stringify(d));
        return true;
      }
    }
    if (key === 'v' && clipboard) {
      // Ctrl+V: Paste from clipboard with offset
      const pasted = JSON.parse(JSON.stringify(clipboard));
      pasted.id = generateId();
      pasted.state = 'idle';
      // Offset slightly so paste isn't on top of original
      pasted.points = pasted.points.map((p) => ({
        price: p.price * 1.002,
        time: p.time + 60000,
      }));
      drawings.push(pasted);
      // Select the pasted drawing
      selectedDrawingId = pasted.id;
      pasted.state = 'selected';
      setState(STATE.SELECTED);
      emit();
      return true;
    }
    if (key === 'd' && interactionState === STATE.SELECTED && selectedDrawingId) {
      // Ctrl+D: Duplicate in place
      const d = drawings.find((d) => d.id === selectedDrawingId);
      if (d) {
        const dup = JSON.parse(JSON.stringify(d));
        dup.id = generateId();
        dup.state = 'selected';
        dup.points = dup.points.map((p) => ({
          price: p.price * 1.003,
          time: p.time + 120000,
        }));
        drawings.push(dup);
        // Deselect old, select new
        d.state = 'idle';
        selectedDrawingId = dup.id;
        emit();
        return true;
      }
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════

  return {
    // ── Coordinate setup ──
    setCoordinateConverters,

    // ── Tool activation ──

    /**
     * Activate a drawing tool. Next click starts placing points.
     * @param {string} toolType - 'trendline', 'fib', 'hray', etc.
     * @param {Object} [styleOverrides] - Custom style
     */
    activateTool(toolType, styleOverrides = {}) {
      // Cancel any in-progress drawing
      if (activeDrawing) {
        drawings = drawings.filter((d) => d.id !== activeDrawing.id);
      }

      // If sticky mode is on, record the tool for re-use
      if (stickyMode) {
        stickyToolType = toolType;
        stickyStyleOverrides = { ...styleOverrides };
      }

      // Merge per-tool memory if no explicit overrides given
      const mergedStyle = Object.keys(styleOverrides).length > 0
        ? styleOverrides
        : (toolStyleMemory[toolType] || {});

      activeTool = toolType;
      activeDrawing = createDrawing(toolType, null, mergedStyle);
      activeDrawing._confirmedPoints = 0;
      drawings.push(activeDrawing);

      // Deselect everything
      selectedDrawingId = null;
      drawings.forEach((d) => {
        if (d !== activeDrawing) d.state = 'idle';
      });

      setState(STATE.CREATING);
      emit();
    },

    /** Cancel the current tool and exit sticky mode */
    cancelTool() {
      stickyMode = false;
      stickyToolType = null;
      stickyStyleOverrides = {};
      if (activeDrawing) {
        drawings = drawings.filter((d) => d.id !== activeDrawing.id);
        activeDrawing = null;
        activeTool = null;
      }
      setState(STATE.IDLE);
      emit();
    },

    /** Get the active tool type (or null) */
    get activeTool() {
      return activeTool;
    },

    // ── Sticky mode API ──

    /** Enable/disable sticky drawing mode */
    setStickyMode(enabled) {
      stickyMode = enabled;
      if (!enabled) {
        stickyToolType = null;
        stickyStyleOverrides = {};
      } else if (activeTool) {
        stickyToolType = activeTool;
        stickyStyleOverrides = activeDrawing?.style ? { ...activeDrawing.style } : {};
      }
    },

    /** Check if sticky mode is active */
    get isStickyMode() {
      return stickyMode;
    },

    /** Get per-tool style memory */
    getToolStyleMemory(toolType) {
      return toolStyleMemory[toolType] || null;
    },

    /** Set per-tool style memory */
    setToolStyleMemory(toolType, style) {
      toolStyleMemory[toolType] = { ...style };
    },

    // ── Enhanced snap API (Sprint 2) ──
    setSnapStrength,
    setAngleSnap,
    setSmartGuides,
    getSmartGuides,
    applyAngleSnap,
    /** Get info about the last snap event (for visual indicator) */
    get lastSnapInfo() { return lastSnapInfo; },

    // ── Advanced snap data sources ──
    /** Pass overlay indicator data for snap-to-indicator-value */
    setIndicatorData(indicators) { _indicatorData = indicators || []; },
    /** Set current hover bar index for indicator value lookup */
    setHoverBarIdx(idx) { _hoverBarIdx = idx; },
    /** Set grid tick values for snap-to-grid */
    setGridTicks(ticks) { _gridTicks = ticks || []; },

    // ── Event handlers ──
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onDoubleClick,
    onKeyDown,

    // ── Drawing management ──

    /** Get all drawings */
    get drawings() {
      return drawings;
    },

    /** Get selected drawing */
    get selectedDrawing() {
      return selectedDrawingId ? drawings.find((d) => d.id === selectedDrawingId) : null;
    },

    /** Get hovered drawing ID (for glow effect) */
    get hoveredDrawingId() {
      return hoveredDrawingId;
    },

    /** Sprint 13.2: Get hovered anchor index for cursor hint */
    get hoveredAnchorIdx() {
      return hoveredAnchorIdx;
    },

    /** Set the scene graph for spatial-index-accelerated hitTest (Phase 2) */
    setSceneGraph(sg) {
      _sceneGraph = sg;
    },

    /** Sprint 13.2: Get cursor hint based on hover state */
    get cursorHint() {
      if (interactionState === STATE.CREATING) return 'crosshair';
      if (interactionState === STATE.DRAGGING) return 'grabbing';
      if (interactionState === STATE.MOVING) return 'grabbing';
      if (hoveredAnchorIdx >= 0) return 'grab';
      if (hoveredDrawingId) return 'pointer';
      return null; // default
    },

    /** Sprint 13.3: Get selected drawing IDs set */
    get selectedDrawingIds() {
      return selectedDrawingIds;
    },

    /** Sprint 13.3: Toggle multi-select for a drawing (Ctrl+click) */
    toggleMultiSelect(id) {
      if (selectedDrawingIds.has(id)) {
        selectedDrawingIds.delete(id);
        const d = drawings.find(d => d.id === id);
        if (d) d.state = 'idle';
      } else {
        selectedDrawingIds.add(id);
        const d = drawings.find(d => d.id === id);
        if (d) d.state = 'selected';
      }
      emit();
    },

    /** Sprint 13.3: Select all drawings */
    selectAll() {
      for (const d of drawings) {
        if (!d.locked && d.visible) {
          selectedDrawingIds.add(d.id);
          d.state = 'selected';
        }
      }
      emit();
    },

    /** Sprint 13.3: Clear multi-selection */
    clearMultiSelect() {
      for (const id of selectedDrawingIds) {
        const d = drawings.find(d => d.id === id);
        if (d) d.state = 'idle';
      }
      selectedDrawingIds.clear();
      emit();
    },

    /** Sprint 13.3: Batch delete selected drawings */
    deleteSelected() {
      const idsToDelete = selectedDrawingIds.size > 0
        ? selectedDrawingIds
        : (selectedDrawingId ? new Set([selectedDrawingId]) : new Set());
      if (idsToDelete.size === 0) return;
      drawings = drawings.filter(d => !idsToDelete.has(d.id));
      selectedDrawingIds.clear();
      selectedDrawingId = null;
      setState(STATE.IDLE);
      emit();
    },

    /** Sprint 13.3: Batch style update on selected drawings */
    batchUpdateStyle(style) {
      const idsToUpdate = selectedDrawingIds.size > 0
        ? selectedDrawingIds
        : (selectedDrawingId ? new Set([selectedDrawingId]) : new Set());
      for (const d of drawings) {
        if (idsToUpdate.has(d.id)) {
          Object.assign(d.style, style);
        }
      }
      emit();
    },

    /** Sprint 13.5: Set label on a drawing */
    setDrawingLabel(id, label) {
      const d = drawings.find(d => d.id === id);
      if (d) {
        if (!d.meta) d.meta = {};
        d.meta.label = label;
        emit();
      }
    },

    /** Sprint 13.6: Toggle cross-timeframe sync for a drawing */
    toggleSyncAcrossTimeframes(id) {
      const d = drawings.find(d => d.id === id);
      if (d) {
        d.syncAcrossTimeframes = !d.syncAcrossTimeframes;
        emit();
      }
    },

    /** Get interaction state */
    get state() {
      return interactionState;
    },

    /**
     * Add a pre-built drawing (from deserialization).
     * @param {Drawing} drawing
     */
    addDrawing(drawing) {
      drawing.state = 'idle';
      drawings.push(drawing);
      emit();
    },

    /**
     * Remove a drawing by ID.
     * @param {string} id
     */
    removeDrawing(id) {
      drawings = drawings.filter((d) => d.id !== id);
      if (selectedDrawingId === id) {
        selectedDrawingId = null;
        setState(STATE.IDLE);
      }
      emit();
    },

    /** Remove all drawings */
    clearAll() {
      drawings = [];
      selectedDrawingId = null;
      activeDrawing = null;
      activeTool = null;
      setState(STATE.IDLE);
      emit();
    },

    /** Toggle visibility of a drawing */
    toggleVisibility(id) {
      const d = drawings.find((d) => d.id === id);
      if (d) {
        d.visible = !d.visible;
        emit();
      }
    },

    /** Toggle lock on a drawing */
    toggleLock(id) {
      const d = drawings.find((d) => d.id === id);
      if (d) {
        d.locked = !d.locked;
        emit();
      }
    },

    /** Update a drawing's style */
    updateStyle(id, style) {
      const d = drawings.find((d) => d.id === id);
      if (d) {
        Object.assign(d.style, style);
        emit();
      }
    },

    /** Load drawings from serialized data */
    loadDrawings(drawingArray) {
      drawings = drawingArray.map((d) => ({ ...d, state: 'idle' }));
      selectedDrawingId = null;
      setState(STATE.IDLE);
      emit();
    },

    /** Convert a pixel position to anchor (exposed for renderer) */
    pixelToAnchor,
    anchorToPixel,

    /** Duplicate a drawing by ID (offset slightly) */
    duplicateDrawing(id) {
      const d = drawings.find((d) => d.id === id);
      if (!d) return null;
      const dup = JSON.parse(JSON.stringify(d));
      dup.id = generateId();
      dup.state = 'idle';
      dup.points = dup.points.map((p) => ({
        price: p.price * 1.003,
        time: p.time + 120000,
      }));
      drawings.push(dup);
      emit();
      return dup.id;
    },

    /** Bring a drawing to front (render last = on top) */
    bringToFront(id) {
      const idx = drawings.findIndex((d) => d.id === id);
      if (idx >= 0 && idx < drawings.length - 1) {
        const [d] = drawings.splice(idx, 1);
        drawings.push(d);
        emit();
      }
    },

    /** Send a drawing to back (render first = behind) */
    sendToBack(id) {
      const idx = drawings.findIndex((d) => d.id === id);
      if (idx > 0) {
        const [d] = drawings.splice(idx, 1);
        drawings.unshift(d);
        emit();
      }
    },

    /** Dispose */
    dispose() {
      drawings = [];
      activeDrawing = null;
      activeTool = null;
      selectedDrawingId = null;
    },
  };
}
