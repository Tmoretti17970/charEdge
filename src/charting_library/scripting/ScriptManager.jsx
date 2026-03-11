// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Script Manager Panel
//
// Library sidebar/overlay for managing custom indicator scripts.
// Shows built-in scripts (read-only) and user scripts (editable).
// Grouped by category with toggle switches.
//
// Actions: toggle, edit, duplicate, delete, create new.
// Opens as an overlay panel from the Charts page toolbar.
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { Btn } from '../../app/components/ui/UIKit.jsx';
import { C, M } from '../../constants.js';
import { useScriptStore } from '../../state/useScriptStore.js';
import { space, radii, text, transition, preset, zIndex as zi } from '../../theme/tokens.js';
import { SCRIPT_CATEGORIES } from './scriptLibrary.js';

/**
 * @param {Object} props
 * @param {boolean} props.open - Whether the panel is visible
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onEditScript - Called with script ID to open in editor
 */
export default function ScriptManager({ open, onClose, onEditScript }) {
  const scripts = useScriptStore((s) => s.scripts);
  const toggleScript = useScriptStore((s) => s.toggleScript);
  const deleteScript = useScriptStore((s) => s.deleteScript);
  const createScript = useScriptStore((s) => s.createScript);
  const duplicateScript = useScriptStore((s) => s.duplicateScript);

  const [filter, setFilter] = useState('all'); // 'all' or category id
  const [search, setSearch] = useState('');

  // Filter scripts
  const filtered = scripts.filter((s) => {
    if (filter !== 'all' && s.category !== filter) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const builtins = filtered.filter((s) => s.builtin);
  const userScripts = filtered.filter((s) => !s.builtin);

  // ─── Handlers ───────────────────────────────────────────
  const handleCreate = useCallback(() => {
    const id = createScript();
    if (onEditScript) onEditScript(id);
  }, [createScript, onEditScript]);

  const handleDuplicate = useCallback(
    (id) => {
      const newId = duplicateScript(id);
      if (newId && onEditScript) onEditScript(newId);
    },
    [duplicateScript, onEditScript],
  );

  const handleDelete = useCallback(
    (id, name) => {
      if (window.confirm(`Delete "${name}"? This cannot be undone.`)) {
        deleteScript(id);
      }
    },
    [deleteScript],
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: zi.overlay,
        }}
      />

      {/* Panel */}
      <div
        className="tf-slide-in"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 380,
          maxWidth: '90vw',
          background: C.sf,
          borderLeft: `1px solid ${C.bd}`,
          zIndex: zi.overlay + 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ─── Header ─────────────────────────────────── */}
        <div
          style={{
            padding: `${space[4]}px ${space[4]}px ${space[3]}px`,
            borderBottom: `1px solid ${C.bd}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: space[3],
            }}
          >
            <h2 style={text.h2}>📜 Script Library</h2>
            <button
              className="tf-btn"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: C.t3,
                fontSize: 18,
                cursor: 'pointer',
                padding: '0 4px',
              }}
            >
              ×
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search scripts..."
            style={{
              ...preset.input,
              fontSize: 11,
              padding: '6px 10px',
              marginBottom: space[2],
            }}
          />

          {/* Category filter */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              flexWrap: 'wrap',
            }}
          >
            <FilterChip label="All" active={filter === 'all'} onClick={() => setFilter('all')} count={scripts.length} />
            {SCRIPT_CATEGORIES.map((cat) => {
              const count = scripts.filter((s) => s.category === cat.id).length;
              if (count === 0) return null;
              return (
                <FilterChip
                  key={cat.id}
                  label={`${cat.icon} ${cat.label}`}
                  active={filter === cat.id}
                  onClick={() => setFilter(cat.id)}
                  count={count}
                />
              );
            })}
          </div>
        </div>

        {/* ─── Script List ────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: space[3],
          }}
        >
          {/* Built-in section */}
          {builtins.length > 0 && (
            <div style={{ marginBottom: space[4] }}>
              <div
                style={{
                  ...text.label,
                  fontSize: 9,
                  marginBottom: space[2],
                  color: C.t3,
                }}
              >
                Built-in ({builtins.length})
              </div>

              {builtins.map((script) => (
                <ScriptRow
                  key={script.id}
                  script={script}
                  onToggle={() => toggleScript(script.id)}
                  onEdit={() => onEditScript?.(script.id)}
                  onDuplicate={() => handleDuplicate(script.id)}
                  onDelete={null} // Can't delete built-ins
                />
              ))}
            </div>
          )}

          {/* User scripts section */}
          <div>
            <div
              style={{
                ...text.label,
                fontSize: 9,
                marginBottom: space[2],
                color: C.t3,
              }}
            >
              My Scripts ({userScripts.length})
            </div>

            {userScripts.length === 0 ? (
              <div
                style={{
                  padding: space[6],
                  textAlign: 'center',
                  color: C.t3,
                }}
              >
                <div style={{ fontSize: 28, marginBottom: space[2], opacity: 0.5 }}>✏️</div>
                <div style={{ ...text.bodySm, marginBottom: space[3] }}>No custom scripts yet.</div>
                <Btn onClick={handleCreate} style={{ fontSize: 11 }}>
                  + New Script
                </Btn>
              </div>
            ) : (
              userScripts.map((script) => (
                <ScriptRow
                  key={script.id}
                  script={script}
                  onToggle={() => toggleScript(script.id)}
                  onEdit={() => onEditScript?.(script.id)}
                  onDuplicate={() => handleDuplicate(script.id)}
                  onDelete={() => handleDelete(script.id, script.name)}
                />
              ))
            )}
          </div>
        </div>

        {/* ─── Footer ─────────────────────────────────── */}
        <div
          style={{
            padding: space[3],
            borderTop: `1px solid ${C.bd}`,
            display: 'flex',
            gap: space[2],
          }}
        >
          <Btn onClick={handleCreate} style={{ flex: 1, fontSize: 11, padding: '8px' }}>
            + New Script
          </Btn>
          <div
            style={{
              ...text.captionSm,
              alignSelf: 'center',
              color: C.t3,
            }}
          >
            {scripts.filter((s) => s.enabled).length} active
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Script Row ───────────────────────────────────────────

function ScriptRow({ script, onToggle, onEdit, onDuplicate, onDelete }) {
  const [hovered, setHovered] = useState(false);

  const catInfo = SCRIPT_CATEGORIES.find((c) => c.id === script.category);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space[2],
        padding: `${space[2]}px ${space[2]}px`,
        marginBottom: 2,
        borderRadius: radii.md,
        background: hovered ? C.sf2 : 'transparent',
        transition: `background ${transition.fast}`,
      }}
    >
      {/* Toggle switch */}
      <ToggleSwitch enabled={script.enabled} onToggle={onToggle} />

      {/* Info */}
      <div style={{ flex: 1, cursor: 'pointer', minWidth: 0 }} onClick={onEdit}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space[1],
          }}
        >
          {catInfo && <span style={{ fontSize: 10 }}>{catInfo.icon}</span>}
          <span
            style={{
              ...text.bodySm,
              color: C.t1,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {script.name}
          </span>
          {script.builtin && (
            <span
              style={{
                ...preset.badge,
                fontSize: 7,
                padding: '1px 4px',
                background: C.b + '20',
                color: C.b,
              }}
            >
              BUILT-IN
            </span>
          )}
        </div>
        {script.description && (
          <div
            style={{
              ...text.captionSm,
              fontSize: 9,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: 1,
            }}
          >
            {script.description}
          </div>
        )}
      </div>

      {/* Actions (visible on hover) */}
      {hovered && (
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <ActionBtn title="Edit" onClick={onEdit}>
            ✎
          </ActionBtn>
          <ActionBtn title="Duplicate" onClick={onDuplicate}>
            ⧉
          </ActionBtn>
          {onDelete && (
            <ActionBtn title="Delete" onClick={onDelete} danger>
              ✕
            </ActionBtn>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Toggle Switch ────────────────────────────────────────

function ToggleSwitch({ enabled, onToggle }) {
  return (
    <button
      className="tf-btn"
      onClick={onToggle}
      style={{
        width: 28,
        height: 16,
        borderRadius: 8,
        border: 'none',
        background: enabled ? C.g : C.bd2,
        position: 'relative',
        cursor: 'pointer',
        flexShrink: 0,
        transition: `background ${transition.base}`,
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          background: '#fff',
          position: 'absolute',
          top: 2,
          left: enabled ? 14 : 2,
          transition: `left ${transition.base}`,
        }}
      />
    </button>
  );
}

// ─── Filter Chip ──────────────────────────────────────────

function FilterChip({ label, active, onClick, count }) {
  return (
    <button
      className="tf-btn"
      onClick={onClick}
      style={{
        padding: '3px 8px',
        borderRadius: radii.pill,
        border: `1px solid ${active ? C.b : C.bd}`,
        background: active ? C.b + '15' : 'transparent',
        color: active ? C.b : C.t3,
        fontSize: 9,
        fontWeight: 600,
        fontFamily: M,
        cursor: 'pointer',
        transition: `all ${transition.fast}`,
      }}
    >
      {label} {count > 0 && <span style={{ opacity: 0.6 }}>({count})</span>}
    </button>
  );
}

// ─── Action Button ────────────────────────────────────────

function ActionBtn({ children, onClick, title, danger = false }) {
  return (
    <button
      className="tf-btn"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      style={{
        width: 22,
        height: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.sm,
        border: 'none',
        background: 'transparent',
        color: danger ? C.r : C.t3,
        fontSize: 11,
        cursor: 'pointer',
        transition: `background ${transition.fast}`,
      }}
      onMouseEnter={(e) => (e.target.style.background = danger ? C.r + '20' : C.bd)}
      onMouseLeave={(e) => (e.target.style.background = 'transparent')}
    >
      {children}
    </button>
  );
}
