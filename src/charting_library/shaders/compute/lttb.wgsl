struct Params {
  inputLength: u32,
  outputLength: u32,
  _pad1: u32,
  _pad2: u32,
}

@group(0) @binding(0) var<storage, read> inputX: array<f32>;
@group(0) @binding(1) var<storage, read> inputY: array<f32>;
@group(0) @binding(2) var<storage, read_write> outputX: array<f32>;
@group(0) @binding(3) var<storage, read_write> outputY: array<f32>;
@group(0) @binding(4) var<uniform> params: Params;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let bucketIdx = gid.x;
  let inLen = params.inputLength;
  let outLen = params.outputLength;

  // Bucket 0 = first point, bucket outLen-1 = last point (handled on CPU)
  if (bucketIdx == 0u || bucketIdx >= outLen - 1u) { return; }

  let bucketSize = f32(inLen - 2u) / f32(outLen - 2u);
  let bucketStart = u32(f32(bucketIdx - 1u) * bucketSize) + 1u;
  let bucketEnd = min(u32(f32(bucketIdx) * bucketSize) + 1u, inLen - 1u);

  // Previous selected point (approximation: use bucket center of previous bucket)
  let prevBucketStart = u32(f32(max(bucketIdx, 1u) - 1u) * bucketSize);
  let prevX = inputX[prevBucketStart];
  let prevY = inputY[prevBucketStart];

  // Next bucket average
  let nextStart = min(u32(f32(bucketIdx) * bucketSize) + 1u, inLen - 1u);
  let nextEnd = min(u32(f32(bucketIdx + 1u) * bucketSize) + 1u, inLen - 1u);
  var nextAvgX: f32 = 0.0;
  var nextAvgY: f32 = 0.0;
  var nextCount: f32 = 0.0;
  for (var j: u32 = nextStart; j <= nextEnd && j < inLen; j++) {
    nextAvgX += inputX[j];
    nextAvgY += inputY[j];
    nextCount += 1.0;
  }
  if (nextCount > 0.0) {
    nextAvgX /= nextCount;
    nextAvgY /= nextCount;
  }

  // Find the point in current bucket with largest triangle area
  var maxArea: f32 = -1.0;
  var bestIdx: u32 = bucketStart;
  for (var j: u32 = bucketStart; j <= bucketEnd && j < inLen; j++) {
    let area = abs(
      (prevX - nextAvgX) * (inputY[j] - prevY) -
      (prevX - inputX[j]) * (nextAvgY - prevY)
    ) * 0.5;
    if (area > maxArea) {
      maxArea = area;
      bestIdx = j;
    }
  }

  outputX[bucketIdx] = inputX[bestIdx];
  outputY[bucketIdx] = inputY[bestIdx];
}
