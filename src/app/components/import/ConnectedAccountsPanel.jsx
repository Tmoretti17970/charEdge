// ═══════════════════════════════════════════════════════════════════
// charEdge — Connected Accounts Panel (Phase 7 Sprint 7.2)
//
// Displays list of connected broker accounts with status indicators,
// sync controls, and quick actions.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useEffect } from 'react';
import { C, GLASS } from '../../../constants.js';
import { alpha } from '@/shared/colorUtils';
import { Card } from '../ui/UIKit.jsx';
import { useConnectorStore } from '../../../state/useConnectorStore.js';
import st from './ConnectedAccountsPanel.module.css';

const STATUS_CONFIG = {
  connected: { color: C.g, label: 'Connected', icon: '🟢' },
  syncing: { color: C.b, label: 'Syncing...', icon: '🔄' },
  error: { color: C.r, label: 'Error', icon: '🔴' },
  disconnected: { color: C.t3, label: 'Disconnected', icon: '⚪' },
};

function AccountRow({ connection, onSync, onDisconnect }) {
  const [hovered, setHovered] = useState(false);
  const statusCfg = STATUS_CONFIG[connection.status] || STATUS_CONFIG.disconnected;

  const lastSyncStr = connection.lastSync
    ? new Date(connection.lastSync).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Never';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderBottom: `1px solid ${alpha(C.bd, 0.2)}`,
        background: hovered ? alpha(C.sf, 0.5) : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <span style={{ fontSize: 18 }}>{connection.brokerLogo}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)' }}>
            {connection.brokerName}
          </span>
          <span style={{ fontSize: 8, color: statusCfg.color, fontWeight: 700, fontFamily: 'var(--tf-mono)' }}>
            {statusCfg.icon} {statusCfg.label}
          </span>
        </div>
        <div style={{ fontSize: 10, color: C.t3, fontFamily: 'var(--tf-mono)', marginTop: 1 }}>
          {connection.tradeCount || 0} trades synced · Last: {lastSyncStr}
        </div>
      </div>

      {hovered && (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => onSync(connection.brokerId)}
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              border: `1px solid ${alpha(C.b, 0.2)}`,
              background: alpha(C.b, 0.06),
              color: C.b,
              fontSize: 9,
              fontWeight: 600,
              fontFamily: 'var(--tf-font)',
              cursor: 'pointer',
            }}
          >
            Sync
          </button>
          <button
            onClick={() => onDisconnect(connection.brokerId)}
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              border: `1px solid ${alpha(C.r, 0.2)}`,
              background: 'transparent',
              color: C.r,
              fontSize: 9,
              fontWeight: 600,
              fontFamily: 'var(--tf-font)',
              cursor: 'pointer',
            }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

function ConnectedAccountsPanel({ onConnectNew }) {
  const { connections, loaded, load } = useConnectorStore();

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  const handleSync = useCallback(async (brokerId) => {
    const { syncOne } = await import('../../../data/connectors/SyncEngine.js');
    const result = await syncOne(brokerId);
    if (result.ok) {
      useConnectorStore.getState().updateSyncStatus(brokerId, {
        lastSync: Date.now(),
        tradeCount: (useConnectorStore.getState().getConnection(brokerId)?.tradeCount || 0) + result.tradeCount,
        status: 'connected',
      });
    }
  }, []);

  const handleDisconnect = useCallback(async (brokerId) => {
    const { destroyConnector } = await import('../../../data/connectors/ConnectorRegistry.js');
    const { deleteCredentials } = await import('../../../security/CredentialVault.js');
    destroyConnector(brokerId);
    await deleteCredentials(brokerId);
    useConnectorStore.getState().removeConnection(brokerId);
  }, []);

  if (connections.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: C.t1, fontFamily: 'var(--tf-font)', margin: 0 }}>
          Connected Accounts
        </h2>
        <button
          onClick={onConnectNew}
          style={{
            fontSize: 10,
            fontWeight: 600,
            fontFamily: 'var(--tf-font)',
            padding: '4px 10px',
            borderRadius: 6,
            border: `1px solid ${alpha(C.b, 0.2)}`,
            background: alpha(C.b, 0.06),
            color: C.b,
            cursor: 'pointer',
          }}
        >
          + Connect
        </button>
      </div>

      <Card style={{ overflow: 'hidden', background: GLASS.subtle }}>
        {connections.map((conn) => (
          <AccountRow
            key={conn.brokerId}
            connection={conn}
            onSync={handleSync}
            onDisconnect={handleDisconnect}
          />
        ))}
      </Card>
    </div>
  );
}

export default React.memo(ConnectedAccountsPanel);
