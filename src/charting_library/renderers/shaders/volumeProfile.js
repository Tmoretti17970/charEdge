// charEdge — Volume Profile Vertex Shader (Horizontal Bars)
export const VPROFILE_VERT = `#version 300 es
precision highp float;

in vec2 a_position;   // unit quad

// Per-instance
in float a_y;         // row center Y in pixels
in float a_width;     // bar width in pixels (extends leftward from right edge)
in float a_height;    // row height in pixels
in float a_intensity; // 0..1 normalized volume
in float a_isPoc;     // 1.0 = point of control row

uniform vec2 u_resolution;
uniform float u_rightEdge; // right edge X for horizontal bars

out float v_intensity;
out float v_isPoc;

void main() {
  v_intensity = a_intensity;
  v_isPoc = a_isPoc;

  float halfH = a_height * 0.5;
  float right = u_rightEdge;
  float left  = right - a_width;

  float x = mix(left, right, a_position.x);
  float y = (a_y - halfH) + a_position.y * a_height;

  gl_Position = vec4(
    (x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (y / u_resolution.y) * 2.0,
    0.0, 1.0
  );
}
`;

// charEdge — Volume Profile Fragment Shader
export const VPROFILE_FRAG = `#version 300 es
precision highp float;

in float v_intensity;
in float v_isPoc;

uniform vec4 u_buyColor;
uniform vec4 u_sellColor;
uniform vec4 u_pocColor;

out vec4 fragColor;

void main() {
  if (v_isPoc > 0.5) {
    fragColor = u_pocColor;
  } else {
    float alpha = 0.2 + v_intensity * 0.6;
    vec4 baseColor = mix(u_sellColor, u_buyColor, v_intensity);
    fragColor = vec4(baseColor.rgb, baseColor.a * alpha);
  }
}
`;
