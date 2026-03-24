// Section 4: Sentiment Snapshot for Morning Briefing
import { C } from '@/constants.js';
import { alpha } from '@/shared/colorUtils';
import st from './SentimentSnapshot.module.css';

export default function SentimentSnapshot({ data }) {
  const fgColor = data.fearGreed > 70 ? C.g : data.fearGreed > 40 ? C.y : C.r;
  const socialColor = data.socialSentiment > 60 ? C.g : data.socialSentiment > 40 ? C.y : C.r;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
      <SentimentCard label="Fear & Greed" value={data.fearGreed} sub={data.fearGreedLabel} color={fgColor} />
      <SentimentCard label="Social Sentiment" value={data.socialSentiment} sub={data.socialLabel} color={socialColor} />
      <SentimentCard label="BTC Dominance" value={`${data.btcDominance}%`} sub="" color={C.t1} />
      <SentimentCard label="Total Market Cap" value={`$${data.totalMarketCap}`} sub="" color={C.t1} />
    </div>
  );
}

function SentimentCard({ label, value, sub, color }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: alpha(C.bg2, 0.6),
        borderRadius: 10,
        border: `1px solid ${alpha(C.bd, 0.3)}`,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 600, color: C.t3, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'var(--tf-font)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'var(--tf-mono)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: C.t3, fontFamily: 'var(--tf-font)', marginTop: 2, fontWeight: 600 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
