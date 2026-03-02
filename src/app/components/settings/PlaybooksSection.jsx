import { Card } from '../ui/UIKit.jsx';
import PlaybookManager from '../../features/playbook/PlaybookManager.jsx';
import { SectionHeader } from './SettingsHelpers.jsx';

export default function PlaybooksSection() {
  return (
    <section style={{ marginBottom: 40 }}>
      <SectionHeader icon="book" title="Playbooks" description="Define and manage your trading strategies" />
      <Card style={{ padding: 20 }}>
        <PlaybookManager />
      </Card>
    </section>
  );
}
