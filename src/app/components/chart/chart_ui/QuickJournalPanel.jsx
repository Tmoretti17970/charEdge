// ═══════════════════════════════════════════════════════════════════
// charEdge v10.6 — Quick Journal Panel
// Sprint 10 C10.5: Floating panel on chart to log a trade quickly.
// Pre-fills symbol, entry/exit from chart levels, captures context.
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { captureChartState } from '../../../../charting_library/tools/ChartJournalPipeline.js';
import { captureChartScreenshot } from '../../../../hooks/useAutoScreenshot.js';
import { useChartCoreStore } from '../../../../state/chart/useChartCoreStore';
import { useChartFeaturesStore } from '../../../../state/chart/useChartFeaturesStore';
import { useChartTradeStore } from '../../../../state/chart/useChartTradeStore';
import { useJournalStore } from '../../../../state/useJournalStore';
import { uid } from '../../../../utils.js';
import toast from '../../ui/Toast.jsx';
import s from './QuickJournalPanel.module.css';
import { EMOJIS } from '@/constants.js';

const SIDES = ['long', 'short'];

export default function QuickJournalPanel({ onClose }) {
  const symbol = useChartCoreStore((st) => st.symbol);
  const pendingEntry = useChartTradeStore((st) => st.pendingEntry);
  const pendingSL = useChartTradeStore((st) => st.pendingSL);
  const pendingTP = useChartTradeStore((st) => st.pendingTP);
  const tradeSide = useChartFeaturesStore((st) => st.tradeSide);
  const exitTradeMode = useChartFeaturesStore((st) => st.exitTradeMode);
  const addTrade = useJournalStore((st) => st.addTrade);

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
      screenshots: (() => {
        try {
          const chartState = useChartCoreStore.getState();
          const shot = captureChartScreenshot(chartState.symbol, chartState.tf);
          return shot ? [shot] : [];
        } catch {
          return [];
        }
      })(),
      _source: 'chart-quick-journal',
      chartContext: (() => {
        try {
          const chartState = useChartCoreStore.getState();
          return captureChartState(chartState);
        } catch {
          return null;
        }
      })(),
    };

    addTrade(trade);
    exitTradeMode();
    onClose();
    toast.success(`${trade.symbol} ${trade.side} logged — ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`);
  };

  return (
    <div className={s.panel}>
      {/* Header */}
      <div className={s.header}>
        <span className={s.headerTitle}>📝 Quick Journal — {symbol}</span>
        <button className={s.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>

      <div className={s.body}>
        {/* Side */}
        <div className={s.sideToggle}>
          {SIDES.map((side) => (
            <button
              className={s.sideBtn}
              key={side}
              onClick={() => set('side', side)}
              data-active={form.side === side || undefined}
              data-side={side}
            >
              {side}
            </button>
          ))}
        </div>

        {/* Levels (read-only from chart) */}
        <div className={s.levelGrid}>
          <LevelBadge label="Entry" value={pendingEntry?.price} color="var(--tf-info)" />
          <LevelBadge label="SL" value={pendingSL?.price} color="var(--tf-red)" />
          <LevelBadge label="TP" value={pendingTP?.price} color="var(--tf-green)" />
        </div>

        {/* Qty + P&L */}
        <div className={s.twoCol}>
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
        <div className={s.emotionRow}>
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
              className={s.emotionBtn}
              key={em.l}
              onClick={() => set('emotion', form.emotion === em.l ? '' : em.l)}
              data-active={form.emotion === em.l || undefined}
            >
              {em.e}
            </button>
          ))}
        </div>

        {/* Tags */}
        <SmallInput label="Tags" value={form.tags} onChange={(v) => set('tags', v)} placeholder="comma-separated" />

        {/* Notes */}
        <div className={s.notesWrap}>
          <label className={s.notesLabel}>Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Quick notes..."
            rows={2}
            className={s.notesArea}
          />
        </div>

        {/* Submit */}
        <button className={s.submitBtn} onClick={handleSubmit}>
          Log Trade
        </button>
      </div>
    </div>
  );
}

function LevelBadge({ label, value, color }) {
  return (
    <div className={s.levelBadge} style={{ '--level-color': color }} data-has-value={!!value || undefined}>
      <div className={s.levelBadgeLabel}>{label}</div>
      <div className={s.levelBadgeValue} data-has-value={!!value || undefined}>
        {value ? value.toFixed(2) : '—'}
      </div>
    </div>
  );
}

function SmallInput({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div className={s.smallInputWrap}>
      <label className={s.smallInputLabel}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={s.smallInput}
      />
    </div>
  );
}
