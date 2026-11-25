import { beforeEach, describe, expect, it } from "vitest";
import { CUE_NAMES } from "../src/audio";
import { CARDS } from "../src/game/cards";
import { CARD_ANIMS, cardAnim, FALLBACK_ANIM, MAX_LEAD } from "../src/ui/cardfx";
import { ENEMY_IMPACT, enemyShot, IMPACT_KINDS, SHOT_KINDS, STEP_KINDS } from "../src/ui/cardplay";
import { addEffect, clearGfx, effectCount, emit, fitBox, MAX_PARTICLES, particleCount, playEffects, stepParticles } from "../src/ui/gfx";

const HEX = /^#[0-9a-f]{6}$/i;

describe("card play animations", () => {
  it("gives every card in the game its own animation", () => {
    for (const card of CARDS) {
      expect(CARD_ANIMS[card.id], `${card.id} (${card.name}) has no animation`).toBeDefined();
      expect(cardAnim(card.id)).not.toBe(FALLBACK_ANIM);
    }
  });

  it("has no animation left over for a card that no longer exists", () => {
    const ids = new Set(CARDS.map((card) => card.id));
    for (const id of Object.keys(CARD_ANIMS)) expect(ids.has(id), `${id} is not a card`).toBe(true);
  });

  it("makes each card's animation distinct from every other card's", () => {
    const seen = new Map<string, string>();
    for (const [id, anim] of Object.entries(CARD_ANIMS)) {
      const key = JSON.stringify(anim);
      expect(seen.get(key), `${id} plays exactly like ${seen.get(key)}`).toBeUndefined();
      seen.set(key, id);
    }
  });

  it("builds every animation from effects the runtime can draw, with sounds that exist", () => {
    const cues = new Set<string>(CUE_NAMES);
    for (const [id, anim] of Object.entries(CARD_ANIMS)) {
      for (const step of anim.cast) {
        expect(STEP_KINDS, `${id} cast`).toContain(step.fx);
        if (step.sfx) expect(cues.has(step.sfx), `${id} cue ${step.sfx}`).toBe(true);
        expect(step.at ?? 0, `${id} step timing`).toBeGreaterThanOrEqual(0);
        expect(step.at ?? 0, `${id} step timing`).toBeLessThanOrEqual(600);
        for (const value of Object.values(step)) if (typeof value === "string" && value.startsWith("#")) expect(value, `${id} colour`).toMatch(HEX);
      }
      if (anim.shot) {
        expect(SHOT_KINDS, `${id} shot`).toContain(anim.shot.fx);
        expect(cues.has(anim.shot.sfx), `${id} cue ${anim.shot.sfx}`).toBe(true);
        expect(anim.shot.ms, `${id} shot time`).toBeGreaterThan(0);
        expect(anim.shot.ms, `${id} shot time`).toBeLessThanOrEqual(900);
      }
      if (anim.impact) {
        expect(IMPACT_KINDS, `${id} impact`).toContain(anim.impact.fx);
        expect(anim.impact.color, `${id} impact colour`).toMatch(HEX);
      }
      expect(anim.lead, `${id} lead`).toBeGreaterThanOrEqual(0);
      expect(anim.lead, `${id} lead`).toBeLessThanOrEqual(MAX_LEAD);
      // Something must happen on screen: a cast, or at least a shot.
      expect(anim.cast.length + (anim.shot ? 1 : 0), `${id} shows nothing`).toBeGreaterThan(0);
    }
  });

  it("gives every attack a shot and an impact", () => {
    for (const card of CARDS) {
      if (card.type !== "attack") continue;
      const anim = cardAnim(card.id);
      expect(anim.shot, `${card.id} deals damage with no shot`).toBeDefined();
      expect(anim.impact, `${card.id} deals damage with no impact`).toBeDefined();
    }
  });

  it("falls back to a generic animation for an unknown card", () => {
    expect(cardAnim("no-such-card")).toBe(FALLBACK_ANIM);
    expect(SHOT_KINDS).toContain(FALLBACK_ANIM.shot!.fx);
  });

  it("draws enemy fire from the same shot and impact vocabulary", () => {
    for (const style of ["tracer", "missile", "heavy"] as const) {
      expect(SHOT_KINDS).toContain(enemyShot(style).fx);
      expect(IMPACT_KINDS).toContain(ENEMY_IMPACT[style].fx);
    }
  });
});

describe("particle engine", () => {
  beforeEach(() => clearGfx());

  it("never holds more than its cap, recycling the oldest particle", () => {
    for (let i = 0; i < MAX_PARTICLES + 250; i++) emit({ x: i, y: 0, life: 1 });
    expect(particleCount()).toBe(MAX_PARTICLES);
  });

  it("moves particles and retires them when their life is over", () => {
    emit({ x: 0, y: 0, vx: 100, vy: 0, life: 0.5 });
    emit({ x: 0, y: 0, life: 2 });
    stepParticles(0.016);
    stepParticles(0.25);
    expect(particleCount()).toBe(2);
    stepParticles(0.3);
    expect(particleCount()).toBe(1);
    stepParticles(2);
    expect(particleCount()).toBe(0);
  });

  it("holds a delayed particle back until its time", () => {
    emit({ x: 0, y: 0, life: 0.2, delay: 0.5 });
    stepParticles(0.4);
    expect(particleCount()).toBe(1);
    stepParticles(0.2);
    stepParticles(0.016);
    stepParticles(0.3);
    expect(particleCount()).toBe(0);
  });

  it("gives a particle its first frame where it was emitted, however long that frame took", () => {
    const init = { x: 10, y: 20, vx: 400, vy: -300, life: 0.05 };
    emit(init);
    // A dropped frame, four times the particle's whole life: it must still be shown once, at its origin.
    stepParticles(0.2);
    expect(particleCount()).toBe(1);
    stepParticles(0.02);
    expect(particleCount()).toBe(1);
    stepParticles(0.2);
    expect(particleCount()).toBe(0);
  });

  it("settles a drawn effect even with no canvas to draw on", async () => {
    let finished = false;
    const done = addEffect({ life: 0.01, draw: () => undefined, done: () => (finished = true) });
    expect(effectCount()).toBe(1);
    await done;
    clearGfx();
    expect(finished).toBe(true);
    expect(effectCount()).toBe(0);
  });

  /** Plays frames of `dt` seconds with no canvas, noting how far through its life each one drew an effect. */
  const frames = (dt: number, count: number) => {
    const stub = { save: () => undefined, restore: () => undefined } as unknown as CanvasRenderingContext2D;
    for (let i = 0; i < count; i++) playEffects(dt, stub);
  };

  it("draws an effect first at its very start and last at its very end, even when frames are dropped", () => {
    for (const dt of [0.016, 0.066, 0.25, 1]) {
      clearGfx();
      const drawn: number[] = [];
      let finished = 0;
      void addEffect({ life: 0.17, delay: 0.07, draw: (_c, k) => drawn.push(k), done: () => finished++ });
      frames(dt, 40);
      expect(drawn[0], `first frame at ${dt}s a frame`).toBe(0);
      expect(drawn[drawn.length - 1], `last frame at ${dt}s a frame`).toBe(1);
      expect(finished).toBe(1);
      expect(effectCount()).toBe(0);
      for (let i = 1; i < drawn.length; i++) expect(drawn[i]).toBeGreaterThanOrEqual(drawn[i - 1]);
    }
  });

  it("draws an effect started inside another's drawing in the same frame, from its start", () => {
    const drawn: number[] = [];
    let started = false;
    void addEffect({
      life: 0.3,
      draw: () => {
        if (started) return;
        started = true;
        void addEffect({ life: 0.05, draw: (_c, k) => drawn.push(k) });
      },
    });
    frames(0.2, 1);
    expect(drawn).toEqual([0]);
    frames(0.2, 2);
    expect(drawn[drawn.length - 1]).toBe(1);
  });
});

describe("effects canvas fit", () => {
  /** Where a client coordinate lands on screen once drawn through the fit and shown in the canvas's box. */
  const shown = (x: number, y: number, box: { left: number; top: number; width: number; height: number }, dpr: number) => {
    const fit = fitBox(box, dpr, 2_200_000);
    const px = (x - fit.left) * fit.sx;
    const py = (y - fit.top) * fit.sy;
    return { x: box.left + (px * box.width) / fit.pixelsWide, y: box.top + (py * box.height) / fit.pixelsHigh, fit };
  };

  it("lands every client coordinate on itself, on any screen", () => {
    const boxes = [
      { left: 0, top: 0, width: 390, height: 844 },
      { left: 0, top: 0, width: 430, height: 932 },
      { left: 0, top: 0, width: 844, height: 390 },
      { left: 0, top: 0, width: 1280, height: 800 },
      { left: 0, top: 0, width: 2560, height: 1440 },
      // A layer that does not match the window: a toolbar taking part of the height, or an offset.
      { left: 0, top: 0, width: 390, height: 664.5 },
      { left: 12, top: 47, width: 366, height: 750 },
    ];
    for (const box of boxes) {
      for (const dpr of [1, 2, 3]) {
        for (const [x, y] of [[0, 0], [184, 614], [box.left + box.width, box.top + box.height], [195.5, 386.25]]) {
          const at = shown(x, y, box, dpr);
          expect(at.x).toBeCloseTo(x, 6);
          expect(at.y).toBeCloseTo(y, 6);
        }
      }
    }
  });

  it("keeps the backing store within its budget and never sharper than the screen", () => {
    const phone = fitBox({ left: 0, top: 0, width: 390, height: 844 }, 3, 2_200_000);
    expect(phone.pixelsWide).toBe(780);
    expect(phone.pixelsHigh).toBe(1688);
    const big = fitBox({ left: 0, top: 0, width: 2560, height: 1440 }, 2, 2_200_000);
    expect(big.pixelsWide * big.pixelsHigh).toBeLessThanOrEqual(2_210_000);
    const plain = fitBox({ left: 0, top: 0, width: 1280, height: 800 }, 1, 2_200_000);
    expect(plain.pixelsWide).toBe(1280);
  });
});
