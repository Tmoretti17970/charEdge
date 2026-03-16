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
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: 6,
        width: 320,
        maxHeight: 460,
        overflowY: 'auto',
        borderRadius: 14,
        background: 'var(--tf-glass-3)',
        backdropFilter: 'blur(28px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.6)',
        border: 'var(--tf-glass-border)',
        boxShadow: 'var(--tf-shadow-3), var(--tf-inner-glow-strong)',
        zIndex: 1000,
        fontFamily: "var(--tf-font)",
        fontSize: 12,
        color: 'var(--tf-t1)',
        animation: 'tfDropdownIn 0.18s cubic-bezier(0.16,1,0.3,1)',
        userSelect: 'none',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* ─── Search ─── */}
      <div style={{ padding: '10px 10px 6px', borderBottom: '1px solid var(--tf-bd)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'color-mix(in srgb, var(--tf-t2) 8%, transparent)', borderRadius: 8,
          padding: '6px 10px', border: '1px solid var(--tf-bd)',
        }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.5, flexShrink: 0, color: 'var(--tf-t3)' }}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
            <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            ref={searchRef}
            placeholder="Search tools…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--tf-t1)', fontSize: 12, width: '100%',
              fontFamily: 'inherit',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                background: 'none', border: 'none', color: 'var(--tf-t3)',
                cursor: 'pointer', fontSize: 11, padding: 0,
              }}
            >✕</button>
          )}
        </div>
      </div>

      {/* ─── Search results ─── */}
      {filtered ? (
        <div style={{ padding: '4px 6px 8px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '16px 10px', textAlign: 'center', color: 'var(--tf-t3)', fontSize: 11 }}>
              No tools match "{search}"
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              {essential.map(t => (
                <ToolItem key={t.id} tool={t} active={activeTool === t.id} onSelect={handleSelect} showShortcut />
              ))}
            </div>
          </TierSection>

          {/* ─── Common ─── */}
          <TierSection title="Common" badge={common.length} open={commonOpen} onToggle={() => setCommonOpen(!commonOpen)}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
              {common.map(t => (
                <ToolItem key={t.id} tool={t} active={activeTool === t.id} onSelect={handleSelect} />
              ))}
            </div>
          </TierSection>

          {/* ─── Advanced ─── */}
          <TierSection title="Advanced" badge={advanced.length} open={advancedOpen} onToggle={() => setAdvancedOpen(!advancedOpen)}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
              {advanced.map(t => (
                <ToolItem key={t.id} tool={t} active={activeTool === t.id} onSelect={handleSelect} />
              ))}
            </div>
          </TierSection>
        </>
      )}

      {/* ─── Sticky Mode Toggle ─── */}
      <div style={{
        padding: '8px 12px', borderTop: '1px solid var(--tf-bd)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, color: 'var(--tf-t3)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.5 }}>
            <rect x="4" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
            <path d="M4 5H2.5A1.5 1.5 0 001 6.5v5A1.5 1.5 0 002.5 13h5a1.5 1.5 0 001.5-1.5V10" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
          Stay in drawing mode
        </span>
        <button
          onClick={toggleStickyMode}
          style={{
            width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer',
            background: stickyMode ? 'var(--tf-accent)' : 'color-mix(in srgb, var(--tf-t2) 20%, transparent)',
            position: 'relative', transition: 'background 0.15s',
          }}
        >
          <span style={{
            position: 'absolute', top: 2, width: 14, height: 14, borderRadius: '50%',
            background: stickyMode ? '#fff' : 'var(--tf-t2)',
            transition: 'left 0.15s',
            left: stickyMode ? 16 : 2,
          }} />
        </button>
      </div>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────

function TierSection({ title, badge, children, open, onToggle, alwaysOpen }) {
  const isOpen = alwaysOpen || open;
  return (
    <div style={{ borderBottom: '1px solid var(--tf-bd)' }}>
      <button
        onClick={alwaysOpen ? undefined : onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          width: '100%', padding: '6px 12px',
          background: 'none', border: 'none',
          cursor: alwaysOpen ? 'default' : 'pointer',
          color: 'var(--tf-t2)', fontSize: 10, fontWeight: 600,
          letterSpacing: 0.5, textTransform: 'uppercase',
          textAlign: 'left',
        }}
      >
        {!alwaysOpen && (
          <span style={{
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s', display: 'inline-block', fontSize: 9,
          }}>▸</span>
        )}
        <span style={{ flex: 1 }}>{title}</span>
        <span style={{
          background: 'color-mix(in srgb, var(--tf-t2) 15%, transparent)',
          borderRadius: 8, padding: '1px 6px',
          fontSize: 9, color: 'var(--tf-t3)',
        }}>{badge}</span>
      </button>
      {isOpen && (
        <div style={{ padding: '0 6px 6px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function ToolItem({ tool, active, onSelect, showShortcut }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => onSelect(tool.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 3, padding: '8px 4px',
        borderRadius: 8, border: 'none',
        background: active
          ? 'color-mix(in srgb, var(--tf-accent) 15%, transparent)'
          : hovered
            ? 'color-mix(in srgb, var(--tf-t2) 12%, transparent)'
            : 'transparent',
        color: active ? 'var(--tf-accent)' : 'var(--tf-t1)',
        cursor: 'pointer', outline: 'none',
        transition: 'background 0.12s, transform 0.1s',
        transform: hovered ? 'scale(1.04)' : 'scale(1)',
        position: 'relative',
      }}
    >
      <div style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <TIcon id={tool.id} />
      </div>
      <span style={{
        fontSize: 9, fontWeight: 500,
        color: active ? 'var(--tf-accent)' : 'var(--tf-t2)',
        whiteSpace: 'nowrap', overflow: 'hidden',
        textOverflow: 'ellipsis', maxWidth: '100%',
        lineHeight: 1.1,
      }}>
        {tool.label}
      </span>
      {showShortcut && tool.shortcut && (
        <span style={{
          position: 'absolute', top: 2, right: 3,
          fontSize: 8, fontWeight: 600,
          color: active ? 'var(--tf-accent)' : 'var(--tf-t3)',
          background: 'color-mix(in srgb, var(--tf-t2) 8%, transparent)',
          borderRadius: 3, padding: '0 3px',
          fontFamily: "'SF Mono', monospace",
        }}>
          {tool.shortcut}
        </span>
      )}
    </button>
  );
}
