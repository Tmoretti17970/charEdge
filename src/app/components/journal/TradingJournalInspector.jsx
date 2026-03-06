// ═══════════════════════════════════════════════════════════════════
// charEdge — Trading Journal Inspector (Liquid Glass)
//
// §4.12: Modeless trailing inspector with psychological dimension
// tracking, confluence badges, trigger logging, and Liquid Glass
// material. Floats above the chart without pushing content.
//
// Features:
//   4.12.3  — Modeless trailing inspector
//   4.12.4  — Integration triggers (logbook, chart, QuickJournal)
//   4.12.5  — Psychological sliders (FOMO/Impulse/Clarity)
//   4.12.6  — Pre/Post mood capture + Emotional Drift
//   4.12.7  — Confluence badge cloud
//   4.12.8  — Specular rim (CSS)
//   4.12.9  — SVG refraction filter (CSS)
//   4.12.10 — Adaptive P&L tint (CSS)
//   4.12.11 — Trigger logging UI
//   4.12.14 — Accessibility fallback (CSS)
//   4.12.17 — Financial typography (CSS)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { C } from '../../../constants/theme.js';
import { EMOJIS } from '../../../constants/chart.js';
import css from './TradingJournalInspector.module.css';

// ─── Preset Data ────────────────────────────────────────────────

const CONFLUENCE_OPTIONS = [
    { id: 'vwap', label: 'VWAP', icon: '📊' },
    { id: 'snr', label: 'S/R', icon: '📐' },
    { id: 'news', label: 'News', icon: '📰' },
    { id: 'level2', label: 'Level 2', icon: '📋' },
    { id: 'ma_cross', label: 'MA Cross', icon: '✖️' },
    { id: 'supply_demand', label: 'Supply/Demand', icon: '⚖️' },
    { id: 'fibonacci', label: 'Fibonacci', icon: '🌀' },
    { id: 'volume', label: 'Volume', icon: '📶' },
    { id: 'divergence', label: 'Divergence', icon: '↗️' },
    { id: 'breakout', label: 'Breakout', icon: '💥' },
];

const TRIGGER_OPTIONS = [
    { id: 'fatigue', label: 'Fatigue', icon: '😴' },
    { id: 'social_media', label: 'Social Media', icon: '📱' },
    { id: 'drawdown_streak', label: 'Drawdown Streak', icon: '📉' },
    { id: 'overtrading', label: 'Overtrading', icon: '🔄' },
    { id: 'no_plan', label: 'No Plan', icon: '🚫' },
    { id: 'external_stress', label: 'External Stress', icon: '😤' },
    { id: 'lack_of_sleep', label: 'Lack of Sleep', icon: '🌙' },
    { id: 'fomo', label: 'FOMO', icon: '😱' },
    { id: 'revenge', label: 'Revenge Trading', icon: '🔥' },
];

const DEFAULT_EMOTIONS = EMOJIS || [
    { l: 'confident', e: '😎' },
    { l: 'neutral', e: '😐' },
    { l: 'focused', e: '🎯' },
    { l: 'anxious', e: '😰' },
    { l: 'frustrated', e: '😤' },
    { l: 'calm', e: '🧘' },
];

// ─── Slider Component ───────────────────────────────────────────

function PsychSlider({ icon, label, value, onChange, color }) {
    const trackRef = useRef(null);
    const fill = value ? ((value - 1) / 9) * 100 : 0;

    const handleInteraction = useCallback((e) => {
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        const x = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        const val = Math.round(pct * 9) + 1;
        onChange(val);
    }, [onChange]);

    const handleMouseDown = useCallback((e) => {
        handleInteraction(e);
        const onMove = (ev) => handleInteraction(ev);
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [handleInteraction]);

    return (
        <div className={css.sliderRow}>
            <div className={css.sliderIcon}>{icon}</div>
            <span className={css.sliderLabel}>{label}</span>
            <div
                className={css.sliderTrack}
                ref={trackRef}
                onMouseDown={handleMouseDown}
                onTouchStart={handleInteraction}
                onTouchMove={handleInteraction}
                style={{ '--slider-color': color, '--slider-fill': `${fill}%` }}
                role="slider"
                aria-valuenow={value || 0}
                aria-valuemin={1}
                aria-valuemax={10}
                aria-label={label}
                tabIndex={0}
            >
                <div className={css.sliderTrackInner}>
                    {value && <div className={css.sliderThumb} style={{ '--slider-fill': `${fill}%`, '--slider-color': color }} />}
                </div>
            </div>
            <span className={css.sliderValue} style={{ color: value ? color : C.t3 }}>
                {value || '—'}
            </span>
        </div>
    );
}

// ─── SVG Refraction Filter (injected once) ──────────────────────

function RefractionSVG() {
    return (
        <svg width="0" height="0" style={{ position: 'absolute' }}>
            <defs>
                <filter id="liquidRefraction">
                    <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="3" result="noise" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" />
                </filter>
            </defs>
        </svg>
    );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function TradingJournalInspector({ trade, isOpen, onClose, onSave = null }) {
    const updateTrade = useJournalStore((s) => s.updateTrade);

    // ─── Local form state ──────────────────────────────────────────
    const [form, setForm] = useState({
        emotion: '',
        notes: '',
        rating: null,
        fomo: null,
        impulse: null,
        clarity: null,
        preMood: null,
        postMood: null,
        confluences: [],
        triggers: [],
        tags: '',
    });

    // Hydrate form from trade when it changes
    useEffect(() => {
        if (!trade) return;
        setForm({
            emotion: trade.emotion || '',
            notes: trade.notes || '',
            rating: trade.rating || null,
            fomo: trade.fomo || null,
            impulse: trade.impulse || null,
            clarity: trade.clarity || null,
            preMood: trade.preMood || null,
            postMood: trade.postMood || null,
            confluences: trade.confluences || [],
            triggers: trade.triggers || [],
            tags: (trade.tags || []).join(', '),
        });
    }, [trade]);

    // ─── Closing animation ────────────────────────────────────────
    const [closing, setClosing] = useState(false);

    const handleClose = useCallback(() => {
        setClosing(true);
        setTimeout(() => {
            setClosing(false);
            onClose();
        }, 250);
    }, [onClose]);

    // Escape key support
    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e) => {
            if (e.key === 'Escape') handleClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, handleClose]);

    // ─── Helpers ───────────────────────────────────────────────────

    const set = useCallback((k, v) => setForm((f) => ({ ...f, [k]: v })), []);

    const toggleInArray = useCallback((key, id) => {
        setForm((f) => ({
            ...f,
            [key]: f[key].includes(id)
                ? f[key].filter((x) => x !== id)
                : [...f[key], id],
        }));
    }, []);

    // ─── Emotional Drift (4.12.6) ─────────────────────────────────
    const emotionalDrift = useMemo(() => {
        if (form.preMood == null || form.postMood == null) return null;
        return form.postMood - form.preMood;
    }, [form.preMood, form.postMood]);

    // ─── P&L tint classification ──────────────────────────────────
    const pnlTint = useMemo(() => {
        if (!trade) return '';
        if (trade.pnl > 0) return css.profitTint;
        if (trade.pnl < 0) return css.lossTint;
        return '';
    }, [trade]);

    // ─── Save handler ─────────────────────────────────────────────
    const handleSave = useCallback(() => {
        if (!trade) return;
        const update = {
            ...trade,
            emotion: form.emotion,
            notes: form.notes.trim(),
            rating: form.rating,
            fomo: form.fomo,
            impulse: form.impulse,
            clarity: form.clarity,
            preMood: form.preMood,
            postMood: form.postMood,
            confluences: form.confluences,
            triggers: form.triggers,
            tags: form.tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
        };
        if (updateTrade) {
            updateTrade(trade.id, update);
        }
        if (typeof onSave === 'function') onSave(update);
        handleClose();
    }, [trade, form, updateTrade, onSave, handleClose]);

    // ─── Don't render when closed ─────────────────────────────────
    if (!isOpen && !closing) return null;

    const pnl = trade?.pnl ?? 0;
    const pnlStr = `${pnl >= 0 ? '+' : ''}$${Math.abs(pnl).toFixed(2)}`;

    return (
        <>
            <RefractionSVG />
            <div
                className={`${css.inspector} ${isOpen && !closing ? css.open : ''} ${closing ? css.closing : ''} ${pnlTint}`}
                role="complementary"
                aria-label="Trade Journal Inspector"
                data-testid="journal-inspector"
            >
                {/* Refraction layer (visual-only) */}
                <div className={css.refractionLayer} aria-hidden="true" />

                {/* ─── Header ─────────────────────────────────── */}
                <div className={css.header}>
                    <div className={css.headerLeft}>
                        <span className={css.symbol}>{trade?.symbol || '—'}</span>
                        {trade?.side && (
                            <span className={`${css.sideBadge} ${css[trade.side]}`}>
                                {trade.side}
                            </span>
                        )}
                        <span className={`${css.pnlBadge} ${pnl >= 0 ? css.positive : css.negative}`}>
                            {pnlStr}
                        </span>
                    </div>
                    <button className={css.doneBtn} onClick={handleClose}>Done</button>
                </div>

                {/* ─── Scrollable Body ────────────────────────── */}
                <div className={css.body}>
                    {/* ═══ Psychological Dimensions ═══ */}
                    <div className={css.sectionLabel}>Psychological State</div>
                    <div className={css.sliderGroup}>
                        <PsychSlider
                            icon="🧠" label="FOMO" value={form.fomo}
                            onChange={(v) => set('fomo', v)} color="#f472b6"
                        />
                        <PsychSlider
                            icon="⏱" label="Impulse" value={form.impulse}
                            onChange={(v) => set('impulse', v)} color="#e8642c"
                        />
                        <PsychSlider
                            icon="👁" label="Clarity" value={form.clarity}
                            onChange={(v) => set('clarity', v)} color="#22d3ee"
                        />
                    </div>

                    {/* ═══ Pre/Post Mood ═══ */}
                    <div className={css.sectionLabel}>Emotional Drift</div>
                    <div className={css.moodRow}>
                        <PsychSlider
                            icon="😶" label="Pre" value={form.preMood}
                            onChange={(v) => set('preMood', v)} color="#a78bfa"
                        />
                        <div
                            className={`${css.moodDelta} ${emotionalDrift > 0 ? css.positive
                                : emotionalDrift < 0 ? css.negative
                                    : css.neutral
                                }`}
                        >
                            {emotionalDrift != null
                                ? `${emotionalDrift > 0 ? '+' : ''}${emotionalDrift}`
                                : '—'}
                        </div>
                        <PsychSlider
                            icon="😌" label="Post" value={form.postMood}
                            onChange={(v) => set('postMood', v)} color="#a78bfa"
                        />
                    </div>

                    {/* ═══ Emotion Chips ═══ */}
                    <div className={css.sectionLabel}>Emotion</div>
                    <div className={css.emotionRow}>
                        {DEFAULT_EMOTIONS.map((em) => (
                            <button
                                key={em.l}
                                className={`${css.emotionBtn} ${form.emotion === em.l ? css.active : ''}`}
                                onClick={() => set('emotion', form.emotion === em.l ? '' : em.l)}
                                title={em.l}
                                aria-pressed={form.emotion === em.l}
                            >
                                {em.e}
                            </button>
                        ))}
                    </div>

                    {/* ═══ Technical Confluences ═══ */}
                    <div className={css.sectionLabel}>Confluences</div>
                    <div className={css.badgeCloud}>
                        {CONFLUENCE_OPTIONS.map((c) => (
                            <button
                                key={c.id}
                                className={`${css.badge} ${form.confluences.includes(c.id) ? css.active : ''}`}
                                onClick={() => toggleInArray('confluences', c.id)}
                                aria-pressed={form.confluences.includes(c.id)}
                            >
                                <span>{c.icon}</span> {c.label}
                            </button>
                        ))}
                    </div>

                    {/* ═══ Triggers ═══ */}
                    <div className={css.sectionLabel}>Active Triggers</div>
                    <div className={css.triggerGrid}>
                        {TRIGGER_OPTIONS.map((t) => (
                            <button
                                key={t.id}
                                className={`${css.triggerChip} ${form.triggers.includes(t.id) ? css.active : ''}`}
                                onClick={() => toggleInArray('triggers', t.id)}
                                aria-pressed={form.triggers.includes(t.id)}
                            >
                                <span>{t.icon}</span> {t.label}
                            </button>
                        ))}
                    </div>

                    {/* ═══ Execution Notes ═══ */}
                    <div className={css.sectionLabel}>Execution Notes</div>
                    <textarea
                        className={css.notesArea}
                        value={form.notes}
                        onChange={(e) => set('notes', e.target.value)}
                        placeholder="What was your thought process? What did you observe?"
                        rows={4}
                    />

                    {/* ═══ Tags ═══ */}
                    <div className={css.sectionLabel}>Tags</div>
                    <input
                        className={css.tagsInput}
                        type="text"
                        value={form.tags}
                        onChange={(e) => set('tags', e.target.value)}
                        placeholder="comma-separated tags"
                    />

                    {/* ═══ Save ═══ */}
                    <button className={css.saveBtn} onClick={handleSave}>
                        Save Journal Entry
                    </button>
                </div>
            </div>
        </>
    );
}
