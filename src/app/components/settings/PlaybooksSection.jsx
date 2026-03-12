import React from 'react';
import PlaybookManager from '../../features/playbook/PlaybookManager.jsx';
import { Card } from '../ui/UIKit.jsx';
import { SectionHeader } from './SettingsHelpers.jsx';

function PlaybooksSection() {
  return (
    <section style={{ marginBottom: 40 }}>
      <SectionHeader icon="book" title="Playbooks" description="Define and manage your trading strategies" />
      <Card style={{ padding: 20 }}>
        <PlaybookManager />
      </Card>
    </section>
  );
}

export default React.memo(PlaybooksSection);
