// ═══════════════════════════════════════════════════════════════════
// charEdge — Markets Watchlist Tabs (Sprint 19)
//
// Horizontal tab bar above the grid for switching between watchlists.
// Uses the folder system in useWatchlistStore:
//   - "All" tab shows every item
//   - Each root folder becomes a tab
//   - "+" button creates a new folder
//   - Right-click for rename/delete context menu
//   - Double-click for inline rename
// ═══════════════════════════════════════════════════════════════════

import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { C, F, M } from '../../../constants.js';
import { useWatchlistStore } from '../../../state/useWatchlistStore.js';
import { useMarketsPrefsStore } from '../../../state/useMarketsPrefsStore';
import { radii, transition } from '../../../theme/tokens.js';

const ACCENT = '#6e5ce6';

function MarketsWatchlistTabs() {
  const folders = useWatchlistStore((s) => s.folders);
  const addFolder = useWatchlistStore((s) => s.addFolder);
  const renameFolder = useWatchlistStore((s) => s.renameFolder);
  const removeFolder = useWatchlistStore((s) => s.removeFolder);
  const items = useWatchlistStore((s) => s.items);

  const activeId = useMarketsPrefsStore((s) => s.activeWatchlistId);
  const setActiveId = useMarketsPrefsStore((s) => s.setActiveWatchlistId);

  const [renaming, setRenaming] = useState(null);
  const [renameText, setRenameText] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const renameInputRef = useRef(null);

  // Root folders only (parentId null/undefined)
  const rootFolders = folders.filter((f) => !f.parentId);

  // Count items per folder
  const countFor = useCallback(
    (folderId) => items.filter((i) => i.folderId === folderId).length,
    [items],
  );

  // ─── Create new watchlist ──────────────────────────────
  const handleAdd = useCallback(() => {
    const name = `Watchlist ${rootFolders.length + 1}`;
    addFolder(name);
  }, [addFolder, rootFolders.length]);

  // ─── Double-click → inline rename ─────────────────────
  const handleDoubleClick = useCallback((folder) => {
    setRenaming(folder.id);
    setRenameText(folder.name);
    setTimeout(() => renameInputRef.current?.select(), 50);
  }, []);

  const commitRename = useCallback(() => {
    if (renaming && renameText.trim()) {
      renameFolder(renaming, renameText.trim());
    }
    setRenaming(null);
  }, [renaming, renameText, renameFolder]);

  // ─── Right-click context menu ─────────────────────────
  const handleContextMenu = useCallback((e, folder) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, folder });
  }, []);

  // Close context menu on click anywhere
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  const handleDelete = useCallback(() => {
    if (contextMenu?.folder) {
      if (activeId === contextMenu.folder.id) setActiveId(null);
      removeFolder(contextMenu.folder.id);
    }
    setContextMenu(null);
  }, [contextMenu, removeFolder, activeId, setActiveId]);

  const handleRenameFromMenu = useCallback(() => {
    if (contextMenu?.folder) {
      handleDoubleClick(contextMenu.folder);
    }
    setContextMenu(null);
  }, [contextMenu, handleDoubleClick]);

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 16px',
          borderBottom: `1px solid ${C.bd}20`,
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {/* "All" tab */}
        <TabButton
          label={`All (${items.length})`}
          active={activeId === null}
          onClick={() => setActiveId(null)}
        />

        {/* Folder tabs */}
        {rootFolders.map((folder) => (
          renaming === folder.id ? (
            <input
              key={folder.id}
              ref={renameInputRef}
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setRenaming(null);
              }}
              autoFocus
              style={{
                fontSize: 11, fontFamily: F, fontWeight: 600,
                background: `${C.bd}20`, color: C.t1,
                border: `1px solid ${ACCENT}50`,
                borderRadius: radii.sm, padding: '4px 10px',
                outline: 'none', width: 90,
              }}
            />
          ) : (
            <TabButton
              key={folder.id}
              label={`${folder.name} (${countFor(folder.id)})`}
              active={activeId === folder.id}
              onClick={() => setActiveId(folder.id)}
              onDoubleClick={() => handleDoubleClick(folder)}
              onContextMenu={(e) => handleContextMenu(e, folder)}
              color={folder.color}
            />
          )
        ))}

        {/* Add button */}
        <button
          onClick={handleAdd}
          title="New watchlist"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 24, height: 24, borderRadius: radii.sm,
            border: `1px dashed ${C.bd}40`, background: 'transparent',
            color: C.t3, cursor: 'pointer', fontSize: 14,
            transition: `all ${transition.fast}`,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${C.bd}40`; e.currentTarget.style.color = C.t3; }}
        >
          +
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: C.bg,
            border: `1px solid ${C.bd}40`,
            borderRadius: radii.md,
            padding: 4,
            zIndex: 9999,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(12px)',
            minWidth: 120,
          }}
        >
          <MenuButton label="Rename" onClick={handleRenameFromMenu} />
          <MenuButton label="Delete" onClick={handleDelete} danger />
        </div>
      )}
    </>
  );
}

// ─── Tab Button ────────────────────────────────────────────

function TabButton({ label, active, onClick, onDoubleClick, onContextMenu, color }) {
  return (
    <button
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      style={{
        fontSize: 11, fontFamily: F, fontWeight: active ? 700 : 500,
        color: active ? C.t1 : C.t3,
        background: active ? `${ACCENT}18` : 'transparent',
        border: active ? `1px solid ${ACCENT}30` : '1px solid transparent',
        borderRadius: radii.sm,
        padding: '4px 12px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: `all ${transition.fast}`,
        borderBottom: active ? `2px solid ${color || ACCENT}` : '2px solid transparent',
      }}
    >
      {label}
    </button>
  );
}

// ─── Context Menu Button ───────────────────────────────────

function MenuButton({ label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        fontSize: 11, fontFamily: F, fontWeight: 500,
        color: danger ? C.r : C.t2,
        background: 'transparent', border: 'none',
        padding: '6px 12px', borderRadius: 4,
        cursor: 'pointer',
        transition: `background ${transition.fast}`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = `${C.bd}20`; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {label}
    </button>
  );
}

export default memo(MarketsWatchlistTabs);
