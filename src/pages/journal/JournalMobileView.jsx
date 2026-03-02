// ═══════════════════════════════════════════════════════════════════
// JournalMobileView — Mobile journal render path
// Extracted from JournalPage (Phase 0.1 decomposition)
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, F } from '../../constants.js';
import MobileJournal from '../../app/components/mobile/MobileJournal.jsx';
import { MobileAnalytics } from '../../app/components/mobile/MobileAnalytics.jsx';
import TradeFormModal from '../../app/components/dialogs/TradeFormModal.jsx';
import CSVImportModal from '../../app/components/dialogs/CSVImportModal.jsx';

export default function JournalMobileView({
  trades,
  journalTab,
  setJournalTab,
  result,
  handleEdit,
  handleDelete,
  openAddTrade,
  tradeFormOpen,
  closeTradeForm,
  editTrade,
  csvModalOpen,
  setCsvModalOpen,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100vh', background: C.bg }}>
      {/* Mobile Tab Switcher */}
      <div style={{ display: 'flex', padding: '12px 16px', gap: 8, background: C.sf, borderBottom: `1px solid ${C.bd}` }}>
        {['Logbook', 'Analytics'].map((t) => {
          const isActive = (t === 'Logbook' && journalTab === 'trades') || (t === 'Analytics' && journalTab !== 'trades');
          return (
            <button
              key={t}
              onClick={() => setJournalTab(t === 'Logbook' ? 'trades' : 'overview')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: 8,
                background: isActive ? C.b : 'transparent',
                color: isActive ? '#fff' : C.t2,
                border: `1px solid ${isActive ? C.b : C.bd}`,
                fontFamily: F,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {journalTab === 'trades' ? (
          <MobileJournal trades={trades} onEdit={handleEdit} onDelete={(id) => handleDelete(id)} onAdd={openAddTrade} />
        ) : (
          <MobileAnalytics analytics={result} trades={trades} />
        )}
      </div>

      <TradeFormModal
        isOpen={tradeFormOpen}
        onClose={closeTradeForm}
        editTrade={editTrade}
      />
      <CSVImportModal isOpen={csvModalOpen} onClose={() => setCsvModalOpen(false)} />
    </div>
  );
}
