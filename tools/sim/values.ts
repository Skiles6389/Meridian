import { getCard } from "../../src/game/cards";
import type { CardDef, Effect } from "../../src/game/types";

/** Rough worth of one Energy, in damage-equivalent points. */
export const ENERGY = 6.5;

const SPECIAL_VALUE: Record<string, number> = {
  stitchFire: 10,
  leadPursuit: 13,
  holdFire: 10,
  overpressure: 13,
  merge: 19,
  whisperShot: 10,
  heatSink: 2,
  burnThrough: 12,
  dataSpike: 9,
  cycleSteal: 14.5,
};

/** What a system card is worth over a typical fight once it is online. */
const POWER_VALUE: Record<string, number> = {
  hotStart: 22,
  countermeasures: 9,
  trimAuthority: 13,
  siegeRadar: 12,
  anvilProtocol: 18,
  patience: 7,
  ghostDoctrine: 18,
  lowObservable: 13,
  predictiveTrack: 8,
  ecmWing: 20,
};

function effectValue(effect: Effect): number {
  const n = effect.n ?? 0;
  const spread = effect.aoe ? 1.6 : 1;
  switch (effect.k) {
    case "dmg":
      return n * (effect.times ?? 1) * spread;
    case "shield":
      return n * 0.75;
    case "draw":
      return n * 4;
    case "energy":
      return n * ENERGY;
    case "evasion":
      return n * 3.5;
    case "heal":
      return n * 0.8;
    case "lose":
      return -n;
    case "burn":
      return ((n * (n + 1)) / 2) * 0.9 * spread;
    case "locked":
      return n * 4 * spread;
    case "jam":
      return n * 2.5 * spread;
    case "suppress":
      return 10 * spread;
    case "thrust":
      return n * 5;
    case "armor":
      return n * 5;
    default:
      return 0;
  }
}

/** Points a single play of the card is worth, before paying its Energy. */
export function playValue(def: CardDef): number {
  if (def.type === "burden") return -8;
  if (def.effects.some((effect) => effect.k === "power")) return POWER_VALUE[def.id] ?? 8;
  let value = def.special && SPECIAL_VALUE[def.special] !== undefined ? SPECIAL_VALUE[def.special] : 0;
  if (!(def.special && SPECIAL_VALUE[def.special] !== undefined)) {
    for (const effect of def.effects) value += effectValue(effect);
  }
  if (def.special === "unseenStrike") value += 3;
  return value;
}

/** Net worth of a card in a deck: what it does minus what it costs. Exhausting one-shots count a little less. */
export function cardRating(id: string): number {
  const def = getCard(id);
  const once = def.exhaust && !def.effects.some((effect) => effect.k === "power") ? 0.75 : 1;
  return playValue(def) * once - ENERGY * def.cost;
}

export type Role = "damage" | "defense" | "utility";

export function cardRole(id: string): Role {
  const def = getCard(id);
  if (def.type === "attack") return "damage";
  if (def.effects.some((effect) => effect.k === "shield" || effect.k === "evasion" || effect.k === "armor") || def.special === "holdFire") return "defense";
  return "utility";
}

export const RELIC_VALUE: Record<string, number> = {
  busTie: 10,
  ejectionSeat: 6,
  stabilators: 6,
  hotNozzle: 5,
  tallyStencil: 5,
  rwrBulb: 5,
  beaconLamp: 4,
  bingoCard: 4,
  thirdDetent: 4,
  chaffLoader: 4,
  redundantLines: 4,
  auxTank: 4,
  firstLook: 3,
  coolantLoop: 3,
  wingmanChit: 3,
  noseArt: 2,
  depotStamp: 2,
  memorialTag: 3,
};
