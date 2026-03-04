struct Params {
  barCount: u32,
  columnCount: u32,
  barsPerColumn: f32,
  _pad: u32,
}

@group(0) @binding(0) var<storage, read> high: array<f32>;
@group(0) @binding(1) var<storage, read> low: array<f32>;
@group(0) @binding(2) var<storage, read_write> colMin: array<f32>;
@group(0) @binding(3) var<storage, read_write> colMax: array<f32>;
@group(0) @binding(4) var<uniform> params: Params;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let col = gid.x;
  if (col >= params.columnCount) { return; }

  let start = u32(f32(col) * params.barsPerColumn);
  let end = min(u32(f32(col + 1u) * params.barsPerColumn), params.barCount);

  var lo: f32 = 1e30;
  var hi: f32 = -1e30;

  for (var i = start; i < end; i++) {
    if (low[i] < lo) { lo = low[i]; }
    if (high[i] > hi) { hi = high[i]; }
  }

  colMin[col] = lo;
  colMax[col] = hi;
}
