/*
 * Which weapon stations each jet has fired. This is cosmetic: a launched missile leaves its pylon
 * empty until the jets are rearmed at the start of the next turn. The renderer reads it so a
 * redraw mid-turn does not put a missile back.
 */

import type { StoreKind } from "./anchors";

interface Rack {
  /** Stations whose missile has gone. */
  spent: Set<number>;
  /** How many times each station has fired, so repeat launches alternate sides. */
  fired: Map<number, number>;
}

const racks = new Map<number, Rack>();
const EMPTY: ReadonlySet<number> = new Set();

export function spentStations(who: number): ReadonlySet<number> {
  return racks.get(who)?.spent ?? EMPTY;
}

/** Pods and bays are never emptied: a pod keeps its rockets and a bay hides what is left. */
const reusable = (kind: StoreKind) => kind === "pod" || kind === "bay";

/**
 * Picks the station a weapon leaves from and marks it fired. Loaded stations of a wanted kind go
 * first; failing that any loaded missile will do; and a jet with nothing left fires from where a
 * missile used to hang, so the shot still starts at a pylon.
 */
export function takeStation(who: number, kinds: readonly StoreKind[], want: readonly StoreKind[]): number {
  if (!kinds.length) return -1;
  let rack = racks.get(who);
  if (!rack) {
    rack = { spent: new Set(), fired: new Map() };
    racks.set(who, rack);
  }
  const { spent, fired } = rack;
  const count = (i: number) => fired.get(i) ?? 0;
  const pick = (ok: (i: number) => boolean) => {
    let best = -1;
    for (let i = 0; i < kinds.length; i++) {
      if (ok(i) && (best < 0 || count(i) < count(best))) best = i;
    }
    return best;
  };
  const loaded = (i: number) => reusable(kinds[i]) || !spent.has(i);
  const missile = (i: number) => kinds[i] !== "pod" || want.includes("pod");
  let index = pick((i) => want.includes(kinds[i]) && loaded(i));
  if (index < 0) index = pick((i) => missile(i) && loaded(i));
  if (index < 0) index = pick(missile);
  if (index < 0) index = pick(() => true);
  fired.set(index, count(index) + 1);
  if (!reusable(kinds[index])) spent.add(index);
  return index;
}

/** Rearms one jet, or every jet. Returns whether anything had been fired. */
export function rearm(who?: number): boolean {
  if (who === undefined) {
    const any = [...racks.values()].some((rack) => rack.spent.size > 0);
    racks.clear();
    return any;
  }
  const had = (racks.get(who)?.spent.size ?? 0) > 0;
  racks.delete(who);
  return had;
}
