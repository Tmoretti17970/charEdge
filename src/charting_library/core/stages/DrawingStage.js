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
  if (!layers.isDirty(LAYERS.DRAWINGS) && !fs.viewportChanged) return;
  layers.clearDirty(LAYERS.DRAWINGS);

  const { bitmapWidth: bw, bitmapHeight: bh, pixelRatio: pr, chartWidth: cW, mainHeight } = fs;
  const cBW = Math.round(cW * pr);
  const mainBH = Math.round(mainHeight * pr);

  // ─── Sync DrawingNodes with scene graph ─────────────────────
  if (sceneGraph && engine.drawingEngine) {
    _syncDrawingNodes(sceneGraph, engine.drawingEngine, cW, mainHeight);
  }

  dCtx.clearRect(0, 0, bw, bh);
  drawingRenderer.drawMain(dCtx, {
    pixelRatio: pr,
    bitmapWidth: cBW,
    bitmapHeight: mainBH,
    mediaWidth: cW,
    mediaHeight: mainHeight,
  });
}

/**
 * Synchronize drawing model → scene graph nodes.
 * Adds new nodes, removes deleted ones, updates bounds.
 */
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
