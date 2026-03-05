// ═══════════════════════════════════════════════════════════════════
// charEdge — CandleRenderer
//
// GPU-accelerated candlestick rendering extracted from WebGLRenderer.
// Standalone typed functions that receive the renderer instance.
// ═══════════════════════════════════════════════════════════════════

/** Parameters for candle rendering. */
export interface CandleParams {
  pixelRatio: number;
  barSpacing: number;
  startIdx: number;
  timeTransform?: { indexToPixel: (idx: number) => number } | null;
  yMin: number;
  yMax: number;
  mainH?: number;
  hollow?: boolean; // 5A.3.2: hollow candles mode
  [key: string]: unknown;
}

/** Theme colors for candle rendering. */
export interface CandleTheme {
  bullCandle?: string;
  bearCandle?: string;
  [key: string]: unknown;
}

/** Bar data shape for candle rendering. */
export interface CandleBar {
  open: number;
  high: number;
  low: number;
  close: number;
  [key: string]: unknown;
}

/** Minimal renderer interface to avoid circular WebGLRenderer dependency. */
interface RendererRef {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  _available: boolean;
  _shaderLib: { get(name: string): WebGLProgram | null };
  _buffers: Record<string, WebGLBuffer>;
  _candleData: Float32Array;
  _ensureCapacity(count: number): number;
  _parseColor(color: string): Float32Array;
  _lastCandleInstanceCount: number;
  _lastCandleParams: CandleParams & { mainH: number };
  _lastCandleTheme: CandleTheme;
  _lastPanOffset: number;
}

/**
 * Draw candlesticks via WebGL instanced rendering.
 * Single draw call for ALL visible candles (wick + body per bar).
 */
export function drawCandles(
  r: RendererRef,
  bars: CandleBar[],
  params: CandleParams,
  theme: CandleTheme,
): void {
  if (!r._available || !bars?.length) return;

  const gl = r.gl;
  const prog = r._shaderLib.get('candle');
  if (!prog) return;

  const { pixelRatio: pr, barSpacing, startIdx, timeTransform } = params;
  const cW = r.canvas.width;
  const cH = r.canvas.height;

  const maxInstances = r._ensureCapacity(bars.length * 2); // 2 instances per bar (wick + body)
  const maxBars = Math.floor(maxInstances / 2);
  const barCount = Math.min(bars.length, maxBars);

  // Build instance data — only upload bars within the GPU window
  let instanceCount = 0;
  const data = r._candleData;

  for (let i = 0; i < barCount; i++) {
    const b = bars[i];
    const isBull = b.close >= b.open ? 1.0 : 0.0;
    let x: number;
    if (timeTransform) {
      x = timeTransform.indexToPixel(startIdx + i) * pr;
    } else {
      x = (i + 0.5) * barSpacing * pr;
    }

    // Wick instance
    const wi = instanceCount * 7;
    data[wi] = x;
    data[wi + 1] = b.open;
    data[wi + 2] = b.high;
    data[wi + 3] = b.low;
    data[wi + 4] = b.close;
    data[wi + 5] = isBull;
    data[wi + 6] = 1.0; // isWick
    instanceCount++;

    // Body instance
    const bi = instanceCount * 7;
    data[bi] = x;
    data[bi + 1] = b.open;
    data[bi + 2] = b.high;
    data[bi + 3] = b.low;
    data[bi + 4] = b.close;
    data[bi + 5] = isBull;
    data[bi + 6] = 0.0; // isBody
    instanceCount++;
  }

  gl.useProgram(prog);
  gl.viewport(0, 0, cW, cH);

  // Set uniforms
  const mainH = params.mainH || cH / pr;
  gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), cW, cH);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_bodyWidth'), Math.max(1, barSpacing * 0.35 * pr));
  gl.uniform1f(gl.getUniformLocation(prog, 'u_wickWidth'), Math.max(0.5, pr * 0.5));
  gl.uniform1f(gl.getUniformLocation(prog, 'u_yMin'), params.yMin);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_yMax'), params.yMax);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_mainH'), mainH * pr);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_panOffset'), 0.0);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_hollow'), params.hollow ? 1.0 : 0.0);

  // Bull/bear colors
  const bullRGBA = r._parseColor(theme.bullCandle || '#26A69A');
  const bearRGBA = r._parseColor(theme.bearCandle || '#EF5350');
  gl.uniform4fv(gl.getUniformLocation(prog, 'u_bullColor'), bullRGBA);
  gl.uniform4fv(gl.getUniformLocation(prog, 'u_bearColor'), bearRGBA);

  // Set up quad attribute
  const aPos = gl.getAttribLocation(prog, 'a_position');
  gl.bindBuffer(gl.ARRAY_BUFFER, r._buffers.quad);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(aPos, 0); // per-vertex

  // Upload candle instance data
  gl.bindBuffer(gl.ARRAY_BUFFER, r._buffers.candleInstances);
  gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, instanceCount * 7), gl.DYNAMIC_DRAW);

  const stride = 7 * 4;
  const attrs = ['a_x', 'a_open', 'a_high', 'a_low', 'a_close', 'a_isBull', 'a_isWick'];
  for (let i = 0; i < attrs.length; i++) {
    const loc = gl.getAttribLocation(prog, attrs[i]);
    if (loc >= 0) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, stride, i * 4);
      gl.vertexAttribDivisor(loc, 1); // per-instance
    }
  }

  // Draw instanced
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instanceCount);

  // Clean up
  for (const attr of attrs) {
    const loc = gl.getAttribLocation(prog, attr);
    if (loc >= 0) gl.vertexAttribDivisor(loc, 0);
  }

  // Sprint 3: Save state for pan-only redraws
  r._lastCandleInstanceCount = instanceCount;
  r._lastCandleParams = { ...params, mainH };
  r._lastCandleTheme = theme;
  r._lastPanOffset = 0;
}

/**
 * Update only the last candle's instance data via bufferSubData.
 * Avoids full buffer re-upload on live ticks (~16ms → ~0.5ms).
 *
 * Layout from drawCandles is interleaved: [wick0, body0, wick1, body1, ...]
 * Instance data stores RAW OHLC — the shader converts via u_yMin/u_yMax uniforms.
 */
export function updateLastCandle(
  r: RendererRef,
  bar: CandleBar,
  params: CandleParams,
  theme: CandleTheme,
): boolean {
  if (!r._available || !r._lastCandleInstanceCount || r._lastCandleInstanceCount < 2) return false;

  const gl = r.gl;
  if (!r._buffers.candleInstances) return false;

  const { pixelRatio: pr, barSpacing, startIdx, timeTransform } = params;

  // Last bar number (0-indexed within visible range)
  const lastBarNum = (r._lastCandleInstanceCount / 2) - 1;
  // Interleaved: wick at even index, body at odd index
  const wickIdx = r._lastCandleInstanceCount - 2;
  const bodyIdx = r._lastCandleInstanceCount - 1;

  // Compute x position — must match drawCandles' calculation
  let x: number;
  if (timeTransform) {
    x = timeTransform.indexToPixel(startIdx + lastBarNum) * pr;
  } else {
    x = (lastBarNum + 0.5) * barSpacing * pr;
  }
  const isBull = bar.close >= bar.open ? 1.0 : 0.0;

  gl.bindBuffer(gl.ARRAY_BUFFER, r._buffers.candleInstances);

  // Wick instance (isWick = 1.0) — store RAW OHLC, shader transforms
  const wickData = new Float32Array([
    x, bar.open, bar.high, bar.low, bar.close, isBull, 1.0
  ]);
  gl.bufferSubData(gl.ARRAY_BUFFER, wickIdx * 7 * 4, wickData);

  // Body instance (isWick = 0.0)
  const bodyData = new Float32Array([
    x, bar.open, bar.high, bar.low, bar.close, isBull, 0.0
  ]);
  gl.bufferSubData(gl.ARRAY_BUFFER, bodyIdx * 7 * 4, bodyData);

  // Save state for pan-only redraws
  r._lastCandleParams = { ...params, mainH: r._lastCandleParams?.mainH || r.canvas.height };
  r._lastCandleTheme = theme;

  return true;
}

