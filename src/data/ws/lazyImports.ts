// ═══════════════════════════════════════════════════════════════════
// charEdge — WebSocket Lazy Imports
//
// Sprint 9 #69: Extracted from WebSocketService.ts.
// Lazy-loaded singletons for optional WS dependencies.
// These are loaded on first use to avoid circular imports and
// reduce initial bundle parse time.
// ═══════════════════════════════════════════════════════════════════

// ─── BinaryCodec (Task 1.3.2) ──────────────────────────────────

let _binaryCodec: unknown = null;
let _binaryCodecLoading = false;

/**
 * Lazy-load the BinaryCodec for binary WS message decoding.
 * Returns null if still loading — callers should skip the message.
 */
export function getBinaryCodec(): unknown {
    if (_binaryCodec) return _binaryCodec;
    if (_binaryCodecLoading) return null;
    _binaryCodecLoading = true;
    import('../engine/infra/BinaryCodec.js')
        .then(mod => { _binaryCodec = mod.BinaryCodec || mod.default; })
        .catch(() => { _binaryCodecLoading = false; });
    return null;
}

// ─── StreamingIndicatorBridge ──────────────────────────────────

let _streamingBridge: unknown = null;
let _streamingBridgeLoading = false;

/**
 * Lazy-load the StreamingIndicatorBridge for live indicator updates.
 * Returns null if still loading.
 */
export function getStreamingBridge(): unknown {
    if (_streamingBridge) return _streamingBridge;
    if (_streamingBridgeLoading) return null;
    _streamingBridgeLoading = true;
    import('../engine/indicators/StreamingIndicatorBridge.js')
        .then(mod => { _streamingBridge = mod.streamingIndicatorBridge; })
        .catch(() => { _streamingBridgeLoading = false; });
    return null;
}
