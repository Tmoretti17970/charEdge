// ═══════════════════════════════════════════════════════════════════
// charEdge v10.6 — Quick Journal Panel
// Sprint 10 C10.5: Floating panel on chart to log a trade quickly.
// Pre-fills symbol, entry/exit from chart levels, captures context.
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { captureChartState } from '../../../../charting_library/tools/ChartJournalPipeline.js';
import { C, F, M, EMOJIS } from '../../../../constants.js';
import { useJournalStore } from '../../../../state/useJournalStore';
import { uid } from '../../../../utils.js';
import toast from '../../ui/Toast.jsx';
import css from './QuickJournalPanel.module.css';
import { useChartCoreStore } from '../../../../state/chart/useChartCoreStore';
import { useChartFeaturesStore } from '../../../../state/chart/useChartFeaturesStore';
import { useChartTradeStore } from '../../../../state/chart/useChartTradeStore';

const SIDES = ['long', 'short'];

export default function QuickJournalPanel({ onClose }) {
  const symbol = useChartCoreStore((s) => s.symbol);
  const pendingEntry = useChartTradeStore((s) => s.pendingEntry);
  const pendingSL = useChartTradeStore((s) => s.pendingSL);
  const pendingTP = useChartTradeStore((s) => s.pendingTP);
  const tradeSide = useChartFeaturesStore((s) => s.tradeSide);
  const exitTradeMode = useChartFeaturesStore((s) => s.exitTradeMode);
  const addTrade = useJournalStore((s) => s.addTrade);

  const [form, setForm] = useState({
    side: tradeSide || 'long',
    qty: '',
    pnl: '',
    emotion: '',
    playbook: '',
    notes: '',
    tags: '',
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Auto-calc P&L
  const autoPnl = useMemo(() => {
    if (!pendingEntry?.price || !form.qty) return null;
    const exit = pendingTP?.price || pendingSL?.price;
    if (!exit) return null;
    const qty = Number(form.qty);
    if (!qty) return null;
    const diff = form.side === 'long' ? exit - pendingEntry.price : pendingEntry.price - exit;
    return Math.round(diff * qty * 100) / 100;
  }, [pendingEntry, pendingTP, pendingSL, form.qty, form.side]);

  const handleSubmit = () => {
    const pnl = form.pnl !== '' ? Number(form.pnl) : autoPnl;
    if (pnl == null || isNaN(pnl)) {
      toast.error('Enter P&L or set Entry + Exit levels');
      return;
    }

    const trade = {
      id: uid(),
      symbol: symbol?.toUpperCase() || 'UNKNOWN',
      side: form.side,
      entry: pendingEntry?.price ?? null,
      exit: pendingTP?.price ?? null,
      stopLoss: pendingSL?.price ?? null,
      takeProfit: pendingTP?.price ?? null,
      qty: form.qty ? Number(form.qty) : null,
      pnl,
      date: new Date().toISOString(),
      emotion: form.emotion,
      playbook: form.playbook,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      notes: form.notes.trim(),
      ruleBreak: false,
      screenshots: [],
      _source: 'chart-quick-journal',
      // P2 2.3: Auto-capture chart context for journal entry
      chartContext: (() => {
        try {
          const chartState = useChartCoreStore.getState();
          return captureChartState(chartState);
        } catch { return null; }
      })(),
    };

    addTrade(trade);
    exitTradeMode();
    onClose();
    toast.success(`${trade.symbol} ${trade.side} logged — ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`);
  };

  return (
    <div
      className={css.panel}
      style={{ background: C.bg, border: `1px solid ${C.bd}` }}
    >
      {/* Header */}
      <div className={css.header} style={{ borderBottom: `1px solid ${C.bd}` }}>
        <span className={css.headerTitle} style={{ color: C.t1, fontFamily: F }}>📝 Quick Journal — {symbol}</span>
        <button className={`tf-btn ${css.closeBtn}`} onClick={onClose} style={{ color: C.t3 }}>✕</button>
      </div>

      <div className={css.body}>
        {/* Side */}
        <div className={css.sideToggle}>
          {SIDES.map((s) => (
            <button
              className={`tf-btn ${css.sideBtn}`}
              key={s}
              onClick={() => set('side', s)}
              style={{
                fontFamily: M,
                border: `1px solid ${form.side === s ? (s === 'long' ? C.g : C.r) : C.bd}`,
                background: form.side === s ? (s === 'long' ? C.g + '15' : C.r + '15') : 'transparent',
                color: form.side === s ? (s === 'long' ? C.g : C.r) : C.t3,
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Levels (read-only from chart) */}
        <div className={css.levelGrid}>
          <LevelBadge label="Entry" value={pendingEntry?.price} color={C.info} />
          <LevelBadge label="SL" value={pendingSL?.price} color={C.r} />
          <LevelBadge label="TP" value={pendingTP?.price} color={C.g} />
        </div>

        {/* Qty + P&L */}
        <div className={css.twoCol}>
          <SmallInput label="Qty" value={form.qty} onChange={(v) => set('qty', v)} placeholder="100" type="number" />
          <SmallInput
            label="P&L"
            value={form.pnl}
            onChange={(v) => set('pnl', v)}
            placeholder={autoPnl != null ? autoPnl.toFixed(2) : '0.00'}
            type="number"
          />
        </div>

        {/* Playbook + Emotion */}
        <SmallInput
          label="Strategy"
          value={form.playbook}
          onChange={(v) => set('playbook', v)}
          placeholder="e.g. Breakout"
        />

        {/* Emotion chips */}
        <div className={css.emotionRow}>
          {(
            EMOJIS || [
              { l: 'confident', e: '😎' },
              { l: 'neutral', e: '😐' },
              { l: 'fearful', e: '😰' },
              { l: 'greedy', e: '🤑' },
              { l: 'fomo', e: '😫' },
              { l: 'revenge', e: '😤' },
            ]
          ).map((em) => (
            <button
              className={`tf-btn ${css.emotionBtn}`}
              key={em.l}
              onClick={() => set('emotion', form.emotion === em.l ? '' : em.l)}
              style={{
                border: `1px solid ${form.emotion === em.l ? C.b : C.bd}`,
                background: form.emotion === em.l ? C.b + '15' : 'transparent',
                color: form.emotion === em.l ? C.b : C.t3,
              }}
            >
              {em.e}
            </button>
          ))}
        </div>

        {/* Tags */}
        <SmallInput label="Tags" value={form.tags} onChange={(v) => set('tags', v)} placeholder="comma-separated" />

        {/* Notes */}
        <div className={css.notesWrap}>
          <label className={css.notesLabel} style={{ color: C.t3, fontFamily: M }}>Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Quick notes..."
            rows={2}
            className={css.notesArea}
            style={{ border: `1px solid ${C.bd}`, background: C.sf, color: C.t1, fontFamily: M }}
          />
        </div>

        {/* Submit */}
        <button
          className={`tf-btn ${css.submitBtn}`}
          onClick={handleSubmit}
          style={{ background: C.b, fontFamily: F }}
        >
          Log Trade
        </button>
      </div>
    </div>
  );
}

function LevelBadge({ label, value, color }) {
  return (
    <div
      style={{
        padding: '3px 0',
        textAlign: 'center',
        borderRadius: 4,
        background: value ? color + '10' : C.sf,
        border: `1px solid ${value ? color + '30' : C.bd}`,
      }}
    >
      <div style={{ fontSize: 7, fontWeight: 700, color: C.t3, fontFamily: M }}>{label}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: value ? color : C.t3, fontFamily: M }}>
        {value ? value.toFixed(2) : '—'}
      </div>
    </div>
  );
}

function SmallInput({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <label style={{ fontSize: 8, fontWeight: 600, color: C.t3, fontFamily: M }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '3px 6px',
          fontSize: 10,
          borderRadius: 3,
          border: `1px solid ${C.bd}`,
          background: C.sf,
          color: C.t1,
          fontFamily: M,
          outline: 'none',
        }}
      />
    </div>
  );
}
