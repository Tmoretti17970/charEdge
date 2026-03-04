// charEdge — Fibonacci Fill Vertex Shader (Batch Zone Quads)
export const FIB_FILL_VERT = `#version 300 es
precision highp float;

in vec2 a_position;

// Per-instance: left, top, width, height, r, g, b, a
in float a_left;
in float a_top;
in float a_w;
in float a_h;
in float a_r;
in float a_g;
in float a_b;
in float a_a;

uniform vec2 u_resolution;

out vec4 v_color;

void main() {
  v_color = vec4(a_r, a_g, a_b, a_a);

  float x = a_left + a_position.x * a_w;
  float y = a_top  + a_position.y * a_h;

  gl_Position = vec4(
    (x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (y / u_resolution.y) * 2.0,
    0.0, 1.0
  );
}
`;

// charEdge — Fibonacci Fill Fragment Shader
export const FIB_FILL_FRAG = `#version 300 es
precision highp float;

in vec4 v_color;
out vec4 fragColor;

void main() {
  fragColor = v_color;
}
`;
