import type { JetId } from "./types";

export type RelicKind = "starter" | "buff" | "curse";

export interface RelicDef {
  id: string;
  name: string;
  kind: RelicKind;
  text: string;
  price: number;
  /** Starter relics are fixed to one jet and are never sold or gambled. */
  jet?: JetId;
}

export const RELICS: RelicDef[] = [
  {
    id: "vectorVanes",
    name: "Fly-by-Wire",
    kind: "starter",
    jet: "kite",
    price: 0,
    text: "The first Attack you play each turn costs 1 less Energy.",
  },
  {
    id: "ordnanceBay",
    name: "Conformal Stations",
    kind: "starter",
    jet: "bulwark",
    price: 0,
    text: "The first Attack you play each turn deals 5 extra damage.",
  },
  {
    id: "mothDust",
    name: "Low-Observable Skin",
    kind: "starter",
    jet: "moth",
    price: 0,
    text: "At the start of your turn, gain 1 Evasion.",
  },
  {
    id: "spectrumMast",
    name: "ALQ-99 Pods",
    kind: "starter",
    jet: "lattice",
    price: 0,
    text: "At the start of your turn, apply 1 Jam to the lead enemy.",
  },
  {
    id: "auxTank",
    name: "Aux Tank",
    kind: "buff",
    price: 128,
    text: "Raise your max HP by 8 and heal 8.",
  },
  {
    id: "wingmanChit",
    name: "Wingman Chit",
    kind: "buff",
    price: 116,
    text: "After each fight, stow 12 extra gold.",
  },
  {
    id: "stabilators",
    name: "Stabilators",
    kind: "buff",
    price: 124,
    text: "Whenever you gain Shield, gain 2 more.",
  },
  {
    id: "hotNozzle",
    name: "Hot Nozzle",
    kind: "buff",
    price: 120,
    text: "At the start of each fight, gain 1 Thrust.",
  },
  {
    id: "redundantLines",
    name: "Redundant Lines",
    kind: "buff",
    price: 112,
    text: "Heal 4 HP after each fight.",
  },
  {
    id: "firstLook",
    name: "First Look",
    kind: "buff",
    price: 118,
    text: "Draw 1 extra card on turn 1 of each fight.",
  },
  {
    id: "coolantLoop",
    name: "Coolant Loop",
    kind: "buff",
    price: 130,
    text: "Whenever Burn would be applied to you, that application is reduced by 1.",
  },
  {
    id: "bingoCard",
    name: "Bingo Card",
    kind: "buff",
    price: 122,
    text: "If you end your turn with 0 Energy, gain 5 Shield.",
  },
  {
    id: "beaconLamp",
    name: "Beacon Lamp",
    kind: "buff",
    price: 114,
    text: "At the start of each fight, gain 8 Shield.",
  },
  {
    id: "tallyStencil",
    name: "Tally Stencil",
    kind: "buff",
    price: 148,
    text: "Every 3rd Attack you play in a fight deals 8 extra damage.",
  },
  {
    id: "depotStamp",
    name: "Depot Stamp",
    kind: "buff",
    price: 136,
    text: "Depot prices are 20% cheaper.",
  },
  {
    id: "ejectionSeat",
    name: "Ejection Seat",
    kind: "buff",
    price: 168,
    text: "Once each fight, lethal damage leaves you at 1 HP instead.",
  },
  {
    id: "rwrBulb",
    name: "RWR Bulb",
    kind: "buff",
    price: 126,
    text: "At the start of your turn, if an enemy is about to attack, gain 4 Shield.",
  },
  {
    id: "thirdDetent",
    name: "Third Detent",
    kind: "buff",
    price: 146,
    text: "On turns 3, 6, and 9, gain 1 extra Energy.",
  },
  {
    id: "busTie",
    name: "Bus Tie",
    kind: "buff",
    price: 188,
    text: "You have +1 maximum Energy.",
  },
  {
    id: "chaffLoader",
    name: "Chaff Loader",
    kind: "buff",
    price: 124,
    text: "The first Maneuver you play each turn gains 4 extra Shield.",
  },
  {
    id: "memorialTag",
    name: "Memorial Tag",
    kind: "buff",
    price: 0,
    text: "Whenever you play a Maneuver, heal 1 HP.",
  },
  {
    id: "noseArt",
    name: "Nose Art",
    kind: "buff",
    price: 108,
    text: "Whenever you defeat a boss, gain 4 max HP and heal 4.",
  },
  {
    id: "warpedIntake",
    name: "Warped Intake",
    kind: "curse",
    price: 0,
    text: "Curse. Gain 1 Energy each turn. At the start of your turn, take 3 damage.",
  },
  {
    id: "leadBallast",
    name: "Lead Ballast",
    kind: "curse",
    price: 0,
    text: "Curse. Your Attacks deal 3 extra damage. Draw 1 fewer card each turn.",
  },
  {
    id: "crackedCanopy",
    name: "Cracked Canopy",
    kind: "curse",
    price: 0,
    text: "Curse. +12 max HP. Lose 1 HP at the start of each of your turns.",
  },
  {
    id: "smokedOptics",
    name: "Smoked Optics",
    kind: "curse",
    price: 0,
    text: "Curse. Your Attacks deal 4 extra damage. Shield you gain is reduced by 2.",
  },
  {
    id: "hauntedPump",
    name: "Haunted Pump",
    kind: "curse",
    price: 0,
    text: "Curse. Heal 10 now. Enemies start each fight with 1 Thrust.",
  },
  {
    id: "paperSeals",
    name: "Paper Seals",
    kind: "curse",
    price: 0,
    text: "Curse. Draw 1 extra card each turn. Enemies start each fight with 2 Armor.",
  },
];

const BY_ID: Record<string, RelicDef> = Object.fromEntries(RELICS.map((r) => [r.id, r]));

export function getRelic(id: string): RelicDef {
  const relic = BY_ID[id];
  if (!relic) throw new Error(`Unknown relic ${id}`);
  return relic;
}

export function shopRelics(): RelicDef[] {
  return RELICS.filter((r) => r.kind === "buff" && r.price > 0);
}

export function gambleBuffs(): RelicDef[] {
  return RELICS.filter((r) => r.kind === "buff" && r.id !== "memorialTag");
}

export function curseRelics(): RelicDef[] {
  return RELICS.filter((r) => r.kind === "curse");
}
