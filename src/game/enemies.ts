import type { ActId, BossId, Move, SilhouetteId } from "./types";
import { freshStatus } from "./types";
import type { Fighter } from "./types";

export interface EnemyDef {
  id: string;
  name: string;
  epithet: string;
  hp: number;
  silhouette: SilhouetteId;
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
    name: "Habicht Mk.II",
    epithet: "Nordlicht patrol",
    hp: 42,
    silhouette: "habicht",
    accent: "#f0b429",
    moves: [atk("Peck", 8), mv("Cover", { shield: 7 }), atk("Dive", 12)],
  },
  {
    id: "kiebitz",
    name: "Kiebitz-S",
    epithet: "Bruchwatt trainers",
    hp: 34,
    silhouette: "kiebitz",
    accent: "#8dffc1",
    moves: [atk("Rake", 4, 2), mv("Slip", { shield: 6 }), atk("Snap", 11)],
  },
  {
    id: "dachs",
    name: "Dachs-G",
    epithet: "Mud movers",
    hp: 48,
    silhouette: "dachs",
    accent: "#e0a36a",
    moves: [atk("Scorch", 7, 1, { burn: 1 }), mv("Dig In", { shield: 11 }), atk("Maul", 13)],
  },
  {
    id: "luchs",
    name: "Luchs-C",
    epithet: "Heavy flight",
    hp: 54,
    silhouette: "luchs",
    accent: "#d0d7de",
    moves: [atk("Heavy", 12), mv("Brace", { shield: 9 }), atk("Slam", 16)],
  },
  {
    id: "rabe",
    name: "Rabe-X",
    epithet: "Kellerflug trial",
    hp: 78,
    silhouette: "rabe",
    accent: "#c3b0ff",
    elite: true,
    moves: [atk("Black Peck", 6, 2), atk("Tar", 8, 1, { burn: 2 }), mv("Hood", { shield: 12 }), atk("Swoop", 15)],
  },
  {
    id: "moorhau",
    name: "Moorhau",
    epithet: "Shelf battery",
    hp: 88,
    silhouette: "moorhau",
    accent: "#f0a35e",
    elite: true,
    moves: [mv("Wall", { shield: 14 }), atk("Ram", 17), atk("Tar Shot", 10, 1, { burn: 1 })],
  },
  {
    id: "falke",
    name: "Sturmfalke",
    epithet: "Rhine gate wing",
    hp: 66,
    silhouette: "falke",
    accent: "#ffb020",
    moves: [atk("Cut", 12), atk("Twin Cut", 6, 2), mv("Spike", { thrust: 2, shield: 6 })],
  },
  {
    id: "nachtigall",
    name: "Nachtigall-E",
    epithet: "River listeners",
    hp: 60,
    silhouette: "nachtigall",
    accent: "#8ebfff",
    moves: [atk("Hiss", 8, 1, { burn: 2 }), mv("Veil", { shield: 13 }), atk("Screech", 10, 1, { jam: 2 })],
  },
  {
    id: "bernstein",
    name: "Bernstein",
    epithet: "Gate strikers",
    hp: 72,
    silhouette: "bernstein",
    accent: "#f0a35e",
    moves: [atk("Hook", 14), mv("Plate", { shield: 12 }), atk("Brand", 11, 1, { locked: 1 })],
  },
  {
    id: "marder",
    name: "Marder-G",
    epithet: "Agile flight",
    hp: 64,
    silhouette: "marder",
    accent: "#ff8b7a",
    moves: [atk("Triple", 5, 3), mv("Kick", { thrust: 2 }), atk("Lunge", 16)],
  },
  {
    id: "zwilling",
    name: "Zwilling",
    epithet: "Paired wing",
    hp: 52,
    silhouette: "zwilling",
    accent: "#d7dee8",
    elite: true,
    moves: [atk("Jab", 9), mv("Guard", { shield: 8 }), atk("Cross", 7, 2)],
  },
  {
    id: "hochbahn",
    name: "Hochbahn",
    epithet: "Gate battery",
    hp: 112,
    silhouette: "hochbahn",
    accent: "#f0b429",
    elite: true,
    armor: 2,
    moves: [atk("Press", 10, 2), mv("Weld", { shield: 14, armor: 1 }), atk("Shear", 18)],
  },
  {
    id: "spiegel",
    name: "Spiegel",
    epithet: "Glass test",
    hp: 88,
    silhouette: "spiegel",
    accent: "#c3b0ff",
    riposte: 6,
    moves: [mv("Mirror", { shield: 10, damage: 8, hits: 1 }), atk("Shard", 18), atk("Glint", 8, 1, { burn: 2 })],
  },
  {
    id: "gewitter",
    name: "Gewitter",
    epithet: "Storm plot",
    hp: 92,
    silhouette: "gewitter",
    accent: "#8ebfff",
    moves: [atk("Storm", 12, 1, { jam: 2 }), mv("Cage", { shield: 15, burn: 2 }), atk("Break", 8, 2)],
  },
  {
    id: "eisenwal",
    name: "Eisenwal",
    epithet: "Flying iron",
    hp: 102,
    silhouette: "eisenwal",
    accent: "#d0d7de",
    moves: [mv("Load", { shield: 16, thrust: 1 }), atk("Fire", 22), atk("Walk", 13)],
  },
  {
    id: "schwarz",
    name: "Schwarzwerk",
    epithet: "Black bench",
    hp: 132,
    silhouette: "schwarz",
    accent: "#ff5d6c",
    elite: true,
    armor: 3,
    moves: [atk("Press", 11, 2), mv("Weld", { shield: 16 }), atk("Shear", 20)],
  },
  {
    id: "weiss",
    name: "Weissdorn",
    epithet: "White plot",
    hp: 98,
    silhouette: "weiss",
    accent: "#e7eef4",
    elite: true,
    riposte: 5,
    moves: [atk("Shroud", 6, 1, { suppress: 1 }), atk("Knife", 16), mv("Veil", { shield: 12, burn: 1 })],
  },
  {
    id: "eule",
    name: "Graue Eule",
    epithet: "Eulenprobe command",
    hp: 120,
    silhouette: "eule",
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
    name: "Königsadler",
    epithet: "Adlerwerke prototype",
    hp: 168,
    silhouette: "adler",
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
    name: "Nebelhorn",
    epithet: "Nebelkreis one-off",
    hp: 220,
    silhouette: "nebel",
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
  { id: "a1-habicht", name: "Nordlicht single", act: 1, kind: "battle", foes: [{ id: "habicht" }] },
  { id: "a1-kiebitz", name: "Bruchwatt single", act: 1, kind: "battle", foes: [{ id: "kiebitz" }] },
  { id: "a1-dachs", name: "Mud mover", act: 1, kind: "battle", foes: [{ id: "dachs" }] },
  { id: "a1-luchs", name: "Heavy flight", act: 1, kind: "battle", foes: [{ id: "luchs" }] },
  {
    id: "a1-pair",
    name: "Shelf pair",
    act: 1,
    kind: "battle",
    foes: [
      { id: "habicht", hp: 32, soften: 2 },
      { id: "kiebitz", hp: 28, name: "Kiebitz-S", soften: 1 },
    ],
  },
  { id: "a1-rabe", name: "Rabe-X trial", act: 1, kind: "elite", foes: [{ id: "rabe" }] },
  { id: "a1-moor", name: "Moorhau battery", act: 1, kind: "elite", foes: [{ id: "moorhau" }] },
  { id: "a1-eule", name: "Graue Eule", act: 1, kind: "boss", foes: [{ id: "eule" }] },

  { id: "a2-falke", name: "Sturmfalke", act: 2, kind: "battle", foes: [{ id: "falke" }] },
  { id: "a2-nacht", name: "Nachtigall-E", act: 2, kind: "battle", foes: [{ id: "nachtigall" }] },
  { id: "a2-bern", name: "Bernstein", act: 2, kind: "battle", foes: [{ id: "bernstein" }] },
  { id: "a2-marder", name: "Marder-G", act: 2, kind: "battle", foes: [{ id: "marder" }] },
  {
    id: "a2-pair",
    name: "Gate pair",
    act: 2,
    kind: "battle",
    foes: [
      { id: "falke", hp: 54, soften: 1 },
      { id: "nachtigall", hp: 50, soften: 1 },
    ],
  },
  {
    id: "a2-zwilling",
    name: "Zwilling pair",
    act: 2,
    kind: "elite",
    foes: [
      { id: "zwilling", name: "Zwilling-L" },
      { id: "zwilling", name: "Zwilling-R" },
    ],
  },
  { id: "a2-hoch", name: "Hochbahn", act: 2, kind: "elite", foes: [{ id: "hochbahn" }] },
  { id: "a2-adler", name: "Königsadler", act: 2, kind: "boss", foes: [{ id: "adler" }] },

  { id: "a3-spiegel", name: "Spiegel", act: 3, kind: "battle", foes: [{ id: "spiegel" }] },
  { id: "a3-gewitter", name: "Gewitter", act: 3, kind: "battle", foes: [{ id: "gewitter" }] },
  { id: "a3-eisen", name: "Eisenwal", act: 3, kind: "battle", foes: [{ id: "eisenwal" }] },
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
  { id: "a3-schwarz", name: "Schwarzwerk", act: 3, kind: "elite", foes: [{ id: "schwarz" }] },
  { id: "a3-weiss", name: "Weissdorn", act: 3, kind: "elite", foes: [{ id: "weiss" }] },
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
