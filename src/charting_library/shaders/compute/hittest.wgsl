struct HitParams {
  mouseX: f32,
  mouseY: f32,
  barCount: u32,
  barSpacing: f32,
  startIdx: u32,
  yMin: f32,
  yMax: f32,
  mainH: f32,
}

@group(0) @binding(0) var<storage, read> open: array<f32>;
@group(0) @binding(1) var<storage, read> high: array<f32>;
@group(0) @binding(2) var<storage, read> low: array<f32>;
@group(0) @binding(3) var<storage, read> close: array<f32>;
@group(0) @binding(4) var<storage, read_write> result: array<atomic<u32>>; // [hitIdx, snapPrice*1000]
@group(0) @binding(5) var<uniform> params: HitParams;

fn priceToY(price: f32) -> f32 {
  return params.mainH * (1.0 - (price - params.yMin) / (params.yMax - params.yMin));
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= params.barCount) { return; }

  let barX = (f32(params.startIdx + i) + 0.5) * params.barSpacing;
  let dx = abs(barX - params.mouseX);

  if (dx < params.barSpacing * 0.5) {
    // Find closest OHLC price to mouseY
    let prices = array<f32, 4>(open[i], high[i], low[i], close[i]);
    var closestDist: f32 = 1e30;
    var closestPrice: f32 = close[i];

    for (var j: u32 = 0u; j < 4u; j++) {
      let py = priceToY(prices[j]);
      let dist = abs(py - params.mouseY);
      if (dist < closestDist) {
        closestDist = dist;
        closestPrice = prices[j];
      }
    }

    // Atomic write (first bar to claim wins)
    atomicMin(&result[0], i);
    atomicStore(&result[1], u32(closestPrice * 1000.0));
  }
}
