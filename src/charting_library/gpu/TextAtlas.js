import { logger } from '@/observability/logger';

// ═══════════════════════════════════════════════════════════════════
// charEdge — TextAtlas (SDF)
//
// Signed Distance Field font atlas for GPU-composited text rendering.
// Produces crisp text at any size without blurriness on HiDPI screens.
//
// How it works:
//   1. Pre-render all needed glyphs to an offscreen canvas at high resolution
//   2. Generate an SDF field per glyph (distance to nearest edge)
//   3. Upload atlas as a WebGL texture
//   4. Render text as instanced quads with SDF fragment shader
//
// Usage:
//   const atlas = new TextAtlas(gl, { fontFamily: 'Inter, sans-serif' });
//   atlas.drawText(entries, params);
// ═══════════════════════════════════════════════════════════════════

// All characters we need for price/time labels
// Sprint 20: Extended with common trading emoji and currency symbols
const CHARSET =
  '0123456789.,:-+%$/ ' +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' +
  '€£¥₿▲▼⬆⬇◆●○★☆✓✗⚠';

const GLYPH_SIZE = 48;        // Render size for each glyph in the atlas
const SDF_RADIUS = 8;         // Distance field spread in pixels
const ATLAS_COLS = 16;        // Columns in the atlas grid
const ATLAS_PADDING = 2;      // Padding around each glyph cell

// ─── SDF Text Shaders ─────────────────────────────────────────

const SDF_TEXT_VERT = `#version 300 es
precision highp float;

in vec2 a_position;   // unit quad (0..1)

// Per-instance
in vec2 a_offset;     // text position (top-left) in bitmap pixels
in vec2 a_size;       // glyph quad size in bitmap pixels
in vec4 a_uvRect;     // UV rect in atlas: x, y, w, h
in vec4 a_color;      // RGBA color

uniform vec2 u_resolution;

out vec2 v_uv;
out vec4 v_color;

void main() {
  v_color = a_color;

  // UV within the atlas for this glyph
  v_uv = vec2(
    a_uvRect.x + a_position.x * a_uvRect.z,
    a_uvRect.y + a_position.y * a_uvRect.w
  );

  // Screen position
  float x = a_offset.x + a_position.x * a_size.x;
  float y = a_offset.y + a_position.y * a_size.y;

  gl_Position = vec4(
    (x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (y / u_resolution.y) * 2.0,
    0.0, 1.0
  );
}
`;

const SDF_TEXT_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
in vec4 v_color;

uniform sampler2D u_atlas;
uniform float u_smoothing;  // SDF smoothing factor (depends on font size)

out vec4 fragColor;

void main() {
  float dist = texture(u_atlas, v_uv).r;

  // SDF rendering: 0.5 = edge, >0.5 = inside, <0.5 = outside
  float alpha = smoothstep(0.5 - u_smoothing, 0.5 + u_smoothing, dist);
  fragColor = vec4(v_color.rgb, v_color.a * alpha);
}
`;

// ═══════════════════════════════════════════════════════════════
// TextAtlas Class
// ═══════════════════════════════════════════════════════════════

export class TextAtlas {
  /**
   * @param {WebGL2RenderingContext} gl
   * @param {Object} [opts]
   * @param {string} [opts.fontFamily]
   */
  constructor(gl, opts = {}) {
    this.gl = gl;
    this._fontFamily = opts.fontFamily || 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
    // Sprint 20: Support bold weight
    this._fontWeight = opts.fontWeight || 'normal';
    this._glyphs = new Map(); // char → { u, v, w, h, advance, bearingX, bearingY }
    this._texture = null;
    this._program = null;
    this._buffers = {};
    this._atlasW = 0;
    this._atlasH = 0;
    this._ready = false;
    this._maxInstances = 512;

    this._build();
  }

  get ready() { return this._ready; }

  // ─── Atlas Generation ─────────────────────────────────────────

  /** @private */
  _build() {
    const gl = this.gl;
    const charCount = CHARSET.length;
    const rows = Math.ceil(charCount / ATLAS_COLS);
    const cellSize = GLYPH_SIZE + ATLAS_PADDING * 2;

    this._atlasW = ATLAS_COLS * cellSize;
    this._atlasH = rows * cellSize;

    // Create offscreen canvas for glyph rendering
    const canvas = document.createElement('canvas');
    canvas.width = this._atlasW;
    canvas.height = this._atlasH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Render glyphs at high resolution
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this._atlasW, this._atlasH);
    ctx.fillStyle = '#FFF';
    // Sprint 20: Use configurable weight for bold rendering
    ctx.font = `${this._fontWeight} ${GLYPH_SIZE * 0.7}px ${this._fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    for (let i = 0; i < charCount; i++) {
      const ch = CHARSET[i];
      const col = i % ATLAS_COLS;
      const row = Math.floor(i / ATLAS_COLS);
      const x = col * cellSize + ATLAS_PADDING;
      const y = row * cellSize + ATLAS_PADDING;

      const metrics = ctx.measureText(ch);
      ctx.fillText(ch, x, y);

      this._glyphs.set(ch, {
        u: x / this._atlasW,
        v: y / this._atlasH,
        w: cellSize / this._atlasW,
        h: cellSize / this._atlasH,
        advance: metrics.width / (GLYPH_SIZE * 0.7), // Normalized advance
        cellPx: cellSize,
      });
    }

    // Generate SDF from the rendered bitmap
    const imageData = ctx.getImageData(0, 0, this._atlasW, this._atlasH);
    const sdfData = this._generateSDF(imageData);

    // Upload to WebGL texture
    this._texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, this._atlasW, this._atlasH, 0, gl.RED, gl.UNSIGNED_BYTE, sdfData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Compile SDF text shader
    this._compileProgram();
    this._createBuffers();

    this._ready = true;
  }

  /**
   * Generate a signed distance field from a binary glyph image.
   * Uses brute-force approach (adequate for small atlas sizes).
   *
   * @param {ImageData} imageData
   * @returns {Uint8Array} SDF as single-channel data
   * @private
   */
  _generateSDF(imageData) {
    const w = imageData.width;
    const h = imageData.height;
    const src = imageData.data;
    const output = new Uint8Array(w * h);

    // Extract binary mask (threshold at 128)
    const inside = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      inside[i] = src[i * 4] > 128 ? 1 : 0;
    }

    // For each pixel, find distance to nearest edge
    const radius = SDF_RADIUS;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const isIn = inside[idx];
        let minDist = radius;

        // Search in a local window
        const x0 = Math.max(0, x - radius);
        const x1 = Math.min(w - 1, x + radius);
        const y0 = Math.max(0, y - radius);
        const y1 = Math.min(h - 1, y + radius);

        for (let sy = y0; sy <= y1; sy++) {
          for (let sx = x0; sx <= x1; sx++) {
            if (inside[sy * w + sx] !== isIn) {
              const d = Math.sqrt((sx - x) ** 2 + (sy - y) ** 2);
              if (d < minDist) minDist = d;
            }
          }
        }

        // Map to 0..255: 128 = edge, >128 = inside, <128 = outside
        const normalized = (isIn ? minDist : -minDist) / radius * 0.5 + 0.5;
        output[idx] = Math.max(0, Math.min(255, Math.round(normalized * 255)));
      }
    }

    return output;
  }

  /** @private */
  _compileProgram() {
    const gl = this.gl;

    const vert = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vert, SDF_TEXT_VERT);
    gl.compileShader(vert);
    if (!gl.getShaderParameter(vert, gl.COMPILE_STATUS)) {
      logger.engine.error('[TextAtlas] Vert error:', gl.getShaderInfoLog(vert));
      return;
    }

    const frag = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(frag, SDF_TEXT_FRAG);
    gl.compileShader(frag);
    if (!gl.getShaderParameter(frag, gl.COMPILE_STATUS)) {
      logger.engine.error('[TextAtlas] Frag error:', gl.getShaderInfoLog(frag));
      return;
    }

    this._program = gl.createProgram();
    gl.attachShader(this._program, vert);
    gl.attachShader(this._program, frag);
    gl.linkProgram(this._program);

    if (!gl.getProgramParameter(this._program, gl.LINK_STATUS)) {
      logger.engine.error('[TextAtlas] Link error:', gl.getProgramInfoLog(this._program));
      this._program = null;
    }

    gl.deleteShader(vert);
    gl.deleteShader(frag);
  }

  /** @private */
  _createBuffers() {
    const gl = this.gl;

    // Unit quad
    const quadVerts = new Float32Array([
      0, 0,  1, 0,  0, 1,
      1, 0,  1, 1,  0, 1,
    ]);
    this._buffers.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.quad);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

    // Instance data: offset(2) + size(2) + uvRect(4) + color(4) = 12 floats per glyph
    this._instanceData = new Float32Array(this._maxInstances * 12);
    this._buffers.instances = gl.createBuffer();
  }

  // ─── Text Measurement ──────────────────────────────────────────

  /**
   * Measure text width in CSS pixels at a given font size.
   *
   * @param {string} text
   * @param {number} fontSize - in CSS pixels
   * @returns {number} Width in CSS pixels
   */
  measureText(text, fontSize) {
    let width = 0;
    const _scale = fontSize / (GLYPH_SIZE * 0.7);
    for (const ch of text) {
      const glyph = this._glyphs.get(ch);
      if (glyph) {
        width += glyph.advance * fontSize;
      } else {
        width += fontSize * 0.5; // fallback for unknown chars
      }
    }
    return width;
  }

  // ─── Text Rendering ────────────────────────────────────────────

  /**
   * Render multiple text entries in a single batched draw call.
   *
   * @param {Array<{text: string, x: number, y: number, fontSize: number, color: Float32Array|number[], align?: string}>} entries
   *   - x, y in bitmap pixels, fontSize in CSS pixels
   * @param {Object} params - { pixelRatio, canvasWidth, canvasHeight }
   */
  drawText(entries, params) {
    if (!this._ready || !this._program || !entries?.length) return;

    const gl = this.gl;
    const { pixelRatio: pr, canvasWidth: cW, canvasHeight: cH } = params;

    let instanceCount = 0;

    // Ensure capacity
    let totalGlyphs = 0;
    for (const e of entries) totalGlyphs += e.text.length;
    if (totalGlyphs > this._maxInstances) {
      this._maxInstances = Math.max(totalGlyphs, this._maxInstances * 2);
      this._instanceData = new Float32Array(this._maxInstances * 12);
    }

    const data = this._instanceData;

    for (const entry of entries) {
      const { text, fontSize, color } = entry;
      const scale = fontSize / (GLYPH_SIZE * 0.7);
      const quadH = GLYPH_SIZE * scale * pr;
      const _quadAspect = 1.0; // Square cells in atlas

      // Compute text width for alignment
      let totalW = 0;
      for (const ch of text) {
        const g = this._glyphs.get(ch);
        totalW += g ? g.advance * fontSize * pr : fontSize * 0.5 * pr;
      }

      let cursorX = entry.x;
      const align = entry.align || 'left';
      if (align === 'center') cursorX -= totalW / 2;
      else if (align === 'right') cursorX -= totalW;

      const cursorY = entry.y - quadH * 0.5; // Vertically center

      for (const ch of text) {
        const g = this._glyphs.get(ch);
        if (!g) {
          cursorX += fontSize * 0.5 * pr;
          continue;
        }

        const quadW = g.cellPx * scale * pr;
        const off = instanceCount * 12;

        data[off]      = cursorX;    // a_offset.x
        data[off + 1]  = cursorY;    // a_offset.y
        data[off + 2]  = quadW;      // a_size.x
        data[off + 3]  = quadH;      // a_size.y
        data[off + 4]  = g.u;        // a_uvRect.x
        data[off + 5]  = g.v;        // a_uvRect.y
        data[off + 6]  = g.w;        // a_uvRect.z
        data[off + 7]  = g.h;        // a_uvRect.w
        data[off + 8]  = color[0];   // r
        data[off + 9]  = color[1];   // g
        data[off + 10] = color[2];   // b
        data[off + 11] = color[3] !== undefined ? color[3] : 1.0; // a

        instanceCount++;
        cursorX += g.advance * fontSize * pr;
      }
    }

    if (instanceCount === 0) return;

    // Render
    gl.useProgram(this._program);
    gl.viewport(0, 0, cW, cH);

    // Bind atlas texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.uniform1i(gl.getUniformLocation(this._program, 'u_atlas'), 0);
    gl.uniform2f(gl.getUniformLocation(this._program, 'u_resolution'), cW, cH);

    // SDF smoothing: smaller sizes need more smoothing
    const avgFontSize = entries.reduce((s, e) => s + e.fontSize, 0) / entries.length;
    const smoothing = Math.max(0.05, Math.min(0.35, 3.0 / (avgFontSize * pr)));
    gl.uniform1f(gl.getUniformLocation(this._program, 'u_smoothing'), smoothing);

    // Quad vertices
    const aPos = gl.getAttribLocation(this._program, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.quad);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aPos, 0);

    // Upload instance data
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.instances);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, instanceCount * 12), gl.DYNAMIC_DRAW);

    const stride = 12 * 4;
    // a_offset (vec2)
    const aOffset = gl.getAttribLocation(this._program, 'a_offset');
    if (aOffset >= 0) {
      gl.enableVertexAttribArray(aOffset);
      gl.vertexAttribPointer(aOffset, 2, gl.FLOAT, false, stride, 0);
      gl.vertexAttribDivisor(aOffset, 1);
    }
    // a_size (vec2)
    const aSize = gl.getAttribLocation(this._program, 'a_size');
    if (aSize >= 0) {
      gl.enableVertexAttribArray(aSize);
      gl.vertexAttribPointer(aSize, 2, gl.FLOAT, false, stride, 8);
      gl.vertexAttribDivisor(aSize, 1);
    }
    // a_uvRect (vec4)
    const aUV = gl.getAttribLocation(this._program, 'a_uvRect');
    if (aUV >= 0) {
      gl.enableVertexAttribArray(aUV);
      gl.vertexAttribPointer(aUV, 4, gl.FLOAT, false, stride, 16);
      gl.vertexAttribDivisor(aUV, 1);
    }
    // a_color (vec4)
    const aColor = gl.getAttribLocation(this._program, 'a_color');
    if (aColor >= 0) {
      gl.enableVertexAttribArray(aColor);
      gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, stride, 32);
      gl.vertexAttribDivisor(aColor, 1);
    }

    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instanceCount);

    // Cleanup divisors
    const attrs = [aOffset, aSize, aUV, aColor];
    for (const loc of attrs) {
      if (loc >= 0) gl.vertexAttribDivisor(loc, 0);
    }
  }

  // ─── Cleanup ────────────────────────────────────────────────────

  dispose() {
    const gl = this.gl;
    if (this._texture) gl.deleteTexture(this._texture);
    if (this._program) gl.deleteProgram(this._program);
    for (const name in this._buffers) gl.deleteBuffer(this._buffers[name]);
    this._ready = false;
  }

  /**
   * Sprint 20: Change font style at runtime and rebuild atlas.
   * @param {Object} opts
   * @param {string} [opts.fontFamily]
   * @param {string} [opts.fontWeight] - 'normal' | 'bold' | '600' etc.
   */
  setFontStyle(opts = {}) {
    if (opts.fontFamily) this._fontFamily = opts.fontFamily;
    if (opts.fontWeight) this._fontWeight = opts.fontWeight;
    // Rebuild atlas with new font
    if (this._texture) {
      this.gl.deleteTexture(this._texture);
    }
    this._glyphs.clear();
    this._ready = false;
    this._build();
  }
}
