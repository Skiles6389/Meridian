import { describe, expect, it } from "vitest";
import { ENEMIES } from "../src/game/enemies";
import { JET_ORDER, JETS } from "../src/game/jets";
import { chaseAspect, hasChaseArt } from "../src/ui/art";
import { allySpot, facesRight, foeSpots, type CamShape, type CamShot } from "../src/ui/camera";

const SHAPES: CamShape[] = ["desk", "portrait", "landscape"];
const SHOTS: CamShot[] = ["close", "wide"];

describe("chase camera framing", () => {
  it("keeps every airframe inside the frame and clear of its wingmen", () => {
    for (const shape of SHAPES) {
      for (const shot of SHOTS) {
        for (const n of [1, 2, 3]) {
          const spots = foeSpots(Array(n).fill(false), shape, shot);
          expect(spots).toHaveLength(n);
          for (const spot of spots) {
            expect(spot.x - spot.s / 2, `${shape} ${shot} ${n}`).toBeGreaterThanOrEqual(0);
            expect(spot.x + spot.s / 2, `${shape} ${shot} ${n}`).toBeLessThanOrEqual(100);
            expect(spot.y, `${shape} ${shot} ${n}`).toBeGreaterThan(10);
            expect(spot.y, `${shape} ${shot} ${n}`).toBeLessThan(50);
          }
          const byX = [...spots].sort((a, b) => a.x - b.x);
          for (let i = 1; i < byX.length; i++) {
            expect(byX[i].x - byX[i - 1].x, `${shape} ${shot} ${n}`).toBeGreaterThanOrEqual((byX[i].s + byX[i - 1].s) / 2);
          }
        }
        const [boss] = foeSpots([true], shape, shot);
        expect(boss.s).toBeGreaterThan(foeSpots([false], shape, shot)[0].s);
        expect(boss.x - boss.s / 2).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("pulls back on the enemy turn: everything shrinks and the player's jet rises off the hand", () => {
    for (const shape of SHAPES) {
      const close = allySpot(shape, "close");
      const wide = allySpot(shape, "wide");
      expect(wide.s).toBeLessThan(close.s);
      expect(wide.y).toBeGreaterThan(close.y);
      expect(close.x).toBe(50);
      for (const n of [1, 2, 3]) {
        const near = foeSpots(Array(n).fill(false), shape, "close");
        const far = foeSpots(Array(n).fill(false), shape, "wide");
        far.forEach((spot, index) => expect(spot.s).toBeLessThan(near[index].s));
      }
      // The player's jet is the biggest thing on screen up close.
      expect(close.s).toBeGreaterThan(foeSpots([true], shape, "close")[0].s);
    }
  });

  it("turns foes left of centre to face in toward the player", () => {
    expect(facesRight({ x: 30, y: 30, s: 20 })).toBe(true);
    expect(facesRight({ x: 70, y: 30, s: 20 })).toBe(false);
  });

  it("has rear views of every player jet and both views of every enemy", () => {
    for (const jet of JET_ORDER) {
      expect(hasChaseArt(JETS[jet].silhouette, "rear"), jet).toBe(true);
      expect(chaseAspect(JETS[jet].silhouette, "rear"), jet).toBeGreaterThan(1);
    }
    for (const enemy of ENEMIES) {
      expect(hasChaseArt(enemy.silhouette, "rear"), enemy.id).toBe(true);
      expect(hasChaseArt(enemy.silhouette, "front"), enemy.id).toBe(true);
    }
  });
});
