import { afterEach, describe, expect, it, vi } from "vitest";
import { songLoop } from "../src/audio";
import { loadMeta, META_KEY } from "../src/game/meta";
import { handLayout, phoneShape } from "../src/ui/render";

afterEach(() => {
  vi.unstubAllGlobals();
});

function viewport(w: number, h: number) {
  vi.stubGlobal("window", { innerWidth: w, innerHeight: h });
}

describe("phone hand layout", () => {
  const phones: [number, number, "portrait" | "landscape"][] = [
    [320, 640, "portrait"],
    [360, 740, "portrait"],
    [390, 844, "portrait"],
    [430, 932, "portrait"],
    [667, 375, "landscape"],
    [844, 390, "landscape"],
    [932, 430, "landscape"],
  ];

  for (const [w, h, shape] of phones) {
    it(`keeps every card on screen and tappable at ${w}x${h}`, () => {
      viewport(w, h);
      expect(phoneShape()).toBe(shape);
      for (let n = 1; n <= 10; n++) {
        const layout = handLayout(n);
        expect(layout.slots).toHaveLength(n);
        expect(layout.trayH).not.toBeNull();
        expect(layout.pw).toBeGreaterThan(140);
        const left = Math.min(...layout.slots.map((slot) => slot.x)) - layout.cw / 2;
        const right = Math.max(...layout.slots.map((slot) => slot.x)) + layout.cw / 2;
        expect(left).toBeGreaterThanOrEqual(-w / 2);
        expect(right).toBeLessThanOrEqual(w / 2);
        if (n > 1) {
          const step = layout.slots[1].x - layout.slots[0].x;
          expect(step).toBeGreaterThanOrEqual(24);
          if (n <= 7) expect(step).toBeGreaterThanOrEqual(40);
          // A normal five-card hand sits side by side with no overlap at all.
          if (n <= 5) expect(step).toBeGreaterThanOrEqual(layout.cw);
        }
      }
    });
  }

  it("leaves the desktop fan alone", () => {
    viewport(1280, 800);
    expect(phoneShape()).toBeNull();
    const layout = handLayout(5);
    expect(layout.mini).toBe(false);
    expect(layout.trayH).toBeNull();
    expect(layout.cw).toBe(170);
  });
});

describe("generative music", () => {
  const tracks = ["title", "act1", "act2", "act3", "boss"] as const;

  for (const track of tracks) {
    it(`composes a stable, in-key loop for ${track}`, () => {
      const loop = songLoop(track);
      expect(songLoop(track).notes).toEqual(loop.notes);
      const scale = new Set(loop.scale);
      for (const note of loop.notes) {
        expect(note.step).toBeGreaterThanOrEqual(0);
        expect(note.step).toBeLessThan(loop.steps);
        expect(note.len).toBeGreaterThan(0);
        if (note.part === "lead" || note.part === "pad" || note.part === "arp") {
          expect(scale.has((((note.midi - loop.root) % 12) + 12) % 12)).toBe(true);
          expect(note.midi).toBeGreaterThanOrEqual(36);
          expect(note.midi).toBeLessThanOrEqual(96);
        }
      }
      for (let bar = 0; bar < 8; bar++) {
        const inBar = loop.notes.filter((note) => Math.floor(note.step / 16) === bar);
        expect(inBar.some((note) => note.part === "bass")).toBe(true);
        expect(inBar.some((note) => note.part === "lead")).toBe(true);
      }
      const last = loop.notes.filter((note) => note.part === "lead").at(-1)!;
      expect(((last.midi - loop.root) % 12 + 12) % 12).toBe(0);
    });
  }

  it("gives each track its own melody", () => {
    const leads = tracks.map((track) => JSON.stringify(songLoop(track).notes.filter((note) => note.part === "lead").map((note) => note.midi - songLoop(track).root)));
    expect(new Set(leads).size).toBe(tracks.length);
  });
});

describe("audio settings", () => {
  it("gives saves from before the volume sliders sensible defaults", () => {
    const old = { version: 1, unlocked: { kite: true }, stats: { runs: 3 }, mute: true };
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => (key === META_KEY ? JSON.stringify(old) : null),
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    const meta = loadMeta();
    expect(meta.mute).toBe(true);
    expect(meta.musicVol).toBe(0.6);
    expect(meta.sfxVol).toBe(0.8);
    expect(meta.stats.runs).toBe(3);
  });

  it("clamps stored volumes", () => {
    const saved = { version: 1, unlocked: { kite: true }, stats: {}, mute: false, musicVol: 4, sfxVol: -1 };
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify(saved),
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    const meta = loadMeta();
    expect(meta.musicVol).toBe(1);
    expect(meta.sfxVol).toBe(0);
  });
});
