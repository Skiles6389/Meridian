import { clampDifficulty, highestUnlocked, NORMAL } from "./difficulty";
import { getEncounter, getEnemy } from "./enemies";
import type { FoeSpawn } from "./enemies";
import type { JetId, Meta, MetaStats, RunState } from "./types";

// Keys keep the game's original name so saves made before the rename still load.
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
    unlocked: { kite: true, bulwark: false, moth: false, lattice: false, hog: false },
    stats: emptyStats(),
    cleared: {},
    difficulty: NORMAL,
    mute: false,
    musicVol: 0.6,
    sfxVol: 0.8,
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

function volume(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

function cleanCleared(value: unknown): Meta["cleared"] {
  if (!value || typeof value !== "object") return {};
  const out: Meta["cleared"] = {};
  for (const [jet, level] of Object.entries(value as Record<string, unknown>)) {
    if (typeof level === "number" && Number.isFinite(level)) out[jet as JetId] = clampDifficulty(level);
  }
  return out;
}

export function loadMeta(): Meta {
  const raw = storage()?.getItem(META_KEY);
  if (!raw) return freshMeta();
  try {
    const parsed = JSON.parse(raw) as Meta;
    if (parsed.version !== 1 || !parsed.unlocked || !parsed.stats) return freshMeta();
    const meta: Meta = {
      ...freshMeta(),
      ...parsed,
      unlocked: { ...freshMeta().unlocked, ...parsed.unlocked },
      stats: { ...emptyStats(), ...parsed.stats },
      cleared: cleanCleared(parsed.cleared),
      difficulty: clampDifficulty(parsed.difficulty ?? NORMAL),
      musicVol: volume(parsed.musicVol, 0.6),
      sfxVol: volume(parsed.sfxVol, 0.8),
    };
    meta.difficulty = Math.min(meta.difficulty, highestUnlocked(meta));
    checkUnlocks(meta);
    return meta;
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

/**
 * Saves written before the real-aircraft reskin carry the old display names
 * and art ids inside an in-progress fight. Ids are unchanged, so refresh the
 * presentation fields from the current definitions.
 */
export function migrateRun(run: RunState): RunState {
  run.scratch = false;
  run.route = run.route ?? (run.nodeId ? [run.nodeId] : []);
  run.notices = run.notices ?? [];
  run.difficulty = clampDifficulty(run.difficulty ?? NORMAL);
  const combat = run.combat;
  if (combat) {
    combat.player.status.plating = combat.player.status.plating ?? 0;
    for (const fighter of combat.enemies) fighter.status.plating = fighter.status.plating ?? 0;
    let foes: FoeSpawn[] = [];
    try {
      const encounter = getEncounter(combat.encounterId);
      combat.encounterName = encounter.name;
      foes = encounter.foes;
    } catch {
      foes = [];
    }
    combat.enemies.forEach((fighter, index) => {
      try {
        const def = getEnemy(fighter.defId);
        const spawn = foes[index]?.id === fighter.defId ? foes[index] : undefined;
        fighter.name = spawn?.name ?? def.name;
        fighter.epithet = def.epithet;
        fighter.silhouette = def.silhouette;
        fighter.accent = def.accent;
      } catch {
        /* unknown enemy ids are left as saved */
      }
    });
  }
  return run;
}

export function loadRun(): RunState | null {
  const raw = storage()?.getItem(RUN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RunState;
    if (parsed.version !== 1 || !parsed.deck || !parsed.map) return null;
    return migrateRun(parsed);
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
  if (!meta.unlocked.hog && meta.stats.deepest >= 3) {
    meta.unlocked.hog = true;
    fresh.push("hog");
  }
  return fresh;
}
