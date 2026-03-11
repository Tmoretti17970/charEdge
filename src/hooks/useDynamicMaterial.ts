// ═══════════════════════════════════════════════════════════════════
// charEdge — Dynamic Material / Clear Mode Hook (E1.3)
//
// Reads canvas pixel data from the chart at throttled 4fps to
// provide sampled background color to CSS surfaces with
// [data-clear-mode]. Toggle via `document.body.dataset.clearMode`.
//
// Usage:
//   const { tint, luminance, isActive } = useDynamicMaterial(canvasRef);
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from 'react';

interface DynamicMaterialState {
  /** Dominant tint color from canvas sample (CSS rgb string) */
  tint: string;
  /** Average luminance (0-1) of sampled region */
  luminance: number;
  /** Whether clear mode is currently active */
  isActive: boolean;
}

const SAMPLE_SIZE = 16; // 16x16 pixel region
const SAMPLE_FPS = 4;  // 250ms between samples
const SAMPLE_INTERVAL = 1000 / SAMPLE_FPS;

/**
 * Sample a small region of a canvas and compute the average color.
 */
function sampleCanvas(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  size: number,
): { r: number; g: number; b: number; luminance: number } | null {
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const clampedX = Math.max(0, Math.min(x, canvas.width - size));
    const clampedY = Math.max(0, Math.min(y, canvas.height - size));
    const imageData = ctx.getImageData(clampedX, clampedY, size, size);
    const data = imageData.data;
    const pixelCount = size * size;

    let rSum = 0, gSum = 0, bSum = 0;
    for (let i = 0; i < data.length; i += 4) {
      rSum += data[i]!;
      gSum += data[i + 1]!;
      bSum += data[i + 2]!;
    }

    const r = Math.round(rSum / pixelCount);
    const g = Math.round(gSum / pixelCount);
    const b = Math.round(bSum / pixelCount);

    // Relative luminance (ITU-R BT.709)
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    return { r, g, b, luminance };
  } catch {
    return null;
  }
}

/**
 * React hook that provides dynamic material sampling from a chart canvas.
 *
 * When `[data-clear-mode]` is set on `<body>`, this hook samples the
 * canvas at 4fps and sets `--tf-clear-bg` and `--tf-clear-tint` on
 * the document element for use in glassmorphism surfaces.
 */
export function useDynamicMaterial(
  // eslint-disable-next-line no-undef
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
): DynamicMaterialState {
  const [state, setState] = useState<DynamicMaterialState>({
    tint: 'rgb(22, 24, 29)',
    luminance: 0.08,
    isActive: false,
  });
  const rafRef = useRef<number>(0);
  const lastSampleRef = useRef<number>(0);

  const sample = useCallback(() => {
    const canvas = canvasRef.current;
    const isActive = document.body.hasAttribute('data-clear-mode');

    if (!isActive || !canvas) {
      setState((prev) => ({ ...prev, isActive: false }));
      return;
    }

    const now = performance.now();
    if (now - lastSampleRef.current < SAMPLE_INTERVAL) {
      rafRef.current = requestAnimationFrame(sample);
      return;
    }
    lastSampleRef.current = now;

    // Sample center of canvas
    const cx = Math.floor(canvas.width / 2) - Math.floor(SAMPLE_SIZE / 2);
    const cy = Math.floor(canvas.height / 2) - Math.floor(SAMPLE_SIZE / 2);
    const result = sampleCanvas(canvas, cx, cy, SAMPLE_SIZE);

    if (result) {
      const tint = `rgb(${result.r}, ${result.g}, ${result.b})`;

      // Set CSS custom properties for clear-mode surfaces
      const root = document.documentElement;
      root.style.setProperty('--tf-clear-bg', `rgba(${result.r}, ${result.g}, ${result.b}, 0.55)`);
      root.style.setProperty('--tf-clear-tint', `rgba(${result.r}, ${result.g}, ${result.b}, 0.15)`);

      setState({ tint, luminance: result.luminance, isActive: true });
    }

    rafRef.current = requestAnimationFrame(sample);
  }, [canvasRef]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(sample);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [sample]);

  return state;
}

export default useDynamicMaterial;
