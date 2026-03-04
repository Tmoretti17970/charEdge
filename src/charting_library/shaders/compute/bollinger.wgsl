struct Params {
  length: u32,
  period: u32,
  multiplier: f32,
  _pad: u32,
}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> middle: array<f32>;
@group(0) @binding(2) var<storage, read_write> upper: array<f32>;
@group(0) @binding(3) var<storage, read_write> lower: array<f32>;
@group(0) @binding(4) var<uniform> params: Params;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  let n = params.length;
  let period = params.period;
  let mult = params.multiplier;

  if (idx >= n) { return; }
  if (idx < period - 1u) {
    // Use a var to prevent WGSL constant folding — literal 0.0/0.0 is a const-expr error
    var zero_bb: f32 = middle[0] * 0.0;
    let nan_bb = zero_bb / zero_bb;
    middle[idx] = nan_bb;
    upper[idx] = nan_bb;
    lower[idx] = nan_bb;
    return;
  }

  // Calculate SMA
  var sum: f32 = 0.0;
  for (var j: u32 = 0u; j < period; j++) {
    sum += input[idx - j];
  }
  let sma = sum / f32(period);
  middle[idx] = sma;

  // Calculate standard deviation
  var variance: f32 = 0.0;
  for (var j: u32 = 0u; j < period; j++) {
    let diff = input[idx - j] - sma;
    variance += diff * diff;
  }
  let stddev = sqrt(variance / f32(period));

  upper[idx] = sma + mult * stddev;
  lower[idx] = sma - mult * stddev;
}
