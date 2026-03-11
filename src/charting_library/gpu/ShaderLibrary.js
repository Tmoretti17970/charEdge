import { logger } from '@/observability/logger';

// ═══════════════════════════════════════════════════════════════════
// charEdge — ShaderLibrary
//
// Central registry for all WebGL shader programs. Provides:
//   - Compile-once, use-many shader caching
//   - Shared per-frame uniforms (resolution, pixelRatio, time)
//   - GPU-tier variant selection
//
// Usage:
//   const lib = new ShaderLibrary(gl);
//   lib.register('myEffect', vertSrc, fragSrc);
//   const prog = lib.get('myEffect');
//   lib.setFrameUniforms(width, height, pixelRatio);
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} ShaderEntry
 * @property {string} vert - Vertex shader source
 * @property {string} frag - Fragment shader source
 * @property {WebGLProgram|null} program - Compiled program (null until first use)
 * @property {Object} uniformCache - Cached uniform locations
 */

export class ShaderLibrary {
  /**
   * @param {WebGL2RenderingContext} gl
   */
  constructor(gl) {
    /** @type {WebGL2RenderingContext} */
    this.gl = gl;

    /** @type {Map<string, ShaderEntry>} */
    this._registry = new Map();

    /** Shared uniform values set once per frame */
    this._frameUniforms = {
      resolution: [0, 0],
      pixelRatio: 1,
      time: 0,
    };

    // Task 2.3.8: Async shader compilation via KHR_parallel_shader_compile
    this._parallelCompileExt = gl.getExtension('KHR_parallel_shader_compile');
    /** @type {number|null} COMPLETION_STATUS_KHR constant */
    this._completionStatusKHR = this._parallelCompileExt ? 0x91B1 : null;

    // Item 22: O(1) program → cache lookup (replaces O(n) registry scan)
    /** @type {WeakMap<WebGLProgram, Object>} */
    this._uniformCacheByProgram = new WeakMap();
    /** @type {WeakMap<WebGLProgram, Object>} */
    this._attribCacheByProgram = new WeakMap();
  }

  // ─── Registration ─────────────────────────────────────────────

  /**
   * Register a shader pair by name.
   * Does NOT compile immediately — compilation is deferred to first use.
   *
   * @param {string} name
   * @param {string} vertSrc - GLSL 300 ES vertex shader source
   * @param {string} fragSrc - GLSL 300 ES fragment shader source
   */
  register(name, vertSrc, fragSrc) {
    this._registry.set(name, {
      vert: vertSrc,
      frag: fragSrc,
      program: null,
      uniformCache: {},
    });
  }

  // ─── Retrieval ────────────────────────────────────────────────

  /**
   * Get a compiled WebGL program by name.
   * Compiles on first access, then caches.
   *
   * @param {string} name
   * @returns {WebGLProgram|null}
   */
  get(name) {
    const entry = this._registry.get(name);
    if (!entry) {
      logger.engine.warn(`[ShaderLibrary] Unknown shader: "${name}"`);
      return null;
    }

    if (!entry.program) {
      entry.program = this._compile(entry.vert, entry.frag);
      if (!entry.program) {
        logger.engine.error(`[ShaderLibrary] Failed to compile shader: "${name}"`);
        return null;
      }
    }

    // Task 2.3.8: If async compilation is in flight, check if program is ready
    if (this._completionStatusKHR && entry.program) {
      if (!this.gl.getProgramParameter(entry.program, this._completionStatusKHR)) {
        return null; // Still compiling — caller should fall back to Canvas 2D
      }
    }

    return entry.program;
  }

  /**
   * Check if a shader is registered.
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this._registry.has(name);
  }

  // ─── Uniform Helpers ─────────────────────────────────────────

  /**
   * Set shared per-frame uniforms. Call once at the beginning of each frame.
   * This caches the values so individual shaders can bind them cheaply.
   *
   * @param {number} width - Canvas bitmap width
   * @param {number} height - Canvas bitmap height
   * @param {number} pixelRatio
   */
  setFrameUniforms(width, height, pixelRatio) {
    this._frameUniforms.resolution[0] = width;
    this._frameUniforms.resolution[1] = height;
    this._frameUniforms.pixelRatio = pixelRatio;
    this._frameUniforms.time = performance.now() * 0.001;
  }

  /**
   * Bind the shared frame uniforms to the currently-active program.
   * Call after gl.useProgram().
   *
   * @param {WebGLProgram} program
   */
  bindFrameUniforms(program) {
    const gl = this.gl;
    const u = this._frameUniforms;

    const uRes = this._getUniform(program, 'u_resolution');
    if (uRes !== null) gl.uniform2f(uRes, u.resolution[0], u.resolution[1]);

    const uPR = this._getUniform(program, 'u_pixelRatio');
    if (uPR !== null) gl.uniform1f(uPR, u.pixelRatio);

    const uTime = this._getUniform(program, 'u_time');
    if (uTime !== null) gl.uniform1f(uTime, u.time);
  }

  /**
   * Get a cached uniform location.
   *
   * @param {WebGLProgram} program
   * @param {string} name
   * @returns {WebGLUniformLocation|null}
   */
  getUniform(program, name) {
    return this._getUniform(program, name);
  }

  /**
   * Get a cached attribute location.
   * Item 22: Eliminates per-frame gl.getAttribLocation() calls.
   *
   * @param {WebGLProgram} program
   * @param {string} name
   * @returns {number}
   */
  getAttrib(program, name) {
    if (!program) return -1;
    let cache = this._attribCacheByProgram.get(program);
    if (!cache) {
      cache = {};
      this._attribCacheByProgram.set(program, cache);
    }
    if (!(name in cache)) {
      cache[name] = this.gl.getAttribLocation(program, name);
    }
    return cache[name];
  }

  // ─── Internal ─────────────────────────────────────────────────

  /** @private */
  _getUniform(program, name) {
    if (!program) return null;
    // Item 22: O(1) lookup via WeakMap keyed by program object
    let cache = this._uniformCacheByProgram.get(program);
    if (!cache) {
      cache = {};
      this._uniformCacheByProgram.set(program, cache);
    }
    if (!(name in cache)) {
      cache[name] = this.gl.getUniformLocation(program, name);
    }
    return cache[name];
  }

  /** @private */
  _compile(vertSrc, fragSrc) {
    const gl = this.gl;

    const vert = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vert, vertSrc);
    gl.compileShader(vert);

    const frag = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(frag, fragSrc);
    gl.compileShader(frag);

    // Task 2.3.8: With KHR_parallel_shader_compile, skip sync status checks.
    // Link immediately — the GPU driver compiles asynchronously.
    // Completion is polled in get() via COMPLETION_STATUS_KHR.
    if (!this._parallelCompileExt) {
      // Synchronous fallback: check compile status immediately
      if (!gl.getShaderParameter(vert, gl.COMPILE_STATUS)) {
        logger.engine.error('[ShaderLibrary] Vertex shader error:', gl.getShaderInfoLog(vert));
        gl.deleteShader(vert);
        gl.deleteShader(frag);
        return null;
      }
      if (!gl.getShaderParameter(frag, gl.COMPILE_STATUS)) {
        logger.engine.error('[ShaderLibrary] Fragment shader error:', gl.getShaderInfoLog(frag));
        gl.deleteShader(vert);
        gl.deleteShader(frag);
        return null;
      }
    }

    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (!this._parallelCompileExt) {
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        logger.engine.error('[ShaderLibrary] Link error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        gl.deleteShader(vert);
        gl.deleteShader(frag);
        return null;
      }
    }

    gl.deleteShader(vert);
    gl.deleteShader(frag);
    return program;
  }

  // ─── Lifecycle ────────────────────────────────────────────────

  /**
   * Delete all compiled programs and clear the registry.
   */
  dispose() {
    const gl = this.gl;
    for (const entry of this._registry.values()) {
      if (entry.program) {
        gl.deleteProgram(entry.program);
      }
    }
    this._registry.clear();
  }

  /**
   * Number of registered shaders.
   * @returns {number}
   */
  get size() {
    return this._registry.size;
  }
}
