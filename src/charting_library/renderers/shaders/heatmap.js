// charEdge — Heatmap Vertex Shader (Instanced Color-Gradient Quads)
export const HEATMAP_VERT = `#version 300 es
precision highp float;

in vec2 a_position;

// Per-instance: x, y, width, height, intensity
in float a_x;
in float a_y;
in float a_cellW;
in float a_cellH;
in float a_intensity;

uniform vec2 u_resolution;

out float v_intensity;

void main() {
  v_intensity = a_intensity;

  float x = a_x + a_position.x * a_cellW;
  float y = a_y + a_position.y * a_cellH;

  gl_Position = vec4(
    (x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (y / u_resolution.y) * 2.0,
    0.0, 1.0
  );
}
`;

// charEdge — Heatmap Fragment Shader (3-stop gradient)
export const HEATMAP_FRAG = `#version 300 es
precision highp float;

in float v_intensity;

// 3-stop gradient: cold -> warm -> hot
uniform vec4 u_coldColor;
uniform vec4 u_warmColor;
uniform vec4 u_hotColor;
uniform float u_globalAlpha;

out vec4 fragColor;

void main() {
  vec4 color;
  if (v_intensity < 0.5) {
    color = mix(u_coldColor, u_warmColor, v_intensity * 2.0);
  } else {
    color = mix(u_warmColor, u_hotColor, (v_intensity - 0.5) * 2.0);
  }
  fragColor = vec4(color.rgb, color.a * u_globalAlpha * (0.3 + v_intensity * 0.7));
}
`;
