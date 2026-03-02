// ═══════════════════════════════════════════════════════════════════
// charEdge — UIStage
// Renders: crosshair, floating tooltip, bar countdown, synced crosshair,
//          magnet snap dot, pane splitter lines, drawing top-layer
// Layer: UI
//
// Phase 2: Maintains a CrosshairNode in the scene graph for
// dirty-region-optimized UI repaints.
// ═══════════════════════════════════════════════════════════════════

import { formatPrice } from '../CoordinateSystem.js';
import { tfToMs, formatCountdown, formatTimeLabel } from '../barCountdown.js';
import { CrosshairNode } from '../../scene/RenderNode.js';

/**
 * Render the UI layer: crosshair, tooltip, countdown, synced crosshair, magnet dot.
 *
 * @param {import('../FrameState.js').FrameState} fs
 * @param {Object} ctx - Render contexts
 * @param {Object} engine - ChartEngine instance
 */
export function executeUIStage(fs, ctx, engine) {
  const { uiCtx: tCtx, theme: thm, drawingRenderer } = ctx;
  const topCanvas = engine.topCanvas;
  const S = engine.state;
  const R = S.lastRender;
  if (!R) return;

  const { pixelRatio: pr, bars, hoverIdx, scaleMode, percentBase } = fs;

  // Clear entire UI canvas — AxesStage runs AFTER UIStage and redraws
  // the axes gutter regions on top.
  tCtx.clearRect(0, 0, topCanvas.width, topCanvas.height);

  // ─── Crosshair ──────────────────────────────────────────────
  if (S.mouseX !== null && S.mouseY !== null) {
    let by = Math.round(S.mouseY * pr);
    const bx = Math.round(S.mouseX * pr);

    // Snap-to-close (magnetic, within 8px)
    if (R.vis && S.hoverIdx >= 0 && S.hoverIdx < R.vis.length) {
      const hBar = R.vis[S.hoverIdx];
      if (hBar) {
        const closeY = Math.round(R.p2y(hBar.close) * pr);
        const dist = Math.abs(by - closeY);
        if (dist < 8 * pr) {
          by = Math.round(by + (closeY - by) * 0.7);
        }
      }
    }

    tCtx.strokeStyle = thm.crosshairColor || 'rgba(149,152,161,0.5)';
    tCtx.lineWidth = Math.max(1, Math.round(pr));
    tCtx.setLineDash([Math.round(4 * pr), Math.round(4 * pr)]);
    tCtx.beginPath();
    tCtx.moveTo(0, by + 0.5);
    tCtx.lineTo(Math.round(R.cW * pr), by + 0.5);
    tCtx.stroke();
    if (S.mouseX >= 0 && S.mouseX <= R.cW) {
      tCtx.beginPath();
      tCtx.moveTo(bx + 0.5, 0);
      tCtx.lineTo(bx + 0.5, topCanvas.height);
      tCtx.stroke();
    }
    tCtx.setLineDash([]);

    // ─── Sync CrosshairNode with scene graph ──────────────────
    if (ctx.sceneGraph) {
      _syncCrosshairNode(ctx.sceneGraph, S.mouseX, S.mouseY, R.cW, topCanvas.height / pr);
    }

    // ─── Crosshair Price Label ───────────────────────────────
    if (!fs.compact) {
      const cursorPrice = R.yMin + ((R.mainH - S.mouseY) / R.mainH) * (R.yMax - R.yMin);
      const priceText = formatPrice(cursorPrice) + (scaleMode === 'percent' && percentBase > 0 ? '%' : '');
      const axFs = Math.round(11 * pr);
      tCtx.font = `${axFs}px Arial`;
      const plW = tCtx.measureText(priceText).width + Math.round(12 * pr);
      const plH = Math.round(18 * pr);
      const plX = Math.round(R.cW * pr);
      const plY = by - plH / 2;
      tCtx.fillStyle = '#363A45';
      tCtx.fillRect(plX, plY, plW, plH);
      tCtx.fillStyle = '#D1D4DC';
      tCtx.textAlign = 'right';
      tCtx.textBaseline = 'middle';
      tCtx.fillText(priceText, plX + plW - Math.round(6 * pr), by);
    }

    // ─── Crosshair Time Label ────────────────────────────────
    if (!fs.compact && hoverIdx != null) {
      const hoverBar = bars[hoverIdx];
      if (hoverBar?.time) {
        const timeText = formatTimeLabel(hoverBar.time, fs.timeframe);
        const axFs = Math.round(10 * pr);
        tCtx.font = `${axFs}px Arial`;
        const tlW = tCtx.measureText(timeText).width + Math.round(16 * pr);
        const tlH = Math.round(18 * pr);
        const tlX = bx - tlW / 2;
        const tlY = Math.round(R.mainH * pr);
        tCtx.fillStyle = '#363A45';
        tCtx.fillRect(Math.round(tlX), tlY, Math.round(tlW), tlH);
        tCtx.fillStyle = '#D1D4DC';
        tCtx.textAlign = 'center';
        tCtx.textBaseline = 'top';
        tCtx.fillText(timeText, bx, tlY + Math.round(3 * pr));
      }
    }

    // ─── Floating Tooltip ────────────────────────────────────
    const hoverBar = hoverIdx != null ? bars[hoverIdx] : null;
    if (hoverBar && S.mouseX >= 0 && S.mouseX <= R.cW) {
      drawTooltip(tCtx, hoverBar, bx, by, pr, R, thm, topCanvas, engine);
    }
  }

  // ─── Synced Crosshair ──────────────────────────────────────
  if (fs.syncedCrosshair && R.vis?.length > 0) {
    drawSyncedCrosshair(tCtx, fs, bars, R, pr, topCanvas);
  }

  // ─── Bar Countdown ──────────────────────────────────────────
  if (!fs.compact && bars.length > 0) {
    drawBarCountdown(tCtx, fs, bars, R, pr);
  }

  // ─── Drawing Top Layer ──────────────────────────────────────
  if (drawingRenderer && fs.lod.drawings) {
    drawingRenderer.drawTop(tCtx, {
      pixelRatio: pr,
      bitmapWidth: topCanvas.width,
      bitmapHeight: topCanvas.height,
      mediaWidth: topCanvas.width / pr,
      mediaHeight: topCanvas.height / pr,
    });
  }

  // ─── Magnet Snap Dot ──────────────────────────────────────
  if (fs.magnetMode && hoverIdx != null && bars.length > 0 && S.mouseY != null) {
    drawMagnetDot(tCtx, fs, bars, R, pr, S);
  }

  // ─── Pane Splitters ────────────────────────────────────────
  if (R.paneCount > 0) {
    drawPaneSplitters(tCtx, R, pr, topCanvas);
  }

  // ─── "Scroll to Now" Button ───────────────────────────────
  drawScrollToNow(tCtx, fs, R, pr, S, thm);
}

// ─── Internal Helpers ──────────────────────────────────────────

function drawTooltip(tCtx, hoverBar, bx, by, pr, R, thm, topCanvas, engine) {
  const fs2 = Math.round(10 * pr);
  const pad = Math.round(8 * pr);
  const lineH = Math.round(14 * pr);
  const bull = hoverBar.close >= hoverBar.open;
  const vc = bull ? thm.bullCandle || '#26A69A' : thm.bearCandle || '#EF5350';

  const lines = [
    { label: 'O', value: formatPrice(hoverBar.open), color: vc },
    { label: 'H', value: formatPrice(hoverBar.high), color: vc },
    { label: 'L', value: formatPrice(hoverBar.low), color: vc },
    { label: 'C', value: formatPrice(hoverBar.close), color: vc },
  ];
  if (hoverBar.volume != null) {
    const vol = hoverBar.volume >= 1e9 ? (hoverBar.volume / 1e9).toFixed(1) + 'B'
      : hoverBar.volume >= 1e6 ? (hoverBar.volume / 1e6).toFixed(1) + 'M'
      : hoverBar.volume >= 1e3 ? (hoverBar.volume / 1e3).toFixed(1) + 'K'
      : hoverBar.volume.toFixed(0);
    lines.push({ label: 'V', value: vol, color: thm.textSecondary || '#787B86' });
  }

  // Indicator values
  const overlays = engine.indicators.filter(ind => ind.mode === 'overlay' && ind.computed);
  for (const ind of overlays.slice(0, 3)) {
    for (const out of ind.outputs) {
      const vals = ind.computed[out.key];
      if (!vals) continue;
      const val = engine.state.hoverIdx < vals.length ? vals[engine.state.hoverIdx] : NaN;
      if (!isNaN(val)) {
        lines.push({ label: ind.label, value: formatPrice(val), color: out.color || '#AAA' });
      }
    }
  }

  tCtx.font = `${fs2}px Arial`;
  let maxW = 0;
  for (const l of lines) {
    const w = tCtx.measureText(l.label + '  ' + l.value).width;
    if (w > maxW) maxW = w;
  }

  const tipW = maxW + pad * 3;
  const tipH = lines.length * lineH + pad * 2;
  let tx = bx + Math.round(16 * pr);
  let ty = by - tipH / 2;
  if (tx + tipW > topCanvas.width - Math.round(R.axW * pr)) tx = bx - tipW - Math.round(16 * pr);
  if (ty < 0) ty = Math.round(4 * pr);
  if (ty + tipH > topCanvas.height) ty = topCanvas.height - tipH - Math.round(4 * pr);

  // Background
  const radius = Math.round(6 * pr);
  tCtx.save();
  tCtx.globalAlpha = 0.88;
  tCtx.fillStyle = thm.bg || '#131722';
  tCtx.beginPath();
  tCtx.moveTo(tx + radius, ty);
  tCtx.lineTo(tx + tipW - radius, ty);
  tCtx.quadraticCurveTo(tx + tipW, ty, tx + tipW, ty + radius);
  tCtx.lineTo(tx + tipW, ty + tipH - radius);
  tCtx.quadraticCurveTo(tx + tipW, ty + tipH, tx + tipW - radius, ty + tipH);
  tCtx.lineTo(tx + radius, ty + tipH);
  tCtx.quadraticCurveTo(tx, ty + tipH, tx, ty + tipH - radius);
  tCtx.lineTo(tx, ty + radius);
  tCtx.quadraticCurveTo(tx, ty, tx + radius, ty);
  tCtx.closePath();
  tCtx.fill();
  tCtx.globalAlpha = 1;
  tCtx.strokeStyle = (thm.gridLine || 'rgba(54,58,69,0.5)');
  tCtx.lineWidth = Math.max(1, pr);
  tCtx.stroke();

  // Text
  tCtx.font = `${fs2}px Arial`;
  tCtx.textBaseline = 'top';
  for (let i = 0; i < lines.length; i++) {
    const ly = ty + pad + i * lineH;
    tCtx.fillStyle = thm.textSecondary || '#787B86';
    tCtx.textAlign = 'left';
    tCtx.fillText(lines[i].label, tx + pad, ly);
    tCtx.fillStyle = lines[i].color;
    tCtx.textAlign = 'right';
    tCtx.fillText(lines[i].value, tx + tipW - pad, ly);
  }
  tCtx.restore();
}

function drawSyncedCrosshair(tCtx, fs, bars, R, pr, topCanvas) {
  const syncTime = fs.syncedCrosshair.time;
  let syncX = null;
  for (let i = 0; i < bars.length; i++) {
    if (Math.abs(bars[i].time - syncTime) < (bars[1]?.time - bars[0]?.time || 60000) * 0.6) {
      syncX = Math.round(R.timeTransform.indexToPixel(i) * pr);
      break;
    }
  }
  if (syncX !== null && syncX >= 0 && syncX <= Math.round(R.cW * pr)) {
    tCtx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
    tCtx.lineWidth = Math.max(1, Math.round(pr));
    tCtx.setLineDash([Math.round(3 * pr), Math.round(3 * pr)]);
    tCtx.beginPath();
    tCtx.moveTo(syncX + 0.5, 0);
    tCtx.lineTo(syncX + 0.5, topCanvas.height);
    tCtx.stroke();
    tCtx.setLineDash([]);
    const fs2 = Math.round(9 * pr);
    tCtx.font = `${fs2}px Arial`;
    tCtx.fillStyle = 'rgba(59, 130, 246, 0.8)';
    tCtx.textAlign = 'center';
    tCtx.textBaseline = 'bottom';
    tCtx.fillText('⬆', syncX, topCanvas.height - Math.round(2 * pr));
  }
}

function drawBarCountdown(tCtx, fs, bars, R, pr) {
  const lastBar = bars[bars.length - 1];
  const tfMs = tfToMs(fs.timeframe);
  if (tfMs > 0 && lastBar?.time) {
    const nextBarTime = lastBar.time + tfMs;
    const remaining = nextBarTime - Date.now();
    if (remaining > 0 && remaining < tfMs * 2) {
      const cdText = formatCountdown(remaining);
      const cdFs = Math.round(9 * pr);
      tCtx.font = `${cdFs}px Arial`;
      const cdW = tCtx.measureText(cdText).width + Math.round(8 * pr);
      const cdH = Math.round(14 * pr);
      const lastY = R.p2y ? Math.round(R.p2y(lastBar.close) * pr) : 0;
      const cdX = Math.round(R.cW * pr) + Math.round(2 * pr);
      const cdY = lastY + Math.round(12 * pr);
      tCtx.fillStyle = (R.thm.bg || '#131722') + 'CC';
      tCtx.fillRect(cdX, cdY, cdW, cdH);
      tCtx.fillStyle = R.thm.axisText || '#787B86';
      tCtx.textAlign = 'left';
      tCtx.textBaseline = 'middle';
      tCtx.fillText(cdText, cdX + Math.round(4 * pr), cdY + cdH / 2);
    }
  }
}

function drawMagnetDot(tCtx, fs, bars, R, pr, S) {
  const bar = bars[fs.hoverIdx];
  if (!bar || !R.p2y) return;

  const ohlc = [bar.open, bar.high, bar.low, bar.close];
  let closestP = bar.close, closestDist = Infinity;
  for (const p of ohlc) {
    const py = Math.abs(R.p2y(p) * pr - S.mouseY * pr);
    if (py < closestDist) { closestDist = py; closestP = p; }
  }
  const snapX = Math.round(R.timeTransform.indexToPixel(fs.hoverIdx) * pr);
  const snapY = Math.round(R.p2y(closestP) * pr);
  tCtx.fillStyle = '#2962FF';
  tCtx.beginPath();
  tCtx.arc(snapX, snapY, Math.round(4 * pr), 0, Math.PI * 2);
  tCtx.fill();
  tCtx.strokeStyle = '#fff';
  tCtx.lineWidth = Math.max(1, pr);
  tCtx.stroke();
}

function drawPaneSplitters(tCtx, R, pr, topCanvas) {
  const mainBH = Math.round(R.mainH * pr);
  for (let i = 0; i < R.paneCount; i++) {
    const splitterY = mainBH + Math.round(R.paneH * i * pr);
    tCtx.fillStyle = R.thm.gridLine || 'rgba(54,58,69,0.5)';
    tCtx.fillRect(0, splitterY - Math.round(1 * pr), topCanvas.width, Math.round(3 * pr));
    const midX = Math.round(topCanvas.width * 0.5);
    tCtx.fillStyle = R.thm.axisText || '#787B86';
    for (let d = -1; d <= 1; d++) {
      tCtx.beginPath();
      tCtx.arc(midX + d * Math.round(6 * pr), splitterY, Math.round(1.5 * pr), 0, Math.PI * 2);
      tCtx.fill();
    }
  }
}

/**
 * Scroll-to-now floating button — appears when user has scrolled away from
 * the latest bar (scrollOffset > 5). TradingView-style right-pointing chevron.
 */
function drawScrollToNow(tCtx, fs, R, pr, S, thm) {
  if (S.scrollOffset <= 5 || fs.compact) {
    S._scrollToNowBtn = null;
    return;
  }

  const btnW = Math.round(32 * pr);
  const btnH = Math.round(28 * pr);
  const margin = Math.round(8 * pr);
  // Position: bottom-right of chart area, just above time axis
  const btnX = Math.round(R.cW * pr) - btnW - margin;
  const btnY = Math.round(R.mainH * pr) - btnH - margin;
  const radius = Math.round(6 * pr);

  // Semi-transparent rounded rect background
  tCtx.save();
  tCtx.globalAlpha = 0.85;
  tCtx.fillStyle = thm.axisBg || '#1E222D';
  tCtx.beginPath();
  tCtx.moveTo(btnX + radius, btnY);
  tCtx.lineTo(btnX + btnW - radius, btnY);
  tCtx.quadraticCurveTo(btnX + btnW, btnY, btnX + btnW, btnY + radius);
  tCtx.lineTo(btnX + btnW, btnY + btnH - radius);
  tCtx.quadraticCurveTo(btnX + btnW, btnY + btnH, btnX + btnW - radius, btnY + btnH);
  tCtx.lineTo(btnX + radius, btnY + btnH);
  tCtx.quadraticCurveTo(btnX, btnY + btnH, btnX, btnY + btnH - radius);
  tCtx.lineTo(btnX, btnY + radius);
  tCtx.quadraticCurveTo(btnX, btnY, btnX + radius, btnY);
  tCtx.closePath();
  tCtx.fill();
  tCtx.globalAlpha = 1;
  tCtx.strokeStyle = thm.gridLine || 'rgba(54,58,69,0.5)';
  tCtx.lineWidth = Math.max(1, pr);
  tCtx.stroke();

  // Double-chevron icon (»)
  const cx = btnX + btnW / 2;
  const cy = btnY + btnH / 2;
  const chevH = Math.round(5 * pr);
  const chevW = Math.round(4 * pr);
  tCtx.strokeStyle = '#2962FF';
  tCtx.lineWidth = Math.round(2 * pr);
  tCtx.lineCap = 'round';
  tCtx.lineJoin = 'round';
  // First chevron
  tCtx.beginPath();
  tCtx.moveTo(cx - chevW - Math.round(2 * pr), cy - chevH);
  tCtx.lineTo(cx - Math.round(2 * pr), cy);
  tCtx.lineTo(cx - chevW - Math.round(2 * pr), cy + chevH);
  tCtx.stroke();
  // Second chevron
  tCtx.beginPath();
  tCtx.moveTo(cx + Math.round(1 * pr), cy - chevH);
  tCtx.lineTo(cx + chevW + Math.round(1 * pr), cy);
  tCtx.lineTo(cx + Math.round(1 * pr), cy + chevH);
  tCtx.stroke();
  tCtx.restore();

  // Store hit-test bounds (CSS pixels, not bitmap)
  S._scrollToNowBtn = {
    x: btnX / pr,
    y: btnY / pr,
    w: btnW / pr,
    h: btnH / pr,
  };
}

/**
 * Sync the CrosshairNode in the scene graph.
 * Uses a single node whose bounds encompass the cross area.
 */
function _syncCrosshairNode(sceneGraph, mouseX, mouseY, chartWidth, chartHeight) {
  let node = sceneGraph.getNode('crosshair');
  if (!node) {
    node = new CrosshairNode();
    sceneGraph.addNode(node);
  }
  // Bounds: union of horizontal and vertical crosshair strips
  // Marking the full viewport since crosshair spans both axes
  if (mouseX != null && mouseY != null) {
    node.updateBounds({ x: 0, y: 0, w: chartWidth, h: chartHeight });
    node.visible = true;
  } else {
    node.visible = false;
  }
}

