// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Trade Plans
// Pre-trade planning: bias, entry/exit criteria, checklist
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';
import { C, F, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore';
import { uid } from '../../../utils.js';
import toast from '../../components/ui/Toast.jsx';
import { Card, Btn, ModalOverlay, inputStyle } from '../../components/ui/UIKit.jsx';

const DEFAULT_CHECKLIST = [
  'Market regime confirmed (trend/range)',
  'Key S/R levels identified',
  'Entry trigger present',
  'Stop loss placed',
  'Position sized within risk limits',
  'No conflicting news/events',
];

export default function TradePlanManager() {
  const tradePlans = useJournalStore((s) => s.tradePlans);
  const addTradePlan = useJournalStore((s) => s.addTradePlan);
  const deleteTradePlan = useJournalStore((s) => s.deleteTradePlan);
  const updateTradePlan = useJournalStore((s) => s.updateTradePlan);

  const [formOpen, setFormOpen] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const handleSave = (plan) => {
    if (editPlan) {
      updateTradePlan(editPlan.id, plan);
      toast.success('Trade plan updated');
    } else {
      addTradePlan({ ...plan, id: uid(), createdAt: new Date().toISOString() });
      toast.success('Trade plan created');
    }
    setFormOpen(false);
    setEditPlan(null);
  };

  const handleDelete = (id) => {
    deleteTradePlan(id);
    setDeleteConfirm(null);
    toast.success('Trade plan deleted');
  };

  const toggleChecklist = (planId, idx) => {
    const plan = tradePlans.find((p) => p.id === planId);
    if (!plan) return;
    const checked = [...(plan.checked || [])];
    if (checked.includes(idx)) {
      checked.splice(checked.indexOf(idx), 1);
    } else {
      checked.push(idx);
    }
    updateTradePlan(planId, { checked });
  };

  // Sort: active (uncompleted) first, then completed
  const sorted = useMemo(() => {
    return [...tradePlans].sort((a, b) => {
      const aComplete = a.status === 'completed';
      const bComplete = b.status === 'completed';
      if (aComplete !== bComplete) return aComplete ? 1 : -1;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [tradePlans]);

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, fontFamily: F, color: C.t1, margin: 0 }}>Trade Plans</h1>
          <p style={{ fontSize: 11, color: C.t3, margin: '4px 0 0', fontFamily: M }}>
            {tradePlans.length} plan{tradePlans.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Btn
          onClick={() => {
            setEditPlan(null);
            setFormOpen(true);
          }}
          style={{ fontSize: 11, padding: '8px 14px' }}
        >
          + New Plan
        </Btn>
      </div>

      {/* Plans */}
      {sorted.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map((plan) => {
            const expanded = expandedId === plan.id;
            const checklistItems = plan.checklist || DEFAULT_CHECKLIST;
            const checked = plan.checked || [];
            const progress = checklistItems.length > 0 ? Math.round((checked.length / checklistItems.length) * 100) : 0;
            const isComplete = plan.status === 'completed';

            return (
              <Card
                key={plan.id}
                style={{
                  padding: 0,
                  opacity: isComplete ? 0.6 : 1,
                  borderLeft: `3px solid ${plan.bias === 'long' ? C.g : plan.bias === 'short' ? C.r : C.b}`,
                }}
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedId(expanded ? null : plan.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        fontFamily: M,
                        color: C.t1,
                      }}
                    >
                      {plan.symbol || 'Untitled'}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 3,
                        background: (plan.bias === 'long' ? C.g : plan.bias === 'short' ? C.r : C.b) + '20',
                        color: plan.bias === 'long' ? C.g : plan.bias === 'short' ? C.r : C.b,
                      }}
                    >
                      {(plan.bias || 'neutral').toUpperCase()}
                    </span>
                    {isComplete && <span style={{ fontSize: 9, color: C.g, fontWeight: 700 }}>✓ COMPLETED</span>}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Progress */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 60, height: 4, background: C.bg2, borderRadius: 2, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${progress}%`,
                            height: '100%',
                            background: progress === 100 ? C.g : C.b,
                            transition: 'width 0.2s',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 9, fontFamily: M, color: C.t3 }}>{progress}%</span>
                    </div>
                    <span style={{ fontSize: 12, color: C.t3 }}>{expanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded Detail */}
                {expanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${C.bd}50` }}>
                    {/* Entry/Exit/Notes Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '12px 0' }}>
                      {plan.entryReason && (
                        <div>
                          <Label>Entry Criteria</Label>
                          <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                            {plan.entryReason}
                          </div>
                        </div>
                      )}
                      {plan.exitPlan && (
                        <div>
                          <Label>Exit Plan</Label>
                          <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                            {plan.exitPlan}
                          </div>
                        </div>
                      )}
                    </div>

                    {plan.notes && (
                      <div style={{ marginBottom: 12 }}>
                        <Label>Notes</Label>
                        <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {plan.notes}
                        </div>
                      </div>
                    )}

                    {/* Checklist */}
                    <Label>Pre-Trade Checklist</Label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                      {checklistItems.map((item, i) => (
                        <label
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 8px',
                            borderRadius: 5,
                            background: checked.includes(i) ? C.g + '08' : 'transparent',
                            cursor: 'pointer',
                            fontSize: 12,
                            color: checked.includes(i) ? C.t3 : C.t1,
                            textDecoration: checked.includes(i) ? 'line-through' : 'none',
                            transition: 'all 0.15s',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked.includes(i)}
                            onChange={() => toggleChecklist(plan.id, i)}
                            style={{ accentColor: C.g }}
                          />
                          {item}
                        </label>
                      ))}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {!isComplete && (
                        <Btn
                          variant="ghost"
                          onClick={() => updateTradePlan(plan.id, { status: 'completed' })}
                          style={{ fontSize: 10, padding: '4px 10px' }}
                        >
                          ✓ Mark Complete
                        </Btn>
                      )}
                      {isComplete && (
                        <Btn
                          variant="ghost"
                          onClick={() => updateTradePlan(plan.id, { status: 'active' })}
                          style={{ fontSize: 10, padding: '4px 10px' }}
                        >
                          ↩ Reopen
                        </Btn>
                      )}
                      <button
                        className="tf-btn"
                        onClick={() => {
                          setEditPlan(plan);
                          setFormOpen(true);
                        }}
                        style={{ background: 'none', border: 'none', color: C.t3, fontSize: 11, cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                      {deleteConfirm === plan.id ? (
                        <>
                          <Btn
                            variant="ghost"
                            onClick={() => setDeleteConfirm(null)}
                            style={{ fontSize: 10, padding: '4px 8px' }}
                          >
                            Cancel
                          </Btn>
                          <Btn
                            variant="danger"
                            onClick={() => handleDelete(plan.id)}
                            style={{ fontSize: 10, padding: '4px 8px' }}
                          >
                            Delete
                          </Btn>
                        </>
                      ) : (
                        <button
                          className="tf-btn"
                          onClick={() => setDeleteConfirm(plan.id)}
                          style={{ background: 'none', border: 'none', color: C.t3, fontSize: 11, cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <div style={{ padding: 48, textAlign: 'center', color: C.t3, fontSize: 13 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 700, color: C.t2, marginBottom: 4 }}>No trade plans yet</div>
            <div style={{ marginBottom: 16 }}>
              Create a plan before entering a trade — define your thesis, entry, exit, and checklist.
            </div>
            <Btn
              onClick={() => {
                setEditPlan(null);
                setFormOpen(true);
              }}
            >
              New Trade Plan
            </Btn>
          </div>
        </Card>
      )}

      {/* Form Modal */}
      <TradePlanFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditPlan(null);
        }}
        onSave={handleSave}
        editPlan={editPlan}
      />
    </div>
  );
}

// ─── Form Modal ─────────────────────────────────────────────────

function TradePlanFormModal({ isOpen, onClose, onSave, editPlan }) {
  const [symbol, setSymbol] = useState('');
  const [bias, setBias] = useState('long');
  const [entryReason, setEntryReason] = useState('');
  const [exitPlan, setExitPlan] = useState('');
  const [notes, setNotes] = useState('');
  const [checklistText, setChecklistText] = useState('');

  React.useEffect(() => {
    if (isOpen && editPlan) {
      setSymbol(editPlan.symbol || '');
      setBias(editPlan.bias || 'long');
      setEntryReason(editPlan.entryReason || '');
      setExitPlan(editPlan.exitPlan || '');
      setNotes(editPlan.notes || '');
      setChecklistText((editPlan.checklist || DEFAULT_CHECKLIST).join('\n'));
    } else if (isOpen) {
      setSymbol('');
      setBias('long');
      setEntryReason('');
      setExitPlan('');
      setNotes('');
      setChecklistText(DEFAULT_CHECKLIST.join('\n'));
    }
  }, [isOpen, editPlan]);

  const handleSubmit = () => {
    onSave({
      symbol: symbol.trim().toUpperCase() || 'PLAN',
      bias,
      entryReason: entryReason.trim(),
      exitPlan: exitPlan.trim(),
      notes: notes.trim(),
      checklist: checklistText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
      checked: editPlan?.checked || [],
      status: editPlan?.status || 'active',
    });
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} width={560}>
      <h3 style={{ fontSize: 15, fontWeight: 800, fontFamily: F, color: C.t1, margin: '0 0 16px' }}>
        {editPlan ? 'Edit Trade Plan' : 'New Trade Plan'}
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <Label>Symbol</Label>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="BTC"
            style={{ ...inputStyle, fontWeight: 800 }}
            autoFocus
          />
        </div>
        <div>
          <Label>Bias</Label>
          <div style={{ display: 'flex', gap: 4 }}>
            {['long', 'short', 'neutral'].map((b) => (
              <button
                className="tf-btn"
                key={b}
                onClick={() => setBias(b)}
                style={{
                  flex: 1,
                  padding: '6px 0',
                  borderRadius: 4,
                  border: `1px solid ${bias === b ? (b === 'long' ? C.g : b === 'short' ? C.r : C.b) : C.bd}`,
                  background: bias === b ? (b === 'long' ? C.g : b === 'short' ? C.r : C.b) + '15' : 'transparent',
                  color: bias === b ? (b === 'long' ? C.g : b === 'short' ? C.r : C.b) : C.t3,
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {b.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <Label>Entry Criteria</Label>
        <textarea
          value={entryReason}
          onChange={(e) => setEntryReason(e.target.value)}
          placeholder="Why are you entering? What setup/pattern?"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <Label>Exit Plan</Label>
        <textarea
          value={exitPlan}
          onChange={(e) => setExitPlan(e.target.value)}
          placeholder="Target price, trailing stop, time-based exit..."
          rows={2}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <Label>Pre-Trade Checklist (one item per line)</Label>
        <textarea
          value={checklistText}
          onChange={(e) => setChecklistText(e.target.value)}
          rows={5}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, fontSize: 11 }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Label>Notes</Label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional context, market conditions..."
          rows={2}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onClose}>
          Cancel
        </Btn>
        <Btn onClick={handleSubmit}>{editPlan ? 'Save' : 'Create Plan'}</Btn>
      </div>
    </ModalOverlay>
  );
}

function Label({ children }) {
  return (
    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: C.t3, marginBottom: 3, fontFamily: M }}>
      {children}
    </label>
  );
}

export { TradePlanManager };
