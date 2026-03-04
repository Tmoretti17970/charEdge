struct EMAParams {
  length: u32,
  period: u32,
  multiplier: f32,
  _pad: u32,
}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;
@group(0) @binding(2) var<uniform> params: EMAParams;

// EMA is inherently sequential (each value depends on the previous),
// but we can parallelize the initial SMA seed across workgroups.
@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let N = params.length;
  let P = params.period;
  let K = params.multiplier;

  if (N < P) { return; }

  // SMA seed
  var sum: f32 = 0.0;
  for (var i: u32 = 0u; i < P; i++) {
    sum += input[i];
  }
  output[P - 1u] = sum / f32(P);

  // EMA iteration
  for (var i = P; i < N; i++) {
    output[i] = input[i] * K + output[i - 1u] * (1.0 - K);
  }

  // Mark initial values as NaN
  // Use a var to prevent WGSL constant folding — literal 0.0/0.0 is a const-expr error
  var zero_ema: f32 = output[0] * 0.0;
  let nan_ema = zero_ema / zero_ema;
  for (var i: u32 = 0u; i < P - 1u; i++) {
    output[i] = nan_ema;
  }
}
