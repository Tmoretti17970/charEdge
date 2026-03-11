// ═══════════════════════════════════════════════════════════════════
// charEdge — GPU Buffer Registry (FinalizationRegistry)
//
// Automatically cleans up WebGL buffers when their JS wrappers are
// garbage-collected. Prevents GPU memory leaks when components unmount
// without calling dispose(), which is common with React hot-reloads
// and error boundaries.
//
// Usage:
//   import { gpuRegistry } from './GPUBufferRegistry';
//   const buf = gl.createBuffer();
//   gpuRegistry.track(gl, buf, 'candle-instances');
//   // When `buf` reference is GC'd, the WebGL buffer is auto-deleted.
// ═══════════════════════════════════════════════════════════════════

interface GPUHandle {
    gl: WebGL2RenderingContext;
    buffer: WebGLBuffer;
    label: string;
}

/**
 * GPU Buffer Registry — FinalizationRegistry-based cleanup for WebGL resources.
 *
 * Tracks WebGLBuffer handles and automatically deletes them when their
 * associated JavaScript object is garbage-collected.
 */
class GPUBufferRegistry {
    private _registry: FinalizationRegistry<GPUHandle> | null = null;
    private _trackCount = 0;
    private _cleanupCount = 0;

    constructor() {
        if (typeof FinalizationRegistry !== 'undefined') {
            this._registry = new FinalizationRegistry<GPUHandle>((handle) => {
                try {
                    if (handle.gl && handle.buffer) {
                        handle.gl.deleteBuffer(handle.buffer);
                        this._cleanupCount++;
                    }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                } catch (_) {
                    // GL context may already be lost — safe to ignore
                }
            });
        }
    }

    /**
     * Track a WebGL buffer for automatic cleanup.
     *
     * @param owner   - The JS object whose lifetime gates the buffer.
     *                  When `owner` is GC'd, the buffer is deleted.
     * @param gl      - The WebGL2 context
     * @param buffer  - The WebGL buffer to track
     * @param label   - Debug label (e.g. 'candle-instances')
     */
    track(owner: object, gl: WebGL2RenderingContext, buffer: WebGLBuffer, label = 'unknown'): void {
        if (!this._registry) return;
        this._registry.register(owner, { gl, buffer, label });
        this._trackCount++;
    }

    /**
     * Untrack a buffer (e.g., when explicitly disposing).
     * Prevents double-delete if the owner is later GC'd.
     *
     * @param owner - The previously registered owner object
     */
    untrack(owner: object): void {
        if (!this._registry) return;
        this._registry.unregister(owner);
    }

    /** Whether FinalizationRegistry is supported. */
    get supported(): boolean {
        return this._registry !== null;
    }

    /** Stats for the perf dashboard. */
    getStats(): { tracked: number; cleaned: number; supported: boolean } {
        return {
            tracked: this._trackCount,
            cleaned: this._cleanupCount,
            supported: this.supported,
        };
    }
}

// ─── Singleton ─────────────────────────────────────────────────

export const gpuRegistry = new GPUBufferRegistry();
export default gpuRegistry;
