import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { armAudioOnGesture, CHIME_NOTES, playChime, readSoundSetting, resetSoundForTests, SOUND_KEY, subscribeSoundSetting, unlockAudio, writeSoundSetting } from "../notifications/sound";

/** A store whose every access throws (Safari private mode, blocked site data). */
const throwing = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

function memoryStore() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), map };
}

beforeEach(() => resetSoundForTests());
afterEach(() => {
  vi.unstubAllGlobals();
  try {
    window.localStorage.clear();
  } catch {
    // jsdom storage always works; the guard mirrors the code.
  }
});

describe("the sound setting (per browser, on by default)", () => {
  it("is on when nothing is stored", () => {
    expect(readSoundSetting(memoryStore())).toBe(true);
    expect(readSoundSetting(null)).toBe(true);
  });

  it("reads and writes the stored choice", () => {
    const store = memoryStore();
    writeSoundSetting(false, store);
    expect(store.map.get(SOUND_KEY)).toBe("off");
    expect(readSoundSetting(store)).toBe(false);
    writeSoundSetting(true, store);
    expect(store.map.get(SOUND_KEY)).toBe("on");
    expect(readSoundSetting(store)).toBe(true);
  });

  it("ignores a stored value it does not know", () => {
    const store = memoryStore();
    store.setItem(SOUND_KEY, "maybe");
    expect(readSoundSetting(store)).toBe(true);
  });

  it("never throws when storage throws, and keeps the choice in memory for the visit", () => {
    expect(readSoundSetting(throwing)).toBe(true);
    expect(() => writeSoundSetting(false, throwing)).not.toThrow();
    expect(readSoundSetting(throwing)).toBe(false);
    expect(readSoundSetting(null)).toBe(false);
  });

  it("uses window.localStorage by default", () => {
    writeSoundSetting(false);
    expect(window.localStorage.getItem(SOUND_KEY)).toBe("off");
    expect(readSoundSetting()).toBe(false);
  });

  it("tells subscribers about a change here and in another tab", () => {
    const listener = vi.fn();
    const off = subscribeSoundSetting(listener);
    writeSoundSetting(false, memoryStore());
    expect(listener).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new StorageEvent("storage", { key: SOUND_KEY }));
    expect(listener).toHaveBeenCalledTimes(2);
    window.dispatchEvent(new StorageEvent("storage", { key: "something-else" }));
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    writeSoundSetting(true, memoryStore());
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

/** A minimal AudioContext that records what the chime schedules. */
function mockAudio(initialState: AudioContextState = "running") {
  const oscillators: { type: string; freq: number[]; start: number[]; stop: number[] }[] = [];
  const gains: { values: number[] }[] = [];
  const created = vi.fn();
  class FakeAudioContext {
    state: AudioContextState = initialState;
    currentTime = 1;
    destination = {};
    constructor() {
      created(this);
    }
    resume = vi.fn(async () => {
      this.state = "running";
    });
    createOscillator() {
      const o = { type: "", freq: [] as number[], start: [] as number[], stop: [] as number[] };
      oscillators.push(o);
      return {
        set type(v: string) {
          o.type = v;
        },
        frequency: { setValueAtTime: (v: number) => o.freq.push(v) },
        connect: vi.fn(),
        start: (t: number) => o.start.push(t),
        stop: (t: number) => o.stop.push(t),
      };
    }
    createGain() {
      const g = { values: [] as number[] };
      gains.push(g);
      return {
        gain: {
          setValueAtTime: (v: number) => g.values.push(v),
          exponentialRampToValueAtTime: (v: number) => g.values.push(v),
        },
        connect: vi.fn(),
      };
    }
  }
  vi.stubGlobal("AudioContext", FakeAudioContext);
  return { oscillators, gains, created };
}

describe("the chime (Web Audio, unlocked by a gesture)", () => {
  it("is skipped silently before any gesture", () => {
    const audio = mockAudio();
    expect(playChime()).toBe(false);
    expect(audio.created).not.toHaveBeenCalled();
    expect(audio.oscillators).toHaveLength(0);
  });

  it("creates the AudioContext on the first click only, then plays two soft notes under 300 ms", () => {
    const audio = mockAudio();
    armAudioOnGesture(window);
    expect(audio.created).not.toHaveBeenCalled();
    window.dispatchEvent(new MouseEvent("click"));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(audio.created).toHaveBeenCalledTimes(1);

    expect(playChime()).toBe(true);
    expect(audio.oscillators.map((o) => o.freq[0])).toEqual(CHIME_NOTES.map((n) => n.freq));
    expect(audio.oscillators.every((o) => o.type === "sine")).toBe(true);
    const first = Math.min(...audio.oscillators.flatMap((o) => o.start));
    const last = Math.max(...audio.oscillators.flatMap((o) => o.stop));
    expect(last - first).toBeLessThanOrEqual(0.3);
    // Soft peak, and each note fades out to (near) silence.
    for (const g of audio.gains) {
      expect(Math.max(...g.values)).toBeLessThanOrEqual(0.1);
      expect(g.values[g.values.length - 1]).toBeLessThan(0.001);
    }
  });

  it("arms the gesture hook once per page", () => {
    const audio = mockAudio();
    const add = vi.spyOn(window, "addEventListener");
    armAudioOnGesture(window);
    armAudioOnGesture(window);
    expect(add.mock.calls.filter(([type]) => type === "click")).toHaveLength(1);
    add.mockRestore();
    window.dispatchEvent(new MouseEvent("click"));
    expect(audio.created).toHaveBeenCalledTimes(1);
  });

  it("resumes a suspended context on the gesture, and again (iOS) before playing", async () => {
    const audio = mockAudio("suspended");
    unlockAudio();
    const instance = audio.created.mock.calls[0]![0] as { state: AudioContextState; resume: ReturnType<typeof vi.fn> };
    expect(instance.resume).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(instance.state).toBe("running");

    instance.state = "suspended";
    expect(playChime()).toBe(false);
    expect(audio.oscillators).toHaveLength(0);
    await new Promise((r) => setTimeout(r, 0));
    expect(instance.resume).toHaveBeenCalledTimes(2);
    expect(audio.oscillators).toHaveLength(2);
  });

  it("stays silent when the context cannot resume", async () => {
    vi.stubGlobal(
      "AudioContext",
      class {
        state: AudioContextState = "suspended";
        resume = () => Promise.reject(new Error("NotAllowedError"));
      }
    );
    unlockAudio();
    expect(playChime()).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
  });

  it("does nothing where Web Audio is missing or throws", () => {
    vi.stubGlobal("AudioContext", undefined);
    unlockAudio();
    expect(playChime()).toBe(false);
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          throw new Error("NotSupportedError");
        }
      }
    );
    expect(() => unlockAudio()).not.toThrow();
    expect(playChime()).toBe(false);
  });
});
