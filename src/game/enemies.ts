import type { ActId, BossId, Livery, Move, SilhouetteId } from "./types";
import { freshStatus } from "./types";
import type { Fighter } from "./types";

export interface EnemyDef {
  id: string;
  name: string;
  epithet: string;
  hp: number;
  silhouette: SilhouetteId;
  livery?: Livery;
  accent: string;
  moves: Move[];
  phases?: Move[][];
  armor?: number;
  boss?: BossId;
  riposte?: number;
  elite?: boolean;
}

export interface FoeSpawn {
  id: string;
  hp?: number;
  name?: string;
  /** Subtracted from damaging moves, to keep early pairs from spiking. */
  soften?: number;
}

export interface EncounterDef {
  id: string;
  name: string;
  act: ActId;
  kind: "battle" | "elite" | "boss";
  foes: FoeSpawn[];
}

function mv(name: string, partial: Partial<Move> & { damage?: number; hits?: number }): Move {
  return {
    name,
    damage: partial.damage ?? 0,
    hits: partial.hits ?? (partial.damage ? 1 : 0),
    shield: partial.shield ?? 0,
    thrust: partial.thrust ?? 0,
    armor: partial.armor ?? 0,
    burn: partial.burn ?? 0,
    locked: partial.locked ?? 0,
    jam: partial.jam ?? 0,
    suppress: partial.suppress ?? 0,
    stat: partial.stat ?? 0,
    heal: partial.heal ?? 0,
  };
}

const atk = (name: string, damage: number, hits = 1, extra: Partial<Move> = {}) =>
  mv(name, { ...extra, damage, hits });

export const ENEMIES: EnemyDef[] = [
  {
    id: "habicht",
    name: "F-104G Starfighter",
    epithet: "Habicht flight · naval patrol",
    hp: 42,
    silhouette: "f104",
    accent: "#f0b429",
    moves: [atk("Peck", 8), mv("Cover", { shield: 7 }), atk("Dive", 12)],
  },
  {
    id: "kiebitz",
    name: "Alpha Jet A",
    epithet: "Kiebitz flight · lead-in trainers",
    hp: 34,
    silhouette: "alphajet",
    accent: "#8dffc1",
    moves: [atk("Rake", 4, 2), mv("Slip", { shield: 6 }), atk("Snap", 11)],
  },
  {
    id: "dachs",
    name: "Alpha Jet CAS",
    epithet: "Dachs flight · rocket pods",
    hp: 48,
    silhouette: "alphajet",
    livery: "olive",
    accent: "#e0a36a",
    moves: [atk("Scorch", 7, 1, { burn: 1 }), mv("Dig In", { shield: 11 }), atk("Maul", 13)],
  },
  {
    id: "luchs",
    name: "RF-4E Phantom II",
    epithet: "Luchs flight · armed recon",
    hp: 54,
    silhouette: "f4f",
    livery: "green",
    accent: "#d0d7de",
    moves: [atk("Heavy", 12), mv("Brace", { shield: 9 }), atk("Slam", 16)],
  },
  {
    id: "rabe",
    name: "F-104G Black Tail",
    epithet: "Rabe · Starfighter ace",
    hp: 78,
    silhouette: "f104",
    livery: "night",
    accent: "#c3b0ff",
    elite: true,
    moves: [atk("Black Peck", 6, 2), atk("Tar", 8, 1, { burn: 2 }), mv("Hood", { shield: 12 }), atk("Swoop", 15)],
  },
  {
    id: "moorhau",
    name: "Tornado IDS Marine",
    epithet: "Moorhau battery · anti-ship strike",
    hp: 88,
    silhouette: "tornado_marine",
    accent: "#f0a35e",
    elite: true,
    moves: [mv("Wall", { shield: 14 }), atk("Ram", 17), atk("Tar Shot", 10, 1, { burn: 1 })],
  },
  {
    id: "falke",
    name: "Eurofighter Typhoon",
    epithet: "Sturmfalke pair · quick-reaction alert",
    hp: 66,
    silhouette: "typhoon",
    accent: "#ffb020",
    moves: [atk("Cut", 12), atk("Twin Cut", 6, 2), mv("Spike", { thrust: 2, shield: 6 })],
  },
  {
    id: "nachtigall",
    name: "Tornado ECR",
    epithet: "Nachtigall flight · radar hunters",
    hp: 60,
    silhouette: "tornado_ecr",
    accent: "#8ebfff",
    moves: [atk("Hiss", 8, 1, { burn: 2 }), mv("Veil", { shield: 13 }), atk("Screech", 10, 1, { jam: 2 })],
  },
  {
    id: "bernstein",
    name: "Tornado IDS",
    epithet: "Bernstein flight · low-level strike",
    hp: 72,
    silhouette: "tornado_ids",
    accent: "#f0a35e",
    moves: [atk("Hook", 14), mv("Plate", { shield: 12 }), atk("Brand", 11, 1, { locked: 1 })],
  },
  {
    id: "marder",
    name: "MiG-29G Fulcrum",
    epithet: "Marder flight · close-in dogfighters",
    hp: 64,
    silhouette: "mig29",
    accent: "#ff8b7a",
    moves: [atk("Triple", 5, 3), mv("Kick", { thrust: 2 }), atk("Lunge", 16)],
  },
  {
    id: "zwilling",
    name: "MiG-29G Fulcrum",
    epithet: "Zwilling pair · aggressor wing",
    hp: 52,
    silhouette: "mig29",
    livery: "splinter",
    accent: "#d7dee8",
    elite: true,
    moves: [atk("Jab", 9), mv("Guard", { shield: 8 }), atk("Cross", 7, 2)],
  },
  {
    id: "hochbahn",
    name: "F-4F Phantom II ICE",
    epithet: "Hochbahn battery · radar missiles",
    hp: 112,
    silhouette: "f4f",
    livery: "steel",
    accent: "#f0b429",
    elite: true,
    armor: 2,
    moves: [atk("Press", 10, 2), mv("Weld", { shield: 14, armor: 1 }), atk("Shear", 18)],
  },
  {
    id: "spiegel",
    name: "Eurofighter Typhoon EK",
    epithet: "Spiegel test cell · electronic combat",
    hp: 88,
    silhouette: "typhoon",
    livery: "glass",
    accent: "#c3b0ff",
    riposte: 6,
    moves: [mv("Mirror", { shield: 10, damage: 8, hits: 1 }), atk("Shard", 18), atk("Glint", 8, 1, { burn: 2 })],
  },
  {
    id: "gewitter",
    name: "Tornado ECR ASSTA",
    epithet: "Gewitter flight · storm jammers",
    hp: 92,
    silhouette: "tornado_ecr",
    livery: "storm",
    accent: "#8ebfff",
    moves: [atk("Storm", 12, 1, { jam: 2 }), mv("Cage", { shield: 15, burn: 2 }), atk("Break", 8, 2)],
  },
  {
    id: "eisenwal",
    name: "Tornado IDS Taurus",
    epithet: "Eisenwal flight · cruise-missile carrier",
    hp: 102,
    silhouette: "tornado_ids",
    livery: "iron",
    accent: "#d0d7de",
    moves: [mv("Load", { shield: 16, thrust: 1 }), atk("Fire", 22), atk("Walk", 13)],
  },
  {
    id: "schwarz",
    name: "MiG-29G Night Fulcrum",
    epithet: "Schwarzwerk · night aggressor",
    hp: 132,
    silhouette: "mig29",
    livery: "night",
    accent: "#ff5d6c",
    elite: true,
    armor: 3,
    moves: [atk("Press", 11, 2), mv("Weld", { shield: 16 }), atk("Shear", 20)],
  },
  {
    id: "weiss",
    name: "F-35A Lightning II",
    epithet: "Weissdorn flight · low-observable escort",
    hp: 98,
    silhouette: "f35",
    livery: "frost",
    accent: "#e7eef4",
    elite: true,
    riposte: 5,
    moves: [atk("Shroud", 6, 1, { suppress: 1 }), atk("Knife", 16), mv("Veil", { shield: 12, burn: 1 })],
  },
  {
    id: "eule",
    name: "F-4F Phantom II",
    epithet: "“Graue Eule” · squadron command",
    hp: 120,
    silhouette: "f4f_boss",
    accent: "#f0b429",
    boss: "eule",
    moves: [
      atk("Radar Sweep", 6, 1, { locked: 2 }),
      atk("Drum", 8, 2),
      atk("Glare", 16),
      mv("Brace", { shield: 12, thrust: 1 }),
    ],
  },
  {
    id: "adler",
    name: "Eurofighter Typhoon T3",
    epithet: "“Königsadler” · display prototype",
    hp: 168,
    silhouette: "typhoon_boss",
    accent: "#f0a35e",
    boss: "adler",
    armor: 8,
    moves: [
      atk("Talon", 13),
      atk("Crown", 7, 2),
      mv("Shed", { shield: 12, thrust: 1 }),
      atk("Fall", 18),
    ],
  },
  {
    id: "nebel",
    name: "F-35A Lightning II",
    epithet: "“Nebelhorn” · Nebelkreis lead",
    hp: 220,
    silhouette: "f35_boss",
    accent: "#8ebfff",
    boss: "nebel",
    moves: [],
    phases: [
      [mv("Fog", { shield: 16 }), atk("Lane", 14), atk("Mark", 10, 1, { locked: 1 })],
      [atk("Horn", 6, 3), atk("Static Burst", 12, 1, { stat: 1, burn: 2 }), atk("Peel", 16)],
      [atk("Whiteout", 20), atk("Seeker", 8, 2, { burn: 2 }), atk("Howl", 14, 1, { locked: 2, stat: 1 })],
    ],
  },
];

const ENEMY_BY_ID: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

export function getEnemy(id: string): EnemyDef {
  const enemy = ENEMY_BY_ID[id];
  if (!enemy) throw new Error(`Unknown enemy ${id}`);
  return enemy;
}

function softenMove(move: Move, soften: number): Move {
  if (!soften || move.damage <= 0) return move;
  return { ...move, damage: Math.max(4, move.damage - soften) };
}

export function spawnFighter(spawn: FoeSpawn, uid: number): Fighter {
  const def = getEnemy(spawn.id);
  const soften = spawn.soften ?? 0;
  const moves = def.moves.map((m) => softenMove(m, soften));
  const phases = (def.phases ?? []).map((set) => set.map((m) => softenMove(m, soften)));
  return {
    uid,
    defId: def.id,
    name: spawn.name ?? def.name,
    epithet: def.epithet,
    hp: spawn.hp ?? def.hp,
    maxHp: spawn.hp ?? def.hp,
    shield: 0,
    status: { ...freshStatus(), armor: def.armor ?? 0 },
    moves,
    phases,
    movePtr: 0,
    phase: 1,
    silhouette: def.silhouette,
    accent: def.accent,
    boss: def.boss ?? "",
    riposte: def.riposte ?? 0,
    riposteReady: true,
    bonusDamage: 0,
    ignoreEvasion: false,
    molted: false,
    moltedPending: false,
    elite: !!def.elite,
  };
}

export const ENCOUNTERS: EncounterDef[] = [
  { id: "a1-habicht", name: "Starfighter patrol", act: 1, kind: "battle", foes: [{ id: "habicht" }] },
  { id: "a1-kiebitz", name: "Alpha Jet trainer", act: 1, kind: "battle", foes: [{ id: "kiebitz" }] },
  { id: "a1-dachs", name: "Rocket-pod Alpha Jet", act: 1, kind: "battle", foes: [{ id: "dachs" }] },
  { id: "a1-luchs", name: "Recon Phantom", act: 1, kind: "battle", foes: [{ id: "luchs" }] },
  {
    id: "a1-pair",
    name: "Shelf pair",
    act: 1,
    kind: "battle",
    foes: [
      { id: "habicht", hp: 32, soften: 2 },
      { id: "kiebitz", hp: 28, soften: 1 },
    ],
  },
  { id: "a1-rabe", name: "Black-tail Starfighter", act: 1, kind: "elite", foes: [{ id: "rabe" }] },
  { id: "a1-moor", name: "Marine Tornado", act: 1, kind: "elite", foes: [{ id: "moorhau" }] },
  { id: "a1-eule", name: "Graue Eule", act: 1, kind: "boss", foes: [{ id: "eule" }] },

  { id: "a2-falke", name: "Typhoon alert", act: 2, kind: "battle", foes: [{ id: "falke" }] },
  { id: "a2-nacht", name: "Tornado ECR", act: 2, kind: "battle", foes: [{ id: "nachtigall" }] },
  { id: "a2-bern", name: "Tornado strike", act: 2, kind: "battle", foes: [{ id: "bernstein" }] },
  { id: "a2-marder", name: "Fulcrum", act: 2, kind: "battle", foes: [{ id: "marder" }] },
  {
    id: "a2-pair",
    name: "Typhoon and ECR",
    act: 2,
    kind: "battle",
    foes: [
      { id: "falke", hp: 54, soften: 1 },
      { id: "nachtigall", hp: 50, soften: 1 },
    ],
  },
  {
    id: "a2-zwilling",
    name: "Fulcrum pair",
    act: 2,
    kind: "elite",
    foes: [
      { id: "zwilling", name: "Fulcrum Lead" },
      { id: "zwilling", name: "Fulcrum Two" },
    ],
  },
  { id: "a2-hoch", name: "Phantom battery", act: 2, kind: "elite", foes: [{ id: "hochbahn" }] },
  { id: "a2-adler", name: "Königsadler", act: 2, kind: "boss", foes: [{ id: "adler" }] },

  { id: "a3-spiegel", name: "Typhoon EK", act: 3, kind: "battle", foes: [{ id: "spiegel" }] },
  { id: "a3-gewitter", name: "Storm jammers", act: 3, kind: "battle", foes: [{ id: "gewitter" }] },
  { id: "a3-eisen", name: "Taurus carrier", act: 3, kind: "battle", foes: [{ id: "eisenwal" }] },
  {
    id: "a3-pair",
    name: "Glass pair",
    act: 3,
    kind: "battle",
    foes: [
      { id: "spiegel", hp: 70, soften: 2 },
      { id: "gewitter", hp: 68, soften: 2 },
    ],
  },
  { id: "a3-schwarz", name: "Night Fulcrum", act: 3, kind: "elite", foes: [{ id: "schwarz" }] },
  { id: "a3-weiss", name: "Lightning escort", act: 3, kind: "elite", foes: [{ id: "weiss" }] },
  { id: "a3-nebel", name: "Nebelhorn", act: 3, kind: "boss", foes: [{ id: "nebel" }] },
];

const ENC_BY_ID: Record<string, EncounterDef> = Object.fromEntries(ENCOUNTERS.map((e) => [e.id, e]));

export function getEncounter(id: string): EncounterDef {
  const encounter = ENC_BY_ID[id];
  if (!encounter) throw new Error(`Unknown encounter ${id}`);
  return encounter;
}

export function encounterPool(act: ActId, kind: "battle" | "elite" | "boss"): EncounterDef[] {
  return ENCOUNTERS.filter((e) => e.act === act && e.kind === kind);
}
