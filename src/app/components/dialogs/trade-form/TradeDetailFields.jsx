// ═══════════════════════════════════════════════════════════════════
// TradeDetailFields — The "More Details" collapsible section
// Extracted from TradeFormModal for manageability.
// ═══════════════════════════════════════════════════════════════════

import { C, F, EMOJIS } from '@/constants.js';
import { TradeChecklistPanel, TradeNotesEditor } from '../../../features/journal/journal_ui/JournalEvolution.jsx';
import { inputStyle } from '../../ui/UIKit.jsx';
import Field from './Field.jsx';
import { ASSET_CLASSES } from './tradeConstants.js';

const STRATEGY_COLORS = {
  'Trend Following': '#00D4AA',
  'Mean Reversion': '#7B61FF',
  Breakout: '#FF9F43',
  Scalp: '#FF453A',
  Momentum: '#00A3FF',
  Swing: '#10B981',
  'Gap Fill': '#F59E0B',
  Fade: '#EC4899',
};

const DEFAULT_STRATEGIES = ['Trend Following', 'Mean Reversion', 'Breakout', 'Scalp'];

/**
 * Renders the expanded "More Details" section of the trade form.
 * Includes asset class, qty/entry/exit, close date/fees/R, emotion,
 * playbook/tags, checklist, notes, screenshots, and rule-break toggle.
 *
 * @param {{ form, set, autoCalcPnl, autoCalcR, playbooks, tradeTemplates, activeTemplateId, checklistState, setChecklistState }} props
 */
export default function TradeDetailFields({
  form,
  set,
  autoCalcPnl,
  autoCalcR,
  playbooks,
  tradeTemplates,
  activeTemplateId,
  checklistState,
  setChecklistState,
  screenshotUploadSection,
}) {
  return (
    <div style={{ animation: 'tfSubTabsIn 0.2s ease forwards' }}>
      {/* Asset Class */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 12 }}>
        <Field label="Asset Class">
          <select
            value={form.assetClass}
            onChange={(e) => set('assetClass', e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {ASSET_CLASSES.map((ac) => (
              <option key={ac} value={ac}>
                {ac}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Qty + Entry + Exit + Stop Loss */}
      <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <Field label="Qty">
          <input
            type="number"
            value={form.qty}
            onChange={(e) => set('qty', e.target.value)}
            onBlur={autoCalcPnl}
            placeholder="1"
            style={inputStyle}
          />
        </Field>
        <Field label="Entry">
          <input
            type="number"
            value={form.entry}
            onChange={(e) => set('entry', e.target.value)}
            onBlur={autoCalcR}
            placeholder="0.00"
            step="0.01"
            style={inputStyle}
          />
        </Field>
        <Field label="Exit">
          <input
            type="number"
            value={form.exit}
            onChange={(e) => set('exit', e.target.value)}
            onBlur={autoCalcR}
            placeholder="0.00"
            step="0.01"
            style={inputStyle}
          />
        </Field>
        <Field label="Stop Loss">
          <input
            type="number"
            value={form.stopLoss}
            onChange={(e) => set('stopLoss', e.target.value)}
            onBlur={autoCalcR}
            placeholder="0.00"
            step="0.01"
            style={inputStyle}
          />
        </Field>
      </div>

      {/* Close Date + Fees + R-Multiple */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 8, marginBottom: 12 }}>
        <Field label="Exit Date & Time">
          <input
            type="datetime-local"
            value={form.closeDate}
            onChange={(e) => set('closeDate', e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Fees">
          <input
            type="number"
            value={form.fees}
            onChange={(e) => set('fees', e.target.value)}
            placeholder="0"
            step="0.01"
            style={inputStyle}
          />
        </Field>
        <Field label="R-Multiple">
          <input
            type="number"
            value={form.rMultiple}
            onChange={(e) => set('rMultiple', e.target.value)}
            placeholder="0.0"
            step="0.1"
            style={inputStyle}
          />
        </Field>
      </div>

      {/* ─── Emotion Picker ──────────────────────────────── */}
      <Field label="Emotion" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {EMOJIS.map((e) => (
            <button
              className="tf-btn"
              key={e.l}
              onClick={() => set('emotion', form.emotion === e.l ? '' : e.l)}
              title={e.l}
              style={{
                padding: '5px 8px',
                borderRadius: 6,
                border: `1px solid ${form.emotion === e.l ? C.b : C.bd}`,
                background: form.emotion === e.l ? C.b + '20' : 'transparent',
                fontSize: 11,
                cursor: 'pointer',
                color: form.emotion === e.l ? C.t1 : C.t3,
              }}
            >
              {e.e} {e.l}
            </button>
          ))}
        </div>
      </Field>

      {/* ─── Playbook + Tags ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <Field label="Playbook / Strategy">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 30, alignItems: 'center' }}>
            {(playbooks.length > 0 ? playbooks : DEFAULT_STRATEGIES).map((pb) => {
              const name = pb.name || pb;
              const isActive = form.playbook === name;
              const color = STRATEGY_COLORS[name] || '#9CA3AF';
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => set('playbook', isActive ? '' : name)}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 6,
                    border: `1px solid ${isActive ? color : C.bd}`,
                    background: isActive ? color + '18' : 'transparent',
                    color: isActive ? color : C.t2,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: F,
                    lineHeight: 1.4,
                    transition: 'all 120ms ease',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: color,
                      marginRight: 5,
                      verticalAlign: 'middle',
                    }}
                  />
                  {name}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Tags (comma-separated)">
          <input
            value={form.tags}
            onChange={(e) => set('tags', e.target.value)}
            placeholder="e.g. A+setup, trendday"
            style={inputStyle}
          />
        </Field>
      </div>

      {/* ─── Sprint 9: Pre-Trade Checklist ────────────────── */}
      {activeTemplateId &&
        (() => {
          const tpl = tradeTemplates.find((t) => t.id === activeTemplateId);
          return tpl?.checklist?.length > 0 ? (
            <TradeChecklistPanel
              items={tpl.checklist}
              checked={checklistState}
              onToggle={(itemId) => setChecklistState((prev) => ({ ...prev, [itemId]: !prev[itemId] }))}
            />
          ) : null;
        })()}

      {/* ─── Notes (Sprint 9 enhanced) ───────────────────── */}
      <div style={{ marginBottom: 12 }}>
        <TradeNotesEditor value={form.notes} onChange={(val) => set('notes', val)} />
      </div>

      {/* ─── Screenshots ─────────────────────────────────── */}
      {screenshotUploadSection}

      {/* ─── Rule Break Toggle ────────────────────────────── */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 20,
          cursor: 'pointer',
          fontSize: 12,
          color: form.ruleBreak ? C.r : C.t3,
        }}
      >
        <input
          type="checkbox"
          checked={form.ruleBreak}
          onChange={(e) => set('ruleBreak', e.target.checked)}
          style={{ accentColor: C.r }}
        />
        Rule break
      </label>
    </div>
  );
}
