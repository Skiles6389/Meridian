import { describe, expect, it } from "vitest";
import { ENEMIES } from "../src/game/enemies";
import { JET_ORDER, JETS } from "../src/game/jets";
import { chaseAspect, hasChaseArt } from "../src/ui/art";
import {
  allySpot,
  attitude,
  breakTurn,
  cubic,
  cubicTangent,
  flightView,
  foeSpots,
  mirrored,
  overshoot,
  sixSpots,
  sizeAlong,
  type CamShape,
  type CamShot,
  type FlightView,
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

  it("flies the break turn out to the side, round toward the camera, and up onto the six", () => {
    const from = { x: 40, y: 28 };
    const to = { x: 38, y: 75 };
    const curve = breakTurn(from, to, -1);
    expect(cubic(curve, 0)).toEqual(from);
    expect(cubic(curve, 1)).toEqual(to);
    const views: FlightView[] = [];
    let view: FlightView | undefined;
    let minX = 100;
    let maxY = 0;
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const p = cubic(curve, t);
      minX = Math.min(minX, p.x);
      maxY = Math.max(maxY, p.y);
      const d = cubicTangent(curve, Math.min(0.995, Math.max(0.005, t)));
      view = flightView(d.x * 16, d.y * 9, view);
      if (views.at(-1) !== view) views.push(view);
    }
    // Sweeps out wide to its side, stays on screen, and dips below the six before reversing onto it.
    expect(minX).toBeLessThan(25);
    expect(minX).toBeGreaterThan(0);
    expect(maxY).toBeGreaterThan(to.y);
    expect(maxY).toBeLessThan(100);
    // Profile out of the turn, nose toward the camera as it comes round, then tail-on on the six.
    expect(views[0]).toBe("side");
    expect(views).toContain("front");
    expect(views.at(-1)).toBe("rear");
    expect(views.length).toBeLessThanOrEqual(4);
    // A landscape phone's short, wide stage still arrives tail-on.
    const flat = breakTurn({ x: 40, y: 25 }, { x: 36, y: 78 }, -1, 844 / 222);
    const d = cubicTangent(flat, 0.995);
    expect(flightView(d.x * 844, d.y * 222, "side")).toBe("rear");
  });

  it("overshoots back out ahead tail-on, banking as it goes", () => {
    const curve = overshoot({ x: 62, y: 80 }, { x: 67, y: 27 }, 1);
    for (let i = 1; i < 20; i++) {
      const d = cubicTangent(curve, i / 20);
      expect(flightView(d.x * 16, d.y * 9, "rear")).toBe("rear");
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
