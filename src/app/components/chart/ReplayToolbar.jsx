// ═══════════════════════════════════════════════════════════════════
// charEdge — Replay Toolbar
//
// Floating control bar for chart replay mode.
// Shows: Play/Pause, Stop, Step Forward, Speed selector, Progress bar.
// Uses glass-panel styling consistent with the Trading Journal Inspector.
//
// Tasks: 3.4.1 (bar-by-bar), 3.4.2 (hide future), 3.4.4 (speed controls)
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { C, F, M } from '../../../constants.js';
import { space, radii, text, transition } from '../../../theme/tokens.js';

const SPEEDS = [
    { label: '1x', value: 1 },
    { label: '2x', value: 2 },
    { label: '5x', value: 5 },
    { label: '10x', value: 10 },
];

export default function ReplayToolbar({
    replayState = 'idle',
    currentIndex = 0,
    totalBars = 0,
    speed = 1,
    onPlay,
    onPause,
    onStop,
    onStep,
    onSpeedChange,
    onSeek,
}) {
    if (replayState === 'idle' || replayState === 'stopped') return null;

    const progress = totalBars > 0 ? (currentIndex / (totalBars - 1)) * 100 : 0;
    const isPlaying = replayState === 'playing';
    const isLoading = replayState === 'loading';

    return (
        <div
            className="replay-toolbar"
            style={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                background: 'rgba(15, 17, 28, 0.85)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                borderRadius: 12,
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                zIndex: 50,
                userSelect: 'none',
                minWidth: 360,
            }}
        >
            {/* Replay badge */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                background: 'rgba(239, 68, 68, 0.15)',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 700,
                fontFamily: F,
                color: '#ef4444',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
            }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: isPlaying ? 'pulse 1.5s infinite' : 'none' }} />
                REPLAY
            </div>

            {/* Play/Pause */}
            <ToolbarButton
                onClick={isPlaying ? onPause : onPlay}
                disabled={isLoading}
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                active={isPlaying}
            >
                {isLoading ? '⏳' : isPlaying ? '⏸' : '▶️'}
            </ToolbarButton>

            {/* Step Forward */}
            <ToolbarButton
                onClick={onStep}
                disabled={isLoading || isPlaying}
                title="Step Forward (→)"
            >
                ⏭
            </ToolbarButton>

            {/* Stop */}
            <ToolbarButton
                onClick={onStop}
                disabled={isLoading}
                title="Stop Replay (Esc)"
            >
                ⏹
            </ToolbarButton>

            {/* Divider */}
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />

            {/* Speed selector */}
            <div style={{ display: 'flex', gap: 2 }}>
                {SPEEDS.map((s) => (
                    <button
                        key={s.value}
                        onClick={() => onSpeedChange?.(s.value)}
                        style={{
                            padding: '3px 8px',
                            background: speed === s.value ? C.b + '25' : 'transparent',
                            border: `1px solid ${speed === s.value ? C.b + '50' : 'transparent'}`,
                            borderRadius: 4,
                            color: speed === s.value ? C.b : C.t3,
                            fontSize: 10,
                            fontWeight: speed === s.value ? 700 : 500,
                            fontFamily: M,
                            cursor: 'pointer',
                            transition: `all ${transition.fast}`,
                        }}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Divider */}
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />

            {/* Progress bar */}
            <div style={{ flex: 1, minWidth: 60, position: 'relative', height: 6, cursor: 'pointer' }}
                onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const targetIndex = Math.round(pct * (totalBars - 1));
                    onSeek?.(targetIndex);
                }}
            >
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: 3,
                }} />
                <div style={{
                    position: 'absolute', top: 0, left: 0, bottom: 0,
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${C.b}, #f0b64e)`,
                    borderRadius: 3,
                    transition: isPlaying ? 'width 0.15s linear' : 'width 0.05s linear',
                }} />
            </div>

            {/* Bar count */}
            <span style={{
                fontSize: 10,
                fontFamily: M,
                color: C.t3,
                minWidth: 65,
                textAlign: 'right',
            }}>
                {currentIndex + 1} / {totalBars}
            </span>
        </div>
    );
}

// ─── Toolbar Button ─────────────────────────────────────────────

function ToolbarButton({ children, onClick, disabled, title, active }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: active ? 'rgba(239, 176, 51, 0.1)' : 'transparent',
                border: '1px solid transparent',
                borderRadius: 6,
                color: C.t1,
                fontSize: 14,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.4 : 1,
                transition: `all ${transition.fast}`,
            }}
        >
            {children}
        </button>
    );
}
