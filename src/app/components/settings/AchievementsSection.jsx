import React from 'react';
import { useState } from 'react';
import { C, M } from '../../../constants.js';
import { useGamificationStore, getRankForXP, getXPToNextLevel, ACHIEVEMENTS, COSMETIC_REWARDS } from '../../../state/useGamificationStore';
import AchievementShelf from '../ui/AchievementShelf.jsx';
import QuestPanel from '../ui/QuestPanel.jsx';
import { Card, Btn } from '../ui/UIKit.jsx';
import { SectionHeader } from './SettingsHelpers.jsx';
import s from './AchievementsSection.module.css';

function AchievementsSection() {
  const xp = useGamificationStore((s) => s.xp);
  const enabled = useGamificationStore((s) => s.enabled);
  const toggleEnabled = useGamificationStore((s) => s.toggleEnabled);
  const notificationPrefs = useGamificationStore((s) => s.notificationPrefs);
  const setNotificationPref = useGamificationStore((s) => s.setNotificationPref);
  const resetProgress = useGamificationStore((s) => s.resetProgress);
  const achievements = useGamificationStore((s) => s.achievements);
  const streaks = useGamificationStore((s) => s.streaks);
  const rank = getRankForXP(xp);
  const progress = getXPToNextLevel(xp);
  const unlockedCount = Object.keys(achievements).length;
  const [confirmReset, setConfirmReset] = useState(false);
  const equippedCosmetic = useGamificationStore((s) => s.equippedCosmetic);
  const equipCosmetic = useGamificationStore((s) => s.equipCosmetic);

  return (
    <section style={{ marginBottom: 40 }}>
      <SectionHeader icon="trophy" title="Gamification" description="XP, achievements, streaks, and progression" />

      {/* Master Toggle */}
      <Card className={s.s0}>
        <div className={s.s1}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>Gamification System</div>
            <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{enabled ? 'XP, achievements, and daily challenges are active' : 'Progression features are disabled'}</div>
          </div>
          <button onClick={toggleEnabled} className="tf-btn"
            style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${enabled ? C.g : C.bd}`, background: enabled ? C.g + '15' : 'transparent', color: enabled ? C.g : C.t3, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
            {enabled ? '✓ Enabled' : 'Disabled'}
          </button>
        </div>
      </Card>

      {/* XP Stats + Rank */}
      {enabled && (
        <Card className={s.s2}>
          <div className={s.s3}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: `linear-gradient(135deg, ${rank.color}20, ${rank.color}08)`, border: `2px solid ${rank.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>{rank.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: M, color: rank.color }}>{rank.name}</div>
              <div style={{ fontSize: 12, color: C.t2, fontFamily: M }}>Level {rank.level} · {xp.toLocaleString()} XP</div>
            </div>
          </div>
          {progress.nextRank && (
            <div style={{ marginBottom: 16 }}>
              <div className={s.s4}>
                <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>{Math.round(progress.progress * 100)}% to {progress.nextRank.name}</span>
                <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>{progress.needed.toLocaleString()} XP needed</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: C.bd + '30', overflow: 'hidden' }}>
                <div style={{ width: `${Math.round(progress.progress * 100)}%`, height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${rank.color}, ${progress.nextRank.color})`, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          )}
          <div className={s.s5}>
            {[
              { label: 'Achievements', value: `${unlockedCount}/${ACHIEVEMENTS.length}`, icon: '🏆' },
              { label: 'Trade Streak', value: `${streaks.trading.current}d`, icon: '🔥' },
              { label: 'Best Streak', value: `${streaks.trading.best}d`, icon: '⭐' },
              { label: 'Journal Streak', value: `${streaks.journaling.current}d`, icon: '📝' },
            ].map((s, i) => (
              <div key={i} style={{ flex: '1 1 80px', padding: '8px 12px', background: C.sf, borderRadius: 8, textAlign: 'center' }}>
                <div className={s.s6}>{s.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: M, color: C.t1 }}>{s.value}</div>
                <div style={{ fontSize: 9, fontWeight: 600, color: C.t3, fontFamily: M }}>{s.label}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {enabled && <Card className={s.s7}><AchievementShelf /></Card>}

      {/* Theme Shop */}
      {enabled && (
        <Card className={s.s8}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 4 }}>🎨 Theme Shop</div>
          <div style={{ fontSize: 11, color: C.t3, marginBottom: 14 }}>Unlock accent themes by earning XP</div>
          <div className={s.s9}>
            {COSMETIC_REWARDS.map((theme) => {
              const unlocked = xp >= theme.unlockXP;
              const active = equippedCosmetic === theme.id;
              return (
                <button key={theme.id} className="tf-btn" onClick={() => unlocked && equipCosmetic(theme.id)}
                  style={{ padding: '10px 8px', borderRadius: 10, border: active ? `2px solid ${theme.colors.primary}` : `1px solid ${C.bd}40`, background: active ? theme.colors.primary + '10' : unlocked ? C.sf : C.sf + '60', cursor: unlocked ? 'pointer' : 'not-allowed', opacity: unlocked ? 1 : 0.5, textAlign: 'center', transition: 'all 0.2s' }}>
                  <div className={s.s10}>{theme.emoji}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, fontFamily: M, color: C.t1 }}>{theme.name}</div>
                  <div className={s.s11}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: theme.colors.primary }} />
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: theme.colors.accent }} />
                  </div>
                  {!unlocked && <div style={{ fontSize: 8, color: C.t3, fontFamily: M, marginTop: 4 }}>🔒 {theme.unlockXP.toLocaleString()} XP</div>}
                  {active && <div style={{ fontSize: 8, color: theme.colors.primary, fontWeight: 700, marginTop: 4 }}>Active</div>}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {enabled && (
        <Card className={s.s12}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 4 }}>🗺️ Trading Quests</div>
          <div style={{ fontSize: 11, color: C.t3, marginBottom: 14 }}>Guided missions that teach good trading habits</div>
          <QuestPanel />
        </Card>
      )}

      {/* Notification Preferences */}
      {enabled && (
        <Card className={s.s13}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 12 }}>Notifications</div>
          <div className={s.s14}>
            {[
              { key: 'levelUp', label: 'Level-Up Celebration', desc: 'Full-screen modal when you rank up' },
              { key: 'achievements', label: 'Achievement Toasts', desc: 'Pop-up notification when you unlock a badge' },
            ].map(({ key, label, desc }) => (
              <div key={key} className={s.s15}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>{label}</div>
                  <div style={{ fontSize: 10, color: C.t3 }}>{desc}</div>
                </div>
                <button onClick={() => setNotificationPref(key, !notificationPrefs[key])} className="tf-btn"
                  style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: notificationPrefs[key] ? C.g : C.bd, cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: notificationPrefs[key] ? 23 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Reset Progress */}
      {enabled && (
        <Card style={{ padding: 20, border: `1px solid ${C.r}20`, background: C.r + '03' }}>
          <div className={s.s16}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>Reset Progress</div>
              <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>Clear all XP, achievements, and streaks. Cannot be undone.</div>
            </div>
            {!confirmReset ? (
              <Btn variant="ghost" onClick={() => setConfirmReset(true)} style={{ fontSize: 12, padding: '6px 12px', color: C.r, border: `1px solid ${C.r}30`, flexShrink: 0 }}>Reset</Btn>
            ) : (
              <div className={s.s17}>
                <Btn onClick={() => { resetProgress(); setConfirmReset(false); }} style={{ fontSize: 12, padding: '6px 12px', background: C.r, color: '#fff', border: 'none', flexShrink: 0 }}>Confirm Reset</Btn>
                <Btn variant="ghost" onClick={() => setConfirmReset(false)} className={s.s18}>Cancel</Btn>
              </div>
            )}
          </div>
        </Card>
      )}
    </section>
  );
}

export default React.memo(AchievementsSection);
