// ═══════════════════════════════════════════════════════════════════
// charEdge — Pattern Recognition Drawing Assist (Sprint 17)
//
// Subtle AI assistance for Harmonic patterns, Elliott Waves, and
// Head & Shoulders drawings. Validates ratios, suggests placements,
// and calculates targets. Never forced — just informational overlays.
// ═══════════════════════════════════════════════════════════════════

// ─── Harmonic Pattern Ratios ────────────────────────────────────

interface HarmonicRatios {
  XA_BC: number;
  BC_AB: number;
  XA_CD: number;
  pattern: string;
  valid: boolean;
  quality: 'perfect' | 'acceptable' | 'borderline' | 'invalid';
}

interface Point {
  price: number;
  time: number;
}

/**
 * Known harmonic pattern Fibonacci ratio sets.
 * Each pattern defines expected retracement/extension ratios.
 */
const HARMONIC_PATTERNS: Record<
  string,
  {
    AB_XA: [number, number]; // B retraces XA by this range
    BC_AB: [number, number]; // C retraces AB by this range
    CD_BC: [number, number]; // D extends BC by this range
    CD_XA?: [number, number]; // D retraces XA (alternative measure)
  }
> = {
  Gartley: {
    AB_XA: [0.582, 0.654], // 0.618 ± tolerance
    BC_AB: [0.382, 0.886],
    CD_BC: [1.27, 1.618],
    CD_XA: [0.764, 0.806], // 0.786
  },
  Butterfly: {
    AB_XA: [0.746, 0.826], // 0.786
    BC_AB: [0.382, 0.886],
    CD_BC: [1.618, 2.618],
    CD_XA: [1.27, 1.41],
  },
  Bat: {
    AB_XA: [0.352, 0.45], // 0.382-0.50
    BC_AB: [0.382, 0.886],
    CD_BC: [1.618, 2.618],
    CD_XA: [0.856, 0.906], // 0.886
  },
  Crab: {
    AB_XA: [0.352, 0.654], // 0.382-0.618
    BC_AB: [0.382, 0.886],
    CD_BC: [2.24, 3.618],
    CD_XA: [1.558, 1.678], // 1.618
  },
};

/**
 * Validate a 5-point harmonic pattern (XABCD).
 * Returns the best matching pattern with quality grade.
 */
export function validateHarmonicRatios(points: Point[]): HarmonicRatios | null {
  if (points.length < 4) return null;

  const [X, A, B, C, D] = points;
  if (!X || !A || !B) return null;

  const XA = Math.abs(A.price - X.price);
  const AB = Math.abs(B.price - A.price);
  const BC = C ? Math.abs(C.price - B.price) : 0;
  const CD = D ? Math.abs(D.price - C!.price) : 0;

  if (XA === 0 || AB === 0) return null;

  const abXaRatio = AB / XA;
  const bcAbRatio = BC > 0 ? BC / AB : 0;
  const cdBcRatio = CD > 0 && BC > 0 ? CD / BC : 0;
  const cdXaRatio = CD > 0 ? CD / XA : 0;

  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const [name, ratios] of Object.entries(HARMONIC_PATTERNS)) {
    let score = 0;
    let checks = 0;

    // Check AB/XA retracement
    if (abXaRatio >= ratios.AB_XA[0] && abXaRatio <= ratios.AB_XA[1]) {
      score += 1;
    }
    checks += 1;

    // Check BC/AB retracement (only if C exists)
    if (bcAbRatio > 0) {
      if (bcAbRatio >= ratios.BC_AB[0] && bcAbRatio <= ratios.BC_AB[1]) {
        score += 1;
      }
      checks += 1;
    }

    // Check CD/BC extension (only if D exists)
    if (cdBcRatio > 0) {
      if (cdBcRatio >= ratios.CD_BC[0] && cdBcRatio <= ratios.CD_BC[1]) {
        score += 1;
      }
      checks += 1;

      // Also check CD/XA ratio
      if (ratios.CD_XA && cdXaRatio > 0) {
        if (cdXaRatio >= ratios.CD_XA[0] && cdXaRatio <= ratios.CD_XA[1]) {
          score += 1;
        }
        checks += 1;
      }
    }

    const normalized = checks > 0 ? score / checks : 0;
    if (normalized > bestScore) {
      bestScore = normalized;
      bestMatch = name;
    }
  }

  if (!bestMatch) return null;

  const quality: HarmonicRatios['quality'] =
    bestScore >= 0.9 ? 'perfect' : bestScore >= 0.7 ? 'acceptable' : bestScore >= 0.5 ? 'borderline' : 'invalid';

  return {
    XA_BC: bcAbRatio,
    BC_AB: abXaRatio,
    XA_CD: cdXaRatio,
    pattern: bestMatch,
    valid: bestScore >= 0.5,
    quality,
  };
}

// ─── Elliott Wave Assist ────────────────────────────────────────

interface WaveSuggestion {
  waveNumber: number;
  direction: 'up' | 'down';
  minPrice: number;
  maxPrice: number;
  label: string;
}

/**
 * Given existing wave points, suggest where the next wave endpoint
 * should go based on Elliott Wave rules.
 */
export function suggestElliottWave(
  existingWaves: Point[],
  bars: Array<{ high: number; low: number; time: number }>,
): WaveSuggestion | null {
  if (existingWaves.length < 2 || bars.length === 0) return null;

  const waveCount = existingWaves.length;
  const isUpTrend = existingWaves[1]!.price > existingWaves[0]!.price;
  const nextWaveNum = waveCount; // 0-indexed → next is waveCount

  // Wave rules:
  // Wave 2: retraces 50-78.6% of Wave 1, never goes below Wave 1 start
  // Wave 3: extends 161.8-261.8% of Wave 1, never shortest
  // Wave 4: retraces 23.6-50% of Wave 3, never enters Wave 1 territory
  // Wave 5: extends 100-161.8% of Wave 1 from Wave 4

  const wave1Range = Math.abs(existingWaves[1]!.price - existingWaves[0]!.price);

  switch (nextWaveNum) {
    case 2: {
      // Wave 2 (corrective)
      const retrace50 = isUpTrend
        ? existingWaves[1]!.price - wave1Range * 0.5
        : existingWaves[1]!.price + wave1Range * 0.5;
      const retrace786 = isUpTrend
        ? existingWaves[1]!.price - wave1Range * 0.786
        : existingWaves[1]!.price + wave1Range * 0.786;
      return {
        waveNumber: 2,
        direction: isUpTrend ? 'down' : 'up',
        minPrice: Math.min(retrace50, retrace786),
        maxPrice: Math.max(retrace50, retrace786),
        label: 'Wave 2: 50-78.6% retracement',
      };
    }
    case 3: {
      // Wave 3 (impulse, longest)
      const wave2End = existingWaves[2]!.price;
      const ext1618 = isUpTrend ? wave2End + wave1Range * 1.618 : wave2End - wave1Range * 1.618;
      const ext2618 = isUpTrend ? wave2End + wave1Range * 2.618 : wave2End - wave1Range * 2.618;
      return {
        waveNumber: 3,
        direction: isUpTrend ? 'up' : 'down',
        minPrice: Math.min(ext1618, ext2618),
        maxPrice: Math.max(ext1618, ext2618),
        label: 'Wave 3: 161.8-261.8% extension',
      };
    }
    case 4: {
      // Wave 4 (corrective)
      const wave3Range = existingWaves[3]
        ? Math.abs(existingWaves[3]!.price - existingWaves[2]!.price)
        : wave1Range * 1.618;
      const wave3End = existingWaves[3]?.price ?? existingWaves[2]!.price + (isUpTrend ? wave3Range : -wave3Range);
      const retrace236 = isUpTrend ? wave3End - wave3Range * 0.236 : wave3End + wave3Range * 0.236;
      const retrace50 = isUpTrend ? wave3End - wave3Range * 0.5 : wave3End + wave3Range * 0.5;
      return {
        waveNumber: 4,
        direction: isUpTrend ? 'down' : 'up',
        minPrice: Math.min(retrace236, retrace50),
        maxPrice: Math.max(retrace236, retrace50),
        label: 'Wave 4: 23.6-50% retracement (no Wave 1 overlap)',
      };
    }
    default:
      return null;
  }
}

// ─── Head & Shoulders ───────────────────────────────────────────

interface HSTarget {
  necklinePrice: number;
  targetPrice: number;
  patternHeight: number;
  direction: 'bearish' | 'bullish';
}

/**
 * Calculate Head & Shoulders measured move target.
 * Requires: left shoulder peak, head peak, right shoulder peak, neckline.
 * For inverse H&S, the direction reverses.
 */
export function calculateHSTarget(points: Point[]): HSTarget | null {
  if (points.length < 3) return null;

  // points[0] = left shoulder, points[1] = head, points[2] = right shoulder
  const [ls, head, rs] = points;
  if (!ls || !head || !rs) return null;

  // Simple neckline: average of troughs between shoulders
  // For a standard H&S (bearish), head is highest
  // For inverse H&S (bullish), head is lowest
  const isStandard = head.price > ls.price && head.price > rs.price;
  const necklinePrice = (ls.price + rs.price) / 2;
  const patternHeight = Math.abs(head.price - necklinePrice);

  const targetPrice = isStandard
    ? necklinePrice - patternHeight // Bearish: project down
    : necklinePrice + patternHeight; // Bullish: project up

  return {
    necklinePrice,
    targetPrice,
    patternHeight,
    direction: isStandard ? 'bearish' : 'bullish',
  };
}
