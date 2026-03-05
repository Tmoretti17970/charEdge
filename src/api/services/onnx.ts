import type { Request, Response, NextFunction, Router } from 'express';
// ═══════════════════════════════════════════════════════════════════
// charEdge — ONNX Runtime Web Service
//
// Phase 7 Task 7.2.1: In-browser ML inference via ONNX Runtime Web.
// Loads pre-trained models (pattern recognition, regime detection)
// without server round-trips.
//
// Usage:
//   const onnx = new ONNXService();
//   await onnx.loadModel('pattern-detector', '/models/patterns.onnx');
//   const result = await onnx.run('pattern-detector', inputTensor);
// ═══════════════════════════════════════════════════════════════════

/**
 * ONNX Runtime Web service for in-browser ML inference.
 */
export class ONNXService {
    constructor() {
        /** @type {Map<string, any>} Loaded model sessions */
        this._sessions = new Map();
        /** @type {any} ONNX Runtime reference */
        this._ort = null;
        this._loading = null;
    }

    /**
     * Lazy-load ONNX Runtime Web.
     */
    async _ensureRuntime() {
        if (this._ort) return this._ort;
        if (this._loading) return this._loading;

        this._loading = (async () => {
            try {
                const ort = await import('onnxruntime-web');
                this._ort = ort;

                // Prefer WebGL backend, fallback to WASM
                ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;
                ort.env.wasm.simd = true;

                console.info('[ONNX] Runtime loaded (WebGL + WASM fallback)');
                return ort;
            } catch (err) {
                console.warn('[ONNX] Runtime not available:', err.message);
                throw err;
            }
        })();

        return this._loading;
    }

    /**
     * Load a model from a URL or ArrayBuffer.
     * @param {string} name - Model identifier
     * @param {string|ArrayBuffer} source - URL or pre-fetched buffer
     * @param {Object} [options] - InferenceSession options
     */
    async loadModel(name, source, options = {}) {
        const ort = await this._ensureRuntime();

        const sessionOptions = {
            executionProviders: ['webgl', 'wasm'],
            graphOptimizationLevel: 'all',
            ...options,
        };

        let session;
        if (typeof source === 'string') {
            // Fetch and create session
            const response = await fetch(source);
            const buffer = await response.arrayBuffer();
            session = await ort.InferenceSession.create(buffer, sessionOptions);
        } else {
            session = await ort.InferenceSession.create(source, sessionOptions);
        }

        this._sessions.set(name, session);
        console.info(`[ONNX] Model "${name}" loaded (inputs: ${session.inputNames}, outputs: ${session.outputNames})`);
        return session;
    }

    /**
     * Run inference on a loaded model.
     * @param {string} name - Model identifier
     * @param {Record<string, any>} feeds - Input tensors
     * @returns {Promise<Record<string, any>>} Output tensors
     */
    async run(name, feeds) {
        const session = this._sessions.get(name);
        if (!session) throw new Error(`[ONNX] Model "${name}" not loaded`);

        const start = performance.now();
        const results = await session.run(feeds);
        const duration = performance.now() - start;

        console.debug(`[ONNX] "${name}" inference: ${duration.toFixed(1)}ms`);
        return results;
    }

    /**
     * Create a tensor from a Float32Array.
     * @param {Float32Array} data
     * @param {number[]} dims - Shape
     */
    async createTensor(data, dims) {
        const ort = await this._ensureRuntime();
        return new ort.Tensor('float32', data, dims);
    }

    /**
     * Unload a model and free memory.
     */
    async unloadModel(name) {
        const session = this._sessions.get(name);
        if (session) {
            await session.release();
            this._sessions.delete(name);
        }
    }

    /**
     * Unload all models.
     */
    async dispose() {
        for (const [name] of this._sessions) {
            await this.unloadModel(name);
        }
    }

    /**
     * Check if ONNX Runtime is available.
     */
    get isAvailable() {
        return this._ort !== null;
    }

    /**
     * Get loaded model names.
     */
    get loadedModels() {
        return [...this._sessions.keys()];
    }
}

// Singleton
let _instance = null;
export function getONNXService() {
    if (!_instance) _instance = new ONNXService();
    return _instance;
}

export default ONNXService;
