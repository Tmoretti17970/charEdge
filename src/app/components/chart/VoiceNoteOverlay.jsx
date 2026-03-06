// ═══════════════════════════════════════════════════════════════════
// charEdge — VoiceNoteOverlay (Task 4.2.8)
//
// Recording indicator: pulsing red dot + waveform bar animation.
// Transcription preview after release. Edit before pinning.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { voiceToChart } from '../../../intelligence/VoiceToChart.ts';

const FONT = 'var(--forge-font, Inter, sans-serif)';
const MONO = 'var(--forge-mono, "JetBrains Mono", monospace)';

// ─── Component ──────────────────────────────────────────────────

export default function VoiceNoteOverlay({ onPin, onClose }) {
    const [phase, setPhase] = useState('idle'); // idle | recording | preview
    const [transcript, setTranscript] = useState('');
    const [editText, setEditText] = useState('');
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState(null);
    const [audioBlob, setAudioBlob] = useState(null);
    const timerRef = useRef(null);
    const inputRef = useRef(null);

    // Start recording on mount or key press
    const startRecording = useCallback(async () => {
        if (!voiceToChart.isSupported()) {
            setError('Voice recording not supported in this browser');
            return;
        }

        const started = await voiceToChart.startRecording();
        if (started) {
            setPhase('recording');
            setTranscript('');
            setDuration(0);
            setError(null);

            // Duration counter
            timerRef.current = setInterval(() => {
                setDuration((d) => d + 1);
            }, 1000);
        } else {
            setError('Could not access microphone');
        }
    }, []);

    // Stop recording
    const stopRecording = useCallback(async () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        const result = await voiceToChart.stopRecording();
        setTranscript(result.text);
        setEditText(result.text);
        setAudioBlob(result.audioBlob);
        setPhase('preview');
        // Focus the edit input
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    // Listen for transcript updates
    useEffect(() => {
        const unsub = voiceToChart.on((type, data) => {
            if (type === 'transcript') {
                setTranscript(data?.text || '');
            }
            if (type === 'error') {
                setError(data?.message || 'Recording error');
            }
        });
        return () => unsub();
    }, []);

    // Auto-start recording
    useEffect(() => {
        startRecording();
        return () => {
            voiceToChart.cancelRecording();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [startRecording]);

    // Handle pin
    const handlePin = useCallback(() => {
        const text = editText.trim();
        if (!text) return;
        onPin?.({ text, audioBlob, duration, timestamp: Date.now() });
        onClose?.();
    }, [editText, audioBlob, duration, onPin, onClose]);

    // Format seconds
    const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    // Error state
    if (error) {
        return (
            <div style={OVERLAY}>
                <div style={PANEL}>
                    <div style={{ color: '#f87171', fontSize: 13, fontFamily: FONT, textAlign: 'center' }}>
                        ⚠️ {error}
                    </div>
                    <button onClick={onClose} style={BTN_SECONDARY}>Close</button>
                </div>
            </div>
        );
    }

    return (
        <div style={OVERLAY}>
            <div style={PANEL}>
                {phase === 'recording' && (
                    <>
                        {/* Recording indicator */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{
                                width: 10, height: 10, borderRadius: '50%', background: '#ef4444',
                                animation: 'pulse 1.2s ease-in-out infinite',
                                boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)',
                            }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#f87171', fontFamily: FONT }}>
                                Recording…
                            </span>
                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
                                {fmtTime(duration)}
                            </span>
                        </div>

                        {/* Waveform animation */}
                        <div style={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'center', height: 32, marginBottom: 12 }}>
                            {Array.from({ length: 20 }, (_, i) => (
                                <div key={i} style={{
                                    width: 3, borderRadius: 2,
                                    background: 'rgba(239, 68, 68, 0.5)',
                                    height: `${8 + Math.random() * 20}px`,
                                    animation: `waveBar 0.6s ease-in-out ${i * 0.05}s infinite alternate`,
                                }} />
                            ))}
                        </div>

                        {/* Live transcript */}
                        {transcript && (
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontFamily: FONT, fontStyle: 'italic', textAlign: 'center', marginBottom: 8 }}>
                                "{transcript}"
                            </div>
                        )}

                        <button onClick={stopRecording} style={BTN_PRIMARY}>
                            ⏹ Stop Recording
                        </button>
                    </>
                )}

                {phase === 'preview' && (
                    <>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, fontFamily: FONT }}>
                            Edit Note · {fmtTime(duration)}
                        </div>

                        <textarea
                            ref={inputRef}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            placeholder="Type or edit transcription…"
                            rows={3}
                            style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 8,
                                color: 'rgba(255,255,255,0.9)',
                                fontFamily: FONT,
                                fontSize: 13,
                                padding: '8px 12px',
                                resize: 'vertical',
                                outline: 'none',
                                marginBottom: 12,
                                lineHeight: 1.5,
                                boxSizing: 'border-box',
                            }}
                        />

                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={onClose} style={BTN_SECONDARY}>Cancel</button>
                            <button onClick={handlePin} disabled={!editText.trim()} style={{ ...BTN_PRIMARY, opacity: editText.trim() ? 1 : 0.4 }}>
                                📌 Pin to Chart
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* CSS animations */}
            <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes waveBar {
          0% { height: 4px; }
          100% { height: 24px; }
        }
      `}</style>
        </div>
    );
}

// ─── Styles ─────────────────────────────────────────────────────

const OVERLAY = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9998,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '15%',
    background: 'rgba(0, 0, 0, 0.3)',
    backdropFilter: 'blur(4px)',
};

const PANEL = {
    background: 'rgba(20, 20, 30, 0.95)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: '20px 24px',
    width: 340,
    maxWidth: '90%',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
};

const BTN_PRIMARY = {
    flex: 1,
    padding: '8px 16px',
    borderRadius: 8,
    background: 'rgba(96, 165, 250, 0.15)',
    border: '1px solid rgba(96, 165, 250, 0.3)',
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'var(--forge-font, Inter, sans-serif)',
    cursor: 'pointer',
    transition: 'background 0.15s',
};

const BTN_SECONDARY = {
    flex: 1,
    padding: '8px 16px',
    borderRadius: 8,
    background: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'var(--forge-font, Inter, sans-serif)',
    cursor: 'pointer',
};

export { VoiceNoteOverlay };
