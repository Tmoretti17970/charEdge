// ═══════════════════════════════════════════════════════════════════
// charEdge — AI Orb (Siri-style Gradient Orb)
//
// A unified AI icon used across the entire app. Renders a small
// radial-gradient orb with warm orange → cool blue tones.
// Supports: size, glow, animate (slow pulse), and className.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';

const ORB_ID_COUNTER = { n: 0 };

/** AIOrb — Siri-inspired gradient orb for all AI features. */
export default function AIOrb({
    size = 20,
    glow = false,
    animate = false,
    className = '',
    style = {},
}) {
    // Unique gradient ID to avoid SVG conflicts when multiple orbs are on screen
    const id = React.useMemo(() => `ai-orb-${++ORB_ID_COUNTER.n}`, []);

    const glowSize = size * 1.6;
    const orbFilter = glow ? `drop-shadow(0 0 ${size * 0.3}px rgba(232,100,44,0.35))` : 'none';

    return (
        <span
            className={`ai-orb ${animate ? 'ai-orb-animate' : ''} ${className}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: size,
                height: size,
                flexShrink: 0,
                position: 'relative',
                filter: orbFilter,
                transition: 'filter 0.3s ease, transform 0.3s ease',
                ...style,
            }}
        >
            {/* Ambient glow layer */}
            {glow && (
                <span
                    style={{
                        position: 'absolute',
                        width: glowSize,
                        height: glowSize,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(232,100,44,0.18) 0%, transparent 70%)',
                        pointerEvents: 'none',
                    }}
                />
            )}

            {/* SVG orb */}
            <svg
                width={size}
                height={size}
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ position: 'relative', zIndex: 1 }}
            >
                <defs>
                    {/* Main radial gradient — warm orange center → blue edge */}
                    <radialGradient id={`${id}-main`} cx="0.4" cy="0.35" r="0.65">
                        <stop offset="0%" stopColor="#FF8C42" />
                        <stop offset="40%" stopColor="#E8642C" />
                        <stop offset="70%" stopColor="#8B5CF6" />
                        <stop offset="100%" stopColor="#3B82F6" />
                    </radialGradient>

                    {/* Inner highlight — top-left specular */}
                    <radialGradient id={`${id}-spec`} cx="0.35" cy="0.3" r="0.35">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </radialGradient>

                    {/* Subtle rim light — bottom-right edge glow */}
                    <radialGradient id={`${id}-rim`} cx="0.65" cy="0.7" r="0.4">
                        <stop offset="0%" stopColor="rgba(96,165,250,0.3)" />
                        <stop offset="100%" stopColor="rgba(96,165,250,0)" />
                    </radialGradient>
                </defs>

                {/* Base orb */}
                <circle cx="16" cy="16" r="14" fill={`url(#${id}-main)`} />

                {/* Specular highlight */}
                <circle cx="13" cy="12" r="8" fill={`url(#${id}-spec)`} />

                {/* Rim light */}
                <circle cx="20" cy="21" r="7" fill={`url(#${id}-rim)`} />

                {/* Subtle inner shadow — adds depth */}
                <circle
                    cx="16"
                    cy="16"
                    r="13.5"
                    fill="none"
                    stroke="rgba(0,0,0,0.15)"
                    strokeWidth="1"
                />
            </svg>
        </span>
    );
}

export { AIOrb };
