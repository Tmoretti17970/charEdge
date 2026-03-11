import { useState, useEffect } from 'react';
import { useSocialStore } from '../../../state/useSocialStore.js';
import PollCard from './PollCard.jsx';

export default function ContextualPoll({ symbol }) {
  const [dismissed, setDismissed] = useState(false);
  const polls = useSocialStore((s) => s.polls);

  // Reset dismissed state when symbol changes
  useEffect(() => {
    setDismissed(false);
  }, [symbol]);

  // Find an active poll for this ticker
  const activePoll = polls.find((p) => p.ticker === symbol && p.status === 'active');

  if (!activePoll || dismissed) return null;

  return (
    <div
      className="tf-slide-up"
      style={{
        position: 'absolute',
        bottom: 24,
        left: 24,
        width: 300,
        zIndex: 200,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        borderRadius: 12,
      }}
    >
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setDismissed(true)}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(0,0,0,0.5)',
            border: 'none',
            color: '#fff',
            width: 20,
            height: 20,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10,
            fontSize: 12,
          }}
          title="Dismiss"
        >
          ×
        </button>
        <PollCard pollId={activePoll.id} compact={true} />
      </div>
    </div>
  );
}
