import { describe, expect, it } from "vitest";
import { ENEMIES } from "../src/game/enemies";
import { JET_ORDER, JETS } from "../src/game/jets";
import { chaseAspect, hasChaseArt } from "../src/ui/art";
import {
  allySpot,
  attitude,
  cubic,
  cubicTangent,
  flightView,
  foeSpots,
  mirrored,
  offstage,
  sixSpots,
  sizeAlong,
  swapIn,
  swapOut,
  type CamShape,
  type CamShot,
} from "../src/ui/camera";

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

  it("pulls well back on the enemy turn: everything shrinks and the player's jet rises off the hand", () => {
    for (const shape of SHAPES) {
      const close = allySpot(shape, "close");
      const wide = allySpot(shape, "wide");
      expect(wide.s * 2.8).toBeLessThan(close.s);
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

  it("puts attackers on the six behind the player's jet, nearer the camera and clear of each other", () => {
    for (const shape of SHAPES) {
      const ally = allySpot(shape, "wide");
      for (const n of [1, 2, 3]) {
        const six = sixSpots(Array(n).fill(false), shape);
        const ahead = foeSpots(Array(n).fill(false), shape, "wide");
        for (const [index, spot] of six.entries()) {
          // The player's jet sits `ally.y` up from the bottom; behind it is lower in the frame.
          expect(spot.y, `${shape} ${n}`).toBeGreaterThan(100 - ally.y + 8);
          expect(spot.y + 6, `${shape} ${n}`).toBeLessThan(100);
          expect(spot.s, `${shape} ${n}`).toBeGreaterThan(ally.s);
          expect(spot.s, `${shape} ${n}`).toBeGreaterThan(ahead[index].s);
          expect(spot.x - spot.s / 2).toBeGreaterThanOrEqual(0);
          expect(spot.x + spot.s / 2).toBeLessThanOrEqual(100);
        }
        for (let i = 1; i < six.length; i++) expect(six[i].x - six[i - 1].x).toBeGreaterThanOrEqual((six[i].s + six[i - 1].s) / 2);
      }
    }
  });

  it("leaves the frame on the way round to the six, then comes back in from off-screen tail-on", () => {
    for (const side of [-1, 1]) {
      for (const aspect of [16 / 9, 390 / 420, 844 / 222]) {
        const from = { x: 50 - side * 10, y: 28 };
        const six = { x: 50 - side * 12, y: 75 };
        const off = 18;
        const [exit, entry] = swapIn(from, six, side, off, aspect);
        const edge = offstage(side, off);
        expect(edge).toBe(side < 0 ? -off : 100 + off);
        expect(cubic(exit, 0)).toEqual(from);
        expect(cubic(entry, 1)).toEqual(six);
        // The exit ends past the edge it banked toward and the entry starts beyond that same edge.
        expect((cubic(exit, 1).x - 50) * side).toBeGreaterThan(50 + off - 0.01);
        expect((cubic(entry, 0).x - 50) * side).toBeGreaterThan(50 + off - 0.01);
        // It only ever moves outward on the way out and inward on the way back.
        for (let i = 1; i <= 20; i++) {
          expect((cubic(exit, i / 20).x - cubic(exit, (i - 1) / 20).x) * side, `exit ${side} ${i}`).toBeGreaterThan(0);
          expect((cubic(entry, i / 20).x - cubic(entry, (i - 1) / 20).x) * side, `entry ${side} ${i}`).toBeLessThan(0);
        }
        // Dives toward the camera on the way out and stays inside the frame's height.
        expect(cubic(exit, 1).y).toBeGreaterThan(from.y);
        for (const curve of [exit, entry]) {
          for (let i = 0; i <= 20; i++) {
            const p = cubic(curve, i / 20);
            expect(p.y).toBeGreaterThan(0);
            expect(p.y).toBeLessThan(108);
          }
        }
        // Arrives on the six tail-on, whatever the stage's shape.
        const d = cubicTangent(entry, 0.995);
        expect(flightView(d.x * aspect, d.y, "side"), `aspect ${aspect}`).toBe("rear");
      }
    }
  });

  it("overshoots out of the frame and returns from off-screen to its slot ahead", () => {
    for (const side of [-1, 1]) {
      for (const aspect of [16 / 9, 390 / 420, 844 / 222]) {
        const six = { x: 50 - side * 12, y: 78 };
        const slot = { x: 50 - side * 17, y: 27 };
        const off = 14;
        const [away, back] = swapOut(six, slot, side, off, aspect);
        expect(cubic(away, 0)).toEqual(six);
        expect(cubic(back, 1)).toEqual(slot);
        expect((cubic(away, 1).x - 50) * side).toBeGreaterThan(50 + off - 0.01);
        expect((cubic(back, 0).x - 50) * side).toBeGreaterThan(50 + off - 0.01);
        // It pulls up and ahead straight off the six: tail-on as it starts to overshoot.
        const lift = cubicTangent(away, 0.02);
        expect(flightView(lift.x * aspect, lift.y, "rear")).toBe("rear");
        expect(cubic(away, 1).y).toBeLessThan(six.y);
        // It settles into its slot from the side it left by.
        expect((cubic(back, 0.9).x - slot.x) * side).toBeGreaterThan(0);
      }
    }
  });

  it("picks paintings, mirroring, and attitude from the heading", () => {
    expect(flightView(0, -1)).toBe("rear");
    expect(flightView(0, 1)).toBe("front");
    expect(flightView(1, 0.1)).toBe("side");
    // Hysteresis: a shallow climb keeps the rear view once it is showing.
    expect(flightView(1, -0.6, "rear")).toBe("rear");
    expect(flightView(1, -0.6, "side")).toBe("side");
    expect(mirrored("side", -1)).toBe(true);
    expect(mirrored("side", 1)).toBe(false);
    expect(mirrored("front", 1)).toBe(true);
    expect(mirrored("rear", -1)).toBe(false);
    // Nose-down in profile tips the nose down whichever way it faces.
    expect(attitude("side", 1, 0.5)).toBeGreaterThan(0);
    expect(attitude("side", -1, 0.5)).toBeLessThan(0);
    expect(Math.abs(attitude("side", 1, 5))).toBeLessThanOrEqual(38);
    expect(attitude("rear", 1, -1)).toBeGreaterThan(0);
  });

  it("grows an airframe as it comes nearer the camera", () => {
    const a = { x: 40, y: 28, s: 100 };
    const b = { x: 38, y: 75, s: 200 };
    expect(sizeAlong(a, b, 28)).toBeCloseTo(100);
    expect(sizeAlong(a, b, 75)).toBeCloseTo(200);
    expect(sizeAlong(a, b, 50)).toBeGreaterThan(100);
    expect(sizeAlong(a, b, 95)).toBeLessThanOrEqual(250);
    expect(sizeAlong(a, b, 0)).toBeGreaterThanOrEqual(85);
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
