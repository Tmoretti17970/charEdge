// ═══════════════════════════════════════════════════════════════════
// WorkspaceLayout — Theme Overrides
// flexlayout-react ships a dark.css, but we need to match
// charEdge's Forge palette.
// ═══════════════════════════════════════════════════════════════════

import { C, F } from '../../../constants.js';

const THEME_OVERRIDES = `
  .flexlayout__layout {
    --color-text: ${C.t1};
    --color-background: ${C.bg};
    --color-base: ${C.bg};
    --color-1: ${C.bg2};
    --color-2: ${C.sf};
    --color-3: ${C.sf2};
    --color-4: ${C.bd};
    --color-5: ${C.bd2};
    --color-6: ${C.t3};
    --color-drag1: ${C.b}40;
    --color-drag2: ${C.b}20;
    --color-drag1-background: ${C.b}15;
    --color-drag2-background: ${C.b}08;
    --color-tabset-background: ${C.bg2};
    --color-tabset-header-background: ${C.bg};
    --color-tabset-background-selected: ${C.bg};
    --font-family: ${F};
    --font-size: 12px;
  }
  .flexlayout__tab_button--selected {
    color: ${C.t1} !important;
    background: ${C.bg} !important;
  }
  .flexlayout__tab_button {
    color: ${C.t3} !important;
    font-family: ${F} !important;
    font-size: 12px !important;
  }
  .flexlayout__tab_button:hover {
    color: ${C.t2} !important;
    background: ${C.sf} !important;
  }
  .flexlayout__splitter {
    background: ${C.bd} !important;
  }
  .flexlayout__splitter:hover {
    background: ${C.b}50 !important;
  }
  .flexlayout__tabset-selected {
    border-bottom: 2px solid ${C.b} !important;
  }
  .flexlayout__tab {
    background: ${C.bg} !important;
    overflow: hidden !important;
  }
  .flexlayout__tabset_header {
    background: ${C.bg2} !important;
    border-bottom: 1px solid ${C.bd} !important;
  }
  .flexlayout__tabset_tabbar_outer {
    background: ${C.bg2} !important;
    border-bottom: 1px solid ${C.bd} !important;
  }
  .flexlayout__border_button {
    color: ${C.t3} !important;
  }
`;

export default THEME_OVERRIDES;
