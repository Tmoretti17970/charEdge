// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Trade Form Modal
// Add new trade or edit existing. All fields supported.
// Decomposed: constants, PnL, screenshots, Field, detail fields,
// useTradeForm hook, and ScreenshotSection now live in ./trade-form/.
// ═══════════════════════════════════════════════════════════════════

import { C, F } from '../../../constants.js';
import { TemplatePicker } from '../../features/journal/journal_ui/JournalEvolution.jsx';
import { ModalOverlay, Btn, inputStyle } from '../ui/UIKit.jsx';
// eslint-disable-next-line import/order
import PostTradeReviewModal from './PostTradeReviewModal.jsx';

// Extracted sub-modules
import Field from './trade-form/Field.jsx';
import ScreenshotSection from './trade-form/ScreenshotSection.jsx';
import { SIDES } from './trade-form/tradeConstants.js';
import TradeDetailFields from './trade-form/TradeDetailFields.jsx';
import { useTradeForm } from './trade-form/useTradeForm.js';

/**
 * @param {boolean} isOpen
 * @param {Function} onClose
 * @param {object|null} editTrade - If provided, edit mode. Null = add mode.
 */
export default function TradeFormModal({ isOpen, onClose, editTrade = null }) {
  const {
    form, errors, isDragging, isEdit,
    showDetails, setShowDetails,
    reviewTrade, reviewOpen, setReviewOpen, setReviewTrade,
    activeTemplateId, checklistState, setChecklistState,
    playbooks, tradeTemplates, symbolRef,
    set, handleSubmit, autoCalcPnl,
    handleDragOver, handleDragLeave, handleDrop,
    handleTemplateSelect,
  } = useTradeForm({ isOpen, onClose, editTrade });

  return (
    <>
      <ModalOverlay isOpen={isOpen} onClose={onClose} width={520}>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            position: 'relative',
            padding: '2px',
            transition: 'all 0.2s ease',
          }}
        >
          {/* Drag overlay */}
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

          {/* Sprint 9: Template Picker */}
          {!isEdit && (
            <TemplatePicker
              templates={tradeTemplates}
              activeId={activeTemplateId}
              onSelect={handleTemplateSelect}
            />
          )}

          {/* Row 1: Symbol + Side */}
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

          {/* Row 2: P&L + Date (always visible) */}
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

          {/* Sprint 11: More Details Toggle */}
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
            {/* P2 3.5: Progressive fill indicator */}
            {showDetails && (() => {
              const filled = [form.qty, form.entry, form.exit, form.fees, form.emotion, form.playbook, form.tags, form.notes, form.closeDate].filter(Boolean).length;
              return filled > 0 ? <span style={{ fontSize: 9, fontWeight: 700, color: C.b, background: `${C.b}15`, borderRadius: 8, padding: '1px 6px', marginLeft: 4 }}>{filled}/9</span> : null;
            })()}
          </button>

          {/* Optional Fields (Sprint 11: collapsed by default) */}
          {showDetails && (
            <TradeDetailFields
              form={form}
              set={set}
              autoCalcPnl={autoCalcPnl}
              playbooks={playbooks}
              tradeTemplates={tradeTemplates}
              activeTemplateId={activeTemplateId}
              checklistState={checklistState}
              setChecklistState={setChecklistState}
              screenshotUploadSection={<ScreenshotSection form={form} set={set} />}
            />
          )}

          {/* Actions */}
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

export { TradeFormModal };
