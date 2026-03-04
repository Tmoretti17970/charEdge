// charEdge — Volume Bar Vertex Shader
export const VOLUME_VERT = `#version 300 es
precision highp float;

in vec2 a_position;

// Per-instance
in float a_x;
in float a_volume;
in float a_isBull;

uniform vec2 u_resolution;
uniform float u_bodyWidth;
uniform float u_maxVolume;
uniform float u_volumeTop;    // Y position where volume pane starts
uniform float u_volumeHeight; // Height of volume pane
uniform float u_panOffset;  // Sprint 3: horizontal pixel offset for GPU panning

out float v_isBull;
out float v_alpha;

void main() {
  v_isBull = a_isBull;
  float normalizedVol = a_volume / max(u_maxVolume, 0.001);
  v_alpha = 0.3 + normalizedVol * 0.5;

  float barH = normalizedVol * u_volumeHeight;
  float halfW = u_bodyWidth;

  float x = a_x + u_panOffset + (a_position.x - 0.5) * halfW * 2.0;
  float bottom = u_volumeTop + u_volumeHeight;
  float top = bottom - barH;
  float y = top + a_position.y * barH;

  gl_Position = vec4(
    (x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (y / u_resolution.y) * 2.0,
    0.0, 1.0
  );
}
`;

// charEdge — Volume Bar Fragment Shader
export const VOLUME_FRAG = `#version 300 es
precision highp float;

in float v_isBull;
in float v_alpha;

uniform vec4 u_bullColor;
uniform vec4 u_bearColor;

out vec4 fragColor;

void main() {
  vec4 color = v_isBull > 0.5 ? u_bullColor : u_bearColor;
  fragColor = vec4(color.rgb, color.a * v_alpha);
}
`;
