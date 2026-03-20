// ═══════════════════════════════════════════════════════════════════
// charEdge — DrawingToolSelector  (Sprint 5)
// Tiered popover for selecting drawing tools. Progressive disclosure:
//   Essential → always visible (6 tools, keyboard shortcuts)
//   Common    → collapsible section (~14 tools)
//   Advanced  → collapsible section (~22 tools)
// Includes instant search across all tiers.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { TOOL_DEFS, TOOL_ICONS, TIcon } from '../../../../shared/drawingToolRegistry';
import { useChartToolsStore } from '../../../../state/chart/useChartToolsStore';
import s from './DrawingToolSelector.module.css';

// ─── Main Component ──────────────────────────────────────────────

export default function DrawingToolSelector({ open, onClose, activeTool, setActiveTool, anchorRef }) {
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const [search, setSearch] = useState('');
  const [commonOpen, setCommonOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const stickyMode = useChartToolsStore((s) => s.stickyMode);
  const toggleStickyMode = useChartToolsStore((s) => s.toggleStickyMode);

  // Focus search on open
  useEffect(() => {
    if (open) {
      setSearch('');
      setAdvancedOpen(false);
      setTimeout(() => searchRef.current?.focus(), 60);
    }
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        if (anchorRef?.current && anchorRef.current.contains(e.target)) return;
        onClose();
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [open, onClose, anchorRef]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [open, onClose]);

  // Filter tools by search
  const filtered = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return TOOL_DEFS.filter(t =>
      t.label.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  }, [search]);

  const handleSelect = useCallback((toolId) => {
    setActiveTool(toolId);
    onClose();
  }, [setActiveTool, onClose]);

  if (!open) return null;

  // Split by tier
  const essential = TOOL_DEFS.filter(t => t.tier === 'essential');
  const common = TOOL_DEFS.filter(t => t.tier === 'common');
  const advanced = TOOL_DEFS.filter(t => t.tier === 'advanced');

  return (
    <div
      ref={panelRef}
      className={s.panel}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* ─── Search ─── */}
      <div className={s.searchWrap}>
        <div className={s.searchBar}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.5, flexShrink: 0, color: 'var(--tf-t3)' }}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
            <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            ref={searchRef}
            placeholder="Search tools…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={s.searchInput}
          />
          {search && (
            <button onClick={() => setSearch('')} className={s.searchClear}>✕</button>
          )}
        </div>
      </div>

      {/* ─── Search results ─── */}
      {filtered ? (
        <div className={s.searchResults}>
          {filtered.length === 0 ? (
            <div className={s.noResults}>
              No tools match "{search}"
            </div>
          ) : (
            <div className={s.toolGrid4}>
              {filtered.map(t => (
                <ToolItem key={t.id} tool={t} active={activeTool === t.id} onSelect={handleSelect} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ─── Essential ─── */}
          <TierSection title="Essential" badge={essential.length} alwaysOpen>
            <div className={s.toolGrid3}>
              {essential.map(t => (
                <ToolItem key={t.id} tool={t} active={activeTool === t.id} onSelect={handleSelect} showShortcut />
              ))}
            </div>
          </TierSection>

          {/* ─── Common ─── */}
          <TierSection title="Common" badge={common.length} open={commonOpen} onToggle={() => setCommonOpen(!commonOpen)}>
            <div className={s.toolGrid4}>
              {common.map(t => (
                <ToolItem key={t.id} tool={t} active={activeTool === t.id} onSelect={handleSelect} />
              ))}
            </div>
          </TierSection>

          {/* ─── Advanced ─── */}
          <TierSection title="Advanced" badge={advanced.length} open={advancedOpen} onToggle={() => setAdvancedOpen(!advancedOpen)}>
            <div className={s.toolGrid4}>
              {advanced.map(t => (
                <ToolItem key={t.id} tool={t} active={activeTool === t.id} onSelect={handleSelect} />
              ))}
            </div>
          </TierSection>
        </>
      )}

      {/* ─── Sticky Mode Toggle ─── */}
      <div className={s.stickyFooter}>
        <span className={s.stickyLabel}>
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.5 }}>
            <rect x="4" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
            <path d="M4 5H2.5A1.5 1.5 0 001 6.5v5A1.5 1.5 0 002.5 13h5a1.5 1.5 0 001.5-1.5V10" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
          Stay in drawing mode
        </span>
        <button onClick={toggleStickyMode} className={s.toggleTrack} data-on={stickyMode || undefined}>
          <span className={s.toggleKnob} />
        </button>
      </div>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────

function TierSection({ title, badge, children, open, onToggle, alwaysOpen }) {
  const isOpen = alwaysOpen || open;
  return (
    <div className={s.tierSection}>
      <button
        onClick={alwaysOpen ? undefined : onToggle}
        className={s.tierHeader}
        style={{ cursor: alwaysOpen ? 'default' : 'pointer' }}
      >
        {!alwaysOpen && (
          <span className={s.tierArrow} data-open={isOpen || undefined}>▸</span>
        )}
        <span className={s.tierTitle}>{title}</span>
        <span className={s.tierBadge}>{badge}</span>
      </button>
      {isOpen && (
        <div className={s.tierBody}>
          {children}
        </div>
      )}
    </div>
  );
}

function ToolItem({ tool, active, onSelect, showShortcut }) {
  return (
    <button
      onClick={() => onSelect(tool.id)}
      title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
      className={s.toolItem}
      data-active={active || undefined}
    >
      <div className={s.toolIcon}>
        <TIcon id={tool.id} />
      </div>
      <span className={s.toolLabel}>
        {tool.label}
      </span>
      {showShortcut && tool.shortcut && (
        <span className={s.shortcutBadge}>
          {tool.shortcut}
        </span>
      )}
    </button>
  );
}
