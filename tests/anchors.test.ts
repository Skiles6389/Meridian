import { describe, expect, it } from "vitest";
import chaseMeta from "../src/assets/art/chase.json";
import { ENEMIES } from "../src/game/enemies";
import { JETS } from "../src/game/jets";
import type { SilhouetteId } from "../src/game/types";
import { ANCHORS, anchorsOf, FALLBACK_ANCHORS, type SpriteAnchors, type Xy } from "../src/ui/anchors";
import { rearm, spentStations, takeStation } from "../src/ui/loadout";
import chaseMask from "../src/assets/art/chase-mask.json";

interface Mask {
  w: number;
  h: number;
  /** One hex string per row of cells, four cells to a digit; a set bit is a solid cell. */
  rows: string[];
}

const MASKS = chaseMask as Record<string, Mask>;

/** Whether a point, in percentages of the sprite's box, lands on the sprite's own opaque pixels. */
function onSprite(name: string, [x, y]: Xy | [number, number, ...unknown[]]): boolean {
  const mask = MASKS[name];
  const cx = Math.min(mask.w - 1, Math.max(0, Math.floor((x / 100) * mask.w)));
  const cy = Math.min(mask.h - 1, Math.max(0, Math.floor((y / 100) * mask.h)));
  return ((parseInt(mask.rows[cy][cx >> 2], 16) >> (3 - (cx & 3))) & 1) === 1;
}

/** The three Tornado variants share one chase airframe, as in art.ts. */
const body = (id: SilhouetteId) => (id.startsWith("tornado_") ? "tornado" : id);

const inBounds = ([x, y]: Xy | [number, number, ...unknown[]], what: string) => {
  expect(x, what).toBeGreaterThanOrEqual(0);
  expect(x, what).toBeLessThanOrEqual(100);
  expect(y, what).toBeGreaterThanOrEqual(0);
  expect(y, what).toBeLessThanOrEqual(100);
};

function check(name: string, a: SpriteAnchors) {
  expect(a, `${name} has no anchors`).not.toBe(FALLBACK_ANCHORS);
  inBounds(a.gun, `${name} gun`);
  expect(a.pylons.length, `${name} weapon stations`).toBeGreaterThanOrEqual(2);
  for (const station of a.pylons) inBounds(station, `${name} station`);
  // Something there must be able to launch a missile: a pod alone only fires rockets.
  expect(a.pylons.some(([, , kind]) => kind !== "pod"), `${name} has nowhere to hang a missile`).toBe(true);
  for (const p of [...(a.flares ?? []), ...(a.pods ?? []), ...(a.tips ?? []), ...(a.chaff ? [a.chaff] : []), ...(a.belly ? [a.belly] : []), ...(a.nose ? [a.nose] : [])]) inBounds(p, `${name} marker`);
}

describe("sprite anchors", () => {
  it("gives every player jet a gun muzzle, weapon stations and countermeasure points on its rear view", () => {
    for (const jet of Object.values(JETS)) {
      const name = `${body(jet.silhouette)}-rear`;
      const a = anchorsOf(name);
      check(name, a);
      expect(a.flares?.length, `${name} flare dispensers`).toBeGreaterThanOrEqual(2);
      expect(a.chaff, `${name} chaff point`).toBeDefined();
      expect(a.tips?.length, `${name} wingtips`).toBe(2);
      expect(a.belly, `${name} belly`).toBeDefined();
      expect(a.nose, `${name} nose`).toBeDefined();
    }
  });

  it("gives every enemy a gun muzzle and weapon stations in both its rear and front-quarter views", () => {
    for (const enemy of Object.values(ENEMIES)) {
      for (const view of ["rear", "front"] as const) {
        const name = `${body(enemy.silhouette)}-${view}`;
        check(name, anchorsOf(name));
      }
    }
  });

  it("has anchors for every chase sprite in the art folder, and none for a sprite that is not there", () => {
    const sprites = Object.keys(chaseMeta).sort();
    expect(Object.keys(ANCHORS).sort()).toEqual(sprites);
  });

  it("puts every anchor on the airframe: none hangs in the transparent air around the sprite", () => {
    expect(Object.keys(MASKS).sort()).toEqual(Object.keys(chaseMeta).sort());
    const off: string[] = [];
    for (const [name, a] of Object.entries(ANCHORS)) {
      const points: [string, Xy | [number, number, ...unknown[]]][] = [
        ["gun", a.gun],
        ...a.pylons.map((p, i): [string, [number, number, ...unknown[]]] => [`station ${i}`, p]),
        ...(a.flares ?? []).map((p, i): [string, Xy] => [`flare ${i}`, p]),
        ...(a.pods ?? []).map((p, i): [string, Xy] => [`pod ${i}`, p]),
        ...(a.tips ?? []).map((p, i): [string, Xy] => [`tip ${i}`, p]),
        ...(a.chaff ? [["chaff", a.chaff] as [string, Xy]] : []),
        ...(a.belly ? [["belly", a.belly] as [string, Xy]] : []),
        ...(a.nose ? [["nose", a.nose] as [string, Xy]] : []),
      ];
      for (const [what, p] of points) if (!onSprite(name, p)) off.push(`${name} ${what} [${p[0]}, ${p[1]}]`);
    }
    expect(off).toEqual([]);
  });

  it("puts the guns where the real ones are", () => {
    // F-16: left wing root. F-15E and F-22: right wing root. EA-18G and A-10: on the nose.
    expect(ANCHORS["f16-rear"].gun[0]).toBeLessThan(48);
    expect(ANCHORS["f15e-rear"].gun[0]).toBeGreaterThan(52);
    expect(ANCHORS["f22-rear"].gun[0]).toBeGreaterThan(52);
    expect(Math.abs(ANCHORS["ea18g-rear"].gun[0] - 50)).toBeLessThan(3);
    expect(Math.abs(ANCHORS["a10-rear"].gun[0] - 50)).toBeLessThan(3);
    expect(ANCHORS["a10-rear"].gun[1]).toBeLessThan(15);
  });

  it("carries the F-22's and F-35's weapons in bays, and everyone else's on pylons", () => {
    for (const [name, a] of Object.entries(ANCHORS)) {
      const stealth = name.startsWith("f22") || name.startsWith("f35");
      expect(a.pylons.every(([, , kind]) => (kind === "bay") === stealth), name).toBe(true);
    }
  });
});

describe("pylon loadout", () => {
  const kinds = ["aam", "aam", "agm", "agm", "pod", "pod"] as const;

  it("fires each missile once, wanted kinds first, and leaves its pylon empty", () => {
    rearm();
    expect(takeStation(1, kinds, ["agm"])).toBe(2);
    expect(takeStation(1, kinds, ["agm"])).toBe(3);
    // No heavy missile left: a light one goes instead.
    expect(takeStation(1, kinds, ["agm"])).toBe(0);
    expect([...spentStations(1)].sort()).toEqual([0, 2, 3]);
    expect(spentStations(2).size).toBe(0);
  });

  it("still launches from a pylon when every missile has gone, and never from a rocket pod", () => {
    rearm();
    const fired = Array.from({ length: 7 }, () => takeStation(1, kinds, ["aam"]));
    expect(fired.slice(0, 4).sort()).toEqual([0, 1, 2, 3]);
    for (const index of fired) expect(kinds[index]).not.toBe("pod");
  });

  it("never empties a bay or a rocket pod, and alternates between them", () => {
    rearm();
    expect([takeStation(1, ["bay", "bay"], ["aam", "bay"]), takeStation(1, ["bay", "bay"], ["aam", "bay"]), takeStation(1, ["bay", "bay"], ["aam", "bay"])]).toEqual([0, 1, 0]);
    expect(spentStations(1).size).toBe(0);
    expect([takeStation(3, kinds, ["pod"]), takeStation(3, kinds, ["pod"])]).toEqual([4, 5]);
    expect(spentStations(3).size).toBe(0);
  });

  it("rearms one jet or all of them", () => {
    rearm();
    takeStation(1, kinds, ["aam"]);
    takeStation(2, kinds, ["aam"]);
    expect(rearm(1)).toBe(true);
    expect(spentStations(1).size).toBe(0);
    expect(spentStations(2).size).toBe(1);
    expect(rearm(1)).toBe(false);
    rearm();
    expect(spentStations(2).size).toBe(0);
  });
});
