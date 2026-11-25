/*
 * What each card looks like when it is played. This file is data only: every card id maps to a
 * recipe built from a small set of physically grounded base animations. A `Shot` is how each hit
 * of an attack leaves the jet (the gun firing from its real muzzle, a missile coming off its
 * pylon, rockets from their pods, a bomb from the belly or bay, a jamming pulse from the pods) and
 * an `Impact` is what it does to the hull it lands on. `Step`s are what the player's own jet does
 * as the card is played: flares, chaff, a maneuver, the burner, armour catching the light.
 * `cardplay.ts` draws them.
 *
 * Cards of one kind share a base animation and differ in its numbers: a short burst against a
 * long one, a light missile against a heavy one. To give a new card an animation, add an entry to
 * CARD_ANIMS. A test checks that every card has one, that no two cards play identically, and that
 * every base animation named here is implemented.
 */

import type { Cue } from "../audio";

/** Palette shared by the recipes, as six-digit hex so the canvas can add alpha to them. */
export const C = {
  amber: "#ffc95a",
  brass: "#ffe08a",
  hot: "#ffb347",
  flame: "#ff8a3c",
  red: "#ff5a4a",
  white: "#ffffff",
  ice: "#cfe8ff",
  cyan: "#5fe3d6",
  blue: "#7fb6ff",
  radar: "#6dffb0",
  heal: "#7dff9a",
  violet: "#c79cff",
  magenta: "#ff6ad5",
  steel: "#b8c4d6",
  titanium: "#dfe6f0",
  bronze: "#e0a45a",
  gold: "#ffd36a",
  shade: "#8fa0c0",
} as const;

export type Where = "self" | "target" | "all";

export type Maneuver = "roll" | "jink" | "loop" | "dip" | "wiggle" | "bank" | "shudder";

export type Step = (
  /** Decoy flares thrown from the dispensers; `salvo` fires both sides together. */
  | { fx: "flares"; count: number; salvo?: boolean }
  /** Bursts of chaff from the tail: a glittering cloud falling behind. */
  | { fx: "chaff"; bursts: number; size: number }
  /** A faint shimmer from the jamming pods (or the radome) towards whatever is being jammed. */
  | { fx: "jam"; on: Where; power: number }
  /** Armour catching the light: a sheen across the hull and glints off its rivets. */
  | { fx: "armor"; tint: string; rivets: number }
  /** The jet flies a maneuver, pulling vapour off its wingtips. */
  | { fx: "pose"; move: Maneuver; ms: number; dir?: -1 | 1 }
  /** Throttle: above 1 lights the burner, below 1 pulls it back. */
  | { fx: "burner"; ms: number; power: number }
  /** Vapour or heat venting from the tail. */
  | { fx: "vent"; puffs: number; tint: string }
  /** Lights out: the hull darkens and the exhaust dims. */
  | { fx: "dim"; ms: number }
  /** A head-up display designator box snapping onto a target. */
  | { fx: "designate"; on: Where; shape: "box" | "diamond" | "cross"; tint: string }
  /** A radar scan line crossing a target. */
  | { fx: "scan"; on: Where; sweeps: number }
  /** Repair work: weld sparks on the hull. */
  | { fx: "repair"; sparks: number; tint: string }
  /** Fresh rounds go onto the empty pylons. */
  | { fx: "reload"; glint: number }
  /** Navigation lights and the anti-collision strobe blink. */
  | { fx: "strobe"; blinks: number }
  /** The gun's barrels spin up, trailing a wisp of smoke. */
  | { fx: "spinup"; ms: number }
  /** A panel lets go: fragments, smoke, and a shudder through the airframe. */
  | { fx: "crack"; pieces: number }
) & {
  /** Milliseconds after the card is played. */
  at?: number;
  sfx?: Cue;
};

export type Shot =
  /**
   * The gun: a burst of tracer from the jet's own muzzle. `caliber` is 1 for a 20 mm cannon and
   * more for the A-10's 30 mm; `walk` drags the burst across the target; `pass` closes in to fire.
   */
  | { fx: "gun"; rounds: number; gap: number; spread: number; caliber: number; ms: number; walk?: number; pass?: boolean; sfx: Cue }
  /** A missile off a pylon or out of a bay: it drops, the motor lights, and it flies a guided arc. */
  | { fx: "missile"; store: "aam" | "agm"; size: number; smoke: "white" | "grey" | "thin"; loft: number; ms: number; sfx: Cue }
  /** Unguided rockets rippled from the pods. */
  | { fx: "rocket"; count: number; spread: number; ms: number; sfx: Cue }
  /** A bomb released from the belly or bay; `split` scatters it into bomblets short of the target. */
  | { fx: "bomb"; split: number; size: number; ms: number; sfx: Cue }
  /** A jamming pulse: nothing to see in the air but a shimmer, and then the target's electronics suffer. */
  | { fx: "ew"; pulses: number; ms: number; sfx: Cue };

/**
 * What a landed hit does to the hull: `sparks` is a glancing hit, `shells` cannon strikes,
 * `pierce` rounds punching through, `blast` and `fireball` warheads, `shrapnel` a scatter of small
 * bursts, `short` arcing electronics, and `embers` something left burning.
 */
export type Impact = { fx: "sparks" | "shells" | "pierce" | "blast" | "fireball" | "shrapnel" | "short" | "embers"; color: string };

export interface CardAnim {
  /** What the player's jet does as the card is played. */
  cast: Step[];
  /** How each hit of an attack travels to its target. */
  shot?: Shot;
  /** What a landed hit looks like on the target. */
  impact?: Impact;
  /** Milliseconds between playing the card and its first event, so the cast can read first. */
  lead: number;
}

type Gun = Extract<Shot, { fx: "gun" }>;
type Missile = Extract<Shot, { fx: "missile" }>;

const gun = (o: Partial<Gun> = {}): Shot => ({ fx: "gun", rounds: 5, gap: 34, spread: 10, caliber: 1, ms: 170, sfx: "cannon", ...o });
const aam = (o: Partial<Missile> = {}): Shot => ({ fx: "missile", store: "aam", size: 1, smoke: "white", loft: 40, ms: 520, sfx: "missile", ...o });
const agm = (o: Partial<Missile> = {}): Shot => ({ fx: "missile", store: "agm", size: 1.35, smoke: "grey", loft: 70, ms: 640, sfx: "heavy", ...o });

/** Head-up display green, and the amber and red it turns for a firing solution. */
const HUD = "#7dffb0";
const SHELLS: Impact = { fx: "shells", color: "#ffd9a0" };
const WARHEAD: Impact = { fx: "blast", color: "#ffb347" };
const HEAVY: Impact = { fx: "fireball", color: "#ff8a3c" };

export const CARD_ANIMS: Record<string, CardAnim> = {
  /* ------------------------------------------------------------ shared */
  gunBurst: { cast: [], shot: gun(), impact: SHELLS, lead: 40 },
  flarePop: { cast: [{ fx: "flares", count: 4, sfx: "flare" }], lead: 200 },
  sidewinder: { cast: [{ fx: "designate", on: "target", shape: "diamond", tint: C.red, sfx: "lock" }], shot: aam(), impact: WARHEAD, lead: 220 },
  flareWall: { cast: [{ fx: "flares", count: 10, salvo: true, sfx: "flare" }], lead: 240 },
  quickLock: { cast: [{ fx: "designate", on: "target", shape: "box", tint: HUD, sfx: "lock" }], lead: 220 },
  cannonRake: { cast: [], shot: gun({ rounds: 8, gap: 30, spread: 8, walk: 90 }), impact: SHELLS, lead: 50 },
  emergencyApu: { cast: [{ fx: "vent", puffs: 5, tint: "#e8eef4", sfx: "repair" }, { fx: "repair", sparks: 6, tint: C.ice, at: 120 }], lead: 280 },
  spareMagazine: { cast: [{ fx: "reload", glint: 2, sfx: "reload" }], lead: 240 },
  chaffCloud: { cast: [{ fx: "chaff", bursts: 3, size: 1.2, sfx: "chaff" }], lead: 260 },
  missilePair: { cast: [{ fx: "designate", on: "target", shape: "diamond", tint: C.amber, sfx: "lock" }], shot: aam({ loft: 60, ms: 480 }), impact: WARHEAD, lead: 220 },
  hotStart: { cast: [{ fx: "burner", ms: 560, power: 1.5, sfx: "burner" }], lead: 300 },
  targetPod: { cast: [{ fx: "designate", on: "all", shape: "cross", tint: HUD, sfx: "ping" }], lead: 280 },
  countermeasures: { cast: [{ fx: "chaff", bursts: 1, size: 0.9, sfx: "chaff" }, { fx: "flares", count: 4, salvo: true, at: 110, sfx: "flare" }], lead: 300 },
  immelmann: { cast: [{ fx: "pose", move: "loop", ms: 560, sfx: "flyby" }], lead: 320 },
  warningShot: { cast: [], shot: gun({ rounds: 3, gap: 70, spread: 30 }), impact: { fx: "sparks", color: "#ffd9a0" }, lead: 40 },
  fuelConserve: { cast: [{ fx: "burner", ms: 520, power: 0.5, sfx: "power" }], lead: 260 },
  breaker: { cast: [{ fx: "designate", on: "target", shape: "box", tint: C.red, sfx: "lock" }], shot: agm({ size: 1.5, loft: 90 }), impact: HEAVY, lead: 240 },

  /* ------------------------------------------------------- F-16C (kite) */
  snapTurn: { cast: [{ fx: "pose", move: "jink", ms: 440, dir: 1, sfx: "flyby" }], lead: 220 },
  probeLock: { cast: [{ fx: "scan", on: "target", sweeps: 1, sfx: "ping" }, { fx: "designate", on: "target", shape: "box", tint: HUD, at: 200 }], lead: 280 },
  stitchFire: { cast: [], shot: gun({ rounds: 4, gap: 26, spread: 5, ms: 140, walk: 34 }), impact: SHELLS, lead: 40 },
  boomSlice: { cast: [{ fx: "pose", move: "dip", ms: 380, sfx: "flyby" }], shot: gun({ rounds: 5, gap: 28, spread: 6, pass: true }), impact: SHELLS, lead: 120 },
  knifePass: { cast: [], shot: gun({ rounds: 4, gap: 24, spread: 4, ms: 130, pass: true }), impact: { fx: "pierce", color: "#ffe9c0" }, lead: 40 },
  overbank: { cast: [{ fx: "pose", move: "roll", ms: 460, sfx: "flyby" }], lead: 280 },
  vectorDraw: { cast: [{ fx: "pose", move: "bank", ms: 420, dir: 1, sfx: "flyby" }, { fx: "strobe", blinks: 1, at: 160 }], lead: 240 },
  leadPursuit: { cast: [{ fx: "designate", on: "target", shape: "cross", tint: HUD, sfx: "ping" }], shot: gun({ rounds: 7, gap: 24, spread: 5, ms: 150 }), impact: SHELLS, lead: 180 },
  afterburnDash: { cast: [{ fx: "burner", ms: 640, power: 2, sfx: "burner" }], lead: 340 },
  wingFlash: { cast: [{ fx: "pose", move: "wiggle", ms: 360, sfx: "flyby" }], shot: gun({ rounds: 4, gap: 30, spread: 12 }), impact: SHELLS, lead: 120 },
  trimAuthority: { cast: [{ fx: "pose", move: "jink", ms: 400, dir: -1, sfx: "flyby" }, { fx: "strobe", blinks: 2, at: 160, sfx: "system" }], lead: 320 },
  merge: { cast: [{ fx: "burner", ms: 320, power: 1.3, sfx: "burner" }], shot: gun({ rounds: 6, gap: 22, spread: 7, pass: true }), impact: SHELLS, lead: 160 },

  /* ---------------------------------------------------- F-15E (bulwark) */
  armorCheck: { cast: [{ fx: "armor", tint: C.steel, rivets: 4, sfx: "plate" }], lead: 260 },
  ironDart: { cast: [], shot: aam({ size: 0.9, smoke: "thin", loft: 12, ms: 420 }), impact: { fx: "pierce", color: "#ffe9c0" }, lead: 40 },
  cruiseMissile: { cast: [{ fx: "designate", on: "target", shape: "cross", tint: C.amber, sfx: "lock" }], shot: agm({ size: 1.7, loft: 30, ms: 760 }), impact: HEAVY, lead: 260 },
  clusterDrop: { cast: [], shot: { fx: "bomb", split: 5, size: 1, ms: 560, sfx: "bomb" }, impact: { fx: "shrapnel", color: "#ffc95a" }, lead: 40 },
  bunkerBuster: { cast: [{ fx: "designate", on: "target", shape: "cross", tint: C.red, sfx: "lock" }], shot: { fx: "bomb", split: 0, size: 1.5, ms: 620, sfx: "bomb" }, impact: HEAVY, lead: 240 },
  hardenedSkin: { cast: [{ fx: "armor", tint: C.shade, rivets: 7, sfx: "plate" }], lead: 320 },
  brace: { cast: [{ fx: "armor", tint: C.titanium, rivets: 0, sfx: "shieldUp" }], lead: 240 },
  overpressure: { cast: [], shot: { fx: "bomb", split: 0, size: 1.1, ms: 480, sfx: "heavy" }, impact: { fx: "blast", color: "#ffe9c0" }, lead: 40 },
  sacrificialBay: { cast: [{ fx: "crack", pieces: 3, sfx: "crack" }], shot: agm({ loft: 20, ms: 520 }), impact: HEAVY, lead: 220 },
  ordnanceCycle: { cast: [{ fx: "reload", glint: 4, sfx: "reload" }], lead: 300 },
  platingWeld: { cast: [{ fx: "repair", sparks: 16, tint: C.ice, sfx: "repair" }, { fx: "armor", tint: C.steel, rivets: 2, at: 220 }], lead: 320 },
  siegeRadar: { cast: [{ fx: "scan", on: "all", sweeps: 2, sfx: "ping" }], lead: 360 },
  heavySalvo: { cast: [{ fx: "designate", on: "target", shape: "diamond", tint: HUD, sfx: "lock" }], shot: aam({ size: 0.95, loft: 55, ms: 440 }), impact: WARHEAD, lead: 220 },
  anvilProtocol: { cast: [{ fx: "armor", tint: C.bronze, rivets: 9, sfx: "shieldUp" }, { fx: "strobe", blinks: 1, at: 240, sfx: "system" }], lead: 360 },

  /* ------------------------------------------------------ F-22A (moth) */
  fade: { cast: [{ fx: "dim", ms: 560, sfx: "cloak" }], lead: 240 },
  silentPing: { cast: [{ fx: "scan", on: "target", sweeps: 2, sfx: "ping" }], lead: 280 },
  holdFire: { cast: [{ fx: "dim", ms: 380, sfx: "cloak" }, { fx: "pose", move: "bank", ms: 380, dir: -1, at: 60 }], lead: 280 },
  whisperShot: { cast: [], shot: aam({ size: 0.9, smoke: "thin", loft: 30, ms: 460 }), impact: { fx: "sparks", color: "#ffe9c0" }, lead: 40 },
  coldPass: { cast: [{ fx: "dim", ms: 320, sfx: "cloak" }], shot: gun({ rounds: 5, gap: 26, spread: 6, pass: true }), impact: SHELLS, lead: 120 },
  shroud: { cast: [{ fx: "chaff", bursts: 2, size: 1, sfx: "chaff" }, { fx: "dim", ms: 460, at: 80 }], lead: 280 },
  noPicture: { cast: [{ fx: "jam", on: "all", power: 2, sfx: "glitch" }], lead: 280 },
  patience: { cast: [{ fx: "dim", ms: 720, sfx: "cloak" }, { fx: "burner", ms: 600, power: 0.4, at: 60 }], lead: 360 },
  bleedRadar: { cast: [], shot: { fx: "ew", pulses: 3, ms: 300, sfx: "laser" }, impact: { fx: "short", color: C.ice }, lead: 40 },
  unseenStrike: { cast: [{ fx: "dim", ms: 440, sfx: "cloak" }], shot: agm({ size: 1.3, smoke: "thin", loft: 80, ms: 560 }), impact: HEAVY, lead: 200 },
  heatSink: { cast: [{ fx: "vent", puffs: 10, tint: "#ffe2c2", sfx: "vent" }], lead: 300 },
  ghostDoctrine: { cast: [{ fx: "dim", ms: 520, sfx: "cloak" }, { fx: "strobe", blinks: 1, at: 320, sfx: "system" }], lead: 340 },
  fadePattern: { cast: [{ fx: "dim", ms: 380, sfx: "cloak" }, { fx: "pose", move: "jink", ms: 420, dir: -1, at: 60 }], lead: 280 },
  blackoutMine: { cast: [], shot: { fx: "bomb", split: 0, size: 0.9, ms: 500, sfx: "bomb" }, impact: { fx: "short", color: C.blue }, lead: 40 },
  lowObservable: { cast: [{ fx: "dim", ms: 680, sfx: "cloak" }, { fx: "vent", puffs: 3, tint: "#dfe9f2", at: 200, sfx: "system" }], lead: 360 },

  /* -------------------------------------------------- EA-18G (lattice) */
  noiseBarrage: { cast: [{ fx: "jam", on: "target", power: 3, sfx: "glitch" }], lead: 260 },
  designator: { cast: [{ fx: "scan", on: "target", sweeps: 1, sfx: "ping" }, { fx: "designate", on: "target", shape: "box", tint: C.red, at: 160, sfx: "lock" }], lead: 300 },
  patchCycle: { cast: [{ fx: "strobe", blinks: 2, sfx: "system" }, { fx: "repair", sparks: 4, tint: C.ice, at: 120 }], lead: 260 },
  burnThrough: { cast: [], shot: { fx: "ew", pulses: 1, ms: 420, sfx: "laser" }, impact: { fx: "embers", color: C.flame }, lead: 40 },
  falseReturn: { cast: [{ fx: "jam", on: "target", power: 1, sfx: "ping" }, { fx: "chaff", bursts: 1, size: 0.7, at: 140 }], lead: 280 },
  cycleSteal: { cast: [{ fx: "jam", on: "target", power: 2, sfx: "glitch" }, { fx: "strobe", blinks: 1, at: 220 }], lead: 300 },
  logicBomb: { cast: [], shot: agm({ size: 1.2, loft: 50, ms: 560, sfx: "missile" }), impact: { fx: "short", color: C.ice }, lead: 40 },
  spectrumFlood: { cast: [{ fx: "jam", on: "all", power: 3, sfx: "glitch" }, { fx: "designate", on: "all", shape: "box", tint: HUD, at: 280, sfx: "lock" }], lead: 380 },
  predictiveTrack: { cast: [{ fx: "scan", on: "all", sweeps: 1, sfx: "ping" }, { fx: "designate", on: "all", shape: "diamond", tint: HUD, at: 240, sfx: "system" }], lead: 380 },
  powerSurge: { cast: [{ fx: "burner", ms: 380, power: 1.2, sfx: "power" }, { fx: "strobe", blinks: 3, at: 80, sfx: "crack" }], lead: 300 },
  ecmWing: { cast: [{ fx: "jam", on: "self", power: 2, sfx: "glitch" }, { fx: "strobe", blinks: 1, at: 240, sfx: "system" }], lead: 340 },
  spoof: { cast: [{ fx: "jam", on: "target", power: 1, sfx: "cloak" }, { fx: "flares", count: 2, at: 120 }], lead: 260 },
  dataSpike: { cast: [], shot: { fx: "ew", pulses: 2, ms: 220, sfx: "zap" }, impact: { fx: "sparks", color: C.ice }, lead: 40 },
  overloadArray: { cast: [{ fx: "jam", on: "all", power: 1, sfx: "glitch" }], shot: { fx: "ew", pulses: 4, ms: 260, sfx: "zap" }, impact: { fx: "short", color: C.white }, lead: 140 },

  /* -------------------------------------------------------- A-10C (hog) */
  brrt: { cast: [{ fx: "spinup", ms: 150 }], shot: gun({ rounds: 10, gap: 14, spread: 7, caliber: 1.6, ms: 130, sfx: "brrt" }), impact: { fx: "pierce", color: "#ffd9a0" }, lead: 140 },
  bathtub: { cast: [{ fx: "armor", tint: C.titanium, rivets: 6, sfx: "plate" }], lead: 300 },
  strafeRun: { cast: [{ fx: "pose", move: "dip", ms: 520, sfx: "flyby" }], shot: gun({ rounds: 12, gap: 15, spread: 5, caliber: 1.6, ms: 150, walk: 60, sfx: "brrt" }), impact: SHELLS, lead: 140 },
  lowPass: { cast: [{ fx: "pose", move: "dip", ms: 420, sfx: "flyby" }], shot: gun({ rounds: 6, gap: 20, spread: 8, caliber: 1.6, sfx: "brrt" }), impact: SHELLS, lead: 120 },
  rivetLine: { cast: [{ fx: "armor", tint: C.bronze, rivets: 10, sfx: "plate" }], lead: 300 },
  rocketPods: { cast: [], shot: { fx: "rocket", count: 4, spread: 22, ms: 260, sfx: "rocket" }, impact: { fx: "shrapnel", color: "#ffb347" }, lead: 40 },
  maverick: { cast: [{ fx: "designate", on: "target", shape: "cross", tint: C.white, sfx: "lock" }], shot: agm({ size: 1.45, loft: 40, ms: 620 }), impact: HEAVY, lead: 260 },
  bathtubCharge: { cast: [{ fx: "armor", tint: C.bronze, rivets: 3, sfx: "plate" }], shot: gun({ rounds: 7, gap: 16, spread: 6, caliber: 1.6, pass: true, sfx: "brrt" }), impact: { fx: "shrapnel", color: "#ffd9a0" }, lead: 200 },
  speedTape: { cast: [{ fx: "repair", sparks: 5, tint: C.titanium, sfx: "tape" }], lead: 300 },
  loiter: { cast: [{ fx: "pose", move: "bank", ms: 620, dir: -1, sfx: "flyby" }, { fx: "strobe", blinks: 2, at: 200, sfx: "system" }], lead: 380 },
  manualReversion: { cast: [{ fx: "pose", move: "shudder", ms: 360, sfx: "crack" }, { fx: "armor", tint: C.steel, rivets: 2, at: 200, sfx: "system" }], lead: 380 },
  avenger: { cast: [{ fx: "spinup", ms: 230 }], shot: gun({ rounds: 8, gap: 11, spread: 9, caliber: 1.8, ms: 110, sfx: "brrt" }), impact: { fx: "pierce", color: "#ffe9c0" }, lead: 220 },
  closeAirSupport: { cast: [{ fx: "reload", glint: 6, sfx: "reload" }, { fx: "armor", tint: C.bronze, rivets: 2, at: 200, sfx: "system" }], lead: 380 },
  survivability: { cast: [{ fx: "armor", tint: C.bronze, rivets: 6, sfx: "plate" }, { fx: "repair", sparks: 6, tint: C.ice, at: 240, sfx: "system" }], lead: 400 },

  /* ------------------------------------------------------------ burden */
  airframeCrack: { cast: [{ fx: "crack", pieces: 5, sfx: "crack" }, { fx: "vent", puffs: 4, tint: "#7c8490", at: 100 }], lead: 260 },
};

/** Used for a card id with no recipe of its own, so a new card still animates. */
export const FALLBACK_ANIM: CardAnim = { cast: [{ fx: "strobe", blinks: 1 }], shot: gun({ rounds: 4 }), impact: SHELLS, lead: 120 };

export function cardAnim(id: string): CardAnim {
  return CARD_ANIMS[id] ?? FALLBACK_ANIM;
}

/** Longest a card's cast may hold up its first event, to keep play snappy. */
export const MAX_LEAD = 420;
