// ═══════════════════════════════════════════════════════════════════
// charEdge — Notes Page (Orchestrator)
//
// Trading journal notes with narrative treatment:
//   1. Header with count + New Note CTA
//   2. Search bar (when notes exist)
//   3. Note cards with tags, timestamps, truncated content
//   4. Note form modal
//
// Embedded inside JournalPage as a tab (Sprint 2 IA).
// Mobile-responsive with larger touch targets + font sizes.
// ═══════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { NotesEmptyState } from '../app/components/ui/EmptyState.jsx';
import toast from '../app/components/ui/Toast.jsx';
import { Card, Btn, inputStyle } from '../app/components/ui/UIKit.jsx';
import { C, F, M } from '../constants.js';
import { useJournalStore } from '../state/useJournalStore';
import { uid } from '../utils.js';
import NoteCard from './notes/NoteCard.jsx';
import NoteFormModal from './notes/NoteFormModal.jsx';
import { useBreakpoints } from '@/hooks/useMediaQuery';

// Extracted sub-components

export default function NotesPage() {
  const notes = useJournalStore((s) => s.notes);
  const addNote = useJournalStore((s) => s.addNote);
  const deleteNote = useJournalStore((s) => s.deleteNote);
  const updateNote = useJournalStore((s) => s.updateNote);
  const { isMobile } = useBreakpoints();

  const [formOpen, setFormOpen] = useState(false);
  const [editNote, setEditNote] = useState(null);
  const [filter, setFilter] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Filter notes
  const filtered = useMemo(() => {
    if (!filter.trim()) return notes;
    const q = filter.toLowerCase();
    return notes.filter(
      (n) =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [notes, filter]);

  const handleSave = (note) => {
    if (editNote) {
      updateNote(editNote.id, note);
      toast.success('Note updated');
    } else {
      addNote({ ...note, id: uid(), createdAt: new Date().toISOString() });
      toast.success('Note created');
    }
    setFormOpen(false);
    setEditNote(null);
  };

  const handleDelete = (id) => {
    deleteNote(id);
    setDeleteConfirm(null);
    toast.success('Note deleted');
  };

  const openNewNote = () => {
    setEditNote(null);
    setFormOpen(true);
  };
  const isFiltered = filter.trim().length > 0;

  return (
    <div
      data-container="notes"
      className="tf-container"
      style={{
        padding: isMobile ? 16 : 24,
        maxWidth: 900,
      }}
    >
      {/* ─── Header ──── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: isMobile ? 22 : 22,
              fontWeight: 800,
              fontFamily: F,
              color: C.t1,
              margin: 0,
            }}
          >
            Notes
          </h1>
          <p style={{ fontSize: 12, color: C.t3, margin: '4px 0 0', fontFamily: M }}>
            {notes.length} note{notes.length !== 1 ? 's' : ''}
            {isFiltered && ` · ${filtered.length} match${filtered.length !== 1 ? 'es' : ''}`}
          </p>
        </div>
        <Btn
          onClick={openNewNote}
          style={{
            fontSize: isMobile ? 13 : 12,
            padding: isMobile ? '10px 16px' : '8px 14px',
            minHeight: isMobile ? 44 : undefined,
          }}
        >
          + New Note
        </Btn>
      </div>

      {/* ─── Search ──── */}
      {notes.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search notes..."
            aria-label="Search notes"
            className="tf-input"
            style={{
              ...inputStyle,
              width: '100%',
              fontSize: isMobile ? 14 : 12,
              minHeight: isMobile ? 44 : undefined,
            }}
          />
          {isFiltered && (
            <button
              onClick={() => setFilter('')}
              className="tf-btn"
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: C.t3,
                fontSize: 14,
                cursor: 'pointer',
                padding: 4,
              }}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* ─── Notes List ──── */}
      {filtered.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(380px, 1fr))',
            gap: 10,
          }}
          role="list"
          aria-label="Notes"
        >
          {filtered.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isMobile={isMobile}
              deleteConfirm={deleteConfirm}
              onEdit={() => {
                setEditNote(note);
                setFormOpen(true);
              }}
              onDeleteConfirm={() => setDeleteConfirm(note.id)}
              onDeleteCancel={() => setDeleteConfirm(null)}
              onDelete={() => handleDelete(note.id)}
            />
          ))}
        </div>
      ) : (
        <div>
          {notes.length === 0 ? (
            <NotesEmptyState onNewNote={openNewNote} />
          ) : (
            <Card>
              <div style={{ padding: 48, textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: C.t2, marginBottom: 8 }}>No notes match "{filter}"</div>
                <button
                  onClick={() => setFilter('')}
                  className="tf-btn tf-link"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: C.b,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Clear search
                </button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ─── Note Form Modal ──── */}
      <NoteFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditNote(null);
        }}
        onSave={handleSave}
        editNote={editNote}
        isMobile={isMobile}
      />
    </div>
  );
}
