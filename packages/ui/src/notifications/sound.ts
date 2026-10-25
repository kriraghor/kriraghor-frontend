/**
 * The bell's chime (M08 §4.1), shared by kriraghor.com, esports and the portal so they all sound
 * the same: a short two-note chime made with the Web Audio API (no audio file), soft and with a
 * quick fade-out. Browsers only let a page start audio after a user gesture, so the AudioContext is
 * created (or resumed) on the first click, key press or tap; until then, or when audio is not
 * allowed or not supported, the chime is silently skipped.
 *
 * The on/off setting is per browser (localStorage), on by default. Every storage access is wrapped:
 * a private window or blocked storage keeps the choice in memory for the visit instead.
 */

// ---------------------------------------------------------------- the setting

export const SOUND_KEY = "kg.notifications.sound";

type SoundStore = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): SoundStore | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The choice when storage is not available (or a write to it failed). */
let remembered: boolean | null = null;
const listeners = new Set<() => void>();

/** Whether to play the chime: the stored choice, else this visit's choice, else on. */
export function readSoundSetting(store: SoundStore | null = browserStorage()): boolean {
  if (store) {
    try {
      const value = store.getItem(SOUND_KEY);
      if (value === "on") return true;
      if (value === "off") return false;
    } catch {
      // Blocked storage: fall through to the in-memory choice.
    }
  }
  return remembered ?? true;
}

/** Saves the choice (in memory too, so it holds without storage) and tells open toggles. */
export function writeSoundSetting(on: boolean, store: SoundStore | null = browserStorage()): void {
  remembered = on;
  if (store) {
    try {
      store.setItem(SOUND_KEY, on ? "on" : "off");
    } catch {
      // Full or blocked storage: the in-memory choice holds for this visit.
    }
  }
  for (const listener of [...listeners]) listener();
}

/** Subscribes to changes of the setting: in this tab, and in other tabs through the storage event. */
export function subscribeSoundSetting(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SOUND_KEY || e.key === null) listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

// ---------------------------------------------------------------- the chime

type AudioCtor = new () => AudioContext;

function audioCtor(): AudioCtor | null {
  const g = globalThis as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

let ctx: AudioContext | null = null;
let armed = false;

/** Creates or resumes the shared AudioContext. Call it from a user gesture only. */
export function unlockAudio(): void {
  try {
    const Ctor = audioCtor();
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  } catch {
    ctx = null;
  }
}

const GESTURES = ["click", "keydown", "touchend"] as const;

/** Unlocks audio on the page's first click, key press or tap (once per page, however many bells). */
export function armAudioOnGesture(target: Window | undefined = typeof window === "undefined" ? undefined : window): void {
  if (armed || !target) return;
  armed = true;
  const onGesture = () => {
    unlockAudio();
    if (ctx) for (const type of GESTURES) target.removeEventListener(type, onGesture, true);
  };
  for (const type of GESTURES) target.addEventListener(type, onGesture, true);
}

/** Two notes a fifth apart (E5 then B5), the second starting as the first fades: about 250 ms. */
export const CHIME_NOTES = [
  { freq: 659.25, at: 0, dur: 0.14 },
  { freq: 987.77, at: 0.1, dur: 0.15 },
] as const;
/** Peak gain of each note: soft. */
export const CHIME_PEAK = 0.06;
const SILENT = 0.0001;

function schedule(c: AudioContext): void {
  const t0 = c.currentTime + 0.01;
  for (const note of CHIME_NOTES) {
    const start = t0 + note.at;
    const end = start + note.dur;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(note.freq, start);
    gain.gain.setValueAtTime(SILENT, start);
    gain.gain.exponentialRampToValueAtTime(CHIME_PEAK, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(SILENT, end);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

/**
 * Plays the chime if audio has been unlocked by a gesture. Returns whether it was scheduled now
 * (a suspended context is resumed and plays when the browser allows it; otherwise nothing).
 */
export function playChime(): boolean {
  const c = ctx;
  if (!c) return false;
  try {
    if (c.state === "running") {
      schedule(c);
      return true;
    }
    if (c.state === "suspended") {
      void c
        .resume()
        .then(() => {
          if (c.state === "running") schedule(c);
        })
        .catch(() => undefined);
    }
  } catch {
    // Audio not allowed or broken: no chime.
  }
  return false;
}

/** Tests only: forget the AudioContext, the gesture hook and the in-memory setting. */
export function resetSoundForTests(): void {
  ctx = null;
  armed = false;
  remembered = null;
  listeners.clear();
}
