import { logger } from './logger';

// ═══════════════════════════════════════════════════════════════════
// charEdge — Alert Sound Notifications (TypeScript)
//
// Phase 3 Task 3.2.10: Audio alerts for price notifications.
// Phase 2: Converted to TypeScript.
// ═══════════════════════════════════════════════════════════════════

type SoundType = 'price' | 'urgent' | 'info' | 'success' | 'error';

interface TonePreset {
    freq: number[];
    duration: number;
    gap: number;
    repeats: number;
    volume: number;
}

let _ctx: AudioContext | null = null;

/** Lazy-init AudioContext (must be triggered by user gesture) */
function getCtx(): AudioContext | null {
    if (!_ctx) {
        try {
            _ctx = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
        } catch (_) {
            logger.ui.warn('[AlertSounds] Web Audio API not available');
            return null;
        }
    }
    if (_ctx.state === 'suspended') {
        _ctx.resume().catch(() => { });
    }
    return _ctx;
}

// ─── Tone Presets ────────────────────────────────────────────────

const TONES: Record<SoundType, TonePreset> = {
    price: { freq: [880, 1320], duration: 0.12, gap: 0.06, repeats: 2, volume: 0.3 },
    urgent: { freq: [1200, 800, 1200], duration: 0.08, gap: 0.04, repeats: 3, volume: 0.4 },
    info: { freq: [660], duration: 0.15, gap: 0, repeats: 1, volume: 0.2 },
    success: { freq: [523, 784], duration: 0.1, gap: 0.05, repeats: 1, volume: 0.25 },
    error: { freq: [440, 330], duration: 0.15, gap: 0.05, repeats: 1, volume: 0.3 },
};

// ─── Playback ────────────────────────────────────────────────────

/**
 * Play an alert sound using the Web Audio API.
 */
export function playAlertSound(type: SoundType = 'price', volumeScale: number = 1): void {
    const ctx = getCtx();
    if (!ctx) return;

    const tone = TONES[type] || TONES.price;
    const { freq, duration, gap, repeats, volume } = tone;
    const masterVol = Math.max(0, Math.min(1, volume * volumeScale));

    let offset = ctx.currentTime + 0.01;

    for (let r = 0; r < repeats; r++) {
        for (let i = 0; i < freq.length; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.value = freq[i]!;

            gain.gain.setValueAtTime(0, offset);
            gain.gain.linearRampToValueAtTime(masterVol, offset + 0.005);
            gain.gain.setValueAtTime(masterVol, offset + duration - 0.01);
            gain.gain.linearRampToValueAtTime(0, offset + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(offset);
            osc.stop(offset + duration);

            offset += duration + gap;
        }
        offset += gap;
    }
}

/**
 * Check if audio is available and ready.
 */
export function isAudioAvailable(): boolean {
    return typeof AudioContext !== 'undefined' || typeof (window as Window & { webkitAudioContext?: unknown }).webkitAudioContext !== 'undefined';
}

/**
 * Resume audio context (call after user interaction).
 */
export function resumeAudio(): void {
    const ctx = getCtx();
    if (ctx?.state === 'suspended') ctx.resume();
}

export default { playAlertSound, isAudioAvailable, resumeAudio };
