/**
 * HashClout Sound Effects System
 *
 * Uses Web Audio API to generate all sounds programmatically —
 * no external audio files needed. Dramatic, addictive, dopamine-loop sounds.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Resume if suspended (autoplay policy)
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/** Simple beep tone */
function playTone(freq: number, duration: number, volume = 0.15, type: OscillatorType = "sine") {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

/** Play a sequence of notes */
function playSequence(notes: Array<{ freq: number; time: number; dur: number; vol?: number; type?: OscillatorType }>) {
  try {
    const ctx = getCtx();
    notes.forEach(({ freq, time, dur, vol = 0.12, type = "sine" }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime + time);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + dur);
    });
  } catch {}
}

/** White noise burst (impact sound) */
function playNoise(duration: number, volume = 0.06) {
  try {
    const ctx = getCtx();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    // Bandpass for impact feel
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 800;
    filter.Q.value = 1;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + duration);
  } catch {}
}

// ═══════════════════════════════════════════
// PUBLIC SOUND EFFECTS
// ═══════════════════════════════════════════

/** Match found — exciting ascending chime */
export function soundMatchFound() {
  playSequence([
    { freq: 523, time: 0, dur: 0.15, vol: 0.15 },     // C5
    { freq: 659, time: 0.1, dur: 0.15, vol: 0.15 },    // E5
    { freq: 784, time: 0.2, dur: 0.25, vol: 0.18 },    // G5
    { freq: 1047, time: 0.35, dur: 0.4, vol: 0.20 },   // C6
  ]);
}

/** Countdown tick — 3, 2, 1 */
export function soundCountdownTick() {
  playTone(880, 0.08, 0.12, "square");
}

/** GO! — dramatic launch sound */
export function soundGo() {
  playNoise(0.12, 0.08);
  playSequence([
    { freq: 440, time: 0, dur: 0.1, vol: 0.15, type: "sawtooth" },
    { freq: 880, time: 0.05, dur: 0.15, vol: 0.18, type: "sawtooth" },
    { freq: 1320, time: 0.12, dur: 0.3, vol: 0.15 },
  ]);
}

/** Round transition — dramatic whoosh + chime */
export function soundRoundTransition() {
  playNoise(0.2, 0.04);
  playSequence([
    { freq: 330, time: 0.05, dur: 0.2, vol: 0.10, type: "triangle" },
    { freq: 440, time: 0.15, dur: 0.2, vol: 0.12, type: "triangle" },
    { freq: 660, time: 0.28, dur: 0.3, vol: 0.14, type: "triangle" },
  ]);
}

/** Your turn — bright ascending */
export function soundYourTurn() {
  playSequence([
    { freq: 587, time: 0, dur: 0.12, vol: 0.14 },     // D5
    { freq: 784, time: 0.08, dur: 0.12, vol: 0.16 },   // G5
    { freq: 988, time: 0.16, dur: 0.25, vol: 0.14 },   // B5
  ]);
}

/** Opponent's turn — lower descending */
export function soundOppTurn() {
  playSequence([
    { freq: 440, time: 0, dur: 0.12, vol: 0.10, type: "triangle" },
    { freq: 349, time: 0.08, dur: 0.15, vol: 0.10, type: "triangle" },
  ]);
}

/** Timer warning — 10 seconds left */
export function soundTimerWarning() {
  playTone(1200, 0.06, 0.10, "square");
}

/** Timer critical — last 3 seconds tick */
export function soundTimerCritical() {
  playTone(1600, 0.04, 0.14, "square");
}

/** Message sent — subtle pop */
export function soundMessageSent() {
  playTone(1200, 0.06, 0.06);
}

/** Message received — softer pop */
export function soundMessageReceived() {
  playTone(800, 0.08, 0.05, "triangle");
}

/** Emoji reaction — bubbly pop */
export function soundEmojiReact() {
  playSequence([
    { freq: 1400, time: 0, dur: 0.05, vol: 0.06 },
    { freq: 1800, time: 0.03, dur: 0.08, vol: 0.05 },
  ]);
}

/** Victory fanfare — dramatic ascending triumph */
export function soundVictory() {
  playSequence([
    { freq: 523, time: 0, dur: 0.2, vol: 0.15 },       // C5
    { freq: 659, time: 0.15, dur: 0.2, vol: 0.15 },    // E5
    { freq: 784, time: 0.30, dur: 0.2, vol: 0.16 },    // G5
    { freq: 1047, time: 0.45, dur: 0.15, vol: 0.18 },  // C6
    { freq: 1175, time: 0.55, dur: 0.15, vol: 0.18 },  // D6
    { freq: 1319, time: 0.65, dur: 0.5, vol: 0.20 },   // E6
  ]);
  // Impact noise for drama
  setTimeout(() => playNoise(0.15, 0.05), 650);
}

/** Defeat — somber descending */
export function soundDefeat() {
  playSequence([
    { freq: 440, time: 0, dur: 0.3, vol: 0.10, type: "triangle" },
    { freq: 392, time: 0.2, dur: 0.3, vol: 0.10, type: "triangle" },
    { freq: 330, time: 0.4, dur: 0.4, vol: 0.08, type: "triangle" },
    { freq: 262, time: 0.65, dur: 0.6, vol: 0.06, type: "triangle" },
  ]);
}

/** Tie — neutral resolution */
export function soundTie() {
  playSequence([
    { freq: 523, time: 0, dur: 0.2, vol: 0.10, type: "triangle" },
    { freq: 440, time: 0.15, dur: 0.2, vol: 0.10, type: "triangle" },
    { freq: 523, time: 0.30, dur: 0.35, vol: 0.10, type: "triangle" },
  ]);
}

/** XP earned — satisfying coin/ding */
export function soundXPEarned() {
  playSequence([
    { freq: 1568, time: 0, dur: 0.08, vol: 0.08 },     // G6
    { freq: 2093, time: 0.06, dur: 0.12, vol: 0.10 },  // C7
  ]);
}

/** Debate start — epic horn */
export function soundDebateStart() {
  playNoise(0.08, 0.04);
  playSequence([
    { freq: 262, time: 0, dur: 0.2, vol: 0.12, type: "sawtooth" },
    { freq: 330, time: 0.08, dur: 0.2, vol: 0.12, type: "sawtooth" },
    { freq: 392, time: 0.16, dur: 0.3, vol: 0.14, type: "sawtooth" },
    { freq: 523, time: 0.30, dur: 0.4, vol: 0.16, type: "sawtooth" },
  ]);
}

/** Button click — subtle */
export function soundClick() {
  playTone(600, 0.03, 0.04);
}

/** Side locked in — confirmation */
export function soundLockIn() {
  playSequence([
    { freq: 880, time: 0, dur: 0.08, vol: 0.10 },
    { freq: 1320, time: 0.06, dur: 0.15, vol: 0.12 },
  ]);
  playNoise(0.06, 0.03);
}

/** Fact Check — bass rumble buildup for challenge review */
export function soundFactCheckRumble() {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(55, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 1.5);
    gain.gain.setValueAtTime(0.02, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 1.5);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.8);
  } catch {}
}

/** Fact Check FAKE NEWS verdict — buzzer + impact */
export function soundFakeNews() {
  playNoise(0.2, 0.10);
  playSequence([
    { freq: 180, time: 0, dur: 0.15, vol: 0.16, type: "sawtooth" },
    { freq: 120, time: 0.1, dur: 0.2, vol: 0.14, type: "sawtooth" },
    { freq: 80, time: 0.2, dur: 0.3, vol: 0.10, type: "sawtooth" },
  ]);
}

/** Fact Check FACTS verdict — gavel slam + bright chime */
export function soundFactsVerified() {
  playNoise(0.1, 0.06);
  playSequence([
    { freq: 784, time: 0, dur: 0.15, vol: 0.14 },    // G5
    { freq: 988, time: 0.1, dur: 0.15, vol: 0.16 },   // B5
    { freq: 1175, time: 0.2, dur: 0.3, vol: 0.14 },   // D6
  ]);
}

/** Fact Check STRETCH verdict — wobbly uncertain tone */
export function soundStretch() {
  playSequence([
    { freq: 440, time: 0, dur: 0.2, vol: 0.10, type: "triangle" },
    { freq: 466, time: 0.1, dur: 0.2, vol: 0.10, type: "triangle" },
    { freq: 440, time: 0.2, dur: 0.2, vol: 0.08, type: "triangle" },
  ]);
}

/** Fact Check DENIED / BLOCKED — shield slam */
export function soundDenied() {
  playNoise(0.15, 0.07);
  playSequence([
    { freq: 300, time: 0, dur: 0.1, vol: 0.12, type: "square" },
    { freq: 200, time: 0.08, dur: 0.2, vol: 0.10, type: "square" },
  ]);
}

/** Challenge queued — subtle confirmation */
export function soundChallengeQueued() {
  playSequence([
    { freq: 660, time: 0, dur: 0.06, vol: 0.08 },
    { freq: 880, time: 0.04, dur: 0.1, vol: 0.06 },
  ]);
}

/**
 * Initialize audio context on first user interaction.
 * Call this on any click/tap to ensure audio works (autoplay policy).
 */
export function initAudio() {
  getCtx();
}
