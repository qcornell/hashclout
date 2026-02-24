"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Zap, Clock, Check, Swords, RotateCcw, Users, Flame, Shield } from 'lucide-react';
import { soundMatchFound, soundCountdownTick, soundGo } from '@/lib/sounds';

const SEARCH_STEPS = [
  { t: 0, msg: 'Entering queue…' },
  { t: 1200, msg: 'Scanning for opponents…' },
  { t: 3200, msg: 'Matching skill levels…' },
  { t: 5200, msg: 'Expanding search radius…' },
  { t: 7200, msg: 'Opponent located — verifying…' },
];

const TIPS = [
  'Strong opening statements set the tone',
  'Use evidence to support your claims',
  'Address counter-arguments directly',
  'Concise arguments are more persuasive',
  'Stay composed — confidence wins debates',
];

function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 400);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

interface FighterOrbProps {
  side: 'yes' | 'no';
  ghost: boolean;
  searching: boolean;
  revealed: boolean;
  size: number;
}

function FighterOrb({ side, ghost, searching, revealed, size }: FighterOrbProps) {
  const yes = side === 'yes';
  const glow = yes ? 'rgba(255,120,60,' : 'rgba(115,47,109,';
  const accent = yes ? '#ff7a45' : '#a855f7';
  const dim = ghost && !revealed;
  const iconSize = size < 90 ? 18 : 22;
  const innerSize = size < 90 ? 42 : 56;

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'grid', placeItems: 'center' }}>
      {!dim && (
        <motion.div
          initial={revealed ? { opacity: 0, scale: 0.6 } : false}
          animate={{ opacity: 0.45, scale: 1 }}
          transition={{ duration: 0.6 }}
          style={{
            position: 'absolute', inset: -12, borderRadius: 999,
            background: `radial-gradient(circle, ${glow}0.14), transparent 60%)`,
            pointerEvents: 'none',
          }}
        />
      )}
      {revealed && (
        <motion.div
          initial={{ opacity: 0.6, scale: 0.7 }}
          animate={{ opacity: 0, scale: 1.8 }}
          transition={{ duration: 1 }}
          style={{
            position: 'absolute', inset: -24, borderRadius: 999,
            background: `radial-gradient(circle, ${glow}0.35), transparent 55%)`,
            pointerEvents: 'none', zIndex: 5,
          }}
        />
      )}
      {[1, 0.78, 0.56].map((s, i) => (
        <motion.div
          key={i}
          animate={searching ? { borderColor: ['rgba(255,255,255,.06)', 'rgba(255,255,255,.24)', 'rgba(255,255,255,.06)'] } : {}}
          transition={searching ? { duration: 1.3, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 } : {}}
          style={{
            position: 'absolute', inset: 0, borderRadius: 999,
            transform: `scale(${s})`,
            border: `1px solid ${dim ? 'rgba(255,255,255,.04)' : `${glow}0.14)`}`,
            background: `radial-gradient(65% 65% at 50% 40%, ${glow}${dim ? '0.02' : '0.07'}) 0%, transparent 72%)`,
            opacity: dim ? 0.2 : 0.4 - i * 0.06,
          }}
        />
      ))}
      <motion.div
        animate={
          searching ? { opacity: [0.25, 0.55, 0.25] }
          : revealed ? { scale: [0.7, 1.12, 1], opacity: [0, 1, 1] }
          : {}
        }
        transition={
          searching ? { duration: 1.3, repeat: Infinity, ease: 'easeInOut' }
          : revealed ? { duration: 0.55 }
          : {}
        }
        style={{
          width: innerSize, height: innerSize, borderRadius: 999,
          display: 'grid', placeItems: 'center',
          background: dim ? 'rgba(18,18,26,.4)' : `${glow}0.08)`,
          border: `1px solid ${dim ? 'rgba(255,255,255,.05)' : `${glow}0.16)`}`,
          position: 'relative', zIndex: 2,
          opacity: dim ? 0.35 : 1,
        }}
      >
        <User size={iconSize} color={dim ? 'rgba(255,255,255,.1)' : accent} strokeWidth={1.5} style={{ opacity: dim ? 0.5 : 0.35 }} />
      </motion.div>
    </div>
  );
}

interface VsBadgeProps {
  phase: string;
  countdown: number;
  size: number;
}

function VsBadge({ phase, countdown, size }: VsBadgeProps) {
  const s = phase === 'searching';
  const f = phase === 'found';
  const c = phase === 'countdown';
  const l = phase === 'launching';
  const badgeSize = size < 36 ? 30 : 38;

  return (
    <div style={{
      width: badgeSize, height: badgeSize, borderRadius: 999,
      display: 'grid', placeItems: 'center',
      background: 'rgba(0,0,0,.3)',
      border: `1px solid ${f ? 'rgba(34,197,94,.35)' : 'rgba(255,255,255,.12)'}`,
      boxShadow: '0 16px 40px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.10)',
      position: 'relative', zIndex: 4,
    }}>
      {s && <div style={{
        position: 'absolute', inset: -5, borderRadius: 999,
        border: '2px solid transparent', borderTopColor: '#ff4d3d', borderRightColor: '#732f6d',
        animation: 'mmq-spin .8s linear infinite',
      }} />}
      {s && <motion.span animate={{ scale: [.7, 1.4, .7], opacity: [.3, 1, .3] }} transition={{ duration: 1, repeat: Infinity }} style={{ fontSize: 9, color: '#ff7a45' }}>●</motion.span>}
      {f && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: .5 }}><Check size={14} color="#22c55e" strokeWidth={3} /></motion.div>}
      {c && <AnimatePresence mode="wait"><motion.span key={countdown} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: .5, opacity: 0 }} transition={{ duration: .35 }} style={{ fontSize: 13, fontWeight: 900, color: '#ff7a45' }}>{countdown}</motion.span></AnimatePresence>}
      {l && <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: .4 }}><Zap size={14} color="#ff7a45" fill="#ff7a45" /></motion.div>}
      {!s && !f && !c && !l && <span style={{ color: 'rgba(255,190,120,.85)', fontSize: 9, fontWeight: 900 }}>VS</span>}
    </div>
  );
}

function Particles() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 80 + Math.random() * 150, x: Math.random() * 100 + '%' }}
          animate={{ opacity: [0, 0.35, 0], y: [80 + Math.random() * 150, -40], x: `${Math.random() * 100}%` }}
          transition={{ duration: 4 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 3, ease: 'easeOut' }}
          style={{
            position: 'absolute', width: 2, height: 2, borderRadius: 999,
            background: i % 2 === 0 ? 'rgba(255,122,69,.5)' : 'rgba(168,85,247,.5)',
          }}
        />
      ))}
    </div>
  );
}

interface MatchmakingQueueProps {
  side?: 'yes' | 'no';
  format?: 'text' | 'video';
  topic?: string;
  onReady?: () => void;
  onCancel?: () => void;
}

export default function MatchmakingQueue({
  side = 'yes',
  format = 'text',
  topic = 'Should AI be granted legal personhood?',
  onReady = () => {},
  onCancel = () => {},
}: MatchmakingQueueProps) {
  const [phase, setPhase] = useState<string>('searching');
  const [elapsed, setElapsed] = useState(0);
  const [searchMsg, setSearchMsg] = useState('Entering queue…');
  const [countdown, setCountdown] = useState(3);
  const [tipIdx, setTipIdx] = useState(0);
  const [oppRevealed, setOppRevealed] = useState(false);
  const [queuePos, setQueuePos] = useState(47);

  const width = useWindowWidth();
  const oppSide = side === 'yes' ? 'no' : 'yes';

  const isMobile = width < 480;
  const isSmall = width < 380;
  const orbSize = isSmall ? 80 : isMobile ? 100 : 140;
  const vsGap = isSmall ? 28 : isMobile ? 36 : 50;
  const headingSize = isSmall ? 18 : isMobile ? 20 : 24;
  const countdownSize = isSmall ? 48 : isMobile ? 56 : 72;
  const goSize = isSmall ? 36 : isMobile ? 42 : 52;
  const tagSize = isSmall ? 10 : 11;
  const statusSize = isSmall ? 13 : isMobile ? 14 : 15;

  useEffect(() => {
    if (phase !== 'searching') return;
    setElapsed(0);
    setSearchMsg('Entering queue…');
    setTipIdx(0);
    setQueuePos(Math.floor(Math.random() * 80) + 20);

    const el = setInterval(() => setElapsed(p => p + 1), 1000);
    const tp = setInterval(() => setTipIdx(p => (p + 1) % TIPS.length), 3200);
    const qp = setInterval(() => setQueuePos(p => Math.max(1, p - Math.floor(Math.random() * 8))), 1400);
    const tts = SEARCH_STEPS.map(({ t, msg }) => setTimeout(() => setSearchMsg(msg), t));
    const go = setTimeout(() => setPhase('found'), 8600);

    return () => {
      clearInterval(el); clearInterval(tp); clearInterval(qp);
      tts.forEach(clearTimeout); clearTimeout(go);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'found') return;
    soundMatchFound();
    setOppRevealed(false);
    const r = setTimeout(() => setOppRevealed(true), 500);
    const n = setTimeout(() => setPhase('countdown'), 2800);
    return () => { clearTimeout(r); clearTimeout(n); };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    setCountdown(3);
    soundCountdownTick();
    const a = setTimeout(() => { setCountdown(2); soundCountdownTick(); }, 1000);
    const b = setTimeout(() => { setCountdown(1); soundCountdownTick(); }, 2000);
    const c = setTimeout(() => setPhase('launching'), 3000);
    return () => { clearTimeout(a); clearTimeout(b); clearTimeout(c); };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'launching') return;
    soundGo();
    const t = setTimeout(() => { setPhase('done'); onReady(); }, 1800);
    return () => clearTimeout(t);
  }, [phase, onReady]);

  const active = phase !== 'done';

  return (
    <div style={{
      color: 'rgba(255,255,255,.92)',
      fontFamily: "'Inter', system-ui, sans-serif",
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: isSmall ? 12 : isMobile ? 16 : 20,
      position: 'relative', overflow: 'hidden',
      minHeight: '100vh',
    }}>
      {/* Background glows — uses parent page background */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(800px 400px at 20% 15%, rgba(255,77,61,.10), transparent 60%), radial-gradient(600px 350px at 75% 35%, rgba(168,85,247,.08), transparent 60%)',
      }} />
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', opacity: .2,
        backgroundImage: 'radial-gradient(rgba(255,255,255,.08) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
        maskImage: 'radial-gradient(circle at 50% 45%, black 0%, transparent 55%)',
        WebkitMaskImage: 'radial-gradient(circle at 50% 45%, black 0%, transparent 55%)',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 640 }}>
        <AnimatePresence mode="wait">
          {active && (
            <motion.div key="queue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: .96 }} transition={{ duration: .5 }} style={{ position: 'relative' }}>
              {phase === 'searching' && <Particles />}

              {/* Topic pill */}
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2 }} style={{
                textAlign: 'center', marginBottom: 6,
                padding: isMobile ? '6px 12px' : '8px 18px', borderRadius: 10,
                background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: isSmall ? 11 : 12, fontWeight: 700, color: 'rgba(255,255,255,.6)',
                justifyContent: 'center',
              }}>
                <Swords size={isSmall ? 11 : 13} style={{ opacity: .5, flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topic}</span>
              </motion.div>

              {/* Arena */}
              <div style={{
                display: 'grid', gridTemplateColumns: `1fr ${vsGap}px 1fr`,
                alignItems: 'center', padding: isMobile ? '16px 0' : '24px 0',
                minHeight: isMobile ? 180 : 260,
              }}>
                {/* YOU */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? 8 : 12 }}>
                  <FighterOrb side={side} searching={false} revealed={false} ghost={false} size={orbSize} />
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .15 }} style={{
                    padding: isMobile ? '4px 10px' : '6px 16px', borderRadius: 8,
                    background: side === 'yes' ? 'rgba(255,77,61,.10)' : 'rgba(115,47,109,.10)',
                    border: `1px solid ${side === 'yes' ? 'rgba(255,77,61,.18)' : 'rgba(115,47,109,.18)'}`,
                    fontSize: tagSize, fontWeight: 800, letterSpacing: '.08em',
                    color: side === 'yes' ? '#ff7a45' : '#a855f7', whiteSpace: 'nowrap',
                  }}>
                    YOU · {side.toUpperCase()}
                  </motion.div>
                </div>

                {/* VS divider */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' }}>
                  <div style={{
                    position: 'absolute', top: '12%', bottom: '12%', left: '50%', width: 1,
                    transform: 'translateX(-50%)',
                    background: 'linear-gradient(180deg, transparent, rgba(255,255,255,.08) 25%, rgba(255,255,255,.08) 75%, transparent)',
                  }} />
                  <VsBadge phase={phase} countdown={countdown} size={vsGap} />
                </div>

                {/* OPPONENT */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? 8 : 12 }}>
                  <FighterOrb side={oppSide} ghost={true} searching={phase === 'searching'} revealed={oppRevealed} size={orbSize} />
                  <AnimatePresence mode="wait">
                    {phase === 'searching' && (
                      <motion.div key="sl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{
                        padding: isMobile ? '4px 10px' : '6px 16px', borderRadius: 8,
                        background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
                        fontSize: tagSize, fontWeight: 600, color: 'rgba(255,255,255,.30)',
                        display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                      }}>
                        <div style={{
                          width: 9, height: 9, borderRadius: '50%',
                          border: '2px solid rgba(255,255,255,.08)', borderTopColor: '#ff7a45',
                          animation: 'mmq-spin .6s linear infinite', flexShrink: 0,
                        }} />
                        Searching…
                      </motion.div>
                    )}
                    {oppRevealed && (
                      <motion.div key="ol" initial={{ opacity: 0, scale: .8, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', duration: .5 }} style={{
                        padding: isMobile ? '4px 10px' : '6px 16px', borderRadius: 8,
                        background: oppSide === 'yes' ? 'rgba(255,77,61,.10)' : 'rgba(115,47,109,.10)',
                        border: `1px solid ${oppSide === 'yes' ? 'rgba(255,77,61,.18)' : 'rgba(115,47,109,.18)'}`,
                        fontSize: tagSize, fontWeight: 800, letterSpacing: '.08em',
                        color: oppSide === 'yes' ? '#ff7a45' : '#a855f7', whiteSpace: 'nowrap',
                      }}>
                        OPP · {oppSide.toUpperCase()}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Status Area */}
              <div style={{ textAlign: 'center', minHeight: isMobile ? 90 : 110 }}>
                <AnimatePresence mode="wait">
                  {phase === 'searching' && (
                    <motion.div key="ss" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                      <AnimatePresence mode="wait">
                        <motion.p key={searchMsg} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .25 }} style={{ fontSize: statusSize, fontWeight: 700, color: 'rgba(255,255,255,.70)', marginBottom: 8 }}>
                          {searchMsg}
                        </motion.p>
                      </AnimatePresence>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: isSmall ? 6 : 10, fontSize: isSmall ? 10 : 11,
                        color: 'rgba(255,255,255,.28)', fontWeight: 500, marginBottom: 12, flexWrap: 'wrap',
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontVariantNumeric: 'tabular-nums' }}><Clock size={10} /> {elapsed}s</span>
                        <span>·</span>
                        <span>{format === 'text' ? '💬 Text' : '🎥 Video'}</span>
                        <span>·</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Users size={10} /> #{queuePos}</span>
                      </div>
                      <div style={{
                        width: isMobile ? '80%' : 220, maxWidth: 220, height: 3, borderRadius: 2,
                        background: 'rgba(255,255,255,.06)', margin: '0 auto 14px', overflow: 'hidden',
                      }}>
                        <motion.div
                          initial={{ width: '0%' }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 8.6, ease: 'linear' }}
                          style={{
                            height: '100%', borderRadius: 2,
                            background: 'linear-gradient(90deg, #ff4d3d, #ff7a45)',
                            boxShadow: '0 0 10px rgba(255,77,61,.3)',
                          }}
                        />
                      </div>
                      <AnimatePresence mode="wait">
                        <motion.p key={tipIdx} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: .25 }} style={{
                          fontSize: isSmall ? 10 : 11, color: 'rgba(255,255,255,.22)',
                          fontWeight: 500, fontStyle: 'italic', padding: '0 8px',
                        }}>
                          💡 {TIPS[tipIdx]}
                        </motion.p>
                      </AnimatePresence>
                      <motion.button
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
                        onClick={onCancel}
                        style={{
                          marginTop: 16, background: 'none',
                          border: '1px solid rgba(255,255,255,.07)', color: 'rgba(255,255,255,.30)',
                          fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
                          padding: '6px 16px', borderRadius: 8, cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </motion.button>
                    </motion.div>
                  )}

                  {phase === 'found' && (
                    <motion.div key="fs" initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                      <motion.div initial={{ scale: .7 }} animate={{ scale: [.7, 1.08, 1] }} transition={{ duration: .55, times: [0, .6, 1] }} style={{
                        fontSize: headingSize, fontWeight: 900, color: '#22c55e', marginBottom: 8,
                        textShadow: '0 0 35px rgba(34,197,94,.45)',
                      }}>
                        ⚡ MATCH FOUND
                      </motion.div>
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .3 }} style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', fontWeight: 500 }}>
                        Preparing the arena…
                      </motion.p>
                    </motion.div>
                  )}

                  {phase === 'countdown' && (
                    <motion.div key="cs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <AnimatePresence mode="wait">
                        <motion.div key={countdown} initial={{ scale: 2.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: .4, opacity: 0 }} transition={{ duration: .4, ease: [.22, 1, .36, 1] }} style={{
                          fontSize: countdownSize, fontWeight: 900, lineHeight: 1,
                          color: 'rgba(255,255,255,.95)', textShadow: '0 0 50px rgba(255,122,69,.5)',
                          marginBottom: 4,
                        }}>
                          {countdown}
                        </motion.div>
                      </AnimatePresence>
                      <p style={{ fontSize: isSmall ? 10 : 12, fontWeight: 800, color: 'rgba(255,255,255,.35)', letterSpacing: '.12em' }}>GET READY</p>
                    </motion.div>
                  )}

                  {phase === 'launching' && (
                    <motion.div key="ls" initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: .45, ease: [.22, 1, .36, 1] }}>
                      <div style={{
                        fontSize: goSize, fontWeight: 900,
                        background: 'linear-gradient(135deg, #ff4d3d, #ff7a45)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        lineHeight: 1, marginBottom: 8,
                      }}>GO!</div>
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .3 }} style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.45)' }}>
                        Entering the arena…
                      </motion.p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {phase === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }} style={{ textAlign: 'center' }}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: .6 }} style={{
                width: isMobile ? 56 : 72, height: isMobile ? 56 : 72, borderRadius: 999,
                background: 'rgba(34,197,94,.10)', border: '2px solid rgba(34,197,94,.22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 18px', boxShadow: '0 0 40px rgba(34,197,94,.12)',
              }}>
                <Swords size={isMobile ? 22 : 28} color="#22c55e" />
              </motion.div>
              <h2 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, marginBottom: 6 }}>onReady() fired!</h2>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginBottom: 6, padding: '0 8px' }}>In your app this navigates to the debate view.</p>
              <p style={{
                fontSize: 10, color: 'rgba(255,255,255,.25)', marginBottom: 20,
                fontFamily: 'monospace', background: 'rgba(255,255,255,.03)',
                display: 'inline-block', padding: '5px 12px', borderRadius: 8,
              }}>
                side=&quot;{side}&quot; format=&quot;{format}&quot;
              </p>
              <div>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: .97 }}
                  onClick={() => setPhase('searching')}
                  style={{
                    height: 42, padding: '0 20px', fontSize: 12, fontWeight: 800,
                    letterSpacing: '.06em', borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #ff4d3d, #ff7a45)', color: '#fff',
                    fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
                    boxShadow: '0 14px 40px rgba(255,77,61,.2)',
                  }}
                >
                  <RotateCcw size={13} /> Run Again
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes mmq-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
