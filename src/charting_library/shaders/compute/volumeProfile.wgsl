struct Params {
  barCount: u32,
  binCount: u32,
  priceMin: f32,
  priceMax: f32,
}

@group(0) @binding(0) var<storage, read> high: array<f32>;
@group(0) @binding(1) var<storage, read> low: array<f32>;
@group(0) @binding(2) var<storage, read> volume: array<f32>;
@group(0) @binding(3) var<storage, read> close: array<f32>;
@group(0) @binding(4) var<storage, read> open: array<f32>;
@group(0) @binding(5) var<storage, read_write> upBins: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> downBins: array<atomic<u32>>;
@group(0) @binding(7) var<uniform> params: Params;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let barIdx = gid.x;
  if (barIdx >= params.barCount) { return; }

  let priceRange = params.priceMax - params.priceMin;
  if (priceRange <= 0.0) { return; }

  let h = high[barIdx];
  let l = low[barIdx];
  let vol = volume[barIdx];
  let isBull = close[barIdx] >= open[barIdx];

  // Distribute volume across price bins this bar touches
  let binLo = u32(max(0.0, (l - params.priceMin) / priceRange * f32(params.binCount)));
  let binHi = min(u32((h - params.priceMin) / priceRange * f32(params.binCount)), params.binCount - 1u);
  let binsHit = binHi - binLo + 1u;
  let volPerBin = u32(vol * 1000.0 / f32(binsHit)); // Scale to integer

  for (var b: u32 = binLo; b <= binHi; b++) {
    if (isBull) {
      atomicAdd(&upBins[b], volPerBin);
    } else {
      atomicAdd(&downBins[b], volPerBin);
    }
  }
}
