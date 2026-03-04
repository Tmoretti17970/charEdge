// ═══════════════════════════════════════════════════════════════════
// charEdge — GridRenderer
//
// GPU-accelerated grid line rendering extracted from WebGLRenderer.
// Reuses the fibFill shader program for colored instanced quads.
// ═══════════════════════════════════════════════════════════════════

/** A horizontal grid line. */
export interface HorizontalGridLine {
  y: number;
  isMajor: boolean;
}

/** A vertical grid line. */
export interface VerticalGridLine {
  x: number;
  isMajor: boolean;
}

/** Grid data containing horizontal and vertical lines. */
export interface GridData {
  horizontal?: HorizontalGridLine[];
  vertical?: VerticalGridLine[];
}

/** Parameters for grid rendering. */
export interface GridParams {
  pixelRatio: number;
  chartWidth: number;
  mainHeight: number;
  [key: string]: unknown;
}

/** Theme for grid rendering. */
export interface GridTheme {
  gridLine?: string;
  [key: string]: unknown;
}

/** Minimal renderer interface to avoid circular WebGLRenderer dependency. */
interface RendererRef {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  _available: boolean;
  _shaderLib: { get(name: string): WebGLProgram | null };
  _buffers: Record<string, WebGLBuffer>;
  _fibFillData: Float32Array;
  _ensureCapacity(count: number): number;
  _parseColor(color: string): Float32Array;
}

/**
 * Draw all grid lines (horizontal + vertical) via GPU instanced quads.
 * Single draw call replaces per-line Canvas2D fillRect loops.
 */
export function drawGrid(
  r: RendererRef,
  gridData: GridData,
  params: GridParams,
  theme: GridTheme,
): void {
  if (!r._available) return;

  const gl = r.gl;
  const prog = r._shaderLib.get('fibFill'); // Reuse the generic colored-quad program
  if (!prog) return;

  const { pixelRatio: pr, chartWidth, mainHeight } = params;
  const cW = Math.round(chartWidth * pr);
  const mainBH = Math.round(mainHeight * pr);
  const gridColor = r._parseColor(theme.gridLine || 'rgba(54,58,69,0.4)');

  // Build instance data for all grid lines as thin quads
  const horizontals = gridData.horizontal || [];
  const verticals = gridData.vertical || [];
  const totalLines = horizontals.length + verticals.length;
  if (totalLines === 0) return;

  r._ensureCapacity(totalLines);

  // Reuse fibFill data buffer (same format: left, top, w, h, r, g, b, a)
  const data = r._fibFillData;
  let count = 0;

  // Horizontal grid lines
  for (let i = 0; i < horizontals.length; i++) {
    const { y, isMajor } = horizontals[i];
    const py = Math.round(y * pr);
    if (py < 0 || py > mainBH) continue;

    const lineH = isMajor ? Math.max(1, pr) : Math.max(1, Math.round(pr * 0.5));
    const alpha = isMajor ? gridColor[3] : gridColor[3] * 0.45;

    const off = count * 8;
    data[off]     = 0;       // left
    data[off + 1] = py;      // top
    data[off + 2] = cW;      // width
    data[off + 3] = lineH;   // height
    data[off + 4] = gridColor[0]; // r
    data[off + 5] = gridColor[1]; // g
    data[off + 6] = gridColor[2]; // b
    data[off + 7] = alpha;        // a
    count++;
  }

  // Vertical grid lines
  for (let i = 0; i < verticals.length; i++) {
    const { x, isMajor } = verticals[i];
    const px = Math.round(x * pr);
    if (px < 0 || px > cW) continue;

    const lineW = Math.max(1, Math.round(pr * 0.5));
    const alpha = isMajor ? gridColor[3] : gridColor[3] * 0.35;

    const off = count * 8;
    data[off]     = px;      // left
    data[off + 1] = 0;       // top
    data[off + 2] = lineW;   // width
    data[off + 3] = mainBH;  // height
    data[off + 4] = gridColor[0];
    data[off + 5] = gridColor[1];
    data[off + 6] = gridColor[2];
    data[off + 7] = alpha;
    count++;
  }

  if (count === 0) return;

  // Use the fibFill program (generic colored instanced quads)
  gl.useProgram(prog);
  gl.viewport(0, 0, r.canvas.width, r.canvas.height);
  gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), r.canvas.width, r.canvas.height);

  // Quad vertices
  const aPos = gl.getAttribLocation(prog, 'a_position');
  gl.bindBuffer(gl.ARRAY_BUFFER, r._buffers.quad);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(aPos, 0);

  // Instance data
  gl.bindBuffer(gl.ARRAY_BUFFER, r._buffers.fibFillInstances);
  gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * 8), gl.DYNAMIC_DRAW);

  const stride = 8 * 4;
  const attrs = ['a_left', 'a_top', 'a_w', 'a_h', 'a_r', 'a_g', 'a_b', 'a_a'];
  for (let i = 0; i < attrs.length; i++) {
    const loc = gl.getAttribLocation(prog, attrs[i]);
    if (loc >= 0) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, stride, i * 4);
      gl.vertexAttribDivisor(loc, 1);
    }
  }

  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);

  for (const attr of attrs) {
    const loc = gl.getAttribLocation(prog, attr);
    if (loc >= 0) gl.vertexAttribDivisor(loc, 0);
  }
}
