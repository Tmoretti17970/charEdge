// ═══════════════════════════════════════════════════════════════════
// charEdge — ReactionBar Overlay (Global Mount)
//
// Wrapper that uses the useReactionBar() hook to auto-show the
// ReactionBar after any trade is logged. Mounted in App.jsx.
// ═══════════════════════════════════════════════════════════════════

import { Suspense } from 'react';
import ReactionBar, { useReactionBar } from './ReactionBar.jsx';

export default function ReactionBarOverlay() {
    const { tradeId, visible, dismiss } = useReactionBar();

    if (!visible || !tradeId) return null;

    return (
        <Suspense fallback={null}>
            <ReactionBar tradeId={tradeId} onDismiss={dismiss} />
        </Suspense>
    );
}
