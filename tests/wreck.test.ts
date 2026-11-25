import { describe, expect, it } from "vitest";
import { CUE_NAMES } from "../src/audio";
import {
  demiseLength,
  demisePlan,
  explosionAt,
  fallPose,
  landingSpot,
  MIDAIR_CHANCE,
  pickDemise,
  pieceArea,
  pieceCentre,
  REAR_PIECES,
  SIDE_PIECES,
  wreckPieces,
  type Cause,
} from "../src/ui/crashplan";

const CAUSES: Cause[] = ["blast", "gun", "burn", "other"];

describe("how a jet dies", () => {
  it("has two deaths, and lets what killed the jet weigh the choice", () => {
    for (const cause of CAUSES) {
      expect(pickDemise(cause, 0.999)).toBe(MIDAIR_CHANCE[cause] >= 1 ? "midair" : "crash");
      if (MIDAIR_CHANCE[cause] > 0) expect(pickDemise(cause, 0)).toBe("midair");
    }
    // A warhead mostly blows a jet apart; gunfire mostly brings it down burning; a fire always does.
    expect(MIDAIR_CHANCE.blast).toBeGreaterThan(0.5);
    expect(MIDAIR_CHANCE.gun).toBeLessThan(0.5);
    expect(pickDemise("burn", 0)).toBe("crash");
    // Both happen under every weapon the player has.
    for (const cause of ["blast", "gun", "other"] as Cause[]) {
      const seen = new Set([0.01, 0.2, 0.4, 0.6, 0.9, 0.99].map((roll) => pickDemise(cause, roll)));
      expect(seen.size, cause).toBe(2);
    }
  });

  it("always breaks up a jet that is on the player's six, where there is no room to fall", () => {
    for (const cause of CAUSES) for (const roll of [0, 0.5, 0.99]) expect(pickDemise(cause, roll, true)).toBe("midair");
  });

  it("gives a boss a longer, bigger death than a line jet", () => {
    for (const kind of ["midair", "crash"] as const) {
      const line = demisePlan(kind);
      const boss = demisePlan(kind, { boss: true });
      expect(boss.size).toBeGreaterThan(line.size * 1.3);
      expect(demiseLength(boss)).toBeGreaterThan(demiseLength(line) * 1.4);
      expect(explosionAt(boss)).toBeGreaterThan(explosionAt(line));
      expect(boss.prelude).toBeGreaterThan(0);
      expect(boss.secondaries).toBeGreaterThan(0);
      expect(boss.aftershocks).toBeGreaterThan(line.aftershocks);
      expect(boss.hitStop).toBeGreaterThan(line.hitStop);
      expect(boss.shake).toBeGreaterThan(line.shake);
      expect(boss.flash).toBe(true);
    }
  });

  it("keeps the hit-stop short and puts it, the shake and the flash on the explosion", () => {
    for (const kind of ["midair", "crash"] as const) {
      for (const who of [{}, { boss: true }, { player: true }]) {
        const plan = demisePlan(kind, who);
        expect(plan.hitStop).toBeGreaterThanOrEqual(60);
        expect(plan.hitStop).toBeLessThanOrEqual(200);
        expect(plan.shake).toBeGreaterThan(0);
        expect(plan.lead).toBeLessThanOrEqual(600);
        expect(plan.settle).toBeGreaterThan(1);
        expect(explosionAt(plan)).toBe(plan.prelude + plan.fall);
        // A mid-air kill explodes at once; a crash explodes when the fall is over.
        if (kind === "midair") expect(plan.fall).toBe(0);
        else expect(plan.fall).toBeGreaterThan(1);
        expect(demiseLength(plan)).toBeLessThan(8);
      }
    }
    expect(demisePlan("crash", { player: true }).size).toBeGreaterThan(1);
  });

  it("has a sound for every beat of both deaths", () => {
    for (const cue of ["breakup", "flameout", "dive", "groundhit", "splash", "explode"]) expect(CUE_NAMES).toContain(cue);
  });
});

describe("wreckage", () => {
  it("breaks the view from behind into wings, tail and body that fit together", () => {
    const names = REAR_PIECES.map((piece) => piece.name);
    expect(names.filter((name) => name.includes("wing")).length).toBe(4);
    expect(names).toContain("tail");
    // No gaps and no overlaps: the pieces' areas add up to the whole sprite.
    expect(REAR_PIECES.reduce((sum, piece) => sum + pieceArea(piece.outline), 0)).toBeCloseTo(1, 6);
    expect(SIDE_PIECES.reduce((sum, piece) => sum + pieceArea(piece.outline), 0)).toBeCloseTo(1, 6);
  });

  it("keeps every piece inside the sprite and big enough to see", () => {
    for (const piece of [...REAR_PIECES, ...SIDE_PIECES]) {
      expect(piece.outline.length, piece.name).toBeGreaterThanOrEqual(5);
      for (const [x, y] of piece.outline) {
        expect(x, piece.name).toBeGreaterThanOrEqual(0);
        expect(x, piece.name).toBeLessThanOrEqual(1);
        expect(y, piece.name).toBeGreaterThanOrEqual(0);
        expect(y, piece.name).toBeLessThanOrEqual(1);
      }
      expect(pieceArea(piece.outline), piece.name).toBeGreaterThan(0.05);
    }
  });

  it("throws the left wing left and the right wing right", () => {
    const centre = (name: string) => pieceCentre(REAR_PIECES.find((piece) => piece.name === name)!.outline);
    expect(centre("left wingtip")[0]).toBeLessThan(0.2);
    expect(centre("left wing")[0]).toBeLessThan(0.4);
    expect(centre("right wing")[0]).toBeGreaterThan(0.6);
    expect(centre("right wingtip")[0]).toBeGreaterThan(0.8);
    expect(centre("tail")[1]).toBeLessThan(0.4);
  });

  it("always has wings and a tail spinning off, with or without the profile to cut from", () => {
    for (const profile of [true, false]) {
      const names = wreckPieces(profile).map((piece) => piece.name);
      expect(names.filter((name) => name.includes("wing")).length, String(profile)).toBe(4);
      expect(names.some((name) => name.includes("tail")), String(profile)).toBe(true);
      expect(names.length).toBeGreaterThanOrEqual(6);
    }
    expect(wreckPieces(false).every((piece) => piece.view === "rear")).toBe(true);
    expect(wreckPieces(true).some((piece) => piece.view === "side")).toBe(true);
  });
});

describe("the fall", () => {
  it("starts where the jet was, ends on the surface, and only ever goes down", () => {
    for (const spiral of [true, false]) {
      for (const side of [-1, 1]) {
        const first = fallPose(0, spiral, side);
        const last = fallPose(1, spiral, side, 0.3);
        expect(first.drop).toBe(0);
        expect(first.size).toBe(1);
        expect(first.roll).toBeCloseTo(0, 9);
        expect(last.drop).toBeCloseTo(1, 9);
        expect(last.along).toBe(1);
        expect(last.size).toBeCloseTo(0.3, 9);
        let before = first;
        for (let k = 0.05; k <= 1.0001; k += 0.05) {
          const pose = fallPose(k, spiral, side, 0.3);
          expect(pose.drop).toBeGreaterThan(before.drop);
          expect(pose.size).toBeLessThan(before.size);
          before = pose;
        }
      }
    }
  });

  it("corkscrews a spiral right round and sends a dive straight in", () => {
    expect(Math.abs(fallPose(1, true, 1).roll)).toBeGreaterThan(Math.PI * 2);
    expect(Math.abs(fallPose(1, false, 1).roll)).toBeLessThan(Math.PI / 2);
    expect(fallPose(1, true, -1).roll).toBeLessThan(0);
    const weave = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map((k) => fallPose(k, true, 1).weave);
    expect(Math.max(...weave)).toBeGreaterThan(0.05);
    expect(Math.min(...weave)).toBeLessThan(-0.05);
    for (const k of [0.2, 0.5, 0.8]) expect(fallPose(k, false, 1).weave).toBe(0);
  });

  it("lands below the horizon, on screen, and clear of the middle of the frame", () => {
    const screens = [
      { w: 1280, h: 720, horizon: 324 },
      { w: 390, h: 844, horizon: 338 },
      { w: 844, h: 390, horizon: 183 },
    ];
    for (const screen of screens) {
      for (const fx of [0.2, 0.42, 0.5, 0.58, 0.8]) {
        for (const roll of [0, 0.5, 0.99]) {
          const from = { x: screen.w * fx, y: screen.h * 0.3 };
          const spot = landingSpot(from, screen, false, roll);
          expect(spot.y).toBeGreaterThan(screen.horizon + screen.h * 0.1);
          expect(spot.y).toBeGreaterThan(from.y);
          expect(spot.y).toBeLessThan(screen.h);
          expect(spot.x).toBeGreaterThan(0);
          expect(spot.x).toBeLessThan(screen.w);
          // It falls outward, away from the player's jet.
          if (fx < 0.45) expect(spot.x).toBeLessThan(from.x);
          if (fx > 0.55) expect(spot.x).toBeGreaterThan(from.x);
          expect(Math.abs(spot.x - screen.w / 2)).toBeGreaterThanOrEqual(screen.w * 0.19);
          expect(spot.size).toBeGreaterThan(0.15);
          expect(spot.size).toBeLessThanOrEqual(0.5);
        }
      }
      // The player's own jet goes in ahead: small, just under the horizon.
      const own = landingSpot({ x: screen.w / 2, y: screen.h * 0.7 }, screen, true, 0.3);
      expect(own.y).toBeGreaterThan(screen.horizon);
      expect(own.y).toBeLessThan(screen.h * 0.7);
      expect(own.size).toBeLessThan(0.2);
    }
  });
});
