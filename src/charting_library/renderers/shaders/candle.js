// charEdge — Candlestick Vertex Shader
export const CANDLE_VERT = `#version 300 es
precision highp float;

// Per-vertex (quad corners)
in vec2 a_position;  // 0-1 normalized quad

// Per-instance
in float a_x;        // bar center X in pixels
in float a_open;     // open price
in float a_high;     // high price
in float a_low;      // low price
in float a_close;    // close price
in float a_isBull;   // 1.0 = bull, 0.0 = bear
in float a_isWick;   // 1.0 = wick, 0.0 = body

// Uniforms
uniform vec2 u_resolution;  // canvas size in pixels
uniform float u_bodyWidth;  // body half-width in pixels
uniform float u_wickWidth;  // wick half-width in pixels
uniform float u_yMin;       // price range min
uniform float u_yMax;       // price range max
uniform float u_mainH;      // main chart height in pixels
uniform float u_panOffset;  // Sprint 3: horizontal pixel offset for GPU panning

out float v_isBull;

float priceToY(float price) {
  return u_mainH * (1.0 - (price - u_yMin) / (u_yMax - u_yMin));
}

void main() {
  v_isBull = a_isBull;

  float halfW;
  float top, bottom;

  if (a_isWick > 0.5) {
    // Wick: thin vertical line from high to low
    halfW = u_wickWidth;
    top = priceToY(a_high);
    bottom = priceToY(a_low);
  } else {
    // Body: rectangle from open to close
    halfW = u_bodyWidth;
    float oY = priceToY(a_open);
    float cY = priceToY(a_close);
    top = min(oY, cY);
    bottom = max(oY, cY);
    if (bottom - top < 1.0) bottom = top + 1.0; // min 1px height
  }

  // Map quad position to screen space
  float x = a_x + u_panOffset + (a_position.x - 0.5) * halfW * 2.0;
  float y = top + a_position.y * (bottom - top);

  // Convert to clip space (-1..1)
  gl_Position = vec4(
    (x / u_resolution.x) * 2.0 - 1.0,
    1.0 - (y / u_resolution.y) * 2.0,
    0.0, 1.0
  );
}
`;

// charEdge — Candlestick Fragment Shader
export const CANDLE_FRAG = `#version 300 es
precision highp float;

in float v_isBull;

uniform vec4 u_bullColor;
uniform vec4 u_bearColor;

out vec4 fragColor;

void main() {
  fragColor = v_isBull > 0.5 ? u_bullColor : u_bearColor;
}
`;
