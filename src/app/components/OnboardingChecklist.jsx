import React, { useState, useEffect } from 'react';

const s = {
  card: { background:'var(--bg-secondary,#1e1e2e)', borderRadius:'12px', border:'1px solid var(--border,rgba(255,255,255,0.08))', padding:'20px', marginBottom:'16px' },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' },
  title: { fontSize:'16px', fontWeight:600, color:'var(--text-primary,#e0e0e0)', display:'flex', alignItems:'center', gap:'8px' },
  dismiss: { background:'transparent', border:'none', color:'var(--text-secondary,#888)', cursor:'pointer', fontSize:'18px', padding:'4px' },
  bar: { height:'6px', borderRadius:'3px', background:'rgba(255,255,255,0.06)', marginBottom:'16px', overflow:'hidden' },
  fill: { height:'100%', borderRadius:'3px', transition:'width 0.4s ease' },
  badge: { display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 10px', borderRadius:'12px', fontSize:'11px', fontWeight:600, textTransform:'uppercase' },
  steps: { display:'flex', flexDirection:'column', gap:'8px' },
  step: { display:'flex', alignItems:'center', gap:'10px', padding:'6px 0', fontSize:'13px' },
  check: { width:'18px', height:'18px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', flexShrink:0 },
};

const TC = { basic:{bg:'rgba(99,102,241,0.15)',c:'#818cf8',g:'linear-gradient(90deg,#818cf8,#6366f1)'}, pro:{bg:'rgba(245,158,11,0.15)',c:'#f59e0b',g:'linear-gradient(90deg,#f59e0b,#d97706)'}, expert:{bg:'rgba(16,185,129,0.15)',c:'#10b981',g:'linear-gradient(90deg,#10b981,#059669)'} };
const TI = { basic:'🌱', pro:'⚡', expert:'🏆' };

export default function OnboardingChecklist() {
  const [progress, setProgress] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { aiFeatureGate } = await import('../../ai/AIFeatureGate');
        setProgress(aiFeatureGate.getOnboardingProgress());
      } catch {}
    })();
    try { if (localStorage.getItem('charEdge-onboarding-dismissed')==='true') setDismissed(true); } catch {}
  }, []);

  if (dismissed || !progress || progress.percentage === 100) return null;
  const t = progress.currentTier;
  const tc = TC[t];

  return React.createElement('div', { style: s.card, role:'region', 'aria-label':'Onboarding' },
    React.createElement('div', { style: s.header },
      React.createElement('div', { style: s.title }, '🚀 Getting Started',
        React.createElement('span', { style: { ...s.badge, background:tc.bg, color:tc.c } }, `${TI[t]} ${t.toUpperCase()}`)),
      React.createElement('button', { style: s.dismiss, onClick: () => { setDismissed(true); try { localStorage.setItem('charEdge-onboarding-dismissed','true'); } catch {} }, 'aria-label':'Dismiss' }, '×')),
    React.createElement('div', { style: s.bar },
      React.createElement('div', { style: { ...s.fill, width:`${progress.percentage}%`, background:tc.g }, role:'progressbar', 'aria-valuenow':progress.percentage })),
    React.createElement('div', { style: s.steps },
      progress.steps.slice(0,5).map(step =>
        React.createElement('div', { key: step.id, style: s.step },
          React.createElement('div', { style: { ...s.check, background: step.completed ? tc.g : 'rgba(255,255,255,0.06)', color: step.completed ? '#fff' : '#888' } }, step.completed ? '✓' : ''),
          React.createElement('div', null,
            React.createElement('div', { style: { color:'var(--text-primary,#e0e0e0)', textDecoration: step.completed ? 'line-through' : 'none', opacity: step.completed ? 0.5 : 1 } }, step.label),
            !step.completed && React.createElement('div', { style: { fontSize:'11px', color:'#888' } }, step.description))))));
}
