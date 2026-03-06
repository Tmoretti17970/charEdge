// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Trade Form Modal
// Add new trade or edit existing. All fields supported.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { C, F, M, EMOJIS } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { useTradeTemplateStore, applyTradeTemplate } from '../../../state/useTradeTemplateStore.js';
import { ModalOverlay, Btn, inputStyle } from '../ui/UIKit.jsx';
import { uid } from '../../../utils.js';
import { roundField } from '../../../charting_library/model/Money.js';
import toast from '../ui/Toast.jsx';
import PostTradeReviewModal from './PostTradeReviewModal.jsx';
import {
  TemplatePicker,
  TradeChecklistPanel,
  TradeNotesEditor,
} from '../../features/journal/journal_ui/JournalEvolution.jsx';

const SIDES = ['long', 'short'];
const ASSET_CLASSES = ['futures', 'crypto', 'stocks', 'forex', 'options'];

/**
 * @param {boolean} isOpen
 * @param {Function} onClose
 * @param {object|null} editTrade - If provided, edit mode. Null = add mode.
 */
export default function TradeFormModal({ isOpen, onClose, editTrade = null }) {
  const addTrade = useJournalStore((s) => s.addTrade);
  const updateTrade = useJournalStore((s) => s.updateTrade);
  const playbooks = useJournalStore((s) => s.playbooks);
  const tradeTemplates = useTradeTemplateStore((s) => s.templates);

  const isEdit = !!editTrade;
  const symbolRef = useRef(null);

  // Sprint 9: Template + checklist state
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [checklistState, setChecklistState] = useState({});
  // Sprint 11: Progressive disclosure
  const [showDetails, setShowDetails] = useState(false);
  // Sprint 3: Post-trade review
  const [reviewTrade, setReviewTrade] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  // ─── Form State ───────────────────────────────────────────
  const empty = {
    symbol: '',
    side: 'long',
    assetClass: 'futures',
    qty: '',
    entry: '',
    exit: '',
    pnl: '',
    fees: '',
    date: new Date().toISOString().slice(0, 16), // datetime-local format
    closeDate: '', // J2.3: Exit time for duration tracking
    emotion: '',
    playbook: '',
    rMultiple: '',
    tags: '',
    notes: '',
    ruleBreak: false,
    screenshots: [],
  };

  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [isDragging, setIsDragging] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (isEdit && editTrade) {
      setForm({
        symbol: editTrade.symbol || '',
        side: editTrade.side || 'long',
        assetClass: editTrade.assetClass || 'futures',
        qty: editTrade.qty ?? '',
        entry: editTrade.entry ?? '',
        exit: editTrade.exit ?? '',
        pnl: editTrade.pnl ?? '',
        fees: editTrade.fees ?? '',
        date: editTrade.date ? editTrade.date.slice(0, 16) : '',
        closeDate: editTrade.closeDate ? editTrade.closeDate.slice(0, 16) : '',
        emotion: editTrade.emotion || '',
        playbook: editTrade.playbook || '',
        rMultiple: editTrade.rMultiple ?? '',
        tags: Array.isArray(editTrade.tags) ? editTrade.tags.join(', ') : '',
        notes: editTrade.notes || '',
        ruleBreak: editTrade.ruleBreak || false,
        screenshots: editTrade.screenshots || [],
      });
    } else {
      setForm(empty);
    }
    setErrors({});
    // Sprint 11: Auto-expand details when editing
    setShowDetails(isEdit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTrade, isOpen, isEdit]);

  // Focus symbol on open
  useEffect(() => {
    if (isOpen && symbolRef.current) {
      setTimeout(() => symbolRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Clipboard paste handler for screenshots
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) _processScreenshot(file, form, (field, val) => setForm((f) => ({ ...f, [field]: val })));
          break;
        }
      }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [isOpen, form]);

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (!isOpen) return;
    const files = e.dataTransfer?.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        _processScreenshot(file, form, (field, val) => setForm((f) => ({ ...f, [field]: val })));
      }
    });
  };

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  // ─── Validation ───────────────────────────────────────────
  function validate() {
    const e = {};
    if (!form.symbol.trim()) e.symbol = 'Required';
    if (form.pnl === '' || isNaN(Number(form.pnl))) e.pnl = 'Required';
    if (!form.date) e.date = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ─── Submit ───────────────────────────────────────────────
  function handleSubmit() {
    if (!validate()) return;

    const trade = {
      id: isEdit ? editTrade.id : uid(),
      symbol: form.symbol.trim().toUpperCase(),
      side: form.side,
      assetClass: form.assetClass,
      qty: form.qty !== '' ? roundField(Number(form.qty), 'qty', form.assetClass) : null,
      entry: form.entry !== '' ? roundField(Number(form.entry), 'entry', form.assetClass) : null,
      exit: form.exit !== '' ? roundField(Number(form.exit), 'exit', form.assetClass) : null,
      pnl: roundField(Number(form.pnl), 'pnl', form.assetClass),
      fees: form.fees !== '' ? roundField(Number(form.fees), 'fees', form.assetClass) : 0,
      date: new Date(form.date).toISOString(),
      closeDate: form.closeDate ? new Date(form.closeDate).toISOString() : null,
      emotion: form.emotion,
      playbook: form.playbook,
      rMultiple: form.rMultiple !== '' ? Number(form.rMultiple) : null,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      notes: form.notes.trim(),
      ruleBreak: form.ruleBreak,
      screenshots: form.screenshots || [],
      // Sprint 9: template + checklist data
      templateId: activeTemplateId || null,
      checklist: activeTemplateId ? { ...checklistState } : null,
      _moneyV: 1,
    };

    if (isEdit) {
      updateTrade(trade.id, trade);
      toast.success(`${trade.symbol} trade updated`);
      onClose();
    } else {
      addTrade(trade);
      toast.success(`${trade.symbol} ${trade.side} trade added — ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}`);
      // Sprint 3: Open post-trade review for new trades
      onClose();
      setReviewTrade(trade);
      setReviewOpen(true);
    }

    setActiveTemplateId(null);
    setChecklistState({});
  }

  // ─── Auto-calculate P&L from entry/exit/qty/side ──────────
  function autoCalcPnl() {
    const qty = Number(form.qty);
    const entry = Number(form.entry);
    const exit = Number(form.exit);
    if (!qty || !entry || !exit) return;
    const diff = form.side === 'long' ? exit - entry : entry - exit;
    // A4.1: Subtract fees to prevent inflated P&L display
    const fees = Number(form.fees) || 0;
    const pnl = Math.round((diff * qty - fees) * 100) / 100;
    set('pnl', pnl);
  }

  return (
    <>
      <ModalOverlay isOpen={isOpen} onClose={onClose} width={520}>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            position: 'relative',
            padding: '2px', // Slight padding to not clip border
            transition: 'all 0.2s ease',
          }}
        >
          {isDragging && (
            <div
              style={{
                position: 'absolute',
                inset: -10,
                zIndex: 50,
                border: `2px dashed ${C.b}`,
                borderRadius: 12,
                background: C.b + '10',
                backdropFilter: 'blur(2px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                animation: 'pulse 2s infinite',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: C.b, fontFamily: F, background: C.sf, padding: '10px 20px', borderRadius: 20, border: `1px solid ${C.b}` }}>
                📥 Drop screenshot here
              </div>
            </div>
          )}

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, fontFamily: F, color: C.t1, margin: 0 }}>
              {isEdit ? 'Edit Trade' : 'Add Trade'}
            </h2>
            <button
              className="tf-btn"
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: C.t3, fontSize: 18, cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          {/* ─── Sprint 9: Template Picker ─────────────────── */}
          {!isEdit && (
            <TemplatePicker
              templates={tradeTemplates}
              activeId={activeTemplateId}
              onSelect={(tpl) => {
                if (activeTemplateId === tpl.id) {
                  setActiveTemplateId(null);
                  setChecklistState({});
                } else {
                  setActiveTemplateId(tpl.id);
                  const fields = applyTradeTemplate(tpl);
                  Object.entries(fields).forEach(([k, v]) => set(k, v));
                  // Reset checklist
                  const initChecklist = {};
                  (tpl.checklist || []).forEach((item) => {
                    initChecklist[item.id] = false;
                  });
                  setChecklistState(initChecklist);
                }
              }}
            />
          )}

          {/* ─── Row 1: Symbol + Side ────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8, marginBottom: 12 }}>
            <Field label="Symbol" error={errors.symbol}>
              <input
                ref={symbolRef}
                value={form.symbol}
                onChange={(e) => set('symbol', e.target.value.toUpperCase())}
                placeholder="BTC"
                style={{ ...inputStyle, textTransform: 'uppercase', fontWeight: 700 }}
              />
            </Field>
            <Field label="Side">
              <div style={{ display: 'flex', gap: 2 }}>
                {SIDES.map((s) => (
                  <button
                    className="tf-btn"
                    key={s}
                    onClick={() => set('side', s)}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      borderRadius: 4,
                      border: `1px solid ${form.side === s ? (s === 'long' ? C.g : C.r) : C.bd}`,
                      background: form.side === s ? (s === 'long' ? C.g + '20' : C.r + '20') : 'transparent',
                      color: form.side === s ? (s === 'long' ? C.g : C.r) : C.t3,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {/* ─── Row 2: P&L + Date (always visible) ───────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <Field label="P&L ($)" error={errors.pnl}>
              <input
                type="number"
                value={form.pnl}
                onChange={(e) => set('pnl', e.target.value)}
                placeholder="0.00"
                step="0.01"
                style={{
                  ...inputStyle,
                  fontWeight: 700,
                  fontSize: 14,
                  color: Number(form.pnl) >= 0 ? C.g : Number(form.pnl) < 0 ? C.r : C.t1,
                }}
              />
            </Field>
            <Field label="Date" error={errors.date}>
              <input
                type="datetime-local"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>

          {/* ─── Sprint 11: More Details Toggle ─────────── */}
          <button
            className="tf-btn"
            onClick={() => setShowDetails(!showDetails)}
            style={{
              width: '100%',
              padding: '8px 0',
              marginBottom: 12,
              background: 'transparent',
              border: `1px dashed ${showDetails ? C.b : C.bd}`,
              borderRadius: 8,
              color: showDetails ? C.b : C.t3,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: F,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {showDetails ? '▲ Less Details' : '▼ More Details'}
            {!showDetails && <span style={{ fontSize: 10, color: C.t3 }}>Qty, Entry/Exit, Emotion, Notes…</span>}
          </button>

          {/* ─── Optional Fields (Sprint 11: collapsed by default) ── */}
          {showDetails && (
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

              {/* Qty + Entry + Exit */}
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 8, marginBottom: 12 }}>
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
                    onBlur={autoCalcPnl}
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
                    onBlur={autoCalcPnl}
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

              {/* ─── Row 4: Emotion Picker ───────────────────── */}
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

              {/* ─── Row 5: Playbook + Tags ──────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <Field label="Playbook / Strategy">
                  <select
                    value={form.playbook}
                    onChange={(e) => set('playbook', e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">— None —</option>
                    {playbooks.map((pb) => (
                      <option key={pb.id} value={pb.name}>
                        {pb.name}
                      </option>
                    ))}
                    {/* Common defaults if no playbooks exist */}
                    {playbooks.length === 0 && (
                      <>
                        <option value="Trend Following">Trend Following</option>
                        <option value="Mean Reversion">Mean Reversion</option>
                        <option value="Breakout">Breakout</option>
                        <option value="Scalp">Scalp</option>
                      </>
                    )}
                  </select>
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

              {/* ─── Sprint 9: Pre-Trade Checklist ──────────── */}
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

              {/* ─── Row 6: Notes (Sprint 9 enhanced) ──────── */}
              <div style={{ marginBottom: 12 }}>
                <TradeNotesEditor value={form.notes} onChange={(val) => set('notes', val)} />
              </div>

              {/* ─── Screenshots ───────────────────────────────── */}
              <Field label={`Screenshots (${form.screenshots?.length || 0}/3)`} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {(form.screenshots || []).map((shot, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img
                        src={shot.data}
                        alt={shot.name || `Screenshot ${i + 1}`}
                        style={{
                          width: 80,
                          height: 56,
                          objectFit: 'cover',
                          borderRadius: 4,
                          border: `1px solid ${C.bd}`,
                        }}
                      />
                      <button
                        className="tf-btn"
                        type="button"
                        onClick={() => {
                          const next = [...form.screenshots];
                          next.splice(i, 1);
                          set('screenshots', next);
                        }}
                        style={{
                          position: 'absolute',
                          top: -6,
                          right: -6,
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: C.r,
                          color: '#fff',
                          border: 'none',
                          fontSize: 10,
                          cursor: 'pointer',
                          lineHeight: '18px',
                          textAlign: 'center',
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                {(form.screenshots?.length || 0) < 3 && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      id="screenshot-upload"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        _processScreenshot(file, form, set);
                        e.target.value = '';
                      }}
                    />
                    <label
                      htmlFor="screenshot-upload"
                      style={{
                        ...inputStyle,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        fontSize: 11,
                        padding: '6px 12px',
                        color: C.t2,
                        textAlign: 'center',
                      }}
                    >
                      📎 Upload
                    </label>
                    <div
                      style={{
                        ...inputStyle,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 11,
                        padding: '6px 12px',
                        color: C.t3,
                      }}
                    >
                      or Ctrl+V to paste
                    </div>
                  </div>
                )}
              </Field>

              {/* ─── Rule Break Toggle ───────────────────────── */}
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
          )}

          {/* ─── Actions ─────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={onClose}>
              Cancel
            </Btn>
            <Btn onClick={handleSubmit}>{isEdit ? 'Save Changes' : 'Add Trade'}</Btn>
          </div>
        </div>
      </ModalOverlay>

      {/* Sprint 3: Post-Trade Review Modal */}
      <PostTradeReviewModal
        isOpen={reviewOpen}
        onClose={() => { setReviewOpen(false); setReviewTrade(null); }}
        trade={reviewTrade}
      />
    </>
  );
}

// ─── Field Wrapper ──────────────────────────────────────────────

function Field({ label, error, children, style = {} }) {
  return (
    <div style={style}>
      <label
        style={{
          display: 'block',
          fontSize: 10,
          fontWeight: 600,
          color: error ? C.r : C.t3,
          marginBottom: 3,
          fontFamily: M,
        }}
      >
        {label} {error && <span style={{ color: C.r }}>· {error}</span>}
      </label>
      {children}
    </div>
  );
}

export { TradeFormModal };

// ─── Screenshot Processing ──────────────────────────────────────
const MAX_SCREENSHOTS = 3;
const MAX_DIM = 1200;
const JPEG_QUALITY = 0.75;

function _processScreenshot(file, form, set) {
  if ((form.screenshots?.length || 0) >= MAX_SCREENSHOTS) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      // Resize if needed
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const data = canvas.toDataURL('image/jpeg', JPEG_QUALITY);

      set('screenshots', [...(form.screenshots || []), { name: file.name, data }]);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}
