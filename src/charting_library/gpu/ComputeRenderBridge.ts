// ═══════════════════════════════════════════════════════════════════
// charEdge — ComputeRenderBridge: Zero-Copy GPU Fusion (#125)
//
// Sprint 20 #125: Binds WebGPU compute output buffers directly as
// vertex/instance buffers in render passes — eliminates the
// GPU→CPU→GPU round-trip for indicator data.
//
// After Sprint 19 #124 (DataJoin), compute buffers persist across
// frames. This bridge connects them to the render pipeline so
// indicator values (EMA, RSI, Bollinger, etc.) flow directly from
// compute shader output → vertex/instance input.
//
// Usage:
//   const bridge = new ComputeRenderBridge();
//   bridge.bindAsVertexBuffer(renderPass, 1, emaJoined);
//   bridge.bindAsInstanceBuffer(renderPass, 2, rsiJoined);
// ═══════════════════════════════════════════════════════════════════

import type { JoinedBuffer } from './DataJoin.ts';

// ─── Types ───────────────────────────────────────────────────────

/** Binding record for tracking what's bound to which slot. */
interface BoundSlot {
    slot: number;
    buffer: GPUBuffer;
    generation: number;
    label: string;
}

/** Stats snapshot for performance monitoring. */
export interface BridgeStats {
    boundVertexSlots: number;
    boundInstanceSlots: number;
    totalRoundTripsAvoided: number;
}

// ─── ComputeRenderBridge ─────────────────────────────────────────

/**
 * Zero-copy bridge between WebGPU compute outputs and render inputs.
 *
 * Instead of:
 *   compute → mapAsync → CPU Float32Array → createBuffer → render
 *
 * This bridge does:
 *   compute → render (same GPUBuffer, dual usage: STORAGE | VERTEX)
 *
 * Requirements:
 *   - Compute output buffers must have been created with
 *     GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX
 *   - DataJoin.join() with extraUsage: GPUBufferUsage.VERTEX
 */
export class ComputeRenderBridge {
    /** Currently bound vertex slots (compute → vertex attribute). */
    private _vertexBindings = new Map<number, BoundSlot>();
    /** Currently bound instance slots (compute → per-instance data). */
    private _instanceBindings = new Map<number, BoundSlot>();
    /** Total round-trips avoided counter. */
    private _roundTripsAvoided = 0;

    // ─── Bind Compute Output as Vertex Buffer ────────────────────

    /**
     * Bind a DataJoin compute output buffer as a vertex buffer.
     *
     * The buffer is used directly — no readback, no copy.
     * It must have been created with GPUBufferUsage.VERTEX.
     *
     * @param renderPass - Active render pass encoder
     * @param slot       - Vertex buffer slot index (0-based)
     * @param joined     - DataJoin buffer to bind
     * @param offset     - Byte offset into the buffer (default 0)
     */
    bindAsVertexBuffer(
        renderPass: GPURenderPassEncoder,
        slot: number,
        joined: JoinedBuffer,
        offset = 0,
    ): void {
        const existing = this._vertexBindings.get(slot);

        // Skip rebind if same buffer + same generation (no data change)
        if (existing?.buffer === joined.buffer && existing.generation === joined.generation) {
            return;
        }

        renderPass.setVertexBuffer(slot, joined.buffer, offset, joined.length * 4);

        this._vertexBindings.set(slot, {
            slot,
            buffer: joined.buffer,
            generation: joined.generation,
            label: joined.label,
        });

        this._roundTripsAvoided++;
    }

    // ─── Bind Compute Output as Instance Buffer ──────────────────

    /**
     * Bind a DataJoin compute output buffer as an instance buffer.
     *
     * Used for per-bar indicator values (e.g. EMA values per candle).
     * The buffer serves as instance-rate vertex data.
     *
     * @param renderPass - Active render pass encoder
     * @param slot       - Vertex buffer slot index (0-based)
     * @param joined     - DataJoin buffer to bind
     * @param offset     - Byte offset into the buffer (default 0)
     */
    bindAsInstanceBuffer(
        renderPass: GPURenderPassEncoder,
        slot: number,
        joined: JoinedBuffer,
        offset = 0,
    ): void {
        const existing = this._instanceBindings.get(slot);

        if (existing?.buffer === joined.buffer && existing.generation === joined.generation) {
            return;
        }

        // Instance buffers use the same setVertexBuffer API but with
        // stepMode: 'instance' defined in the pipeline layout
        renderPass.setVertexBuffer(slot, joined.buffer, offset, joined.length * 4);

        this._instanceBindings.set(slot, {
            slot,
            buffer: joined.buffer,
            generation: joined.generation,
            label: joined.label,
        });

        this._roundTripsAvoided++;
    }

    // ─── Buffer Compatibility Check ──────────────────────────────

    /**
     * Check if a JoinedBuffer has the VERTEX usage flag.
     * Call this before binding to provide a clear error message.
     */
    static isVertexCompatible(joined: JoinedBuffer): boolean {
        return (joined.usage & GPUBufferUsage.VERTEX) !== 0;
    }

    /**
     * Get the required extra usage flags for compute→render fusion.
     * Pass this to DataJoin.join() options.
     */
    static get requiredExtraUsage(): number {
        return GPUBufferUsage.VERTEX;
    }

    // ─── Unbind ──────────────────────────────────────────────────

    /** Clear all vertex bindings. */
    clearVertexBindings(): void {
        this._vertexBindings.clear();
    }

    /** Clear all instance bindings. */
    clearInstanceBindings(): void {
        this._instanceBindings.clear();
    }

    /** Clear all bindings. */
    clearAll(): void {
        this._vertexBindings.clear();
        this._instanceBindings.clear();
    }

    // ─── Stats ───────────────────────────────────────────────────

    /** Get bridge performance stats. */
    getStats(): BridgeStats {
        return {
            boundVertexSlots: this._vertexBindings.size,
            boundInstanceSlots: this._instanceBindings.size,
            totalRoundTripsAvoided: this._roundTripsAvoided,
        };
    }

    /** Reset the round-trips counter. */
    resetStats(): void {
        this._roundTripsAvoided = 0;
    }
}

// ─── Singleton ───────────────────────────────────────────────────

export const computeRenderBridge = new ComputeRenderBridge();
export default computeRenderBridge;
