import type { JetId, Meta, MetaStats, RunState } from "./types";

export const META_KEY = "meridian.meta.v1";
export const RUN_KEY = "meridian.run.v1";

export function emptyStats(): MetaStats {
  return {
    runs: 0,
    wins: 0,
    losses: 0,
    battles: 0,
    elites: 0,
    bosses: 0,
    act1Bosses: 0,
    mysteries: 0,
    goldEarned: 0,
    cardsPlayed: 0,
    deepest: 0,
    bestVictoryHp: 0,
  };
}

export function freshMeta(): Meta {
  return {
    version: 1,
    unlocked: { kite: true, bulwark: false, moth: false, lattice: false },
    stats: emptyStats(),
    mute: false,
  };
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadMeta(): Meta {
  const raw = storage()?.getItem(META_KEY);
  if (!raw) return freshMeta();
  try {
    const parsed = JSON.parse(raw) as Meta;
    if (parsed.version !== 1 || !parsed.unlocked || !parsed.stats) return freshMeta();
    return {
      ...freshMeta(),
      ...parsed,
      unlocked: { ...freshMeta().unlocked, ...parsed.unlocked },
      stats: { ...emptyStats(), ...parsed.stats },
    };
  } catch {
    return freshMeta();
  }
}

export function saveMeta(meta: Meta): void {
  try {
    storage()?.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* private mode or a full disk should not crash a sortie */
  }
}

export function loadRun(): RunState | null {
  const raw = storage()?.getItem(RUN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RunState;
    if (parsed.version !== 1 || !parsed.deck || !parsed.map) return null;
    parsed.scratch = false;
    parsed.route = parsed.route ?? (parsed.nodeId ? [parsed.nodeId] : []);
    parsed.notices = parsed.notices ?? [];
    return parsed;
  } catch {
    return null;
  }
}

export function saveRun(run: RunState | null): void {
  try {
    const bin = storage();
    if (!bin) return;
    if (!run) bin.removeItem(RUN_KEY);
    else bin.setItem(RUN_KEY, JSON.stringify(run));
  } catch {
    /* ignore quota */
  }
}

export function checkUnlocks(meta: Meta): JetId[] {
  const fresh: JetId[] = [];
  if (!meta.unlocked.bulwark && meta.stats.act1Bosses >= 1) {
    meta.unlocked.bulwark = true;
    fresh.push("bulwark");
  }
  if (!meta.unlocked.moth && meta.stats.wins >= 1) {
    meta.unlocked.moth = true;
    fresh.push("moth");
  }
  if (!meta.unlocked.lattice && meta.stats.mysteries >= 5) {
    meta.unlocked.lattice = true;
    fresh.push("lattice");
  }
  return fresh;
}
