// charEdge — Line Chart Vertex Shader
export const LINE_VERT = `#version 300 es
precision highp float;

in vec2 a_position;
uniform vec2 u_resolution;

void main() {
  gl_Position = vec4(
    (a_position.x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (a_position.y / u_resolution.y) * 2.0,
    0.0, 1.0
  );
}
`;

// charEdge — Line Chart Fragment Shader
export const LINE_FRAG = `#version 300 es
precision highp float;

uniform vec4 u_color;
out vec4 fragColor;

void main() {
  fragColor = u_color;
}
`;
