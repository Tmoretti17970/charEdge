// ═══════════════════════════════════════════════════════════════════
// charEdge — DrawingStage
// Renders: user drawings (trendlines, fibs, channels, etc.)
// Layer: DRAWINGS
//
// Phase 2: Also registers DrawingNode instances in the scene graph
// for spatial-index-accelerated hit-testing.
// ═══════════════════════════════════════════════════════════════════

import { LAYERS } from '../LayerManager.js';
import { DrawingNode } from '../../scene/RenderNode.js';

/**
 * Render the drawings layer: all user-created drawing tools.
 *
 * @param {import('../FrameState.js').FrameState} fs
 * @param {Object} ctx - Render contexts
 * @param {Object} engine - ChartEngine instance
 */
export function executeDrawingStage(fs, ctx, engine) {
  const { layers, drawingRenderer, drawingCtx: dCtx, sceneGraph } = ctx;

  if (!drawingRenderer || !fs.lod.drawings) return;
  // A5.1/A5.2: Also re-render when scaleMode changes (Log↔Linear toggle causes price
  // coordinate drift). Track previous scale mode to detect transitions.
  const scaleModeChanged = engine._prevDrawingScaleMode !== undefined &&
    engine._prevDrawingScaleMode !== engine.scaleMode;
  engine._prevDrawingScaleMode = engine.scaleMode;

  if (!layers.isDirty(LAYERS.DRAWINGS) && !fs.viewportChanged && !scaleModeChanged) return;
  layers.clearDirty(LAYERS.DRAWINGS);

  const { bitmapWidth: bw, bitmapHeight: bh, pixelRatio: pr, chartWidth: cW, mainHeight } = fs;
  const cBW = Math.round(cW * pr);
  const mainBH = Math.round(mainHeight * pr);

  // ─── Sync DrawingNodes with scene graph ─────────────────────
  if (sceneGraph && engine.drawingEngine) {
    _syncDrawingNodes(sceneGraph, engine.drawingEngine, cW, mainHeight);
  }

  dCtx.clearRect(0, 0, bw, bh);

  // E3.1: Always-on drawing shadows for visual depth separation
  dCtx.save();
  dCtx.shadowColor = 'rgba(0, 0, 0, 0.18)';
  dCtx.shadowBlur = 1.5 * pr;
  dCtx.shadowOffsetX = 0;
  dCtx.shadowOffsetY = 0.5 * pr;

  drawingRenderer.drawMain(dCtx, {
    pixelRatio: pr,
    bitmapWidth: cBW,
    bitmapHeight: mainBH,
    mediaWidth: cW,
    mediaHeight: mainHeight,
  });

  // E3.1: Clear shadow state
  dCtx.restore();
}

/**
 * Synchronize drawing model → scene graph nodes.
 * Adds new nodes, removes deleted ones, updates bounds.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
function _syncDrawingNodes(sceneGraph, drawingEngine, chartWidth, mainHeight) {
  const drawings = drawingEngine.drawings;
  if (!drawings) return;

  const activeIds = new Set();

  for (const drawing of drawings) {
    const nodeId = `drw_${drawing.id}`;
    activeIds.add(nodeId);

    // Compute pixel-space bounding box from anchor points
    const bounds = _computeDrawingBounds(drawingEngine, drawing, chartWidth, mainHeight);
    if (!bounds) continue;

    let node = sceneGraph.getNode(nodeId);
    if (!node) {
      node = new DrawingNode(drawing);
      sceneGraph.addNode(node);
    }
    node.data = drawing;
    node.updateBounds(bounds);
  }

  // Remove nodes for drawings that no longer exist
  const toRemove = [];
  sceneGraph.root.traverse((node) => {
    if (node.type === 'drawing' && !activeIds.has(node.id)) {
      toRemove.push(node.id);
    }
  });
  for (const id of toRemove) {
    sceneGraph.removeNode(id);
  }
}

/**
 * Compute the CSS-pixel bounding box for a drawing.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
function _computeDrawingBounds(drawingEngine, drawing, chartWidth, mainHeight) {
  if (!drawing.points || drawing.points.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const pt of drawing.points) {
    const px = drawingEngine.anchorToPixel(pt);
    if (!px) continue;
    if (px.x < minX) minX = px.x;
    if (px.y < minY) minY = px.y;
    if (px.x > maxX) maxX = px.x;
    if (px.y > maxY) maxY = px.y;
  }

  if (!isFinite(minX)) return null;

  // Expand for hit-test padding (8px threshold)
  const pad = 10;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(chartWidth, maxX + pad);
  maxY = Math.min(mainHeight, maxY + pad);

  // For horizontal/vertical lines, ensure minimum dimensions
  const w = Math.max(maxX - minX, 2);
  const h = Math.max(maxY - minY, 2);

  return { x: minX, y: minY, w, h };
}

/**
 * Sprint 17: Draw a translucent ghost preview of the drawing being created.
 * Shows rubber-band lines, growing boxes, or fib level previews.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
function _drawGhostPreview(ctx, drawingEngine, drawing, pr, cBW, _mainBH) {
  const pts = drawing.points.map((p) => drawingEngine.anchorToPixel(p)).filter(Boolean);
  if (pts.length === 0) return;

  // Convert to bitmap coordinates
  const bPts = pts.map((p) => ({ x: Math.round(p.x * pr), y: Math.round(p.y * pr) }));
  const ghostAlpha = 0.45;
  const ghostColor = drawing.style?.color || '#2962FF';
  const ghostDash = [Math.round(4 * pr), Math.round(4 * pr)];

  ctx.save();
  ctx.globalAlpha = ghostAlpha;
  ctx.strokeStyle = ghostColor;
  ctx.lineWidth = Math.max(1, Math.round(1.5 * pr));
  ctx.setLineDash(ghostDash);
  ctx.lineCap = 'round';

  switch (drawing.type) {
    // ─── Line tools: rubber-band from first point to cursor ────
    case 'trendline':
    case 'arrow':
    case 'ray':
    case 'extendedline':
    case 'infoline':
    case 'hray':
      if (bPts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(bPts[0].x, bPts[0].y);
        ctx.lineTo(bPts[bPts.length - 1].x, bPts[bPts.length - 1].y);
        ctx.stroke();
      }
      break;

    // ─── Rectangle: growing box with dimensions overlay ─────────
    case 'rect':
    case 'alertzone':
    case 'pricerange':
    case 'daterange':
    case 'measure':
      if (bPts.length >= 2) {
        const left = Math.min(bPts[0].x, bPts[1].x);
        const top = Math.min(bPts[0].y, bPts[1].y);
        const w = Math.abs(bPts[1].x - bPts[0].x);
        const h = Math.abs(bPts[1].y - bPts[0].y);
        ctx.strokeRect(left, top, w, h);

        // Dimensions overlay
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.7;
        const dimFs = Math.round(9 * pr);
        ctx.font = `${dimFs}px Arial`;
        ctx.fillStyle = ghostColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const cssW = Math.round(w / pr);
        const cssH = Math.round(h / pr);
        ctx.fillText(`${cssW}×${cssH}px`, left + w / 2, top - Math.round(3 * pr));
      }
      break;

    // ─── Fibonacci: preview all levels from anchor points ───────
    case 'fib':
    case 'fibext':
      if (bPts.length >= 2) {
        const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
        const dy = bPts[1].y - bPts[0].y;
        ctx.setLineDash(ghostDash);
        for (const lvl of fibLevels) {
          const ly = bPts[0].y + dy * lvl;
          ctx.beginPath();
          ctx.moveTo(0, Math.round(ly));
          ctx.lineTo(cBW, Math.round(ly));
          ctx.stroke();
          // Level label
          ctx.setLineDash([]);
          ctx.globalAlpha = 0.6;
          const fs = Math.round(8 * pr);
          ctx.font = `${fs}px Arial`;
          ctx.fillStyle = ghostColor;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${(lvl * 100).toFixed(1)}%`, Math.round(4 * pr), Math.round(ly));
          ctx.globalAlpha = ghostAlpha;
          ctx.setLineDash(ghostDash);
        }
      }
      break;

    // ─── Channel: preview parallel lines ────────────────────────
    case 'channel':
    case 'parallelchannel':
      if (bPts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(bPts[0].x, bPts[0].y);
        ctx.lineTo(bPts[1].x, bPts[1].y);
        ctx.stroke();
        if (bPts.length >= 3) {
          const dx = bPts[1].x - bPts[0].x;
          const dy = bPts[1].y - bPts[0].y;
          ctx.beginPath();
          ctx.moveTo(bPts[2].x, bPts[2].y);
          ctx.lineTo(bPts[2].x + dx, bPts[2].y + dy);
          ctx.stroke();
        }
      }
      break;

    // ─── Multi-point: connect all placed points ─────────────────
    case 'triangle':
    case 'polyline':
    case 'elliott':
    case 'pitchfork':
      if (bPts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(bPts[0].x, bPts[0].y);
        for (let i = 1; i < bPts.length; i++) {
          ctx.lineTo(bPts[i].x, bPts[i].y);
        }
        ctx.stroke();
      }
      break;

    // ─── Ellipse: growing ellipse outline ───────────────────────
    case 'ellipse':
      if (bPts.length >= 2) {
        const cx = (bPts[0].x + bPts[1].x) / 2;
        const cy = (bPts[0].y + bPts[1].y) / 2;
        const rx = Math.abs(bPts[1].x - bPts[0].x) / 2;
        const ry = Math.abs(bPts[1].y - bPts[0].y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;

    default:
      // Fallback: draw line from first to last point
      if (bPts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(bPts[0].x, bPts[0].y);
        ctx.lineTo(bPts[bPts.length - 1].x, bPts[bPts.length - 1].y);
        ctx.stroke();
      }
      break;
  }

  // Ghost anchor dots at confirmed points
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = ghostColor;
  for (const bp of bPts) {
    ctx.beginPath();
    ctx.arc(bp.x, bp.y, Math.round(4 * pr), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
