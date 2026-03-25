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
import { binarySearchByTime } from '../binarySearchByTime.js';

// ─── P3: measureText cache for static strings ────────────────────
// Caches TextMetrics keyed by "font|text" to avoid redundant browser
// measureText() calls for labels that don't change frame-to-frame.
const _measureCache = new Map<string, number>();
let _measureCacheFont = '';

function cachedMeasureText(ctx: CanvasRenderingContext2D, text: string): number {
  const font = ctx.font;
  // Invalidate cache on font change
  if (font !== _measureCacheFont) {
    _measureCache.clear();
    _measureCacheFont = font;
  }
  const key = text;
  let w = _measureCache.get(key);
  if (w === undefined) {
    w = ctx.measureText(text).width;
    // Cap cache size to prevent unbounded growth
    if (_measureCache.size > 500) _measureCache.clear();
    _measureCache.set(key, w);
  }
  return w;
}

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
  // Sprint 16: Crosshair modes — free | snapBar | snapClose | off
  const crosshairMode = engine.getCrosshairMode?.() || S.crosshairMode || 'free';
  const crosshairLineStyle = engine.getCrosshairStyle?.() || S.crosshairLineStyle || 'dashed';
  const crosshairOpacity = S.crosshairOpacity ?? 1;

  if (crosshairMode !== 'off' && S.mouseX !== null && S.mouseY !== null) {
    let by = Math.round(S.mouseY * pr);
    let bx = Math.round(S.mouseX * pr);

    // Sprint 16: Snap-to-bar — lock X to nearest bar center
    if ((crosshairMode === 'snapBar' || crosshairMode === 'snapClose') && R.vis && R.timeTransform && S.hoverIdx >= 0) {
      const snapBarX = R.timeTransform.indexToPixel(S.hoverIdx);
      if (snapBarX != null) {
        bx = Math.round(snapBarX * pr);
      }
    }

    // Sprint 16: Snap-to-close — also lock Y to close price
    if (crosshairMode === 'snapClose' && R.vis && S.hoverIdx >= 0 && S.hoverIdx < R.vis.length) {
      const hBar = R.vis[S.hoverIdx];
      if (hBar && R.p2y) {
        by = Math.round(R.p2y(hBar.close) * pr);
      }
    }

    // Free mode: soft magnetic snap (original behavior, within 8px)
    if (crosshairMode === 'free' && R.vis && S.hoverIdx >= 0 && S.hoverIdx < R.vis.length) {
      const hBar = R.vis[S.hoverIdx];
      if (hBar) {
        const closeY = Math.round(R.p2y(hBar.close) * pr);
        const dist = Math.abs(by - closeY);
        if (dist < 8 * pr) {
          by = Math.round(by + (closeY - by) * 0.7);
        }
      }
    }

    // Sprint 16: Line style (solid / dashed / dotted)
    tCtx.save();
    tCtx.globalAlpha = crosshairOpacity;
    tCtx.strokeStyle = thm.crosshairColor || 'rgba(149,152,161,0.5)';
    tCtx.lineWidth = Math.max(1, Math.round(pr));
    if (crosshairLineStyle === 'dotted') {
      tCtx.setLineDash([Math.round(1 * pr), Math.round(3 * pr)]);
    } else if (crosshairLineStyle === 'solid') {
      tCtx.setLineDash([]);
    } else {
      // dashed (default)
      tCtx.setLineDash([Math.round(4 * pr), Math.round(4 * pr)]);
    }
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
    tCtx.restore();

    // Item 27: Draw crosshair vertical line in indicator panes
    const paneManager = engine._paneManager;
    if (paneManager && S.mouseX >= 0 && S.mouseX <= R.cW) {
      for (const pane of paneManager.indicatorPanes) {
        if (pane.state.collapsed) continue;
        const paneUiCtx = pane.layers.getCtx?.('UI') || pane.layers.getCtx?.(4);
        if (!paneUiCtx) continue;
        const paneBW = pane.layers.bitmapWidth || 0;
        const paneBH = pane.layers.bitmapHeight || 0;
        if (paneBW <= 0 || paneBH <= 0) continue;

        paneUiCtx.save();
        paneUiCtx.strokeStyle = thm.crosshairColor || 'rgba(149,152,161,0.5)';
        paneUiCtx.lineWidth = Math.max(1, Math.round(pr));
        paneUiCtx.globalAlpha = crosshairOpacity;
        if (crosshairLineStyle === 'dotted') {
          paneUiCtx.setLineDash([Math.round(1 * pr), Math.round(3 * pr)]);
        } else if (crosshairLineStyle === 'solid') {
          paneUiCtx.setLineDash([]);
        } else {
          paneUiCtx.setLineDash([Math.round(4 * pr), Math.round(4 * pr)]);
        }
        paneUiCtx.beginPath();
        paneUiCtx.moveTo(bx + 0.5, 0);
        paneUiCtx.lineTo(bx + 0.5, paneBH);
        paneUiCtx.stroke();
        paneUiCtx.setLineDash([]);
        paneUiCtx.restore();
      }
    }

    // ─── Sync CrosshairNode with scene graph ──────────────────
    if (ctx.sceneGraph) {
      _syncCrosshairNode(ctx.sceneGraph, S.mouseX, S.mouseY, R.cW, topCanvas.height / pr);
    }

    // ─── Sprint 14: Crosshair Price Label (colored pill) ──────
    if (!fs.compact) {
      const cursorPrice = R.yMin + ((R.mainH - S.mouseY) / R.mainH) * (R.yMax - R.yMin);
      const priceText = formatPrice(cursorPrice) + (scaleMode === 'percent' && percentBase > 0 ? '%' : '');
      const axFs = Math.round(11 * pr);
      tCtx.font = `bold ${axFs}px Arial`;
      const plW = tCtx.measureText(priceText).width + Math.round(14 * pr);
      const plH = Math.round(20 * pr);
      const plX = Math.round(R.cW * pr);
      const plY = by - plH / 2;
      const plR = Math.round(4 * pr); // corner radius

      // Bull/bear colored pill
      const lastBar = bars[bars.length - 1];
      const priceBull = lastBar ? cursorPrice >= lastBar.close : true;
      const pillColor = priceBull ? thm.bullCandle || '#26A69A' : thm.bearCandle || '#EF5350';
      tCtx.fillStyle = pillColor;
      tCtx.beginPath();
      tCtx.roundRect(plX, plY, plW, plH, plR);
      tCtx.fill();
      tCtx.fillStyle = '#FFFFFF';
      tCtx.textAlign = 'right';
      tCtx.textBaseline = 'middle';
      tCtx.fillText(priceText, plX + plW - Math.round(7 * pr), by);

      // ─── Sprint 14: Bid/Ask spread labels ──────────────────
      const of = engine.state.orderFlowData;
      if (of?.bestBid != null && of?.bestAsk != null) {
        const bidY = Math.round(R.p2y(of.bestBid) * pr);
        const askY = Math.round(R.p2y(of.bestAsk) * pr);
        const baFs = Math.round(9 * pr);
        const baH = Math.round(14 * pr);
        const baW = Math.round(22 * pr);
        const baR = Math.round(3 * pr);

        // Bid label
        tCtx.fillStyle = (thm.bullCandle || '#26A69A') + 'AA';
        tCtx.beginPath();
        tCtx.roundRect(plX, bidY - baH / 2, baW, baH, baR);
        tCtx.fill();
        tCtx.font = `bold ${baFs}px Arial`;
        tCtx.fillStyle = '#FFFFFF';
        tCtx.textAlign = 'center';
        tCtx.textBaseline = 'middle';
        tCtx.fillText('B', plX + baW / 2, bidY);

        // Ask label
        tCtx.fillStyle = (thm.bearCandle || '#EF5350') + 'AA';
        tCtx.beginPath();
        tCtx.roundRect(plX, askY - baH / 2, baW, baH, baR);
        tCtx.fill();
        tCtx.fillStyle = '#FFFFFF';
        tCtx.fillText('A', plX + baW / 2, askY);
      }
    }

    // ─── Sprint 14: Crosshair Time Label (rounded pill) ──────
    if (!fs.compact && hoverIdx != null) {
      const hoverBar = bars[hoverIdx];
      if (hoverBar?.time) {
        const timeText = formatTimeLabel(hoverBar.time, fs.timeframe, undefined, fs.activeTimezone || 'UTC');
        const axFs = Math.round(10 * pr);
        tCtx.font = `bold ${axFs}px Arial`;
        const tlW = tCtx.measureText(timeText).width + Math.round(18 * pr);
        const tlH = Math.round(20 * pr);
        const tlX = bx - tlW / 2;
        const tlY = Math.round(R.mainH * pr);
        const tlR = Math.round(4 * pr);
        tCtx.fillStyle = '#363A45';
        tCtx.beginPath();
        tCtx.roundRect(Math.round(tlX), tlY, Math.round(tlW), tlH, tlR);
        tCtx.fill();
        tCtx.fillStyle = '#D1D4DC';
        tCtx.textAlign = 'center';
        tCtx.textBaseline = 'top';
        tCtx.fillText(timeText, bx, tlY + Math.round(4 * pr));
      }
    }

    // ─── Floating Tooltip (gated by feature flag) ───────────
    const showTooltip = engine._showCrosshairTooltip ?? false;
    const hoverBar = hoverIdx != null ? bars[hoverIdx] : null;
    if (showTooltip && hoverBar && S.mouseX >= 0 && S.mouseX <= R.cW) {
      drawTooltip(tCtx, hoverBar, bx, by, pr, R, thm, topCanvas, engine);
    }
  }

  // ─── Sprint 12: OHLCV Legend Bar (always visible) ──────────
  if (!fs.compact && bars.length > 0) {
    drawLegendBar(tCtx, fs, bars, R, pr, thm, engine);
  }

  // ─── Synced Crosshair ──────────────────────────────────────
  if (fs.syncedCrosshair && R.vis?.length > 0) {
    drawSyncedCrosshair(tCtx, fs, bars, R, pr, topCanvas);
  }

  // ─── Bar Countdown ──────────────────────────────────────────
  // Sprint 18 #115: Countdown is now a DOM overlay (CountdownOverlay).
  // Position it here so it follows viewport changes.
  if (!fs.compact && bars.length > 0 && engine._countdownOverlay) {
    const lastBar = bars[bars.length - 1];
    if (lastBar && R.p2y) {
      const cx = R.cW + 2;
      const cy = R.p2y(lastBar.close) + 12;
      engine._countdownOverlay.setPosition(cx, cy);
    }
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

// Sprint 12: Format volume in compact form (1.2M, 340K, etc.)
function formatVolume(v) {
  if (v == null || v === 0) return '0';
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(0);
}

// Sprint 12: OHLCV Legend Bar + indicator value lines
// eslint-disable-next-line @typescript-eslint/naming-convention
function drawLegendBar(tCtx, fs, bars, R, pr, thm, engine) {
  const S = engine.state;
  const LX = Math.round(8 * pr); // left margin
  let LY = Math.round(8 * pr); // top margin
  const smallFs = Math.round(11 * pr);
  const tinyFs = Math.round(10 * pr);
  const hitRegions = [];

  // Determine which bar to show values for
  const idx = fs.hoverIdx != null ? fs.hoverIdx : bars.length - 1;
  const bar = bars[idx];
  if (!bar) return;

  const bull = bar.close >= bar.open;
  const bullColor = thm.bullCandle || '#26A69A';
  const bearColor = thm.bearCandle || '#EF5350';
  const valColor = bull ? bullColor : bearColor;
  const dimColor = thm.axisText || '#787B86';

  // ─── Line 1: Symbol · TF · O H L C · Vol ─────────────────
  tCtx.font = `bold ${smallFs}px Arial`;
  tCtx.textAlign = 'left';
  tCtx.textBaseline = 'top';

  let cx = LX;

  // Symbol + Timeframe label
  const symLabel = (fs.symbol || '').toUpperCase();
  const tfLabel = fs.timeframe || '';
  tCtx.fillStyle = '#D1D4DC';
  tCtx.fillText(symLabel, cx, LY);
  cx += cachedMeasureText(tCtx, symLabel) + Math.round(4 * pr);

  tCtx.font = `${tinyFs}px Arial`;
  tCtx.fillStyle = dimColor;
  tCtx.fillText(`· ${tfLabel}`, cx, LY + Math.round(1 * pr));
  cx += cachedMeasureText(tCtx, `· ${tfLabel}`) + Math.round(10 * pr);

  // OHLCV values
  tCtx.font = `${tinyFs}px Arial`;
  const ohlcItems = [
    { label: 'O', value: bar.open },
    { label: 'H', value: bar.high },
    { label: 'L', value: bar.low },
    { label: 'C', value: bar.close },
  ];

  for (const item of ohlcItems) {
    tCtx.fillStyle = dimColor;
    tCtx.fillText(item.label, cx, LY + Math.round(1 * pr));
    cx += tCtx.measureText(item.label).width + Math.round(2 * pr);

    tCtx.fillStyle = valColor;
    const vText = formatPrice(item.value);
    tCtx.fillText(vText, cx, LY + Math.round(1 * pr));
    cx += tCtx.measureText(vText).width + Math.round(8 * pr);
  }

  // Volume
  tCtx.fillStyle = dimColor;
  tCtx.fillText('Vol', cx, LY + Math.round(1 * pr));
  cx += cachedMeasureText(tCtx, 'Vol') + Math.round(2 * pr);
  tCtx.fillStyle = valColor;
  const volText = formatVolume(bar.volume);
  tCtx.fillText(volText, cx, LY + Math.round(1 * pr));
  cx += cachedMeasureText(tCtx, volText) + Math.round(8 * pr);

  // Store the end-X of the OHLCV line (CSS pixels) so the React
  // IndicatorLegendHeader overlay can position itself inline.
  S._legendEndX = cx / pr;

  // Expose as CSS custom property on tf-chart-area for React overlays
  const chartArea = engine.topCanvas?.closest?.('.tf-chart-area') || engine.topCanvas?.parentElement?.parentElement;
  if (chartArea) {
    (chartArea as HTMLElement).style.setProperty('--legend-end-x', `${Math.round(cx / pr)}px`);
  }

  // Store hit regions for InputManager
  S._legendHitRegions = hitRegions;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
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
    const vol =
      hoverBar.volume >= 1e9
        ? (hoverBar.volume / 1e9).toFixed(1) + 'B'
        : hoverBar.volume >= 1e6
          ? (hoverBar.volume / 1e6).toFixed(1) + 'M'
          : hoverBar.volume >= 1e3
            ? (hoverBar.volume / 1e3).toFixed(1) + 'K'
            : hoverBar.volume.toFixed(0);
    lines.push({ label: 'V', value: vol, color: thm.textSecondary || '#787B86' });
  }

  // Indicator values
  const overlays = engine.indicators.filter((ind) => ind.mode === 'overlay' && ind.computed);
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
  tCtx.strokeStyle = thm.gridLine || 'rgba(54,58,69,0.5)';
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

// eslint-disable-next-line @typescript-eslint/naming-convention
function drawSyncedCrosshair(tCtx, fs, bars, R, pr, topCanvas) {
  const syncTime = fs.syncedCrosshair.time;
  let syncX = null;
  // Sprint 11 B11: O(log n) binary search replaces linear scan
  const idx = binarySearchByTime(bars, syncTime);
  if (idx >= 0) {
    const bar = bars[idx];
    const tolerance = (bars[1]?.time - bars[0]?.time || 60000) * 0.6;
    if (Math.abs(bar.time - syncTime) < tolerance) {
      syncX = Math.round(R.timeTransform.indexToPixel(idx) * pr);
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

// eslint-disable-next-line @typescript-eslint/naming-convention
function _drawBarCountdown(tCtx, fs, bars, R, pr) {
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

// eslint-disable-next-line @typescript-eslint/naming-convention
function drawMagnetDot(tCtx, fs, bars, R, pr, S) {
  const bar = bars[fs.hoverIdx];
  if (!bar || !R.p2y) return;

  const ohlc = [bar.open, bar.high, bar.low, bar.close];
  let closestP = bar.close,
    closestDist = Infinity;
  for (const p of ohlc) {
    const py = Math.abs(R.p2y(p) * pr - S.mouseY * pr);
    if (py < closestDist) {
      closestDist = py;
      closestP = p;
    }
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

// eslint-disable-next-line @typescript-eslint/naming-convention
function drawPaneSplitters(tCtx, R, pr, topCanvas) {
  const mainBH = Math.round(R.mainH * pr);
  const hoverIdx = R._splitterHoverIdx ?? -1;
  const collapsedPanes = R.collapsedPanes || new Set();

  for (let i = 0; i < R.paneCount; i++) {
    const isCollapsed = collapsedPanes.has(i);
    const splitterY = mainBH + Math.round(R.paneH * i * pr);
    const isHovered = hoverIdx === i;

    // Sprint 11: Highlight splitter on hover
    const splitterColor = isHovered ? '#2962FF' : R.thm.gridLine || 'rgba(54,58,69,0.5)';
    const splitterH = isHovered ? Math.round(4 * pr) : Math.round(3 * pr);

    tCtx.fillStyle = splitterColor;
    tCtx.fillRect(0, splitterY - Math.round(1 * pr), topCanvas.width, splitterH);

    const midX = Math.round(topCanvas.width * 0.5);

    if (isCollapsed) {
      // Sprint 11: Collapsed pane \u2192 show expand chevron (\u25B6)
      const chevSize = Math.round(5 * pr);
      tCtx.fillStyle = '#2962FF';
      tCtx.beginPath();
      tCtx.moveTo(midX - chevSize, splitterY - chevSize);
      tCtx.lineTo(midX + chevSize, splitterY);
      tCtx.lineTo(midX - chevSize, splitterY + chevSize);
      tCtx.closePath();
      tCtx.fill();
    } else {
      // Grip dots (3 dots centered on splitter)
      tCtx.fillStyle = isHovered ? '#5B9CF6' : R.thm.axisText || '#787B86';
      for (let d = -1; d <= 1; d++) {
        tCtx.beginPath();
        tCtx.arc(midX + d * Math.round(6 * pr), splitterY, Math.round(1.5 * pr), 0, Math.PI * 2);
        tCtx.fill();
      }
    }
  }
}

/**
 * Scroll-to-now floating button — appears when user has scrolled away from
 * the latest bar (scrollOffset > 5). TradingView-style right-pointing chevron.
 */

// eslint-disable-next-line @typescript-eslint/naming-convention
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
// eslint-disable-next-line @typescript-eslint/naming-convention
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
