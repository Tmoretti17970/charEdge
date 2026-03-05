import { logger } from '../../utils/logger';

// ═══════════════════════════════════════════════════════════════════
// charEdge — RenderCommandBuffer
//
// Collects, sorts, and flushes all GPU draw commands for a frame.
// Minimizes GPU state changes (the #1 performance killer in WebGL)
// by sorting commands by: shader program → blend state → texture → z-order.
//
// Usage:
//   const buf = new RenderCommandBuffer();
//   // During stage execution:
//   buf.push({ program: candleProg, zOrder: 0, drawFn: () => { ... } });
//   // After all stages:
//   buf.flush(gl);
//   buf.reset();
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} DrawCommand
 * @property {WebGLProgram|null} program - Shader program (used for sort key)
 * @property {number} blendMode - 0 = normal, 1 = additive, 2 = premultiplied
 * @property {WebGLTexture|null} texture - Texture binding (null = no texture)
 * @property {number} zOrder - Render order (lower = first)
 * @property {Function} drawFn - The actual draw call: (gl) => void
 * @property {string} [label] - Optional debug label
 */

/**
 * Sort key generator for draw commands.
 * Packs program ID, blend mode, and z-order into a comparable number.
 */
let _nextProgramId = 1;
const _programIds = new WeakMap();

function getProgramId(program) {
  if (!program) return 0;
  let id = _programIds.get(program);
  if (id === undefined) {
    id = _nextProgramId++;
    _programIds.set(program, id);
  }
  return id;
}

function sortKey(cmd) {
  // Sort by: program (bits 24..31) → blend (bits 16..23) → z-order (bits 0..15)
  const progBits = (getProgramId(cmd.program) & 0xFF) << 24;
  const blendBits = ((cmd.blendMode || 0) & 0xFF) << 16;
  const zBits = ((cmd.zOrder || 0) + 32768) & 0xFFFF; // offset to make signed z positive
  return progBits | blendBits | zBits;
}

// ═══════════════════════════════════════════════════════════════
// RenderCommandBuffer Class
// ═══════════════════════════════════════════════════════════════

export class RenderCommandBuffer {
  constructor() {
    /** @type {DrawCommand[]} */
    this._commands = [];

    /** @type {number} */
    this._sortKeys = [];

    // Statistics for profiling
    this.stats = {
      totalCommands: 0,
      drawCalls: 0,
      stateChanges: 0,
      flushTimeMs: 0,
    };
  }

  // ─── Command Collection ─────────────────────────────────────────

  /**
   * Push a draw command into the buffer.
   *
   * @param {DrawCommand} command
   */
  push(command) {
    this._commands.push(command);
    this._sortKeys.push(sortKey(command));
  }

  /**
   * Push multiple draw commands at once.
   *
   * @param {DrawCommand[]} commands
   */
  pushBatch(commands) {
    for (const cmd of commands) {
      this.push(cmd);
    }
  }

  /**
   * Number of pending commands.
   * @returns {number}
   */
  get size() {
    return this._commands.length;
  }

  // ─── Flush ──────────────────────────────────────────────────────

  /**
   * Sort and execute all pending commands, then clear the buffer.
   * Minimizes state changes by grouping commands with the same
   * program, blend mode, and texture together.
   *
   * @param {WebGL2RenderingContext} gl
   */
  flush(gl) {
    if (this._commands.length === 0) return;

    const t0 = performance.now();

    // Sort by composite key
    const cmds = this._commands;
    const keys = this._sortKeys;
    const indices = Array.from({ length: cmds.length }, (_, i) => i);
    indices.sort((a, b) => keys[a] - keys[b]);

    // Execute in sorted order, tracking state changes
    let prevProgram = null;
    let prevBlend = -1;
    let prevTexture = null;
    let stateChanges = 0;
    let drawCalls = 0;

    for (const idx of indices) {
      const cmd = cmds[idx];

      // Switch program if needed
      if (cmd.program !== prevProgram) {
        if (cmd.program) gl.useProgram(cmd.program);
        prevProgram = cmd.program;
        stateChanges++;
      }

      // Switch blend mode if needed
      const blend = cmd.blendMode || 0;
      if (blend !== prevBlend) {
        switch (blend) {
          case 0: // Normal alpha blend
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            break;
          case 1: // Additive
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
            break;
          case 2: // Premultiplied alpha
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            break;
        }
        prevBlend = blend;
        stateChanges++;
      }

      // Switch texture if needed
      if (cmd.texture !== prevTexture) {
        if (cmd.texture) {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, cmd.texture);
        }
        prevTexture = cmd.texture;
        stateChanges++;
      }

      // Execute the draw call
      try {
        cmd.drawFn(gl);
        drawCalls++;
      } catch (err) {
        logger.engine.error(`[RenderCommandBuffer] Draw command "${cmd.label || '?'}" failed:`, err);
      }
    }

    // Update stats
    this.stats.totalCommands = cmds.length;
    this.stats.drawCalls = drawCalls;
    this.stats.stateChanges = stateChanges;
    this.stats.flushTimeMs = performance.now() - t0;

    // Clear for next frame
    this._commands.length = 0;
    this._sortKeys.length = 0;
  }

  // ─── Reset ─────────────────────────────────────────────────────

  /**
   * Clear all commands without executing them.
   */
  reset() {
    this._commands.length = 0;
    this._sortKeys.length = 0;
    this.stats.totalCommands = 0;
    this.stats.drawCalls = 0;
    this.stats.stateChanges = 0;
    this.stats.flushTimeMs = 0;
  }

  /**
   * Get profiling statistics from the last flush.
   * @returns {{ totalCommands: number, drawCalls: number, stateChanges: number, flushTimeMs: number }}
   */
  getStats() {
    return { ...this.stats };
  }
}
