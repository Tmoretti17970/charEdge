// ═══════════════════════════════════════════════════════════════════
// charEdge — VoiceNoteOverlay (Task 4.2.8)
//
// Recording indicator: pulsing red dot + waveform bar animation.
// Transcription preview after release. Edit before pinning.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { voiceToChart } from '@/ai/VoiceToChart';
import s from './VoiceNoteOverlay.module.css';

export default function VoiceNoteOverlay({ onPin, onClose }) {
    const [phase, setPhase] = useState('idle');
    const [transcript, setTranscript] = useState('');
    const [editText, setEditText] = useState('');
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState(null);
    const [audioBlob, setAudioBlob] = useState(null);
    const timerRef = useRef(null);
    const inputRef = useRef(null);

    const startRecording = useCallback(async () => {
        if (!voiceToChart.isSupported()) { setError('Voice recording not supported in this browser'); return; }
        const started = await voiceToChart.startRecording();
        if (started) {
            setPhase('recording');
            setTranscript('');
            setDuration(0);
            setError(null);
            timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
        } else {
            setError('Could not access microphone');
        }
    }, []);

    const stopRecording = useCallback(async () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        const result = await voiceToChart.stopRecording();
        setTranscript(result.text);
        setEditText(result.text);
        setAudioBlob(result.audioBlob);
        setPhase('preview');
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    useEffect(() => {
        const unsub = voiceToChart.on((type, data) => {
            if (type === 'transcript') setTranscript(data?.text || '');
            if (type === 'error') setError(data?.message || 'Recording error');
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        startRecording();
        return () => { voiceToChart.cancelRecording(); if (timerRef.current) clearInterval(timerRef.current); };
    }, [startRecording]);

    const handlePin = useCallback(() => {
        const text = editText.trim();
        if (!text) return;
        onPin?.({ text, audioBlob, duration, timestamp: Date.now() });
        onClose?.();
    }, [editText, audioBlob, duration, onPin, onClose]);

    const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

    if (error) {
        return (
            <div className={s.backdrop}>
                <div className={s.panel}>
                    <div className={s.errorMsg}>⚠️ {error}</div>
                    <button onClick={onClose} className={s.btnSecondary}>Close</button>
                </div>
            </div>
        );
    }

    return (
        <div className={s.backdrop}>
            <div className={s.panel}>
                {phase === 'recording' && (
                    <>
                        <div className={s.recRow}>
                            <div className={s.recDot} />
                            <span className={s.recLabel}>Recording…</span>
                            <span className={s.recDuration}>{fmtTime(duration)}</span>
                        </div>
                        <div className={s.waveRow}>
                            {Array.from({ length: 20 }, (_, i) => (
                                <div
                                    key={i}
                                    className={s.waveBar}
                                    style={{
                                        height: `${8 + Math.random() * 20}px`,
                                        animation: `waveBar 0.6s ease-in-out ${i * 0.05}s infinite alternate`,
                                    }}
                                />
                            ))}
                        </div>
                        {transcript && (
                            <div className={s.liveTranscript}>"{transcript}"</div>
                        )}
                        <button onClick={stopRecording} className={s.btnPrimary}>⏹ Stop Recording</button>
                    </>
                )}
                {phase === 'preview' && (
                    <>
                        <div className={s.previewTitle}>Edit Note · {fmtTime(duration)}</div>
                        <textarea
                            ref={inputRef}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            placeholder="Type or edit transcription…"
                            rows={3}
                            className={s.editArea}
                        />
                        <div className={s.btnRow}>
                            <button onClick={onClose} className={s.btnSecondary}>Cancel</button>
                            <button onClick={handlePin} disabled={!editText.trim()} className={s.btnPrimary} style={{ opacity: editText.trim() ? 1 : 0.4 }}>
                                📌 Pin to Chart
                            </button>
                        </div>
                    </>
                )}
            </div>
            <style>{`
@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }
@keyframes waveBar { 0% { height: 4px; } 100% { height: 24px; } }
            `}</style>
        </div>
    );
}

export { VoiceNoteOverlay };
