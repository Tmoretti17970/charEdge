// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — usePanelStore (DEPRECATED — re-export shim)
//
// Phase 0.3: This store has been consolidated into useLayoutStore.
// This file re-exports useLayoutStore for backward compatibility.
//
// NOTE: Action names were prefixed to avoid collisions:
//   open → openPanel
//   close → closePanel
//   toggle → togglePanel
//   back → panelBack
//   setWidth → setPanelWidth
//   getInfo → getPanelInfo
//   getWidth → getPanelWidth
//   isOpen → isPanelOpen
// ═══════════════════════════════════════════════════════════════════

import { useLayoutStore } from './useLayoutStore.js';
import { PANEL_REGISTRY } from './layout/panelSlice.js';

// useLayoutStore IS the panel store — same hook
const usePanelStore = useLayoutStore;

export { usePanelStore, PANEL_REGISTRY };
export default usePanelStore;
