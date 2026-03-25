// charEdge — Anti-Aliased Line Vertex Shader (Triangle-Strip Expansion)
export const AA_LINE_VERT = `#version 300 es
precision highp float;

// Each vertex of the expanded quad
in vec2 a_posA;       // start point of segment (pixels)
in vec2 a_posB;       // end point of segment (pixels)
in float a_side;      // -1 or +1 (left/right of line center)
in float a_miter;     // 0 = segment start, 1 = segment end

uniform vec2 u_resolution;
uniform float u_lineWidth;
uniform float u_pixelRatio;

out float v_distFromCenter;
out float v_lineWidth;

void main() {
  // Interpolate position along the segment
  vec2 pos = mix(a_posA, a_posB, a_miter);

  // Subpixel offset correction: snap line centers to pixel grid
  // Prevents inter-pixel straddling that causes banding at thin widths
  pos = floor(pos * u_pixelRatio + 0.5) / u_pixelRatio;

  // Direction and normal
  vec2 dir = a_posB - a_posA;
  float len = length(dir);
  if (len < 0.001) dir = vec2(1.0, 0.0); else dir /= len;
  vec2 normal = vec2(-dir.y, dir.x);

  // Expand outward by half line width + wider fringe for thin lines
  float fringe = u_lineWidth < 2.0 ? 1.5 : 1.0;
  float halfW = u_lineWidth * 0.5 + fringe;
  pos += normal * a_side * halfW;

  v_distFromCenter = a_side * halfW;
  v_lineWidth = u_lineWidth;

  gl_Position = vec4(
    (pos.x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (pos.y / u_resolution.y) * 2.0,
    0.0, 1.0
  );
}
`;

// charEdge — Anti-Aliased Line Fragment Shader
export const AA_LINE_FRAG = `#version 300 es
precision highp float;

in float v_distFromCenter;
in float v_lineWidth;

uniform vec4 u_color;
out vec4 fragColor;

void main() {
  float d = abs(v_distFromCenter);
  float edge = fwidth(d);

  // Wider smoothstep range for thin lines — reduces banding
  float aaRange = v_lineWidth < 2.0 ? edge * 1.5 : edge;
  float alpha = 1.0 - smoothstep(v_lineWidth * 0.5 - aaRange, v_lineWidth * 0.5 + aaRange, d);

  // Minimum alpha clamp for thin lines — prevents ghostly appearance on non-retina
  float minAlpha = v_lineWidth < 2.0 ? 0.35 : 0.0;
  alpha = max(alpha, minAlpha * step(d, v_lineWidth * 0.5 + aaRange));

  fragColor = vec4(u_color.rgb, u_color.a * alpha);
}
`;
