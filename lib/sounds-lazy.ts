/**
 * Lazy sound loader — dynamically imports the sounds module on first use.
 * Saves the full Web Audio synthesis code from the initial bundle.
 */

type SoundModule = typeof import("./sounds");
let soundsModule: SoundModule | null = null;
let loadPromise: Promise<SoundModule> | null = null;

function getSounds(): Promise<SoundModule> {
  if (soundsModule) return Promise.resolve(soundsModule);
  if (!loadPromise) {
    loadPromise = import("./sounds").then((mod) => {
      soundsModule = mod;
      return mod;
    });
  }
  return loadPromise;
}

/** Pre-load the sounds module (call on first user interaction) */
export function preloadSounds() {
  getSounds();
}

// Create lazy wrappers for every exported sound function.
// Each one fires-and-forgets: if the module isn't loaded yet, the sound is silently skipped.
// After initAudio() / first interaction, the module will be cached and all calls are instant.

function lazySound(name: keyof SoundModule) {
  return () => {
    if (soundsModule) {
      (soundsModule[name] as () => void)();
    } else {
      getSounds().then((mod) => (mod[name] as () => void)());
    }
  };
}

export const initAudio = lazySound("initAudio");
export const soundMatchFound = lazySound("soundMatchFound");
export const soundCountdownTick = lazySound("soundCountdownTick");
export const soundGo = lazySound("soundGo");
export const soundRoundTransition = lazySound("soundRoundTransition");
export const soundYourTurn = lazySound("soundYourTurn");
export const soundOppTurn = lazySound("soundOppTurn");
export const soundTimerWarning = lazySound("soundTimerWarning");
export const soundTimerCritical = lazySound("soundTimerCritical");
export const soundMessageSent = lazySound("soundMessageSent");
export const soundMessageReceived = lazySound("soundMessageReceived");
export const soundEmojiReact = lazySound("soundEmojiReact");
export const soundVictory = lazySound("soundVictory");
export const soundDefeat = lazySound("soundDefeat");
export const soundTie = lazySound("soundTie");
export const soundXPEarned = lazySound("soundXPEarned");
export const soundDebateStart = lazySound("soundDebateStart");
export const soundClick = lazySound("soundClick");
export const soundLockIn = lazySound("soundLockIn");
export const soundFactCheckRumble = lazySound("soundFactCheckRumble");
export const soundFakeNews = lazySound("soundFakeNews");
export const soundFactsVerified = lazySound("soundFactsVerified");
export const soundStretch = lazySound("soundStretch");
export const soundDenied = lazySound("soundDenied");
export const soundChallengeQueued = lazySound("soundChallengeQueued");
