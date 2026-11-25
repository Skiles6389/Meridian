import { beforeEach, describe, expect, it } from "vitest";
import { CUE_NAMES } from "../src/audio";
import { CARDS } from "../src/game/cards";
import { CARD_ANIMS, cardAnim, FALLBACK_ANIM, MAX_LEAD } from "../src/ui/cardfx";
import { ENEMY_IMPACT, enemyShot, IMPACT_KINDS, SHOT_KINDS, STEP_KINDS } from "../src/ui/cardplay";
import { addEffect, clearGfx, effectCount, emit, MAX_PARTICLES, particleCount, stepParticles } from "../src/ui/gfx";

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
    stepParticles(0.3);
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
});
