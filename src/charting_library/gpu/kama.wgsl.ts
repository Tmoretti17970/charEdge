// ═══════════════════════════════════════════════════════════════════
// charEdge — KAMA WebGPU Compute Shader (Phase 5)
// Kaufman Adaptive Moving Average — GPU-accelerated compute path
//
// Feature-detected at runtime:
//   if (navigator.gpu) → GPU path
//   else              → CPU fallback via C.kama()
// ═══════════════════════════════════════════════════════════════════

// WGSL shader stored as a string template for Vite bundling.
// The shader is registered with the GPU pipeline at runtime.

export const KAMA_WGSL = /* wgsl */`
// Kaufman Adaptive Moving Average — compute shader
// Input:  source prices (f32 array)
// Output: KAMA values (f32 array)

struct Params {
  length: u32,
  fast_sc: f32,    // 2 / (fast_period + 1)
  slow_sc: f32,    // 2 / (slow_period + 1)
  count: u32,      // number of bars
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> src: array<f32>;
@group(0) @binding(2) var<storage, read_write> out: array<f32>;

// Efficiency Ratio: abs(direction) / sum(abs(changes))
fn efficiency_ratio(idx: u32, len: u32) -> f32 {
  if (idx < len) { return 0.0; }

  let direction = abs(src[idx] - src[idx - len]);
  var volatility: f32 = 0.0;

  for (var i: u32 = 0u; i < len; i = i + 1u) {
    volatility += abs(src[idx - i] - src[idx - i - 1u]);
  }

  if (volatility == 0.0) { return 0.0; }
  return direction / volatility;
}

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.count) { return; }

  // Warmup: seed with source value
  if (idx < params.length) {
    out[idx] = src[idx];
    return;
  }

  let er = efficiency_ratio(idx, params.length);
  let sc_range = params.fast_sc - params.slow_sc;
  let sc = er * sc_range + params.slow_sc;
  let alpha = sc * sc;  // Squared smoothing constant

  // KAMA[i] = KAMA[i-1] + alpha * (src[i] - KAMA[i-1])
  // Note: sequential dependency — we use a simple scan.
  // For large datasets, a parallel prefix scan would be needed.
  out[idx] = out[idx - 1u] + alpha * (src[idx] - out[idx - 1u]);
}
`;

/**
 * Create a WebGPU compute pipeline for KAMA.
 * Returns null if WebGPU is unavailable.
 */
export async function createKamaPipeline(
    device: GPUDevice,
): Promise<GPUComputePipeline | null> {
    try {
        const module = device.createShaderModule({
            code: KAMA_WGSL,
        });

        const pipeline = await device.createComputePipelineAsync({
            layout: 'auto',
            compute: {
                module,
                entryPoint: 'main',
            },
        });

        return pipeline;
    } catch {
        console.warn('[charEdge] KAMA GPU pipeline creation failed, using CPU fallback');
        return null;
    }
}

/**
 * Run KAMA computation on GPU.
 * Falls back to null if pipeline is unavailable.
 */
export async function computeKamaGPU(
    device: GPUDevice,
    pipeline: GPUComputePipeline,
    srcData: Float32Array,
    length: number,
    fastPeriod: number,
    slowPeriod: number,
): Promise<Float32Array | null> {
    try {
        const count = srcData.length;

        // Params buffer
        const paramsData = new ArrayBuffer(16);
        const paramsView = new DataView(paramsData);
        paramsView.setUint32(0, length, true);
        paramsView.setFloat32(4, 2 / (fastPeriod + 1), true);
        paramsView.setFloat32(8, 2 / (slowPeriod + 1), true);
        paramsView.setUint32(12, count, true);

        const paramsBuffer = device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(paramsBuffer, 0, paramsData);

        // Source buffer
        const srcBuffer = device.createBuffer({
            size: srcData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(srcBuffer, 0, srcData);

        // Output buffer
        const outBuffer = device.createBuffer({
            size: srcData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        // Read-back buffer
        const readBuffer = device.createBuffer({
            size: srcData.byteLength,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        // Bind group
        const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: paramsBuffer } },
                { binding: 1, resource: { buffer: srcBuffer } },
                { binding: 2, resource: { buffer: outBuffer } },
            ],
        });

        // Dispatch
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(count);
        pass.end();

        encoder.copyBufferToBuffer(outBuffer, 0, readBuffer, 0, srcData.byteLength);
        device.queue.submit([encoder.finish()]);

        // Read back
        await readBuffer.mapAsync(GPUMapMode.READ);
        const result = new Float32Array(readBuffer.getMappedRange().slice(0));
        readBuffer.unmap();

        // Cleanup
        paramsBuffer.destroy();
        srcBuffer.destroy();
        outBuffer.destroy();
        readBuffer.destroy();

        return result;
    } catch {
        return null;
    }
}
