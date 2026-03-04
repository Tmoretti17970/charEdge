// ═══════════════════════════════════════════════════════════════════
// charEdge — LineRenderer
//
// GPU-accelerated line, area, and anti-aliased line rendering
// extracted from WebGLRenderer.
// ═══════════════════════════════════════════════════════════════════

/** Parameters for line/area rendering. */
export interface LineParams {
  pixelRatio: number;
  barSpacing: number;
  startIdx: number;
  priceToY: (price: number) => number;
  timeTransform?: { indexToPixel: (idx: number) => number } | null;
  mainH?: number;
  [key: string]: unknown;
}

/** A point in pixel space. */
export interface Point {
  x: number;
  y: number;
}

/** Bar data shape for line rendering. */
export interface LineBar {
  close: number;
  [key: string]: unknown;
}

/** Minimal renderer interface. */
interface RendererRef {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  _available: boolean;
  _shaderLib: { get(name: string): WebGLProgram | null };
  _buffers: Record<string, WebGLBuffer>;
  _lineData: Float32Array;
  _aaLineData: Float32Array;
  _parseColor(color: string): Float32Array;
  drawAALine(points: Point[], color: string, lineWidth?: number): void;
}

/**
 * Draw a line chart via WebGL.
 * Builds pixel-space points and delegates to drawAALine.
 */
export function drawLine(
  r: RendererRef,
  bars: LineBar[],
  params: LineParams,
  color: string,
  lineWidth: number = 2,
): void {
  if (!r._available || !bars?.length) return;

  const { pixelRatio: pr, barSpacing, startIdx, timeTransform } = params;

  // Build pixel-space points for the AA line shader
  const points: Point[] = [];
  for (let i = 0; i < bars.length; i++) {
    let x: number;
    if (timeTransform) {
      x = timeTransform.indexToPixel(startIdx + i) * pr;
    } else {
      x = (i + 0.5) * barSpacing * pr;
    }
    const y = params.priceToY(bars[i].close) * pr;
    points.push({ x, y });
  }

  // Delegate to anti-aliased triangle-strip line renderer
  drawAALine(r, points, color, lineWidth);
}

/**
 * Draw an area chart via WebGL (TRIANGLE_STRIP + LINE_STRIP).
 * Renders a filled area below the line with gradient-like opacity.
 */
export function drawArea(
  r: RendererRef,
  bars: LineBar[],
  params: LineParams,
  lineColor: string,
  fillColor: string,
): void {
  if (!r._available || !bars?.length) return;

  const gl = r.gl;
  const prog = r._shaderLib.get('line');
  if (!prog) return;

  const { pixelRatio: pr, barSpacing, startIdx, timeTransform } = params;
  const cW = r.canvas.width;
  const cH = r.canvas.height;
  const bottomY = (params.mainH || cH / pr) * pr;

  // Build triangle strip: for each bar, two vertices — (x, priceY) and (x, bottomY)
  const vertCount = bars.length * 2;
  const needed = vertCount * 2; // x,y per vertex
  if (needed > r._lineData.length) {
    r._lineData = new Float32Array(needed);
  }
  const data = r._lineData;

  for (let i = 0; i < bars.length; i++) {
    let x: number;
    if (timeTransform) {
      x = timeTransform.indexToPixel(startIdx + i) * pr;
    } else {
      x = (i + 0.5) * barSpacing * pr;
    }
    const y = params.priceToY(bars[i].close) * pr;
    // Top vertex
    data[i * 4] = x;
    data[i * 4 + 1] = y;
    // Bottom vertex
    data[i * 4 + 2] = x;
    data[i * 4 + 3] = bottomY;
  }

  gl.useProgram(prog);
  gl.viewport(0, 0, cW, cH);
  gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), cW, cH);

  const aPos = gl.getAttribLocation(prog, 'a_position');
  gl.bindBuffer(gl.ARRAY_BUFFER, r._buffers.lineVertices);
  gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, vertCount * 2), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  // Draw fill (triangle strip)
  gl.uniform4fv(gl.getUniformLocation(prog, 'u_color'), r._parseColor(fillColor || 'rgba(41,98,255,0.12)'));
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertCount);

  // Draw anti-aliased line on top (triangle-strip AA shader)
  const aaPoints: Point[] = [];
  for (let i = 0; i < bars.length; i++) {
    aaPoints.push({ x: data[i * 4], y: data[i * 4 + 1] });
  }
  drawAALine(r, aaPoints, lineColor || '#2962FF', 2);
}

/**
 * Draw an anti-aliased line via triangle-strip expansion.
 * Each segment is expanded into a screen-aligned quad with smooth edges.
 * Produces sub-pixel smooth lines that look better than Canvas2D.
 */
export function drawAALine(
  r: RendererRef,
  points: Point[],
  color: string,
  lineWidth: number = 2,
): void {
  if (!r._available || !points || points.length < 2) return;

  const gl = r.gl;
  const prog = r._shaderLib.get('aaLine');
  if (!prog) return;

  const cW = r.canvas.width;
  const cH = r.canvas.height;
  const segCount = points.length - 1;

  // Ensure buffer capacity: 4 verts per segment, 6 floats per vert
  const needed = segCount * 4 * 6;
  if (needed > r._aaLineData.length) {
    r._aaLineData = new Float32Array(needed);
  }
  const data = r._aaLineData;

  // Build triangle-strip quad vertices for each segment
  let vi = 0;
  for (let i = 0; i < segCount; i++) {
    const ax = points[i].x, ay = points[i].y;
    const bx = points[i + 1].x, by = points[i + 1].y;

    // 4 vertices: start-left, start-right, end-left, end-right
    data[vi++] = ax; data[vi++] = ay; data[vi++] = bx; data[vi++] = by; data[vi++] = -1; data[vi++] = 0;
    data[vi++] = ax; data[vi++] = ay; data[vi++] = bx; data[vi++] = by; data[vi++] = 1; data[vi++] = 0;
    data[vi++] = ax; data[vi++] = ay; data[vi++] = bx; data[vi++] = by; data[vi++] = -1; data[vi++] = 1;
    data[vi++] = ax; data[vi++] = ay; data[vi++] = bx; data[vi++] = by; data[vi++] = 1; data[vi++] = 1;
  }

  const totalVerts = segCount * 4;

  gl.useProgram(prog);
  gl.viewport(0, 0, cW, cH);

  gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), cW, cH);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_lineWidth'), lineWidth);
  gl.uniform4fv(gl.getUniformLocation(prog, 'u_color'), r._parseColor(color));

  // Upload vertex data
  gl.bindBuffer(gl.ARRAY_BUFFER, r._buffers.aaLineVertices);
  gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, vi), gl.DYNAMIC_DRAW);

  const stride = 6 * 4; // 6 floats × 4 bytes
  const aPosA = gl.getAttribLocation(prog, 'a_posA');
  const aPosB = gl.getAttribLocation(prog, 'a_posB');
  const aSide = gl.getAttribLocation(prog, 'a_side');
  const aMiter = gl.getAttribLocation(prog, 'a_miter');

  if (aPosA >= 0) { gl.enableVertexAttribArray(aPosA); gl.vertexAttribPointer(aPosA, 2, gl.FLOAT, false, stride, 0); }
  if (aPosB >= 0) { gl.enableVertexAttribArray(aPosB); gl.vertexAttribPointer(aPosB, 2, gl.FLOAT, false, stride, 8); }
  if (aSide >= 0) { gl.enableVertexAttribArray(aSide); gl.vertexAttribPointer(aSide, 1, gl.FLOAT, false, stride, 16); }
  if (aMiter >= 0) { gl.enableVertexAttribArray(aMiter); gl.vertexAttribPointer(aMiter, 1, gl.FLOAT, false, stride, 20); }

  // Draw each segment as a separate triangle strip of 4 vertices
  for (let i = 0; i < segCount; i++) {
    gl.drawArrays(gl.TRIANGLE_STRIP, i * 4, 4);
  }

  // Cleanup
  if (aPosA >= 0) gl.disableVertexAttribArray(aPosA);
  if (aPosB >= 0) gl.disableVertexAttribArray(aPosB);
  if (aSide >= 0) gl.disableVertexAttribArray(aSide);
  if (aMiter >= 0) gl.disableVertexAttribArray(aMiter);
}
