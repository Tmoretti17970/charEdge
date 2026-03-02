import { useState, useEffect } from 'react';
import { C, F, M } from '../../../constants.js';

const MOCK_EVENTS = {
  all: [
    {
      id: 1,
      time: '08:30 AM',
      currency: 'USD',
      impact: 'High',
      event: 'Core PCE Price Index m/m',
      forecast: '0.2%',
      previous: '0.2%',
      actual: null,
    },
    {
      id: 101,
      time: '12:00 PM',
      currency: 'CRYPTO',
      impact: 'High',
      event: 'Mt. Gox Distribution',
      forecast: '-',
      previous: '-',
      actual: null,
    },
    {
      id: 3,
      time: '09:45 AM',
      currency: 'USD',
      impact: 'Medium',
      event: 'Chicago PMI',
      forecast: '48.1',
      previous: '46.0',
      actual: null,
    },
  ],
  crypto: [
    {
      id: 101,
      time: '12:00 PM',
      currency: 'CRYPTO',
      impact: 'High',
      event: 'Mt. Gox Distribution',
      forecast: '-',
      previous: '-',
      actual: null,
    },
    {
      id: 102,
      time: '02:00 PM',
      currency: 'ETH',
      impact: 'Medium',
      event: 'Pectra Upgrade Devnet',
      forecast: '-',
      previous: '-',
      actual: null,
    },
  ],
  macro: [
    {
      id: 1,
      time: '08:30 AM',
      currency: 'USD',
      impact: 'High',
      event: 'Core PCE Price Index m/m',
      forecast: '0.2%',
      previous: '0.2%',
      actual: null,
    },
    {
      id: 2,
      time: '08:30 AM',
      currency: 'USD',
      impact: 'High',
      event: 'Personal Spending m/m',
      forecast: '0.4%',
      previous: '0.5%',
      actual: null,
    },
    {
      id: 3,
      time: '09:45 AM',
      currency: 'USD',
      impact: 'Medium',
      event: 'Chicago PMI',
      forecast: '48.1',
      previous: '46.0',
      actual: null,
    },
  ],
};

export default function MacroCalendarWidget({ category = 'all' }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // Simulate fetching
    setEvents(MOCK_EVENTS[category] || MOCK_EVENTS.all);
  }, [category]);

  const getImpactColor = (impact) => {
    switch (impact) {
      case 'High':
        return C.dn; // Red for high impact
      case 'Medium':
        return '#FF9800'; // Orange
      case 'Low':
        return '#FFEB3B'; // Yellow
      default:
        return C.t3;
    }
  };

  return (
    <div
      style={{
        background: C.bg2,
        borderRadius: 16,
        border: `1px solid ${C.bd}`,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: F }}>Macro Calendar</h3>
        <span style={{ fontSize: 12, color: C.t3, fontFamily: M }}>Today (EST)</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {events.map((ev) => (
          <div
            key={ev.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              background: C.bg,
              borderRadius: 8,
              border: `1px solid ${C.bd}`,
            }}
          >
            <div style={{ minWidth: 60, fontSize: 12, color: C.t2, fontFamily: M, fontWeight: 600 }}>{ev.time}</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 50 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{ev.currency}</span>
              <div style={{ display: 'flex', gap: 2 }}>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background:
                        i <= (ev.impact === 'High' ? 3 : ev.impact === 'Medium' ? 2 : 1)
                          ? getImpactColor(ev.impact)
                          : C.sf,
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.t1, fontFamily: F }}>{ev.event}</div>

            <div style={{ display: 'flex', gap: 16, textAlign: 'right', minWidth: 100 }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 10, color: C.t3 }}>Forecast</span>
                <span style={{ fontSize: 12, color: C.t2, fontFamily: M }}>{ev.forecast}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 10, color: C.t3 }}>Previous</span>
                <span style={{ fontSize: 12, color: C.t2, fontFamily: M }}>{ev.previous}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
