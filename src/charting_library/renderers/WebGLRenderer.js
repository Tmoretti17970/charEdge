// ═══════════════════════════════════════════════════════════════════
// charEdge — WebGLRenderer
//
// GPU-accelerated chart rendering via WebGL 2.
// Renders candlesticks and volume bars as instanced geometry,
// achieving 10,000+ candles @ 60fps with minimal CPU overhead.
//
// Architecture:
//   - Single draw call for ALL visible candles (instanced rendering)
//   - Per-instance attributes: position, OHLC, color
//   - Vertex shader transforms OHLC → screen coordinates
//   - Automatic fallback to Canvas 2D if WebGL unavailable
//
// This is a HYBRID renderer: it renders geometric primitives via
// WebGL and composites with Canvas 2D text/UI layers.
// ═══════════════════════════════════════════════════════════════════

import { TextAtlas } from '../gpu/TextAtlas.js';
import { ShaderLibrary } from '../gpu/ShaderLibrary.js';

// ─── Shader Sources ───────────────────────────────────────────

const CANDLE_VERT = `#version 300 es
precision highp float;

// Per-vertex (quad corners)
in vec2 a_position;  // 0-1 normalized quad

// Per-instance
in float a_x;        // bar center X in pixels
in float a_open;     // open price
in float a_high;     // high price
in float a_low;      // low price
in float a_close;    // close price
in float a_isBull;   // 1.0 = bull, 0.0 = bear
in float a_isWick;   // 1.0 = wick, 0.0 = body

// Uniforms
uniform vec2 u_resolution;  // canvas size in pixels
uniform float u_bodyWidth;  // body half-width in pixels
uniform float u_wickWidth;  // wick half-width in pixels
uniform float u_yMin;       // price range min
uniform float u_yMax;       // price range max
uniform float u_mainH;      // main chart height in pixels

out float v_isBull;

float priceToY(float price) {
  return u_mainH * (1.0 - (price - u_yMin) / (u_yMax - u_yMin));
}

void main() {
  v_isBull = a_isBull;

  float halfW;
  float top, bottom;

  if (a_isWick > 0.5) {
    // Wick: thin vertical line from high to low
    halfW = u_wickWidth;
    top = priceToY(a_high);
    bottom = priceToY(a_low);
  } else {
    // Body: rectangle from open to close
    halfW = u_bodyWidth;
    float oY = priceToY(a_open);
    float cY = priceToY(a_close);
    top = min(oY, cY);
    bottom = max(oY, cY);
    if (bottom - top < 1.0) bottom = top + 1.0; // min 1px height
  }

  // Map quad position to screen space
  float x = a_x + (a_position.x - 0.5) * halfW * 2.0;
  float y = top + a_position.y * (bottom - top);

  // Convert to clip space (-1..1)
  gl_Position = vec4(
    (x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (y / u_resolution.y) * 2.0,
    0.0, 1.0
  );
}
`;

const CANDLE_FRAG = `#version 300 es
precision highp float;

in float v_isBull;

uniform vec4 u_bullColor;
uniform vec4 u_bearColor;

out vec4 fragColor;

void main() {
  fragColor = v_isBull > 0.5 ? u_bullColor : u_bearColor;
}
`;

// ─── Volume Shaders ───────────────────────────────────────────

const VOLUME_VERT = `#version 300 es
precision highp float;

in vec2 a_position;

// Per-instance
in float a_x;
in float a_volume;
in float a_isBull;

uniform vec2 u_resolution;
uniform float u_bodyWidth;
uniform float u_maxVolume;
uniform float u_volumeTop;    // Y position where volume pane starts
uniform float u_volumeHeight; // Height of volume pane

out float v_isBull;
out float v_alpha;

void main() {
  v_isBull = a_isBull;
  float normalizedVol = a_volume / max(u_maxVolume, 0.001);
  v_alpha = 0.3 + normalizedVol * 0.5;

  float barH = normalizedVol * u_volumeHeight;
  float halfW = u_bodyWidth;

  float x = a_x + (a_position.x - 0.5) * halfW * 2.0;
  float bottom = u_volumeTop + u_volumeHeight;
  float top = bottom - barH;
  float y = top + a_position.y * barH;

  gl_Position = vec4(
    (x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (y / u_resolution.y) * 2.0,
    0.0, 1.0
  );
}
`;

const VOLUME_FRAG = `#version 300 es
precision highp float;

in float v_isBull;
in float v_alpha;

uniform vec4 u_bullColor;
uniform vec4 u_bearColor;

out vec4 fragColor;

void main() {
  vec4 color = v_isBull > 0.5 ? u_bullColor : u_bearColor;
  fragColor = vec4(color.rgb, color.a * v_alpha);
}
`;

// ─── Line Shaders ─────────────────────────────────────────────

const LINE_VERT = `#version 300 es
precision highp float;

in vec2 a_position;
uniform vec2 u_resolution;

void main() {
  gl_Position = vec4(
    (a_position.x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (a_position.y / u_resolution.y) * 2.0,
    0.0, 1.0
  );
}
`;

const LINE_FRAG = `#version 300 es
precision highp float;

uniform vec4 u_color;
out vec4 fragColor;

void main() {
  fragColor = u_color;
}
`;

// ─── Anti-Aliased Line Shaders (Triangle-Strip) ───────────────

const AA_LINE_VERT = `#version 300 es
precision highp float;

// Each vertex of the expanded quad
in vec2 a_posA;       // start point of segment (pixels)
in vec2 a_posB;       // end point of segment (pixels)
in float a_side;      // -1 or +1 (left/right of line center)
in float a_miter;     // 0 = segment start, 1 = segment end

uniform vec2 u_resolution;
uniform float u_lineWidth;

out float v_distFromCenter;
out float v_lineWidth;

void main() {
  // Interpolate position along the segment
  vec2 pos = mix(a_posA, a_posB, a_miter);

  // Direction and normal
  vec2 dir = a_posB - a_posA;
  float len = length(dir);
  if (len < 0.001) dir = vec2(1.0, 0.0); else dir /= len;
  vec2 normal = vec2(-dir.y, dir.x);

  // Expand outward by half line width + 1px for AA fringe
  float halfW = u_lineWidth * 0.5 + 1.0;
  pos += normal * a_side * halfW;

  v_distFromCenter = a_side * halfW;
  v_lineWidth = u_lineWidth;

  gl_Position = vec4(
    (pos.x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (pos.y / u_resolution.y) * 2.0,
    0.0, 1.0
  );
}
`;

const AA_LINE_FRAG = `#version 300 es
precision highp float;

in float v_distFromCenter;
in float v_lineWidth;

uniform vec4 u_color;
out vec4 fragColor;

void main() {
  float d = abs(v_distFromCenter);
  float edge = fwidth(d);
  float alpha = 1.0 - smoothstep(v_lineWidth * 0.5 - edge, v_lineWidth * 0.5 + edge, d);
  fragColor = vec4(u_color.rgb, u_color.a * alpha);
}
`;

// ─── Volume Profile Shaders (Horizontal Bars) ────────────────

const VPROFILE_VERT = `#version 300 es
precision highp float;

in vec2 a_position;   // unit quad

// Per-instance
in float a_y;         // row center Y in pixels
in float a_width;     // bar width in pixels (extends leftward from right edge)
in float a_height;    // row height in pixels
in float a_intensity; // 0..1 normalized volume
in float a_isPoc;     // 1.0 = point of control row

uniform vec2 u_resolution;
uniform float u_rightEdge; // right edge X for horizontal bars

out float v_intensity;
out float v_isPoc;

void main() {
  v_intensity = a_intensity;
  v_isPoc = a_isPoc;

  float halfH = a_height * 0.5;
  float right = u_rightEdge;
  float left  = right - a_width;

  float x = mix(left, right, a_position.x);
  float y = (a_y - halfH) + a_position.y * a_height;

  gl_Position = vec4(
    (x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (y / u_resolution.y) * 2.0,
    0.0, 1.0
  );
}
`;

const VPROFILE_FRAG = `#version 300 es
precision highp float;

in float v_intensity;
in float v_isPoc;

uniform vec4 u_buyColor;
uniform vec4 u_sellColor;
uniform vec4 u_pocColor;

out vec4 fragColor;

void main() {
  if (v_isPoc > 0.5) {
    fragColor = u_pocColor;
  } else {
    float alpha = 0.2 + v_intensity * 0.6;
    vec4 baseColor = mix(u_sellColor, u_buyColor, v_intensity);
    fragColor = vec4(baseColor.rgb, baseColor.a * alpha);
  }
}
`;

// ─── Heatmap Shaders (Instanced Color-Gradient Quads) ────────

const HEATMAP_VERT = `#version 300 es
precision highp float;

in vec2 a_position;

// Per-instance: x, y, width, height, intensity
in float a_x;
in float a_y;
in float a_cellW;
in float a_cellH;
in float a_intensity;

uniform vec2 u_resolution;

out float v_intensity;

void main() {
  v_intensity = a_intensity;

  float x = a_x + a_position.x * a_cellW;
  float y = a_y + a_position.y * a_cellH;

  gl_Position = vec4(
    (x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (y / u_resolution.y) * 2.0,
    0.0, 1.0
  );
}
`;

const HEATMAP_FRAG = `#version 300 es
precision highp float;

in float v_intensity;

// 3-stop gradient: cold -> warm -> hot
uniform vec4 u_coldColor;
uniform vec4 u_warmColor;
uniform vec4 u_hotColor;
uniform float u_globalAlpha;

out vec4 fragColor;

void main() {
  vec4 color;
  if (v_intensity < 0.5) {
    color = mix(u_coldColor, u_warmColor, v_intensity * 2.0);
  } else {
    color = mix(u_warmColor, u_hotColor, (v_intensity - 0.5) * 2.0);
  }
  fragColor = vec4(color.rgb, color.a * u_globalAlpha * (0.3 + v_intensity * 0.7));
}
`;

// ─── Fibonacci Fill Shaders (Batch Zone Quads) ───────────────

const FIB_FILL_VERT = `#version 300 es
precision highp float;

in vec2 a_position;

// Per-instance: left, top, width, height, r, g, b, a
in float a_left;
in float a_top;
in float a_w;
in float a_h;
in float a_r;
in float a_g;
in float a_b;
in float a_a;

uniform vec2 u_resolution;

out vec4 v_color;

void main() {
  v_color = vec4(a_r, a_g, a_b, a_a);

  float x = a_left + a_position.x * a_w;
  float y = a_top  + a_position.y * a_h;

  gl_Position = vec4(
    (x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (y / u_resolution.y) * 2.0,
    0.0, 1.0
  );
}
`;

const FIB_FILL_FRAG = `#version 300 es
precision highp float;

in vec4 v_color;
out vec4 fragColor;

void main() {
  fragColor = v_color;
}
`;

// ═══════════════════════════════════════════════════════════════
// WebGLRenderer Class
//
// Phase 1.1.4: Virtual bar window — GPU instance buffers are capped
// at GPU_WINDOW_SIZE. This ensures memory-constant rendering:
// 1M bars loaded → only viewport-visible bars in GPU memory.
// ═══════════════════════════════════════════════════════════════

// Maximum instance count for GPU buffers.
// Enough for ~1024 visible candles × 2 (wick + body) with headroom.
// Buffers never grow beyond this — excess bars are clamped.
const GPU_WINDOW_SIZE = 2048;

export class WebGLRenderer {
  /**
   * @param {HTMLCanvasElement} canvas — canvas element to render to
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = null;
    /** @type {ShaderLibrary|null} */
    this._shaderLib = null;
    this._buffers = {};
    this._available = false;
    this._maxInstances = 0;
    /** @type {TextAtlas|null} */
    this._textAtlas = null;

    // Phase 1.1.4: Virtual bar window stats for perf dashboard
    this._gpuWindowStats = { uploaded: 0, capped: 0, windowSize: GPU_WINDOW_SIZE };

    this._init();
  }

  get available() {
    return this._available;
  }

  // ─── Initialization ─────────────────────────────────────────

  _init() {
    try {
      const gl = this.canvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: false,
        antialias: true,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
      });

      if (!gl) {
        console.warn('[WebGLRenderer] WebGL 2 not available, falling back to Canvas 2D');
        return;
      }

      this.gl = gl;
      this._available = true;

      // Enable blending for transparency
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // Register shader programs via ShaderLibrary (compile-on-demand)
      this._shaderLib = new ShaderLibrary(gl);
      this._shaderLib.register('candle', CANDLE_VERT, CANDLE_FRAG);
      this._shaderLib.register('volume', VOLUME_VERT, VOLUME_FRAG);
      this._shaderLib.register('line', LINE_VERT, LINE_FRAG);
      this._shaderLib.register('aaLine', AA_LINE_VERT, AA_LINE_FRAG);
      this._shaderLib.register('vprofile', VPROFILE_VERT, VPROFILE_FRAG);
      this._shaderLib.register('heatmap', HEATMAP_VERT, HEATMAP_FRAG);
      this._shaderLib.register('fibFill', FIB_FILL_VERT, FIB_FILL_FRAG);

      // Create quad geometry (shared by all instanced draws)
      this._createQuadBuffer();

      // Pre-allocate instance buffers
      this._maxInstances = 4096;
      this._createInstanceBuffers();

    } catch (err) {
      console.warn('[WebGLRenderer] Init failed:', err.message);
      this._available = false;
    }
  }

  // ─── Shader Access ──────────────────────────────────────────

  /**
   * Set per-frame shared uniforms (resolution, pixelRatio).
   * Call once per frame before any draw methods.
   *
   * @param {number} width  - Canvas bitmap width
   * @param {number} height - Canvas bitmap height
   * @param {number} pixelRatio
   */
  setFrameUniforms(width, height, pixelRatio) {
    if (this._shaderLib) {
      this._shaderLib.setFrameUniforms(width, height, pixelRatio);
    }
  }

  /**
   * Get a compiled shader program by name.
   * @param {string} name
   * @returns {WebGLProgram|null}
   */
  getProgram(name) {
    return this._shaderLib ? this._shaderLib.get(name) : null;
  }

  // ─── Buffer Setup ───────────────────────────────────────────

  _createQuadBuffer() {
    const gl = this.gl;
    // Unit quad: 2 triangles making a rectangle
    const quadVerts = new Float32Array([
      0, 0,  1, 0,  0, 1,  // triangle 1
      1, 0,  1, 1,  0, 1,  // triangle 2
    ]);
    this._buffers.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.quad);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
  }

  _createInstanceBuffers() {
    const gl = this.gl;
    const n = this._maxInstances;

    // Candle instances: x, open, high, low, close, isBull, isWick
    this._candleData = new Float32Array(n * 7);
    this._buffers.candleInstances = gl.createBuffer();

    // Volume instances: x, volume, isBull
    this._volumeData = new Float32Array(n * 3);
    this._buffers.volumeInstances = gl.createBuffer();

    // Line vertices
    this._lineData = new Float32Array(n * 2);
    this._buffers.lineVertices = gl.createBuffer();

    // AA line vertices: per-vertex = posA(2) + posB(2) + side(1) + miter(1) = 6 floats
    // 4 vertices per segment, (n-1) segments max
    this._aaLineData = new Float32Array(n * 4 * 6);
    this._buffers.aaLineVertices = gl.createBuffer();

    // Volume profile instances: y, width, height, intensity, isPoc = 5 floats
    this._vprofileData = new Float32Array(n * 5);
    this._buffers.vprofileInstances = gl.createBuffer();

    // Heatmap instances: x, y, cellW, cellH, intensity = 5 floats
    this._heatmapData = new Float32Array(n * 5);
    this._buffers.heatmapInstances = gl.createBuffer();

    // Fib fill instances: left, top, w, h, r, g, b, a = 8 floats
    this._fibFillData = new Float32Array(n * 8);
    this._buffers.fibFillInstances = gl.createBuffer();
  }

  // Phase 1.1.4: Virtual bar window — capped GPU buffer management.
  // Buffers grow up to GPU_WINDOW_SIZE but never beyond.
  // If count exceeds window size, callers clamp their instance data.
  _ensureCapacity(count) {
    // Track stats for performance dashboard
    this._gpuWindowStats.uploaded = count;

    // Clamp to GPU window size — never allocate more than needed
    const capped = Math.min(count, GPU_WINDOW_SIZE);
    if (capped > this._maxInstances) {
      this._maxInstances = Math.min(Math.max(capped, this._maxInstances * 2), GPU_WINDOW_SIZE);
      this._candleData = new Float32Array(this._maxInstances * 7);
      this._volumeData = new Float32Array(this._maxInstances * 3);
      this._lineData = new Float32Array(this._maxInstances * 2);
      this._aaLineData = new Float32Array(this._maxInstances * 4 * 6);
      this._vprofileData = new Float32Array(this._maxInstances * 5);
      this._heatmapData = new Float32Array(this._maxInstances * 5);
      this._fibFillData = new Float32Array(this._maxInstances * 8);
    }

    if (count > GPU_WINDOW_SIZE) {
      this._gpuWindowStats.capped++;
    }

    return capped;
  }

  // ─── Candlestick Rendering ──────────────────────────────────

  /**
   * Draw candlesticks via WebGL instanced rendering.
   * Single draw call for ALL visible candles.
   *
   * @param {Array} bars — visible bar data
   * @param {Object} params — { pixelRatio, barSpacing, priceToY, startIdx, timeTransform }
   * @param {Object} theme — { bullCandle, bearCandle }
   */
  drawCandles(bars, params, theme) {
    if (!this._available || !bars?.length) return;

    const gl = this.gl;
    const prog = this._shaderLib.get('candle');
    if (!prog) return;

    const { pixelRatio: pr, barSpacing, startIdx, timeTransform } = params;
    const cW = this.canvas.width;
    const cH = this.canvas.height;

    const maxInstances = this._ensureCapacity(bars.length * 2); // 2 instances per bar (wick + body)
    const maxBars = Math.floor(maxInstances / 2); // Clamp bars to GPU window
    const barCount = Math.min(bars.length, maxBars);

    // Build instance data — only upload bars within the GPU window
    let instanceCount = 0;
    const data = this._candleData;

    for (let i = 0; i < barCount; i++) {
      const b = bars[i];
      const isBull = b.close >= b.open ? 1.0 : 0.0;
      let x;
      if (timeTransform) {
        x = timeTransform.indexToPixel(startIdx + i) * pr;
      } else {
        x = (i + 0.5) * barSpacing * pr;
      }

      // Wick instance
      const wi = instanceCount * 7;
      data[wi]     = x;
      data[wi + 1] = b.open;
      data[wi + 2] = b.high;
      data[wi + 3] = b.low;
      data[wi + 4] = b.close;
      data[wi + 5] = isBull;
      data[wi + 6] = 1.0; // isWick
      instanceCount++;

      // Body instance
      const bi = instanceCount * 7;
      data[bi]     = x;
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

    // Bull/bear colors
    const bullRGBA = this._parseColor(theme.bullCandle || '#26A69A');
    const bearRGBA = this._parseColor(theme.bearCandle || '#EF5350');
    gl.uniform4fv(gl.getUniformLocation(prog, 'u_bullColor'), bullRGBA);
    gl.uniform4fv(gl.getUniformLocation(prog, 'u_bearColor'), bearRGBA);

    // Set up quad attribute
    const aPos = gl.getAttribLocation(prog, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.quad);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aPos, 0); // per-vertex

    // Upload candle instance data
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.candleInstances);
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
  }

  // ─── Volume Rendering ──────────────────────────────────────

  /**
   * Draw volume bars via WebGL.
   */
  drawVolume(bars, params, theme) {
    if (!this._available || !bars?.length) return;

    const gl = this.gl;
    const prog = this._shaderLib.get('volume');
    if (!prog) return;

    const { pixelRatio: pr, barSpacing, startIdx, timeTransform } = params;
    const cW = this.canvas.width;
    const cH = this.canvas.height;

    this._ensureCapacity(bars.length);

    // Find max volume
    let maxVol = 0;
    for (const b of bars) if ((b.volume || 0) > maxVol) maxVol = b.volume;
    if (maxVol === 0) return;

    // Build instance data
    let instanceCount = 0;
    const data = this._volumeData;

    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      let x;
      if (timeTransform) {
        x = timeTransform.indexToPixel(startIdx + i) * pr;
      } else {
        x = (i + 0.5) * barSpacing * pr;
      }

      const vi = instanceCount * 3;
      data[vi]     = x;
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

    const bullRGBA = this._parseColor(theme.bullVolume || '#26A69A80');
    const bearRGBA = this._parseColor(theme.bearVolume || '#EF535080');
    gl.uniform4fv(gl.getUniformLocation(prog, 'u_bullColor'), bullRGBA);
    gl.uniform4fv(gl.getUniformLocation(prog, 'u_bearColor'), bearRGBA);

    // Quad vertices
    const aPos = gl.getAttribLocation(prog, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.quad);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aPos, 0);

    // Instance data
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.volumeInstances);
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
  }

  // ─── Line Chart Rendering ──────────────────────────────────

  /**
   * Draw a line chart via WebGL (GL_LINE_STRIP).
   * Use for line charts and indicator overlay lines.
   *
   * @param {Array} bars — visible bar data
   * @param {Object} params — { pixelRatio, barSpacing, priceToY, startIdx, timeTransform }
   * @param {string} color — CSS color string
   * @param {number} [lineWidth=2] — line width
   */
  drawLine(bars, params, color, lineWidth = 2) {
    if (!this._available || !bars?.length) return;

    const { pixelRatio: pr, barSpacing, startIdx, timeTransform } = params;

    // Build pixel-space points for the AA line shader
    const points = [];
    for (let i = 0; i < bars.length; i++) {
      let x;
      if (timeTransform) {
        x = timeTransform.indexToPixel(startIdx + i) * pr;
      } else {
        x = (i + 0.5) * barSpacing * pr;
      }
      const y = params.priceToY(bars[i].close) * pr;
      points.push({ x, y });
    }

    // Delegate to anti-aliased triangle-strip line renderer
    this.drawAALine(points, color, lineWidth);
  }

  // ─── Area Chart Rendering ──────────────────────────────────

  /**
   * Draw an area chart via WebGL (TRIANGLE_STRIP + LINE_STRIP).
   * Renders a filled area below the line with gradient-like opacity.
   *
   * @param {Array} bars — visible bar data
   * @param {Object} params — { pixelRatio, barSpacing, priceToY, startIdx, timeTransform, mainH }
   * @param {string} lineColor — CSS color for the top line
   * @param {string} fillColor — CSS color for the fill (with alpha)
   */
  drawArea(bars, params, lineColor, fillColor) {
    if (!this._available || !bars?.length) return;

    const gl = this.gl;
    const prog = this._shaderLib.get('line');
    if (!prog) return;

    const { pixelRatio: pr, barSpacing, startIdx, timeTransform } = params;
    const cW = this.canvas.width;
    const cH = this.canvas.height;
    const bottomY = (params.mainH || cH / pr) * pr;

    // Build triangle strip: for each bar, two vertices — (x, priceY) and (x, bottomY)
    const vertCount = bars.length * 2;
    const needed = vertCount * 2; // x,y per vertex
    if (needed > this._lineData.length) {
      this._lineData = new Float32Array(needed);
    }
    const data = this._lineData;

    for (let i = 0; i < bars.length; i++) {
      let x;
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
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.lineVertices);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, vertCount * 2), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Draw fill (triangle strip)
    gl.uniform4fv(gl.getUniformLocation(prog, 'u_color'), this._parseColor(fillColor || 'rgba(41,98,255,0.12)'));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertCount);

    // Draw anti-aliased line on top (triangle-strip AA shader)
    const aaPoints = [];
    for (let i = 0; i < bars.length; i++) {
      aaPoints.push({ x: data[i * 4], y: data[i * 4 + 1] });
    }
    this.drawAALine(aaPoints, lineColor || '#2962FF', 2);
  }

  // ─── Anti-Aliased Line Rendering ──────────────────────────

  /**
   * Draw an anti-aliased line via triangle-strip expansion.
   * Each segment is expanded into a screen-aligned quad with smooth edges.
   * Produces sub-pixel smooth lines that look better than Canvas2D.
   *
   * @param {Array<{x: number, y: number}>} points — pixel-space points (already in bitmap coords)
   * @param {string} color — CSS color string
   * @param {number} [lineWidth=2] — line width in CSS pixels
   */
  drawAALine(points, color, lineWidth = 2) {
    if (!this._available || !points || points.length < 2) return;

    const gl = this.gl;
    const prog = this._shaderLib.get('aaLine');
    if (!prog) return;

    const cW = this.canvas.width;
    const cH = this.canvas.height;
    const segCount = points.length - 1;

    // Ensure buffer capacity: 4 verts per segment, 6 floats per vert
    const needed = segCount * 4 * 6;
    if (needed > this._aaLineData.length) {
      this._aaLineData = new Float32Array(needed);
    }
    const data = this._aaLineData;

    // Build triangle-strip quad vertices for each segment
    // Each segment gets 4 vertices forming a degenerate-joined strip
    let vi = 0;
    for (let i = 0; i < segCount; i++) {
      const ax = points[i].x, ay = points[i].y;
      const bx = points[i + 1].x, by = points[i + 1].y;

      // 4 vertices: start-left, start-right, end-left, end-right
      // v0: posA, side=-1, miter=0
      data[vi++] = ax; data[vi++] = ay; data[vi++] = bx; data[vi++] = by; data[vi++] = -1; data[vi++] = 0;
      // v1: posA, side=+1, miter=0
      data[vi++] = ax; data[vi++] = ay; data[vi++] = bx; data[vi++] = by; data[vi++] = 1; data[vi++] = 0;
      // v2: posB, side=-1, miter=1
      data[vi++] = ax; data[vi++] = ay; data[vi++] = bx; data[vi++] = by; data[vi++] = -1; data[vi++] = 1;
      // v3: posB, side=+1, miter=1
      data[vi++] = ax; data[vi++] = ay; data[vi++] = bx; data[vi++] = by; data[vi++] = 1; data[vi++] = 1;
    }

    const totalVerts = segCount * 4;

    gl.useProgram(prog);
    gl.viewport(0, 0, cW, cH);

    gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), cW, cH);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_lineWidth'), lineWidth);
    gl.uniform4fv(gl.getUniformLocation(prog, 'u_color'), this._parseColor(color));

    // Upload vertex data
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.aaLineVertices);
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

  // ─── Volume Profile Rendering ──────────────────────────────

  /**
   * Draw a volume profile histogram via WebGL instanced horizontal bars.
   * Each row represents a price level; bar width is proportional to volume.
   *
   * @param {Array<{priceY: number, volume: number, isPoc: boolean}>} rows — profile rows in pixel space
   * @param {Object} params — { pixelRatio, rowHeight, maxVolume, rightEdge, maxBarWidth }
   * @param {Object} theme — { buyColor, sellColor, pocColor }
   */
  drawVolumeProfile(rows, params, theme) {
    if (!this._available || !rows?.length) return;

    const gl = this.gl;
    const prog = this._shaderLib.get('vprofile');
    if (!prog) return;

    const { pixelRatio: pr, rowHeight = 10, maxVolume = 1, rightEdge, maxBarWidth = 200 } = params;
    const cW = this.canvas.width;
    const cH = this.canvas.height;

    this._ensureCapacity(rows.length);

    // Build instance data: y, width, height, intensity, isPoc
    let instanceCount = 0;
    const data = this._vprofileData;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const intensity = Math.min(1, (r.volume || 0) / Math.max(maxVolume, 1));
      const barW = intensity * maxBarWidth * pr;
      if (barW < 0.5) continue;

      const idx = instanceCount * 5;
      data[idx]     = r.priceY * pr;        // y center
      data[idx + 1] = barW;                 // width
      data[idx + 2] = rowHeight * pr;       // height
      data[idx + 3] = intensity;            // intensity
      data[idx + 4] = r.isPoc ? 1.0 : 0.0; // isPoc
      instanceCount++;
    }

    if (instanceCount === 0) return;

    gl.useProgram(prog);
    gl.viewport(0, 0, cW, cH);

    gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), cW, cH);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_rightEdge'), (rightEdge || cW / pr) * pr);

    gl.uniform4fv(gl.getUniformLocation(prog, 'u_buyColor'), this._parseColor(theme.buyColor || '#26A69A'));
    gl.uniform4fv(gl.getUniformLocation(prog, 'u_sellColor'), this._parseColor(theme.sellColor || '#EF5350'));
    gl.uniform4fv(gl.getUniformLocation(prog, 'u_pocColor'), this._parseColor(theme.pocColor || '#FFD54F'));

    // Quad
    const aPos = gl.getAttribLocation(prog, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.quad);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aPos, 0);

    // Instance data
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.vprofileInstances);
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

  // ─── Heatmap Rendering ─────────────────────────────────────

  /**
   * Draw a heatmap via WebGL instanced color-gradient quads.
   * Used for liquidation heatmaps, order book depth, etc.
   *
   * @param {Array<{x: number, y: number, w: number, h: number, intensity: number}>} cells — in CSS pixels
   * @param {Object} params — { pixelRatio, globalAlpha }
   * @param {Object} theme — { coldColor, warmColor, hotColor }
   */
  drawHeatmap(cells, params, theme) {
    if (!this._available || !cells?.length) return;

    const gl = this.gl;
    const prog = this._shaderLib.get('heatmap');
    if (!prog) return;

    const { pixelRatio: pr, globalAlpha = 0.8 } = params;
    const cW = this.canvas.width;
    const cH = this.canvas.height;

    this._ensureCapacity(cells.length);

    // Build instance data: x, y, cellW, cellH, intensity
    let instanceCount = 0;
    const data = this._heatmapData;

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

    gl.uniform4fv(gl.getUniformLocation(prog, 'u_coldColor'), this._parseColor(theme.coldColor || '#1A237E'));
    gl.uniform4fv(gl.getUniformLocation(prog, 'u_warmColor'), this._parseColor(theme.warmColor || '#FFD54F'));
    gl.uniform4fv(gl.getUniformLocation(prog, 'u_hotColor'), this._parseColor(theme.hotColor || '#F44336'));

    // Quad
    const aPos = gl.getAttribLocation(prog, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.quad);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aPos, 0);

    // Instance data
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.heatmapInstances);
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

  // ─── Fibonacci Fill Rendering ──────────────────────────────

  /**
   * Draw Fibonacci zone fills via WebGL instanced quads.
   * Renders all fib zones in a single draw call (much faster than Canvas2D per-zone fillRect).
   *
   * @param {Array<{left: number, top: number, width: number, height: number, color: string, alpha: number}>} zones — in CSS pixels
   * @param {Object} params — { pixelRatio }
   */
  drawFibFill(zones, params) {
    if (!this._available || !zones?.length) return;

    const gl = this.gl;
    const prog = this._shaderLib.get('fibFill');
    if (!prog) return;

    const { pixelRatio: pr } = params;
    const cW = this.canvas.width;
    const cH = this.canvas.height;

    this._ensureCapacity(zones.length);

    // Build instance data: left, top, w, h, r, g, b, a
    let instanceCount = 0;
    const data = this._fibFillData;

    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      const rgba = this._parseColor(z.color || '#787B86');
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
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.quad);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aPos, 0);

    // Instance data
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.fibFillInstances);
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

  // ─── SDF Text Rendering ─────────────────────────────────────

  /**
   * Draw text entries via GPU SDF text atlas.
   * Lazily initializes the TextAtlas on first call.
   *
   * @param {Array<{text: string, x: number, y: number, fontSize: number, color: Float32Array|number[], align?: string}>} entries
   * @param {Object} params - { pixelRatio }
   */
  drawSDFText(entries, params) {
    if (!this._available || !entries?.length) return;

    // Lazy init
    if (!this._textAtlas) {
      try {
        this._textAtlas = new TextAtlas(this.gl);
      } catch (err) {
        console.warn('[WebGLRenderer] TextAtlas init failed:', err.message);
        return;
      }
    }

    if (!this._textAtlas.ready) return;

    this._textAtlas.drawText(entries, {
      pixelRatio: params.pixelRatio,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
    });
  }

  /**
   * Measure text width using the SDF atlas (CSS pixels).
   * @param {string} text
   * @param {number} fontSize
   * @returns {number}
   */
  measureSDFText(text, fontSize) {
    if (!this._textAtlas?.ready) return text.length * fontSize * 0.55;
    return this._textAtlas.measureText(text, fontSize);
  }

  // ─── GPU Indicator Lines ─────────────────────────────────────

  /**
   * Draw multiple indicator overlay line series via GPU anti-aliased lines.
   * Batches all series into sequential AA line draws, avoiding Canvas2D path overhead.
   *
   * @param {Array<{values: number[]|Float32Array, color: string, lineWidth?: number, dash?: number[]}>} seriesArray
   * @param {Object} params - { pixelRatio, barSpacing, startIdx, endIdx, priceToY, timeTransform }
   */
  drawIndicatorLines(seriesArray, params) {
    if (!this._available || !seriesArray?.length) return;

    const { pixelRatio: pr, barSpacing, startIdx, endIdx, priceToY, timeTransform } = params;

    for (const series of seriesArray) {
      const { values, color, lineWidth = 2 } = series;
      if (!values || !values.length) continue;

      // Build pixel-space points for this series, skipping NaN gaps
      const segments = [];
      let current = [];

      const lo = Math.max(0, startIdx);
      const hi = Math.min(endIdx, values.length - 1);

      for (let i = lo; i <= hi; i++) {
        const v = values[i];
        if (v === undefined || v === null || isNaN(v)) {
          // NaN gap → end current segment, start a new one
          if (current.length >= 2) segments.push(current);
          current = [];
          continue;
        }

        let x;
        if (timeTransform) {
          x = timeTransform.indexToPixel(i) * pr;
        } else {
          x = ((i - startIdx) + 0.5) * barSpacing * pr;
        }
        const y = priceToY(v) * pr;
        current.push({ x, y });
      }
      if (current.length >= 2) segments.push(current);

      // Draw each contiguous segment
      for (const seg of segments) {
        this.drawAALine(seg, color, lineWidth);
      }
    }
  }

  // ─── GPU Grid Lines ────────────────────────────────────────────

  /**
   * Draw all grid lines (horizontal + vertical) via GPU instanced quads.
   * Single draw call replaces per-line Canvas2D fillRect loops.
   *
   * @param {Object} gridData
   * @param {Array<{y: number, isMajor: boolean}>} gridData.horizontal - Price grid lines
   * @param {Array<{x: number, isMajor: boolean}>} [gridData.vertical] - Time grid lines
   * @param {Object} params - { pixelRatio, chartWidth, mainHeight }
   * @param {Object} theme - { gridLine }
   */
  drawGrid(gridData, params, theme) {
    if (!this._available) return;

    const gl = this.gl;
    const prog = this._shaderLib.get('fibFill'); // Reuse the generic colored-quad program
    if (!prog) return;

    const { pixelRatio: pr, chartWidth, mainHeight } = params;
    const cW = Math.round(chartWidth * pr);
    const mainBH = Math.round(mainHeight * pr);
    const gridColor = this._parseColor(theme.gridLine || 'rgba(54,58,69,0.4)');

    // Build instance data for all grid lines as thin quads
    const horizontals = gridData.horizontal || [];
    const verticals = gridData.vertical || [];
    const totalLines = horizontals.length + verticals.length;
    if (totalLines === 0) return;

    this._ensureCapacity(totalLines);

    // Reuse fibFill data buffer (same format: left, top, w, h, r, g, b, a)
    const data = this._fibFillData;
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
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), this.canvas.width, this.canvas.height);

    // Quad vertices
    const aPos = gl.getAttribLocation(prog, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.quad);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(aPos, 0);

    // Instance data
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.fibFillInstances);
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

  // ─── Clear ──────────────────────────────────────────────────

  clear() {
    if (!this._available) return;
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0); // transparent clear
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  // ─── Resize ─────────────────────────────────────────────────

  resize(width, height) {
    if (!this._available) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  // ─── Utilities ──────────────────────────────────────────────

  /**
   * Parse CSS color string to [r, g, b, a] normalized floats.
   * @param {string} color
   * @returns {Float32Array}
   */
  _parseColor(color) {
    const result = new Float32Array([0, 0, 0, 1]);
    if (!color) return result;

    // Handle rgba
    const rgbaMatch = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (rgbaMatch) {
      result[0] = parseInt(rgbaMatch[1]) / 255;
      result[1] = parseInt(rgbaMatch[2]) / 255;
      result[2] = parseInt(rgbaMatch[3]) / 255;
      result[3] = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
      return result;
    }

    // Handle hex
    let hex = color.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (hex.length >= 6) {
      result[0] = parseInt(hex.slice(0, 2), 16) / 255;
      result[1] = parseInt(hex.slice(2, 4), 16) / 255;
      result[2] = parseInt(hex.slice(4, 6), 16) / 255;
      if (hex.length === 8) {
        result[3] = parseInt(hex.slice(6, 8), 16) / 255;
      }
    }
    return result;
  }

  // ─── Cleanup ────────────────────────────────────────────────

  dispose() {
    if (!this.gl) return;
    const gl = this.gl;

    for (const name in this._buffers) {
      gl.deleteBuffer(this._buffers[name]);
    }
    if (this._shaderLib) {
      this._shaderLib.dispose();
      this._shaderLib = null;
    }
    if (this._textAtlas) {
      this._textAtlas.dispose();
      this._textAtlas = null;
    }

    this.gl = null;
    this._available = false;
  }
}
