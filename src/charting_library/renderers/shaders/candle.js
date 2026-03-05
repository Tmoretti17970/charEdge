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
out float v_isWick;
out vec2 v_uv;

float priceToY(float price) {
  return u_mainH * (1.0 - (price - u_yMin) / (u_yMax - u_yMin));
}

void main() {
  v_isBull = a_isBull;
  v_isWick = a_isWick;
  v_uv = a_position;

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
in float v_isWick;
in vec2 v_uv;

uniform vec4 u_bullColor;
uniform vec4 u_bearColor;
uniform float u_hollow;     // 5A.3.2: 1.0 = hollow candles mode
uniform float u_bodyWidth;  // body half-width for border calculation

out vec4 fragColor;

void main() {
  vec4 color = v_isBull > 0.5 ? u_bullColor : u_bearColor;

  // 5A.3.2: Hollow mode — bullish bodies rendered as outlines
  if (u_hollow > 0.5 && v_isBull > 0.5 && v_isWick < 0.5) {
    // Distance from quad edge (0-0.5 range, 0 = edge, 0.5 = center)
    float edgeX = min(v_uv.x, 1.0 - v_uv.x);
    float edgeY = min(v_uv.y, 1.0 - v_uv.y);
    float edgeDist = min(edgeX, edgeY);

    // Border width: ~1.5px relative to body width
    float border = clamp(1.5 / max(u_bodyWidth, 1.0), 0.02, 0.3);

    if (edgeDist > border) discard; // hollow interior
  }

  fragColor = color;
}
`;
