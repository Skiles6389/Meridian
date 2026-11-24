import type { Fighter, JetId, Meta, Move } from "./types";

export const ROOKIE = -1;
export const NORMAL = 0;
export const MAX_THREAT = 10;

/** Multipliers and extras a difficulty applies on top of the Normal tuning. */
export interface Tuning {
  foeHp: number;
  foeDmg: number;
  eliteHp: number;
  eliteDmg: number;
  bossHp: number;
  bossDmg: number;
  /** Scales repairs from fight rewards, depots, and the between-acts field repair. */
  heal: number;
  /** Scales fight purses. */
  gold: number;
  /** Scales depot prices. */
  price: number;
  /** Scales starting max HP. */
  maxHp: number;
  /** Flat max HP added at launch, after scaling. */
  hpBonus: number;
  /** Random curses installed at launch. */
  curses: number;
}

function normal(): Tuning {
  return { foeHp: 1, foeDmg: 1, eliteHp: 1, eliteDmg: 1, bossHp: 1, bossDmg: 1, heal: 1, gold: 1, price: 1, maxHp: 1, hpBonus: 0, curses: 0 };
}

export interface ThreatStep {
  name: string;
  text: string;
  apply: (t: Tuning) => void;
}

/** Threat Level N applies the first N steps. */
export const THREAT_STEPS: ThreatStep[] = [
  {
    name: "Veteran elites",
    text: "Elites have 15% more HP and hit 10% harder.",
    apply: (t) => {
      t.eliteHp *= 1.15;
      t.eliteDmg *= 1.1;
    },
  },
  {
    name: "Thin repairs",
    text: "Repairs from rewards, depots, and the field heal 25% less.",
    apply: (t) => {
      t.heal *= 0.75;
    },
  },
  {
    name: "Hardened bosses",
    text: "Bosses have 12% more HP.",
    apply: (t) => {
      t.bossHp *= 1.12;
    },
  },
  {
    name: "Paper trail",
    text: "Launch with a random curse installed.",
    apply: (t) => {
      t.curses += 1;
    },
  },
  {
    name: "Thicker skins",
    text: "All enemies have 8% more HP.",
    apply: (t) => {
      t.foeHp *= 1.08;
    },
  },
  {
    name: "Wartime prices",
    text: "Depot prices are 20% higher.",
    apply: (t) => {
      t.price *= 1.2;
    },
  },
  {
    name: "Lean purses",
    text: "Fight purses pay 20% less.",
    apply: (t) => {
      t.gold *= 0.8;
    },
  },
  {
    name: "Hot guns",
    text: "All enemies hit 8% harder.",
    apply: (t) => {
      t.foeDmg *= 1.08;
    },
  },
  {
    name: "Worn airframe",
    text: "Launch with 10% less max HP.",
    apply: (t) => {
      t.maxHp *= 0.9;
    },
  },
  {
    name: "Ace bosses",
    text: "Bosses hit 12% harder.",
    apply: (t) => {
      t.bossDmg *= 1.12;
    },
  },
];

export const ROOKIE_TEXT = [
  "Enemies have 15% less HP and hit 15% softer.",
  "Repairs heal 40% more and purses pay 20% more.",
  "Launch with 22 extra max HP.",
];

export function clampDifficulty(level: unknown): number {
  if (typeof level !== "number" || !Number.isFinite(level)) return NORMAL;
  return Math.max(ROOKIE, Math.min(MAX_THREAT, Math.round(level)));
}

export function tuning(level: number): Tuning {
  const t = normal();
  if (level <= ROOKIE) {
    t.foeHp = 0.85;
    t.foeDmg = 0.85;
    t.heal = 1.4;
    t.gold = 1.2;
    t.hpBonus = 22;
    return t;
  }
  for (const step of THREAT_STEPS.slice(0, Math.min(MAX_THREAT, level))) step.apply(t);
  return t;
}

export function difficultyName(level: number): string {
  if (level <= ROOKIE) return "Rookie";
  if (level === NORMAL) return "Normal";
  return `Threat ${level}`;
}

/** Highest difficulty open in the hangar: Normal, plus one Threat Level past the best clear on any jet. */
export function highestUnlocked(meta: Meta): number {
  let best = NORMAL;
  for (const level of Object.values(meta.cleared ?? {})) {
    if (typeof level === "number" && level >= NORMAL) best = Math.max(best, level + 1);
  }
  return Math.min(MAX_THREAT, best);
}

export function bestClear(meta: Meta, jet: JetId): number | null {
  const level = meta.cleared?.[jet];
  return typeof level === "number" ? level : null;
}

function scaleMove(move: Move, factor: number): Move {
  if (factor === 1 || move.damage <= 0) return move;
  return { ...move, damage: Math.max(1, Math.round(move.damage * factor)) };
}

/** Applies a difficulty to a freshly spawned enemy. */
export function scaleFighter(fighter: Fighter, level: number) {
  if (level === NORMAL) return;
  const t = tuning(level);
  let hp = t.foeHp;
  let dmg = t.foeDmg;
  if (fighter.elite) {
    hp *= t.eliteHp;
    dmg *= t.eliteDmg;
  }
  if (fighter.boss) {
    hp *= t.bossHp;
    dmg *= t.bossDmg;
  }
  fighter.maxHp = Math.max(1, Math.round(fighter.maxHp * hp));
  fighter.hp = Math.min(fighter.maxHp, Math.max(1, Math.round(fighter.hp * hp)));
  fighter.moves = fighter.moves.map((move) => scaleMove(move, dmg));
  fighter.phases = fighter.phases.map((set) => set.map((move) => scaleMove(move, dmg)));
}
