import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FLIGHT_LOOKS, groundAt, groundTrack, REDUCED_SPEED, screenAt, SHOT_VIEW, swayAt, type GroundView } from "../src/ui/flight";

const scene = (name: string) => new URL(`../src/assets/art/scenes/${name}.webp`, import.meta.url);

describe("moving battle backdrop", () => {
  it("has a sky painting and a tiling ground texture for every act", () => {
    for (const act of [1, 2, 3]) {
      const look = FLIGHT_LOOKS[act];
      expect(look, `act ${act}`).toBeDefined();
      expect(existsSync(scene(look.sky)), look.sky).toBe(true);
      expect(existsSync(scene(look.ground)), look.ground).toBe(true);
      expect(look.speed).toBeGreaterThan(0);
      expect(look.horizonRow).toBeGreaterThan(0.2);
      expect(look.horizonRow).toBeLessThan(0.6);
    }
  });

  it("keeps the jet's weave gentle, and stills it for reduced motion", () => {
    for (let t = 0; t < 120; t += 0.37) {
      const s = swayAt(t);
      expect(Math.abs(s.roll)).toBeLessThanOrEqual(2.5);
      expect(Math.abs(s.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(s.y)).toBeLessThanOrEqual(2);
      expect(swayAt(t, true)).toEqual({ roll: 0, x: 0, y: 0 });
    }
    // It does move.
    expect(Math.abs(swayAt(1.8).roll)).toBeGreaterThan(0.5);
  });

  it("pulls back wider and runs a little faster for the enemy's turn", () => {
    expect(SHOT_VIEW.wide.zoom).toBeLessThan(SHOT_VIEW.close.zoom);
    expect(SHOT_VIEW.wide.speed).toBeGreaterThan(SHOT_VIEW.close.speed);
    expect(SHOT_VIEW.wide.speed).toBeLessThanOrEqual(SHOT_VIEW.close.speed * 1.5);
  });

  it("slows to a crawl with reduced motion", () => {
    expect(REDUCED_SPEED).toBeGreaterThanOrEqual(0);
    expect(REDUCED_SPEED).toBeLessThanOrEqual(0.03);
  });
});

describe("the ground under the fight", () => {
  const view: GroundView = { w: 1280, h: 720, hz: 0.45, roll: 0.03, pitch: -0.004, zoom: 1.05 };

  it("says for every act whether it is sea or land", () => {
    for (const act of [1, 2, 3]) expect(["water", "land"]).toContain(FLIGHT_LOOKS[act].surface);
    expect(new Set([1, 2, 3].map((act) => FLIGHT_LOOKS[act].surface)).size).toBe(2);
  });

  it("finds the ground under a screen point and puts it back in the same place", () => {
    for (const [px, py] of [
      [640, 420],
      [200, 500],
      [1100, 380],
      [900, 700],
    ]) {
      const spot = groundAt(view, px, py);
      expect(spot).not.toBeNull();
      const back = screenAt(view, spot!);
      expect(back!.x).toBeCloseTo(px, 4);
      expect(back!.y).toBeCloseTo(py, 4);
    }
    // There is no ground above the horizon.
    expect(groundAt(view, 640, 100)).toBeNull();
  });

  it("carries a mark toward the camera, growing, until it has passed underneath", () => {
    const spot = groundAt(view, 760, 430)!;
    let before = screenAt(view, spot)!;
    let gone = false;
    for (let flown = 0.5; flown < spot.z + 1; flown += 0.5) {
      const now = screenAt(view, { x: spot.x, z: spot.z - flown });
      if (!now) {
        gone = true;
        break;
      }
      expect(now.y).toBeGreaterThan(before.y);
      expect(now.scale).toBeGreaterThan(before.scale);
      // To the right of the vanishing point it slides off to the right.
      expect(now.x).toBeGreaterThan(before.x);
      before = now;
    }
    expect(gone).toBe(true);
    expect(before.y).toBeGreaterThan(view.h * 0.7);
  });

  it("leaves a mark where it is when there is no moving ground to carry it", () => {
    const at = groundTrack(300, 500);
    expect(at()).toEqual({ x: 300, y: 500, scale: 1, tilt: 0.14 });
    expect(at()).toEqual({ x: 300, y: 500, scale: 1, tilt: 0.14 });
  });
});
