// ═══════════════════════════════════════════════════════════════════
// charEdge — VolumeRenderer
//
// GPU-accelerated volume bar rendering extracted from WebGLRenderer.
// ═══════════════════════════════════════════════════════════════════

/** Parameters for volume rendering. */
export interface VolumeParams {
  pixelRatio: number;
  barSpacing: number;
  startIdx: number;
  timeTransform?: { indexToPixel: (idx: number) => number } | null;
  mainH?: number;
  [key: string]: unknown;
}

/** Theme colors for volume rendering. */
export interface VolumeTheme {
  bullVolume?: string;
  bearVolume?: string;
  [key: string]: unknown;
}

/** Bar data shape for volume rendering. */
export interface VolumeBar {
  open: number;
  close: number;
  volume: number;
  [key: string]: unknown;
}

/** Minimal renderer interface. */
interface RendererRef {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  _available: boolean;
  _shaderLib: { get(name: string): WebGLProgram | null };
  _buffers: Record<string, WebGLBuffer>;
  _volumeData: Float32Array;
  _ensureCapacity(count: number): number;
  _parseColor(color: string): Float32Array;
  _lastVolumeInstanceCount: number;
  _lastVolumeMaxVol: number;
  _lastVolumeParams: VolumeParams & { mainH: number; volTop: number; volH: number };
  _lastVolumeTheme: VolumeTheme;
}

/**
 * Draw volume bars via WebGL instanced rendering.
 */
export function drawVolume(
  r: RendererRef,
  bars: VolumeBar[],
  params: VolumeParams,
  theme: VolumeTheme,
): void {
  if (!r._available || !bars?.length) return;

  const gl = r.gl;
  const prog = r._shaderLib.get('volume');
  if (!prog) return;

  const { pixelRatio: pr, barSpacing, startIdx, timeTransform } = params;
  const cW = r.canvas.width;
  const cH = r.canvas.height;

  r._ensureCapacity(bars.length);

  // Find max volume
  let maxVol = 0;
  for (const b of bars) if ((b.volume || 0) > maxVol) maxVol = b.volume;
  if (maxVol === 0) return;

  // Build instance data
  let instanceCount = 0;
  const data = r._volumeData;

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    let x: number;
    if (timeTransform) {
      x = timeTransform.indexToPixel(startIdx + i) * pr;
    } else {
      x = (i + 0.5) * barSpacing * pr;
    }

    const vi = instanceCount * 3;
    data[vi] = x;
    data[vi + 1] = b.volume || 0;
    data[vi + 2] = b.close >= b.open ? 1.0 : 0.0;
    instanceCount++;
  }

  gl.useProgram(prog);

  const mainH = params.mainH || cH / pr;
  const volTop = mainH * 0.75 * pr;
  const volH = mainH * 0.25 * pr;

  gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), cW, cH);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_bodyWidth'), Math.max(1, barSpacing * 0.35 * pr));
  gl.uniform1f(gl.getUniformLocation(prog, 'u_maxVolume'), maxVol);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_volumeTop'), volTop);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_volumeHeight'), volH);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_panOffset'), 0.0);

  const bullRGBA = r._parseColor(theme.bullVolume || '#26A69A80');
  const bearRGBA = r._parseColor(theme.bearVolume || '#EF535080');
  gl.uniform4fv(gl.getUniformLocation(prog, 'u_bullColor'), bullRGBA);
  gl.uniform4fv(gl.getUniformLocation(prog, 'u_bearColor'), bearRGBA);

  // Quad vertices
  const aPos = gl.getAttribLocation(prog, 'a_position');
  gl.bindBuffer(gl.ARRAY_BUFFER, r._buffers.quad);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(aPos, 0);

  // Instance data
  gl.bindBuffer(gl.ARRAY_BUFFER, r._buffers.volumeInstances);
  gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, instanceCount * 3), gl.DYNAMIC_DRAW);

  const stride = 3 * 4;
  const attrs = ['a_x', 'a_volume', 'a_isBull'];
  for (let i = 0; i < attrs.length; i++) {
    const loc = gl.getAttribLocation(prog, attrs[i]);
    if (loc >= 0) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, stride, i * 4);
      gl.vertexAttribDivisor(loc, 1);
    }
  }

  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instanceCount);

  for (const attr of attrs) {
    const loc = gl.getAttribLocation(prog, attr);
    if (loc >= 0) gl.vertexAttribDivisor(loc, 0);
  }

  // Sprint 3: Save state for pan-only redraws
  r._lastVolumeInstanceCount = instanceCount;
  r._lastVolumeMaxVol = maxVol;
  r._lastVolumeParams = { ...params, mainH, volTop, volH };
  r._lastVolumeTheme = theme;
}

/**
 * Update only the last volume bar's instance data via bufferSubData.
 * Avoids full buffer re-upload on live ticks.
 *
 * Task 2.3.13: Mirrors CandleRenderer.updateLastCandle pattern.
 */
export function updateLastVolume(
  r: RendererRef,
  bar: VolumeBar,
  params: VolumeParams,
  theme: VolumeTheme,
): boolean {
  if (!r._available || !r._lastVolumeInstanceCount || r._lastVolumeInstanceCount < 1) return false;

  const gl = r.gl;
  if (!r._buffers.volumeInstances) return false;

  const { pixelRatio: pr, barSpacing, startIdx, timeTransform } = params;

  // Last bar index in the instance buffer
  const lastIdx = r._lastVolumeInstanceCount - 1;

  // Compute x position — must match drawVolume's calculation
  let x: number;
  if (timeTransform) {
    x = timeTransform.indexToPixel(startIdx + lastIdx) * pr;
  } else {
    x = (lastIdx + 0.5) * barSpacing * pr;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, r._buffers.volumeInstances);

  const volData = new Float32Array([
    x,
    bar.volume || 0,
    bar.close >= bar.open ? 1.0 : 0.0,
  ]);
  gl.bufferSubData(gl.ARRAY_BUFFER, lastIdx * 3 * 4, volData);

  // Update saved state
  r._lastVolumeParams = { ...params, mainH: r._lastVolumeParams?.mainH || r.canvas.height / pr, volTop: r._lastVolumeParams?.volTop || 0, volH: r._lastVolumeParams?.volH || 0 };
  r._lastVolumeTheme = theme;

  return true;
}
