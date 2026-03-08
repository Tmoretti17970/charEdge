import { useEffect, useState } from 'react';
import { C, F } from '../../../constants.js';
import { fetchMarketNews } from '../../../services/socialService.js';
import LabsBadge from '../ui/LabsBadge.jsx';

export default function NewsFeed({ category = 'all' }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadNews = () => {
    setLoading(true);
    setError(null);
    fetchMarketNews(category)
      .then((res) => {
        setNews(res || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load news');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadNews();
  }, [category]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 20 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            background: C.bg2, borderRadius: 12, height: 180,
            animation: 'pulse 1.5s ease-in-out infinite',
            opacity: 0.5,
          }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, color: C.t3, textAlign: 'center' }}>
        <p style={{ margin: '0 0 8px', color: C.t2 }}>Could not load news</p>
        <button
          onClick={loadNews}
          style={{
            background: C.bg2, border: `1px solid ${C.bd}`, borderRadius: 8,
            padding: '6px 16px', color: C.t1, cursor: 'pointer', fontSize: 13,
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!news.length) {
    return <div style={{ padding: 20, color: C.t3, textAlign: 'center' }}>No news available</div>;
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
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Market News <LabsBadge />
        </span>
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
