import { useEffect, useState } from 'react';
import { C, F } from '../../../constants.js';
import { fetchMarketNews } from '../../../services/socialService.js';

export default function NewsFeed({ category = 'all' }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchMarketNews(category).then((res) => {
      setNews(res);
      setLoading(false);
    });
  }, [category]);

  if (loading) {
    return <div style={{ padding: 20, color: C.t3, textAlign: 'center' }}>Loading latest news...</div>;
  }

  // Format date helper
  const formatTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h3
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 700,
          color: C.t1,
          fontFamily: F,
          paddingBottom: 8,
          borderBottom: `1px solid ${C.bd}`,
        }}
      >
        Market News
      </h3>
      {news.map((item) => (
        <a key={item.id} href={item.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
          <div
            style={{
              background: C.bg2,
              border: `1px solid ${C.bd}`,
              borderRadius: 12,
              overflow: 'hidden',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = `0 4px 12px ${C.bg}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ height: 140, width: '100%', overflow: 'hidden' }}>
              <img src={item.imageUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span
                  style={{ fontSize: 12, fontWeight: 700, color: C.b, textTransform: 'uppercase', letterSpacing: 0.5 }}
                >
                  {item.source}
                </span>
                <span style={{ fontSize: 12, color: C.t3 }}>{formatTime(item.publishedAt)}</span>
              </div>
              <h4
                style={{
                  margin: '0 0 8px 0',
                  fontSize: 15,
                  fontWeight: 700,
                  color: C.t1,
                  fontFamily: F,
                  lineHeight: 1.4,
                }}
              >
                {item.title}
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: C.t2,
                  lineHeight: 1.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {item.description}
              </p>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
