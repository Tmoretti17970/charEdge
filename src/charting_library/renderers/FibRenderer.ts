// ═══════════════════════════════════════════════════════════════════
// charEdge — FibRenderer
//
// GPU-accelerated Fibonacci zone fill rendering extracted from
// WebGLRenderer. Standalone typed functions that receive the
// renderer instance.
// ═══════════════════════════════════════════════════════════════════

/** A single Fibonacci zone to render. */
export interface FibZone {
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
  alpha?: number;
}

/** Parameters for fib fill rendering. */
export interface FibFillParams {
  pixelRatio: number;
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
 * Draw Fibonacci zone fills via WebGL instanced quads.
 * Renders all fib zones in a single draw call (much faster than Canvas2D per-zone fillRect).
 */
export function drawFibFill(
  r: RendererRef,
  zones: FibZone[],
  params: FibFillParams,
): void {
  if (!r._available || !zones?.length) return;

  const gl = r.gl;
  const prog = r._shaderLib.get('fibFill');
  if (!prog) return;

  const { pixelRatio: pr } = params;
  const cW = r.canvas.width;
  const cH = r.canvas.height;

  r._ensureCapacity(zones.length);

  // Build instance data: left, top, w, h, r, g, b, a
  let instanceCount = 0;
  const data = r._fibFillData;

  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    const rgba = r._parseColor(z.color || '#787B86');
    const idx = instanceCount * 8;
    data[idx]     = z.left * pr;
    data[idx + 1] = z.top * pr;
    data[idx + 2] = z.width * pr;
    data[idx + 3] = z.height * pr;
    data[idx + 4] = rgba[0];
    data[idx + 5] = rgba[1];
    data[idx + 6] = rgba[2];
    data[idx + 7] = (z.alpha !== undefined ? z.alpha : rgba[3]) * rgba[3];
    instanceCount++;
  }

  if (instanceCount === 0) return;

  gl.useProgram(prog);
  gl.viewport(0, 0, cW, cH);

  gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), cW, cH);

  // Quad
  const aPos = gl.getAttribLocation(prog, 'a_position');
  gl.bindBuffer(gl.ARRAY_BUFFER, r._buffers.quad);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(aPos, 0);

  // Instance data
  gl.bindBuffer(gl.ARRAY_BUFFER, r._buffers.fibFillInstances);
  gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, instanceCount * 8), gl.DYNAMIC_DRAW);

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

  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instanceCount);

  for (const attr of attrs) {
    const loc = gl.getAttribLocation(prog, attr);
    if (loc >= 0) gl.vertexAttribDivisor(loc, 0);
  }
}
