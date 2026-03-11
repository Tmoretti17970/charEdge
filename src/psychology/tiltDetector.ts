// ═══════════════════════════════════════════════════════════════════
// charEdge — Tilt Detection Service
//
// Monitors recent trades for tilt patterns:
//   - 3+ consecutive losses
//   - Position size increase after losses
//   - Rapid-fire entries (revenge trading)
//
// Emits severity-based alerts with break recommendations.
// ═══════════════════════════════════════════════════════════════════

export type TiltSeverity = 'none' | 'warning' | 'critical';

export interface TiltSignal {
    severity: TiltSeverity;
    reason: string;
    consecutiveLosses: number;
    sizeIncreased: boolean;
    rapidEntries: boolean;
    suggestedBreakMinutes: number;
    detectedAt: number;
}

export interface Trade {
    pnl: number | null;
    size: number;
    entryDate: string;
    exitDate?: string | null;
}

interface TiltConfig {
    /** Minimum consecutive losses to trigger warning (default: 3) */
    lossThreshold: number;
    /** Minutes between entries to count as "rapid" (default: 5) */
    rapidEntryWindowMinutes: number;
    /** Number of rapid entries to flag (default: 3) */
    rapidEntryCount: number;
    /** Size increase % to flag escalation (default: 50%) */
    sizeIncreasePercent: number;
}

const DEFAULT_CONFIG: TiltConfig = {
    lossThreshold: 3,
    rapidEntryWindowMinutes: 5,
    rapidEntryCount: 3,
    sizeIncreasePercent: 50,
};

/**
 * Analyze recent trades for tilt patterns.
 *
 * @param trades - Trades sorted by entryDate (most recent last)
 * @param config - Detection thresholds
 * @returns TiltSignal with severity and recommendation
 */
export function detectTilt(trades: Trade[], config: Partial<TiltConfig> = {}): TiltSignal {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const now = Date.now();

    if (trades.length < 2) {
        return noTilt(now);
    }

    // Only look at recent closed trades (last 20)
    const recent = trades
        .filter((t) => t.pnl !== null && t.exitDate)
        .slice(-20);

    if (recent.length < 2) {
        return noTilt(now);
    }

    // ── Consecutive losses ────────────────────────────────────
    let consecutiveLosses = 0;
    for (let i = recent.length - 1; i >= 0; i--) {
        if ((recent[i]!.pnl ?? 0) < 0) {
            consecutiveLosses++;
        } else {
            break;
        }
    }

    // ── Size escalation ──────────────────────────────────────
    let sizeIncreased = false;
    if (recent.length >= 3 && consecutiveLosses >= 2) {
        const prevSize = recent[recent.length - 2]!.size;
        const currSize = recent[recent.length - 1]!.size;
        if (prevSize > 0 && currSize > prevSize * (1 + cfg.sizeIncreasePercent / 100)) {
            sizeIncreased = true;
        }
    }

    // ── Rapid-fire entries (revenge trading) ──────────────────
    let rapidEntries = false;
    if (recent.length >= cfg.rapidEntryCount) {
        const lastN = recent.slice(-cfg.rapidEntryCount);
        const entryTimes = lastN.map((t) => new Date(t.entryDate).getTime());
        const span = entryTimes[entryTimes.length - 1]! - entryTimes[0]!;
        const windowMs = cfg.rapidEntryWindowMinutes * 60_000 * cfg.rapidEntryCount;
        if (span < windowMs && span > 0) {
            rapidEntries = true;
        }
    }

    // ── Severity assessment ──────────────────────────────────
    let severity: TiltSeverity = 'none';
    const reasons: string[] = [];

    if (consecutiveLosses >= cfg.lossThreshold) {
        severity = 'warning';
        reasons.push(`${consecutiveLosses} consecutive losses`);
    }

    if (sizeIncreased) {
        severity = 'critical';
        reasons.push('position size increased after losses');
    }

    if (rapidEntries) {
        severity = severity === 'none' ? 'warning' : 'critical';
        reasons.push('rapid-fire entries detected (possible revenge trading)');
    }

    // ── Break recommendation ─────────────────────────────────
    let suggestedBreakMinutes = 0;
    if (severity === 'warning') {
        suggestedBreakMinutes = 15;
    } else if (severity === 'critical') {
        suggestedBreakMinutes = Math.min(60, consecutiveLosses * 10);
    }

    return {
        severity,
        reason: reasons.length > 0 ? reasons.join('; ') : 'No tilt detected',
        consecutiveLosses,
        sizeIncreased,
        rapidEntries,
        suggestedBreakMinutes,
        detectedAt: now,
    };
}

function noTilt(detectedAt: number): TiltSignal {
    return {
        severity: 'none',
        reason: 'No tilt detected',
        consecutiveLosses: 0,
        sizeIncreased: false,
        rapidEntries: false,
        suggestedBreakMinutes: 0,
        detectedAt,
    };
}
