// ═══════════════════════════════════════════════════════════════════
// charEdge — NoteFormModal Component
// Extracted from NotesPage.jsx for single-responsibility.
// ═══════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { C, F } from '../../constants.js';
import { Btn, ModalOverlay, inputStyle } from '../../app/components/ui/UIKit.jsx';

export default function NoteFormModal({ isOpen, onClose, onSave, editNote, isMobile }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');

  React.useEffect(() => {
    if (isOpen && editNote) {
      setTitle(editNote.title || '');
      setContent(editNote.content || '');
      setTags(Array.isArray(editNote.tags) ? editNote.tags.join(', ') : '');
    } else if (isOpen) {
      setTitle('');
      setContent('');
      setTags('');
    }
  }, [isOpen, editNote]);

  const handleSubmit = () => {
    onSave({
      title: title.trim() || `Note — ${new Date().toLocaleDateString()}`,
      content: content.trim(),
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
  };

  const mInput = {
    ...inputStyle,
    fontSize: isMobile ? 14 : 13,
    minHeight: isMobile ? 44 : undefined,
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} width={560}>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 800,
          fontFamily: F,
          color: C.t1,
          margin: '0 0 16px',
        }}
      >
        {editNote ? 'Edit Note' : 'New Note'}
      </h3>

      <div style={{ marginBottom: 14 }}>
        <label
          style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.t3, marginBottom: 4 }}
          htmlFor="note-title"
        >
          Title
        </label>
        <input
          id="note-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`Note — ${new Date().toLocaleDateString()}`}
          style={{ ...mInput, fontWeight: 700 }}
          autoFocus
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label
          style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.t3, marginBottom: 4 }}
          htmlFor="note-content"
        >
          Content
        </label>
        <textarea
          id="note-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Market observations, trade reflections, lessons learned..."
          rows={isMobile ? 8 : 10}
          style={{
            ...mInput,
            resize: 'vertical',
            minHeight: isMobile ? 160 : 180,
            lineHeight: 1.7,
          }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label
          style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.t3, marginBottom: 4 }}
          htmlFor="note-tags"
        >
          Tags (comma-separated)
        </label>
        <input
          id="note-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="e.g. daily-review, market-analysis, psychology"
          style={mInput}
        />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
        }}
      >
        <Btn variant="ghost" onClick={onClose} style={{ minHeight: isMobile ? 44 : undefined }}>
          Cancel
        </Btn>
        <Btn onClick={handleSubmit} style={{ minHeight: isMobile ? 44 : undefined }}>
          {editNote ? 'Save' : 'Create'}
        </Btn>
      </div>
    </ModalOverlay>
  );
}
