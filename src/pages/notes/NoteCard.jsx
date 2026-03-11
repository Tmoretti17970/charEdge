// ═══════════════════════════════════════════════════════════════════
// charEdge — NoteCard Component
// Extracted from NotesPage.jsx for single-responsibility.
// ═══════════════════════════════════════════════════════════════════

import { Card, Btn } from '../../app/components/ui/UIKit.jsx';
import { C, M } from '../../constants.js';
import { radii } from '../../theme/tokens.js';

export default function NoteCard({ note, isMobile, deleteConfirm, onEdit, onDeleteConfirm, onDeleteCancel, onDelete }) {
  const isConfirming = deleteConfirm === note.id;

  return (
    <Card style={{ padding: isMobile ? 16 : 16 }} role="listitem">
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: isMobile ? 15 : 14,
              fontWeight: 700,
              color: C.t1,
              marginBottom: 3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {note.title || 'Untitled'}
          </div>
          <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
            {note.createdAt
              ? new Date(note.createdAt).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
          {isConfirming ? (
            <>
              <Btn
                variant="ghost"
                onClick={onDeleteCancel}
                style={{ fontSize: 11, padding: isMobile ? '6px 10px' : '4px 8px' }}
              >
                Cancel
              </Btn>
              <Btn
                variant="danger"
                onClick={onDelete}
                style={{ fontSize: 11, padding: isMobile ? '6px 10px' : '4px 8px' }}
              >
                Delete
              </Btn>
            </>
          ) : (
            <>
              <button
                onClick={onEdit}
                className="tf-btn tf-link"
                aria-label={`Edit ${note.title || 'note'}`}
                style={{
                  background: 'none',
                  border: 'none',
                  color: C.t3,
                  fontSize: 12,
                  cursor: 'pointer',
                  padding: isMobile ? '6px 8px' : '2px 6px',
                  minHeight: isMobile ? 36 : undefined,
                }}
              >
                Edit
              </button>
              <button
                onClick={onDeleteConfirm}
                className="tf-btn tf-link"
                aria-label={`Delete ${note.title || 'note'}`}
                style={{
                  background: 'none',
                  border: 'none',
                  color: C.t3,
                  fontSize: 12,
                  cursor: 'pointer',
                  padding: isMobile ? '6px 8px' : '2px 6px',
                  minHeight: isMobile ? 36 : undefined,
                }}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content preview */}
      {note.content && (
        <div
          style={{
            fontSize: 13,
            color: C.t2,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            marginBottom: note.tags?.length ? 10 : 0,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {note.content}
        </div>
      )}

      {/* Tags */}
      {note.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {note.tags.map((tag, i) => (
            <span
              key={i}
              style={{
                padding: '3px 8px',
                borderRadius: radii.sm,
                background: C.b + '12',
                color: C.b,
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
