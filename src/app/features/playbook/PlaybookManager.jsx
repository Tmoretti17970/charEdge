// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Playbook Manager
// CRUD for trading playbooks/strategies
// Shows per-playbook stats from analytics
// ═══════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { C, F, M } from '../../../constants.js';
import { useJournalStore } from '../../../state/useJournalStore.js';
import { useAnalyticsStore } from '../../../state/useAnalyticsStore.js';
import { Btn, ModalOverlay, inputStyle } from '../../components/ui/UIKit.jsx';
import { fmtD, uid } from '../../../utils.js';
import toast from '../../components/ui/Toast.jsx';

export default function PlaybookManager() {
  const playbooks = useJournalStore((s) => s.playbooks);
  const addPlaybook = useJournalStore((s) => s.addPlaybook);
  const deletePlaybook = useJournalStore((s) => s.deletePlaybook);
  const result = useAnalyticsStore((s) => s.result);

  const [formOpen, setFormOpen] = useState(false);
  const [editPb, setEditPb] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const handleSave = (pb) => {
    if (editPb) {
      // Update: delete old, add new
      deletePlaybook(editPb.id);
    }
    addPlaybook(pb);
    setFormOpen(false);
    setEditPb(null);
    toast.success(`Playbook "${pb.name}" ${editPb ? 'updated' : 'created'}`);
  };

  const handleDelete = (id) => {
    const pb = playbooks.find((p) => p.id === id);
    deletePlaybook(id);
    setDeleteConfirm(null);
    toast.success(`Playbook "${pb?.name || ''}" deleted`);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>Playbooks</div>
        <Btn
          onClick={() => {
            setEditPb(null);
            setFormOpen(true);
          }}
          style={{ fontSize: 11, padding: '6px 12px' }}
        >
          + New Playbook
        </Btn>
      </div>

      {playbooks.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: C.t3, fontSize: 12 }}>
          No playbooks yet. Create one to categorize your trades.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {playbooks.map((pb) => {
            const stats = result?.bySt?.[pb.name] || null;
            return (
              <div
                key={pb.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: C.sf,
                  border: `1px solid ${C.bd}`,
                  borderRadius: 8,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{pb.name}</div>
                  {pb.description && <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{pb.description}</div>}
                  {stats && (
                    <div style={{ fontSize: 10, fontFamily: M, color: C.t3, marginTop: 4 }}>
                      <span style={{ color: stats.pnl >= 0 ? C.g : C.r, fontWeight: 700 }}>{fmtD(stats.pnl)}</span>
                      {' · '}
                      {stats.count} trades
                      {' · '}
                      {stats.count > 0 ? ((stats.wins / stats.count) * 100).toFixed(0) : 0}% win
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 4 }}>
                  {deleteConfirm === pb.id ? (
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
                        onClick={() => handleDelete(pb.id)}
                        style={{ fontSize: 10, padding: '4px 8px' }}
                      >
                        Delete
                      </Btn>
                    </>
                  ) : (
                    <>
                      <button
                        className="tf-btn"
                        onClick={() => {
                          setEditPb(pb);
                          setFormOpen(true);
                        }}
                        style={{ background: 'none', border: 'none', color: C.t3, fontSize: 11, cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                      <button
                        className="tf-btn"
                        onClick={() => setDeleteConfirm(pb.id)}
                        style={{ background: 'none', border: 'none', color: C.t3, fontSize: 11, cursor: 'pointer' }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Playbook Form Modal */}
      <PlaybookFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditPb(null);
        }}
        onSave={handleSave}
        editPb={editPb}
      />
    </div>
  );
}

// ─── Playbook Form ──────────────────────────────────────────────

function PlaybookFormModal({ isOpen, onClose, onSave, editPb }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');

  // Reset form on open
  React.useEffect(() => {
    if (isOpen && editPb) {
      setName(editPb.name || '');
      setDescription(editPb.description || '');
      setRules(editPb.rules || '');
    } else if (isOpen) {
      setName('');
      setDescription('');
      setRules('');
    }
  }, [isOpen, editPb]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({
      id: editPb ? editPb.id : uid(),
      name: name.trim(),
      description: description.trim(),
      rules: rules.trim(),
    });
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} width={420}>
      <h3 style={{ fontSize: 15, fontWeight: 800, fontFamily: F, color: C.t1, margin: '0 0 16px' }}>
        {editPb ? 'Edit Playbook' : 'New Playbook'}
      </h3>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: C.t3, marginBottom: 3, fontFamily: M }}>
          Name *
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Trend Following"
          style={{ ...inputStyle, fontWeight: 700 }}
          autoFocus
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: C.t3, marginBottom: 3, fontFamily: M }}>
          Description
        </label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of the strategy"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: C.t3, marginBottom: 3, fontFamily: M }}>
          Rules / Checklist
        </label>
        <textarea
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          placeholder="Entry criteria, exit rules, position sizing..."
          rows={4}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 60, lineHeight: 1.5 }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onClose}>
          Cancel
        </Btn>
        <Btn onClick={handleSubmit} disabled={!name.trim()}>
          {editPb ? 'Save' : 'Create'}
        </Btn>
      </div>
    </ModalOverlay>
  );
}

export { PlaybookManager };
