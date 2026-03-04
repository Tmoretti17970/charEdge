struct Params {
  length: u32,
  period: u32,
  _pad1: u32,
  _pad2: u32,
}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;
@group(0) @binding(2) var<uniform> params: Params;

@compute @workgroup_size(1)
fn main() {
  let n = params.length;
  let period = params.period;

  // Fill early values with NaN
  // Use a var to prevent WGSL constant folding — literal 0.0/0.0 is a const-expr error
  var zero_rsi: f32 = output[0] * 0.0;
  let nan_rsi = zero_rsi / zero_rsi;
  for (var i: u32 = 0u; i < period; i++) {
    output[i] = nan_rsi;
  }

  // Calculate initial average gains/losses
  var avgGain: f32 = 0.0;
  var avgLoss: f32 = 0.0;
  for (var i: u32 = 1u; i <= period; i++) {
    let change = input[i] - input[i - 1u];
    if (change > 0.0) {
      avgGain += change;
    } else {
      avgLoss -= change;
    }
  }
  avgGain /= f32(period);
  avgLoss /= f32(period);

  let rs0 = select(100.0, avgGain / avgLoss, avgLoss > 0.0);
  output[period] = 100.0 - 100.0 / (1.0 + rs0);

  // Smooth with Wilder's method
  let pm1 = f32(period - 1u);
  let pf = f32(period);
  for (var i: u32 = period + 1u; i < n; i++) {
    let change = input[i] - input[i - 1u];
    let gain = select(0.0, change, change > 0.0);
    let loss = select(0.0, -change, change < 0.0);
    avgGain = (avgGain * pm1 + gain) / pf;
    avgLoss = (avgLoss * pm1 + loss) / pf;
    let rs = select(100.0, avgGain / avgLoss, avgLoss > 0.0);
    output[i] = 100.0 - 100.0 / (1.0 + rs);
  }
}
