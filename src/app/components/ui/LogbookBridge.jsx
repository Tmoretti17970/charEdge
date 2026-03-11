// ═══════════════════════════════════════════════════════════════════
// charEdge — Logbook Bridge
//
// Lightweight component that listens for the 'charEdge:open-logbook'
// custom event and renders SpotlightLogbook as an overlay modal.
//
// Replaces the old CommandPalette (⌘K was removed).
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import SpotlightLogbook from './SpotlightLogbook.jsx';

export default function LogbookBridge() {
    const [open, setOpen] = useState(false);
    const [filterDate, setFilterDate] = useState(null);

    useEffect(() => {
        const handler = (e) => {
            setFilterDate(e.detail?.date || null);
            setOpen(true);
        };
        window.addEventListener('charEdge:open-logbook', handler);
        return () => window.removeEventListener('charEdge:open-logbook', handler);
    }, []);

    if (!open) return null;

    return (
        <SpotlightLogbook
            isOpen={true}
            onClose={() => setOpen(false)}
            filterDate={filterDate}
        />
    );
}
