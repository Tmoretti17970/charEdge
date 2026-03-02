// ═══════════════════════════════════════════════════════════════════
// charEdge — RenderWorker (Phase 1.3.3)
//
// Web Worker that renders GRID, DATA, and INDICATORS layers off the
// main thread using OffscreenCanvas. The UI layer (crosshair,
// tooltips) and DRAWINGS layer stay on the main thread for
// zero-latency interaction.
//
// Communication:
//   Main → Worker:  postMessage({ type, payload })
//   Worker → Main:  postMessage({ type, payload })
//
// Message Types (Main → Worker):
//   'init'           — Transfer OffscreenCanvases + viewport
//   'resize'         — Update canvas dimensions
//   'setData'        — Send bar data (typed arrays as Transferables)
//   'scroll'         — Update scroll offset / visible bars
//   'setTheme'       — Update color theme
//   'setIndicators'  — Update indicator configs + computed values
//   'render'         — Request a render frame
//   'dispose'        — Clean up
//
// Message Types (Worker → Main):
//   'ready'          — Worker initialized
//   'frameComplete'  — Render frame finished with timing stats
// ═══════════════════════════════════════════════════════════════════

let gridCanvas = null;
let dataCanvas = null;
let indicatorCanvas = null;
let gridCtx = null;
let dataCtx = null;
let indicatorCtx = null;

// State
let barData = null;       // { time, open, high, low, close, volume, length }
let theme = {};
let viewport = { bitmapWidth: 0, bitmapHeight: 0, pixelRatio: 1 };
let scrollState = { scrollOffset: 0, visibleBars: 80 };
let indicators = [];      // [{ type, period, values, color, lineWidth }]

// Grid bitmap cache (mirrors GridStage Phase 1.1.3)
let _gridCache = { canvas: null, ctx: null, key: '' };

// ─── Message Handler ──────────────────────────────────────────

self.onmessage = function(e) {
  const { type, payload } = e.data;

  switch (type) {
    case 'init':
      handleInit(payload);
      break;

    case 'resize':
      handleResize(payload);
      break;

    case 'setData':
      handleSetData(payload);
      break;

    case 'scroll':
      handleScroll(payload);
      break;

    case 'setTheme':
      theme = payload;
      _gridCache.key = ''; // invalidate grid cache on theme change
      break;

    case 'setIndicators':
      indicators = payload || [];
      break;

    case 'render':
      handleRender();
      break;

    case 'dispose':
      gridCanvas = dataCanvas = indicatorCanvas = null;
      gridCtx = dataCtx = indicatorCtx = null;
      barData = null;
      indicators = [];
      _gridCache = { canvas: null, ctx: null, key: '' };
      break;
  }
};

// ─── Init: Receive OffscreenCanvases ──────────────────────────

function handleInit(payload) {
  gridCanvas = payload.gridCanvas;
  dataCanvas = payload.dataCanvas;
  indicatorCanvas = payload.indicatorCanvas;

  gridCtx = gridCanvas.getContext('2d', { alpha: false });
  dataCtx = dataCanvas.getContext('2d', { alpha: true });
  indicatorCtx = indicatorCanvas.getContext('2d', { alpha: true });

  viewport = payload.viewport || viewport;

  self.postMessage({ type: 'ready' });
}

// ─── Resize ───────────────────────────────────────────────────

function handleResize(payload) {
  viewport = { ...viewport, ...payload };
  const { bitmapWidth: bw, bitmapHeight: bh } = viewport;
  if (gridCanvas) { gridCanvas.width = bw; gridCanvas.height = bh; }
  if (dataCanvas) { dataCanvas.width = bw; dataCanvas.height = bh; }
  if (indicatorCanvas) { indicatorCanvas.width = bw; indicatorCanvas.height = bh; }
  _gridCache.key = ''; // invalidate cache on resize
}

// ─── Set Data (Typed Arrays) ──────────────────────────────────

function handleSetData(payload) {
  barData = {
    time:   new Float64Array(payload.time),
    open:   new Float64Array(payload.open),
    high:   new Float64Array(payload.high),
    low:    new Float64Array(payload.low),
    close:  new Float64Array(payload.close),
    volume: new Float64Array(payload.volume),
    length: payload.length,
  };
}

// ─── Scroll State ─────────────────────────────────────────────

function handleScroll(payload) {
  scrollState = { ...scrollState, ...payload };
}

// ─── Compute Visible Range ────────────────────────────────────

function computeViewport() {
  const pr = viewport.pixelRatio || 1;
  const bw = viewport.bitmapWidth || 800;
  const bh = viewport.bitmapHeight || 600;
  const mw = bw / pr;
  const mh = bh / pr;

  const axW = 72;
  const txH = 24;
  const cW = mw - axW;
  const mainH = mh - txH;
  const cBW = Math.round(cW * pr);
  const mainBH = Math.round(mainH * pr);

  const end = barData.length - 1 - scrollState.scrollOffset + 5;
  const exactStart = end - scrollState.visibleBars + 1;
  const start = Math.max(0, Math.floor(exactStart));
  const endIdx = Math.min(barData.length, Math.floor(end) + 2);
  const bSp = cW / scrollState.visibleBars;

  // Price range
  let lo = Infinity, hi = -Infinity;
  for (let i = start; i < endIdx; i++) {
    if (barData.low[i] < lo) lo = barData.low[i];
    if (barData.high[i] > hi) hi = barData.high[i];
  }
  const rng = hi - lo || 1;
  const yMin = lo - rng * 0.06;
  const yMax = hi + rng * 0.06;
  const yRange = yMax - yMin;
  const p2y = (price) => mainH * (1 - (price - yMin) / yRange);

  return { pr, bw, bh, mw, mh, cW, mainH, cBW, mainBH, start, endIdx, exactStart, bSp, yMin, yMax, yRange, p2y };
}

// ─── Render Frame ─────────────────────────────────────────────

function handleRender() {
  if (!dataCtx || !barData || barData.length === 0) {
    self.postMessage({ type: 'frameComplete', payload: { time: 0 } });
    return;
  }

  const t0 = performance.now();
  const vp = computeViewport();

  renderGrid(vp);
  renderData(vp);
  renderIndicators(vp);

  const elapsed = performance.now() - t0;
  self.postMessage({
    type: 'frameComplete',
    payload: { time: elapsed, bars: vp.endIdx - vp.start },
  });
}

// ─── Grid Layer (with Bitmap Cache) ───────────────────────────

function renderGrid(vp) {
  const { pr, bw, bh, cW, mainH, cBW, mainBH, yMin, yRange, p2y } = vp;

  // Build cache key
  const gridCount = Math.floor(mainH / 50);
  const step = yRange / gridCount;
  const cacheKey = `${bw}:${bh}:${pr}:${cW}:${mainH}:${gridCount}:${step}:${theme.bg}:${theme.gridLine}:${theme.fg}`;

  if (_gridCache.key === cacheKey && _gridCache.canvas) {
    gridCtx.drawImage(_gridCache.canvas, 0, 0);
    return;
  }

  // Create/resize cache canvas
  if (!_gridCache.canvas || _gridCache.canvas.width !== bw || _gridCache.canvas.height !== bh) {
    _gridCache.canvas = new OffscreenCanvas(bw, bh);
    _gridCache.ctx = _gridCache.canvas.getContext('2d');
  }

  const oCtx = _gridCache.ctx;

  // Background
  oCtx.fillStyle = theme.bg || '#131722';
  oCtx.fillRect(0, 0, bw, bh);

  // Watermark
  oCtx.save();
  oCtx.globalAlpha = 0.06;
  const wmFs = Math.round(Math.min(cW, mainH) * 0.12 * pr);
  oCtx.font = `bold ${wmFs}px Arial`;
  oCtx.fillStyle = theme.fg || '#D1D4DC';
  oCtx.textAlign = 'center';
  oCtx.textBaseline = 'middle';
  oCtx.fillText(scrollState.symbol || '', Math.round(cW * pr / 2), Math.round(mainH * pr * 0.45));
  oCtx.restore();

  // Grid lines
  oCtx.fillStyle = theme.gridLine || 'rgba(54,58,69,0.4)';
  for (let i = 0; i <= gridCount; i++) {
    const price = yMin + i * step;
    const gy = Math.round(p2y(price) * pr);
    oCtx.fillRect(0, gy, cBW, Math.max(1, pr));
  }

  // Vertical grid lines
  const vStep = Math.max(1, Math.floor(scrollState.visibleBars / 8));
  for (let i = 0; i < scrollState.visibleBars; i += vStep) {
    const x = Math.round((i + 0.5) * (cW / scrollState.visibleBars) * pr);
    if (x >= 0 && x <= cBW) {
      oCtx.fillRect(x, 0, Math.max(1, pr), mainBH);
    }
  }

  _gridCache.key = cacheKey;
  gridCtx.drawImage(_gridCache.canvas, 0, 0);
}

// ─── Data Layer (Candles + Volume + Price Line) ───────────────

function renderData(vp) {
  const { pr, bw, bh, cW, mainH, cBW, mainBH, start, endIdx, exactStart, bSp, yMin, yMax, yRange, p2y } = vp;

  dataCtx.clearRect(0, 0, bw, bh);
  dataCtx.save();
  dataCtx.beginPath();
  dataCtx.rect(0, 0, cBW, mainBH);
  dataCtx.clip();

  const bullColor = theme.bullCandle || '#26A69A';
  const bearColor = theme.bearCandle || '#EF5350';

  // ─── Volume Bars (behind candles) ─────────────────────
  const volH = Math.round(mainH * 0.15);
  const volTop = mainH - volH;
  let maxVol = 0;
  for (let i = start; i < endIdx; i++) {
    if (barData.volume[i] > maxVol) maxVol = barData.volume[i];
  }

  if (maxVol > 0) {
    for (let i = start; i < endIdx; i++) {
      const barIdx = i - start;
      const x = Math.round((barIdx + 0.5 + (exactStart - start)) * bSp * pr);
      const vH = Math.round((barData.volume[i] / maxVol) * volH * pr);
      const isBull = barData.close[i] >= barData.open[i];
      dataCtx.globalAlpha = 0.25;
      dataCtx.fillStyle = isBull ? bullColor : bearColor;
      const bodyW = Math.max(1, Math.floor(bSp * 0.65 * pr));
      dataCtx.fillRect(x - Math.floor(bodyW / 2), Math.round(volTop * pr) + Math.round(volH * pr) - vH, bodyW, vH);
    }
    dataCtx.globalAlpha = 1;
  }

  // ─── Candles (batched: bull wicks, bear wicks, bull bodies, bear bodies) ─
  for (let pass = 0; pass < 4; pass++) {
    const isBull = pass < 2;
    const isWick = pass % 2 === 0;
    dataCtx.fillStyle = isBull ? bullColor : bearColor;

    for (let i = start; i < endIdx; i++) {
      const o = barData.open[i], h = barData.high[i];
      const l = barData.low[i], c = barData.close[i];
      if ((c >= o) !== isBull) continue;

      const barIdx = i - start;
      const x = Math.round((barIdx + 0.5 + (exactStart - start)) * bSp * pr);

      if (isWick) {
        const hY = Math.round(p2y(h) * pr);
        const lY = Math.round(p2y(l) * pr);
        const ww = Math.max(1, Math.round(pr));
        dataCtx.fillRect(x - Math.floor(ww / 2), hY, ww, Math.max(1, lY - hY));
      } else {
        const oY = Math.round(p2y(o) * pr);
        const cY = Math.round(p2y(c) * pr);
        const tp = Math.min(oY, cY);
        const bodyH = Math.max(1, Math.abs(oY - cY));
        const bodyW = Math.max(1, Math.floor(bSp * 0.65 * pr));
        dataCtx.fillRect(x - Math.floor(bodyW / 2), tp, bodyW, bodyH);
      }
    }
  }

  // ─── Price Line (horizontal line at last close) ─────────
  if (endIdx > 0) {
    const lastClose = barData.close[endIdx - 1];
    const lastOpen = barData.open[endIdx - 1];
    const pY = Math.round(p2y(lastClose) * pr);
    const isBull = lastClose >= lastOpen;
    const lineColor = isBull ? bullColor : bearColor;

    dataCtx.save();
    dataCtx.setLineDash([4 * pr, 3 * pr]);
    dataCtx.strokeStyle = lineColor;
    dataCtx.lineWidth = Math.max(1, pr);
    dataCtx.beginPath();
    dataCtx.moveTo(0, pY);
    dataCtx.lineTo(cBW, pY);
    dataCtx.stroke();
    dataCtx.setLineDash([]);

    // Pulsing dot
    const radius = (3 + Math.sin(Date.now() / 250) * 1.5) * pr;
    const lastBarIdx = (endIdx - 1) - start;
    const dotX = Math.round((lastBarIdx + 0.5 + (exactStart - start)) * bSp * pr);
    dataCtx.beginPath();
    dataCtx.arc(dotX, pY, radius, 0, Math.PI * 2);
    dataCtx.fillStyle = lineColor;
    dataCtx.fill();
    dataCtx.restore();
  }

  dataCtx.restore();
}

// ─── Indicator Layer ──────────────────────────────────────────

function renderIndicators(vp) {
  const { pr, bw, bh, cBW, mainBH, start, endIdx, exactStart, bSp, p2y } = vp;

  indicatorCtx.clearRect(0, 0, bw, bh);

  if (!indicators || indicators.length === 0) return;

  indicatorCtx.save();
  indicatorCtx.beginPath();
  indicatorCtx.rect(0, 0, cBW, mainBH);
  indicatorCtx.clip();

  for (const ind of indicators) {
    if (!ind.values || ind.values.length === 0) continue;

    indicatorCtx.strokeStyle = ind.color || '#FFD54F';
    indicatorCtx.lineWidth = (ind.lineWidth || 2) * pr;
    indicatorCtx.lineJoin = 'round';
    indicatorCtx.beginPath();

    let started = false;
    for (let i = start; i < endIdx; i++) {
      const val = ind.values[i];
      if (val == null || isNaN(val)) { started = false; continue; }

      const barIdx = i - start;
      const x = (barIdx + 0.5 + (exactStart - start)) * bSp * pr;
      const y = p2y(val) * pr;

      if (!started) {
        indicatorCtx.moveTo(x, y);
        started = true;
      } else {
        indicatorCtx.lineTo(x, y);
      }
    }

    indicatorCtx.stroke();
  }

  indicatorCtx.restore();
}
