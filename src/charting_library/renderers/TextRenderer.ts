import { logger } from '../../utils/logger';

// ═══════════════════════════════════════════════════════════════════
// charEdge — TextRenderer
//
// GPU SDF text rendering and indicator line batching extracted from
// WebGLRenderer. Standalone typed functions that receive the
// renderer instance.
// ═══════════════════════════════════════════════════════════════════

/** A single text entry to render via SDF atlas. */
export interface SDFTextEntry {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: Float32Array | number[];
  align?: string;
}

/** Parameters for SDF text rendering. */
export interface SDFTextParams {
  pixelRatio: number;
  [key: string]: unknown;
}

/** A single indicator line series. */
export interface IndicatorSeries {
  values: number[] | Float32Array;
  color: string;
  lineWidth?: number;
  dash?: number[];
}

/** Parameters for indicator line rendering. */
export interface IndicatorLineParams {
  pixelRatio: number;
  barSpacing: number;
  startIdx: number;
  endIdx: number;
  priceToY: (price: number) => number;
  timeTransform?: { indexToPixel: (idx: number) => number } | null;
  [key: string]: unknown;
}

/** TextAtlas interface (lazy-loaded). */
interface TextAtlasRef {
  ready: boolean;
  drawText(entries: SDFTextEntry[], params: { pixelRatio: number; canvasWidth: number; canvasHeight: number }): void;
  measureText(text: string, fontSize: number): number;
}

/** Minimal renderer interface to avoid circular WebGLRenderer dependency. */
interface RendererRef {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  _available: boolean;
  _textAtlas: TextAtlasRef | null;
  drawAALine(points: Array<{ x: number; y: number }>, color: string, lineWidth?: number): void;
}

/** TextAtlas constructor type — passed in to avoid circular import. */
type TextAtlasConstructor = new (gl: WebGL2RenderingContext) => TextAtlasRef;

/**
 * Draw text entries via GPU SDF text atlas.
 * Lazily initializes the TextAtlas on first call.
 */
export function drawSDFText(
  r: RendererRef,
  entries: SDFTextEntry[],
  params: SDFTextParams,
  TextAtlasCtor: TextAtlasConstructor,
): void {
  if (!r._available || !entries?.length) return;

  // Lazy init
  if (!r._textAtlas) {
    try {
      r._textAtlas = new TextAtlasCtor(r.gl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.engine.warn('[WebGLRenderer] TextAtlas init failed:', msg);
      return;
    }
  }

  if (!r._textAtlas.ready) return;

  r._textAtlas.drawText(entries, {
    pixelRatio: params.pixelRatio,
    canvasWidth: r.canvas.width,
    canvasHeight: r.canvas.height,
  });
}

/**
 * Measure text width using the SDF atlas (CSS pixels).
 */
export function measureSDFText(
  r: RendererRef,
  text: string,
  fontSize: number,
): number {
  if (!r._textAtlas?.ready) return text.length * fontSize * 0.55;
  return r._textAtlas.measureText(text, fontSize);
}

/**
 * Draw multiple indicator overlay line series via GPU anti-aliased lines.
 * Batches all series into sequential AA line draws, avoiding Canvas2D path overhead.
 */
export function drawIndicatorLines(
  r: RendererRef,
  seriesArray: IndicatorSeries[],
  params: IndicatorLineParams,
): void {
  if (!r._available || !seriesArray?.length) return;

  const { pixelRatio: pr, barSpacing, startIdx, endIdx, priceToY, timeTransform } = params;

  for (const series of seriesArray) {
    const { values, color, lineWidth = 2 } = series;
    if (!values || !values.length) continue;

    // Build pixel-space points for this series, skipping NaN gaps
    const segments: Array<Array<{ x: number; y: number }>> = [];
    let current: Array<{ x: number; y: number }> = [];

    const lo = Math.max(0, startIdx);
    const hi = Math.min(endIdx, values.length - 1);

    for (let i = lo; i <= hi; i++) {
      const v = values[i];
      if (v === undefined || v === null || isNaN(v as number)) {
        // NaN gap → end current segment, start a new one
        if (current.length >= 2) segments.push(current);
        current = [];
        continue;
      }

      let x: number;
      if (timeTransform) {
        x = timeTransform.indexToPixel(i) * pr;
      } else {
        x = ((i - startIdx) + 0.5) * barSpacing * pr;
      }
      const y = priceToY(v as number) * pr;
      current.push({ x, y });
    }
    if (current.length >= 2) segments.push(current);

    // Draw each contiguous segment
    for (const seg of segments) {
      r.drawAALine(seg, color, lineWidth);
    }
  }
}
