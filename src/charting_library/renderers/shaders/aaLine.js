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

out float v_distFromCenter;
out float v_lineWidth;

void main() {
  // Interpolate position along the segment
  vec2 pos = mix(a_posA, a_posB, a_miter);

  // Direction and normal
  vec2 dir = a_posB - a_posA;
  float len = length(dir);
  if (len < 0.001) dir = vec2(1.0, 0.0); else dir /= len;
  vec2 normal = vec2(-dir.y, dir.x);

  // Expand outward by half line width + 1px for AA fringe
  float halfW = u_lineWidth * 0.5 + 1.0;
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
  float alpha = 1.0 - smoothstep(v_lineWidth * 0.5 - edge, v_lineWidth * 0.5 + edge, d);
  fragColor = vec4(u_color.rgb, u_color.a * alpha);
}
`;
