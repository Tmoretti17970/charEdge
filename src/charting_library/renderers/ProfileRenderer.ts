// ═══════════════════════════════════════════════════════════════════
// charEdge — ProfileRenderer
//
// GPU-accelerated volume profile and heatmap rendering extracted
// from WebGLRenderer. Standalone typed functions that receive the
// renderer instance.
// ═══════════════════════════════════════════════════════════════════

/** Parameters for volume profile rendering. */
export interface VolumeProfileParams {
  pixelRatio: number;
  rowHeight?: number;
  maxVolume?: number;
  rightEdge?: number;
  maxBarWidth?: number;
  [key: string]: unknown;
}

/** Theme for volume profile rendering. */
export interface VolumeProfileTheme {
  buyColor?: string;
  sellColor?: string;
  pocColor?: string;
  [key: string]: unknown;
}

/** A single volume profile row. */
export interface ProfileRow {
  priceY: number;
  volume: number;
  isPoc: boolean;
}

/** Parameters for heatmap rendering. */
export interface HeatmapParams {
  pixelRatio: number;
  globalAlpha?: number;
  [key: string]: unknown;
}

/** Theme for heatmap rendering. */
export interface HeatmapTheme {
  coldColor?: string;
  warmColor?: string;
  hotColor?: string;
  [key: string]: unknown;
}

/** A single heatmap cell. */
export interface HeatmapCell {
  x: number;
  y: number;
  w: number;
  h: number;
  intensity: number;
}

/** Minimal renderer interface to avoid circular WebGLRenderer dependency. */
interface RendererRef {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  _available: boolean;
  _shaderLib: { get(name: string): WebGLProgram | null };
  _buffers: Record<string, WebGLBuffer>;
  _vprofileData: Float32Array;
  _heatmapData: Float32Array;
  _ensureCapacity(count: number): number;
  _parseColor(color: string): Float32Array;
}

/**
 * Draw a volume profile histogram via WebGL instanced horizontal bars.
 * Each row represents a price level; bar width is proportional to volume.
 */
export function drawVolumeProfile(
  r: RendererRef,
  rows: ProfileRow[],
  params: VolumeProfileParams,
  theme: VolumeProfileTheme,
): void {
  if (!r._available || !rows?.length) return;

  const gl = r.gl;
  const prog = r._shaderLib.get('vprofile');
  if (!prog) return;

  const { pixelRatio: pr, rowHeight = 10, maxVolume = 1, rightEdge, maxBarWidth = 200 } = params;
  const cW = r.canvas.width;
  const cH = r.canvas.height;

  r._ensureCapacity(rows.length);

  // Build instance data: y, width, height, intensity, isPoc
  let instanceCount = 0;
  const data = r._vprofileData;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const intensity = Math.min(1, (row.volume || 0) / Math.max(maxVolume, 1));
    const barW = intensity * maxBarWidth * pr;
    if (barW < 0.5) continue;

    const idx = instanceCount * 5;
    data[idx]     = row.priceY * pr;        // y center
    data[idx + 1] = barW;                   // width
    data[idx + 2] = rowHeight * pr;         // height
    data[idx + 3] = intensity;              // intensity
    data[idx + 4] = row.isPoc ? 1.0 : 0.0; // isPoc
    instanceCount++;
  }

  if (instanceCount === 0) return;

  gl.useProgram(prog);
  gl.viewport(0, 0, cW, cH);

  gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), cW, cH);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_rightEdge'), (rightEdge || cW / pr) * pr);

  gl.uniform4fv(gl.getUniformLocation(prog, 'u_buyColor'), r._parseColor(theme.buyColor || '#26A69A'));
  gl.uniform4fv(gl.getUniformLocation(prog, 'u_sellColor'), r._parseColor(theme.sellColor || '#EF5350'));
  gl.uniform4fv(gl.getUniformLocation(prog, 'u_pocColor'), r._parseColor(theme.pocColor || '#FFD54F'));

  // Quad
  const aPos = gl.getAttribLocation(prog, 'a_position');
  gl.bindBuffer(gl.ARRAY_BUFFER, r._buffers.quad);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(aPos, 0);

  // Instance data
  gl.bindBuffer(gl.ARRAY_BUFFER, r._buffers.vprofileInstances);
  gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, instanceCount * 5), gl.DYNAMIC_DRAW);

  const stride = 5 * 4;
  const attrs = ['a_y', 'a_width', 'a_height', 'a_intensity', 'a_isPoc'];
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
}

/**
 * Draw a heatmap via WebGL instanced color-gradient quads.
 * Used for liquidation heatmaps, order book depth, etc.
 */
export function drawHeatmap(
  r: RendererRef,
  cells: HeatmapCell[],
  params: HeatmapParams,
  theme: HeatmapTheme,
): void {
  if (!r._available || !cells?.length) return;

  const gl = r.gl;
  const prog = r._shaderLib.get('heatmap');
  if (!prog) return;

  const { pixelRatio: pr, globalAlpha = 0.8 } = params;
  const cW = r.canvas.width;
  const cH = r.canvas.height;

  r._ensureCapacity(cells.length);

  // Build instance data: x, y, cellW, cellH, intensity
  let instanceCount = 0;
  const data = r._heatmapData;

  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const idx = instanceCount * 5;
    data[idx]     = c.x * pr;
    data[idx + 1] = c.y * pr;
    data[idx + 2] = c.w * pr;
    data[idx + 3] = c.h * pr;
    data[idx + 4] = Math.min(1, Math.max(0, c.intensity || 0));
    instanceCount++;
  }

  if (instanceCount === 0) return;

  gl.useProgram(prog);
  gl.viewport(0, 0, cW, cH);

  gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), cW, cH);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_globalAlpha'), globalAlpha);

  gl.uniform4fv(gl.getUniformLocation(prog, 'u_coldColor'), r._parseColor(theme.coldColor || '#1A237E'));
  gl.uniform4fv(gl.getUniformLocation(prog, 'u_warmColor'), r._parseColor(theme.warmColor || '#FFD54F'));
  gl.uniform4fv(gl.getUniformLocation(prog, 'u_hotColor'), r._parseColor(theme.hotColor || '#F44336'));

  // Quad
  const aPos = gl.getAttribLocation(prog, 'a_position');
  gl.bindBuffer(gl.ARRAY_BUFFER, r._buffers.quad);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(aPos, 0);

  // Instance data
  gl.bindBuffer(gl.ARRAY_BUFFER, r._buffers.heatmapInstances);
  gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, instanceCount * 5), gl.DYNAMIC_DRAW);

  const stride = 5 * 4;
  const attrs = ['a_x', 'a_y', 'a_cellW', 'a_cellH', 'a_intensity'];
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
}
