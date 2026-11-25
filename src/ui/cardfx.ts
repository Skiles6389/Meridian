/*
 * What each card looks like when it is played. This file is data only: every card id maps to a
 * recipe built from a small set of effect primitives (`Step`s on or around the player's jet, a
 * `Shot` for each hit of an attack, and an `Impact` where it lands). `cardplay.ts` draws them.
 *
 * To give a new card an animation, add an entry to CARD_ANIMS. A test checks that every card has
 * one, that no two cards share a recipe, and that every primitive named here is implemented.
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

export type Step = (
  | { fx: "flares"; count: number; spread: number; color: string; fall?: boolean }
  | { fx: "chaff"; count: number; radius: number; color: string }
  | { fx: "dome"; color: string; hex: boolean; rings: number }
  | { fx: "plates"; count: number; color: string }
  | { fx: "roll"; turns: number; ms: number }
  | { fx: "jink"; dir: -1 | 1 }
  | { fx: "loop"; ms: number }
  | { fx: "dip"; ms: number }
  | { fx: "cloak"; ms: number; color: string }
  | { fx: "afterimage"; count: number; color: string }
  | { fx: "burner"; ms: number; color: string; len: number }
  | { fx: "vapor"; color: string }
  | { fx: "vent"; count: number; color: string }
  | { fx: "ping"; rings: number; color: string; on: Where; inward?: boolean }
  | { fx: "sweep"; color: string; arc: number }
  | { fx: "lock"; color: string; shape: "box" | "diamond" | "circle" | "cross"; on: Where }
  | { fx: "lines"; color: string; on: Where }
  | { fx: "static"; color: string; bars: number; on: Where }
  | { fx: "glitch"; ms: number }
  | { fx: "wave"; colors: string[]; rings: number }
  | { fx: "hud"; color: string; lines: number }
  | { fx: "siphon"; color: string; count: number }
  | { fx: "repair"; color: string; sparks: number }
  | { fx: "tape"; count: number; color: string }
  | { fx: "rivets"; count: number; color: string }
  | { fx: "arc"; color: string; forks: number }
  | { fx: "crack"; color: string }
  | { fx: "halo"; color: string; rings: number }
  | { fx: "orbit"; count: number; color: string }
  | { fx: "shells"; count: number }
  | { fx: "spinup"; ms: number; color: string }
) & {
  /** Milliseconds after the card is played. */
  at?: number;
  sfx?: Cue;
};

export type Shot =
  | { fx: "tracer"; rounds: number; gap: number; spread: number; color: string; width: number; origin: "nose" | "wings" | "chin"; ms: number; walk?: number; shells?: boolean; sfx: Cue }
  | { fx: "missile"; loft: number; trail: "white" | "grey" | "dark" | "thin" | "none"; ms: number; size: number; rail: "left" | "right" | "both" | "belly"; flame: string; wobble?: number; sfx: Cue }
  | { fx: "rocket"; count: number; spread: number; ms: number; flame: string; sfx: Cue }
  | { fx: "bomb"; split: number; ms: number; color: string; sfx: Cue }
  | { fx: "beam"; color: string; width: number; ms: number; pulses: number; sfx: Cue }
  | { fx: "bolt"; color: string; forks: number; ms: number; sfx: Cue }
  | { fx: "packet"; color: string; count: number; ms: number; sfx: Cue }
  | { fx: "shock"; color: string; rings: number; ms: number; sfx: Cue }
  | { fx: "pass"; color: string; slashes: number; ms: number; sfx: Cue };

export type Impact = { fx: "sparks" | "blast" | "fireball" | "emp" | "shrapnel" | "slash" | "glitch" | "pierce" | "embers"; color: string };

export interface CardAnim {
  /** Effects on and around the player's jet as the card is played. */
  cast: Step[];
  /** How each hit of an attack travels to its target. */
  shot?: Shot;
  /** What a landed hit looks like on the target. */
  impact?: Impact;
  /** Milliseconds between playing the card and its first event, so the cast can read first. */
  lead: number;
}

const gun = (o: Partial<Extract<Shot, { fx: "tracer" }>>): Shot => ({ fx: "tracer", rounds: 5, gap: 38, spread: 10, color: C.amber, width: 2.5, origin: "nose", ms: 170, sfx: "cannon", ...o });
const msl = (o: Partial<Extract<Shot, { fx: "missile" }>>): Shot => ({ fx: "missile", loft: 50, trail: "white", ms: 420, size: 1, rail: "right", flame: C.hot, sfx: "missile", ...o });

export const CARD_ANIMS: Record<string, CardAnim> = {
  /* ------------------------------------------------------------ shared */
  gunBurst: { cast: [], shot: gun({}), impact: { fx: "sparks", color: C.amber }, lead: 60 },
  flarePop: { cast: [{ fx: "flares", count: 6, spread: 70, color: C.brass, sfx: "flare" }], lead: 180 },
  sidewinder: {
    cast: [{ fx: "lock", color: C.red, shape: "circle", on: "target", sfx: "lock" }],
    shot: msl({ wobble: 16 }),
    impact: { fx: "blast", color: C.hot },
    lead: 200,
  },
  flareWall: { cast: [{ fx: "flares", count: 12, spread: 150, color: C.brass, fall: true, sfx: "flare" }], lead: 220 },
  quickLock: { cast: [{ fx: "lock", color: C.radar, shape: "box", on: "target", sfx: "lock" }, { fx: "hud", color: C.radar, lines: 1, at: 120 }], lead: 200 },
  cannonRake: { cast: [], shot: gun({ rounds: 6, gap: 30, spread: 22, origin: "wings", walk: 70 }), impact: { fx: "sparks", color: C.brass }, lead: 60 },
  emergencyApu: {
    cast: [{ fx: "repair", color: C.heal, sparks: 10, sfx: "repair" }, { fx: "burner", ms: 320, color: C.heal, len: 0.7, at: 90 }],
    lead: 260,
  },
  spareMagazine: { cast: [{ fx: "shells", count: 7, sfx: "reload" }, { fx: "hud", color: C.amber, lines: 3, at: 80 }], lead: 200 },
  chaffCloud: {
    cast: [{ fx: "chaff", count: 64, radius: 1.15, color: C.ice, sfx: "chaff" }, { fx: "dome", color: C.ice, hex: false, rings: 1, at: 120 }],
    lead: 240,
  },
  missilePair: {
    cast: [{ fx: "lock", color: C.red, shape: "diamond", on: "target", sfx: "lock" }],
    shot: msl({ rail: "both", loft: 72, ms: 380 }),
    impact: { fx: "blast", color: C.flame },
    lead: 200,
  },
  hotStart: {
    cast: [{ fx: "burner", ms: 520, color: C.flame, len: 1.5, sfx: "burner" }, { fx: "arc", color: C.gold, forks: 1, at: 160 }, { fx: "halo", color: C.flame, rings: 1, at: 120 }],
    lead: 320,
  },
  targetPod: {
    cast: [{ fx: "lines", color: C.red, on: "all", sfx: "ping" }, { fx: "halo", color: C.red, rings: 1, at: 140 }],
    lead: 280,
  },
  countermeasures: {
    cast: [{ fx: "chaff", count: 22, radius: 0.7, color: C.titanium, sfx: "chaff" }, { fx: "flares", count: 4, spread: 110, color: C.brass, at: 90 }, { fx: "halo", color: C.cyan, rings: 1, at: 160 }],
    lead: 300,
  },
  immelmann: { cast: [{ fx: "loop", ms: 520, sfx: "flyby" }, { fx: "vapor", color: C.white, at: 120 }], lead: 300 },
  warningShot: { cast: [], shot: gun({ rounds: 3, gap: 62, spread: 38, color: C.red, width: 3 }), impact: { fx: "glitch", color: C.red }, lead: 60 },
  fuelConserve: {
    cast: [{ fx: "burner", ms: 420, color: C.blue, len: 0.55, sfx: "power" }, { fx: "arc", color: C.gold, forks: 1, at: 120 }, { fx: "dome", color: C.blue, hex: false, rings: 1, at: 160 }],
    lead: 280,
  },
  breaker: {
    cast: [{ fx: "lock", color: C.flame, shape: "box", on: "target", sfx: "lock" }],
    shot: msl({ loft: 115, trail: "dark", ms: 520, size: 1.6, rail: "belly", sfx: "heavy" }),
    impact: { fx: "fireball", color: C.flame },
    lead: 220,
  },

  /* ------------------------------------------------------- F-16C (kite) */
  snapTurn: { cast: [{ fx: "jink", dir: 1, sfx: "flyby" }, { fx: "vapor", color: C.white, at: 60 }], lead: 200 },
  probeLock: { cast: [{ fx: "ping", rings: 1, color: C.cyan, on: "target", sfx: "ping" }, { fx: "lock", color: C.cyan, shape: "circle", on: "target", at: 180 }], lead: 260 },
  stitchFire: { cast: [], shot: gun({ rounds: 4, gap: 26, spread: 6, color: C.brass, ms: 130, walk: 34 }), impact: { fx: "sparks", color: C.white }, lead: 50 },
  boomSlice: { cast: [{ fx: "vapor", color: C.cyan }], shot: { fx: "pass", color: C.cyan, slashes: 1, ms: 260, sfx: "slash" }, impact: { fx: "slash", color: C.cyan }, lead: 60 },
  knifePass: { cast: [], shot: { fx: "pass", color: C.white, slashes: 2, ms: 220, sfx: "slash" }, impact: { fx: "slash", color: C.white }, lead: 40 },
  overbank: { cast: [{ fx: "roll", turns: 1, ms: 420, sfx: "flyby" }, { fx: "dome", color: C.cyan, hex: false, rings: 1, at: 160 }], lead: 260 },
  vectorDraw: { cast: [{ fx: "afterimage", count: 2, color: C.cyan, sfx: "flyby" }, { fx: "hud", color: C.cyan, lines: 3, at: 80 }], lead: 220 },
  leadPursuit: {
    cast: [{ fx: "lines", color: C.gold, on: "target", sfx: "ping" }],
    shot: gun({ rounds: 7, gap: 24, spread: 5, color: C.gold, ms: 150 }),
    impact: { fx: "sparks", color: C.gold },
    lead: 160,
  },
  afterburnDash: {
    cast: [{ fx: "burner", ms: 600, color: C.hot, len: 2.1, sfx: "burner" }, { fx: "afterimage", count: 3, color: C.hot, at: 60 }, { fx: "arc", color: C.gold, forks: 2, at: 200 }],
    lead: 340,
  },
  wingFlash: {
    cast: [{ fx: "vapor", color: C.ice }],
    shot: gun({ rounds: 4, gap: 30, spread: 12, color: C.ice, origin: "wings" }),
    impact: { fx: "sparks", color: C.ice },
    lead: 60,
  },
  trimAuthority: { cast: [{ fx: "jink", dir: -1, sfx: "flyby" }, { fx: "halo", color: C.cyan, rings: 2, at: 140, sfx: "system" }], lead: 320 },
  merge: {
    cast: [{ fx: "burner", ms: 300, color: C.hot, len: 1.2, sfx: "burner" }],
    shot: { fx: "pass", color: C.hot, slashes: 3, ms: 320, sfx: "slash" },
    impact: { fx: "slash", color: C.hot },
    lead: 140,
  },

  /* ---------------------------------------------------- F-15E (bulwark) */
  armorCheck: { cast: [{ fx: "plates", count: 4, color: C.steel, sfx: "plate" }], lead: 240 },
  ironDart: { cast: [], shot: msl({ loft: 8, trail: "thin", ms: 290, size: 0.85, rail: "left" }), impact: { fx: "pierce", color: C.steel }, lead: 60 },
  cruiseMissile: {
    cast: [{ fx: "lock", color: C.amber, shape: "cross", on: "target", sfx: "lock" }],
    shot: msl({ loft: 24, trail: "grey", ms: 700, size: 2.1, rail: "belly", flame: C.amber, sfx: "heavy" }),
    impact: { fx: "fireball", color: C.amber },
    lead: 240,
  },
  clusterDrop: { cast: [], shot: { fx: "bomb", split: 5, ms: 520, color: C.steel, sfx: "bomb" }, impact: { fx: "shrapnel", color: C.amber }, lead: 60 },
  bunkerBuster: {
    cast: [{ fx: "lock", color: C.red, shape: "cross", on: "target", sfx: "lock" }],
    shot: { fx: "bomb", split: 0, ms: 560, color: C.shade, sfx: "bomb" },
    impact: { fx: "fireball", color: C.red },
    lead: 220,
  },
  hardenedSkin: { cast: [{ fx: "plates", count: 6, color: C.shade, sfx: "plate" }, { fx: "halo", color: C.steel, rings: 1, at: 200, sfx: "system" }], lead: 340 },
  brace: { cast: [{ fx: "dome", color: C.steel, hex: true, rings: 2, sfx: "shieldUp" }], lead: 240 },
  overpressure: { cast: [], shot: { fx: "shock", color: C.ice, rings: 3, ms: 260, sfx: "heavy" }, impact: { fx: "blast", color: C.ice }, lead: 60 },
  sacrificialBay: {
    cast: [{ fx: "crack", color: C.red, sfx: "crack" }],
    shot: msl({ loft: -24, trail: "dark", ms: 360, size: 1.3, rail: "belly", flame: C.red }),
    impact: { fx: "fireball", color: C.hot },
    lead: 200,
  },
  ordnanceCycle: { cast: [{ fx: "orbit", count: 4, color: C.amber, sfx: "reload" }, { fx: "arc", color: C.gold, forks: 1, at: 180 }], lead: 300 },
  platingWeld: { cast: [{ fx: "repair", color: C.brass, sparks: 18, sfx: "repair" }, { fx: "plates", count: 2, color: C.steel, at: 120 }], lead: 300 },
  siegeRadar: { cast: [{ fx: "sweep", color: C.radar, arc: 360, sfx: "ping" }, { fx: "halo", color: C.radar, rings: 1, at: 220, sfx: "system" }], lead: 380 },
  heavySalvo: {
    cast: [{ fx: "lock", color: C.amber, shape: "diamond", on: "target", sfx: "lock" }],
    shot: msl({ loft: 60, ms: 330, size: 0.9, rail: "both" }),
    impact: { fx: "blast", color: C.amber },
    lead: 200,
  },
  anvilProtocol: { cast: [{ fx: "dome", color: C.gold, hex: true, rings: 3, sfx: "shieldUp" }, { fx: "halo", color: C.gold, rings: 2, at: 200, sfx: "system" }], lead: 360 },

  /* ------------------------------------------------------ F-22A (moth) */
  fade: { cast: [{ fx: "cloak", ms: 520, color: C.blue, sfx: "cloak" }], lead: 220 },
  silentPing: { cast: [{ fx: "ping", rings: 2, color: C.blue, on: "target", sfx: "ping" }, { fx: "dome", color: C.blue, hex: false, rings: 1, at: 200 }], lead: 280 },
  holdFire: { cast: [{ fx: "dome", color: C.shade, hex: false, rings: 2, sfx: "shieldUp" }, { fx: "hud", color: C.shade, lines: 2, at: 140 }], lead: 260 },
  whisperShot: {
    cast: [],
    shot: msl({ loft: 30, trail: "none", ms: 360, size: 0.8, rail: "belly", flame: C.blue }),
    impact: { fx: "sparks", color: C.blue },
    lead: 60,
  },
  coldPass: {
    cast: [{ fx: "cloak", ms: 300, color: C.ice, sfx: "cloak" }],
    shot: { fx: "pass", color: C.ice, slashes: 1, ms: 280, sfx: "slash" },
    impact: { fx: "glitch", color: C.ice },
    lead: 100,
  },
  shroud: { cast: [{ fx: "chaff", count: 34, radius: 0.9, color: C.shade, sfx: "chaff" }, { fx: "cloak", ms: 460, color: C.shade, at: 80 }], lead: 260 },
  noPicture: { cast: [{ fx: "static", color: C.magenta, bars: 7, on: "all", sfx: "glitch" }, { fx: "glitch", ms: 260, at: 40 }], lead: 260 },
  patience: {
    cast: [{ fx: "cloak", ms: 700, color: C.blue, sfx: "cloak" }, { fx: "orbit", count: 2, color: C.blue, at: 60 }, { fx: "halo", color: C.blue, rings: 1, at: 260, sfx: "system" }],
    lead: 380,
  },
  bleedRadar: { cast: [], shot: { fx: "beam", color: C.radar, width: 3, ms: 260, pulses: 3, sfx: "laser" }, impact: { fx: "emp", color: C.radar }, lead: 60 },
  unseenStrike: {
    cast: [{ fx: "cloak", ms: 420, color: C.violet, sfx: "cloak" }],
    shot: msl({ loft: 92, trail: "none", ms: 300, size: 1.3, rail: "belly", flame: C.violet }),
    impact: { fx: "fireball", color: C.violet },
    lead: 180,
  },
  heatSink: { cast: [{ fx: "vent", count: 18, color: C.flame, sfx: "vent" }, { fx: "vapor", color: C.ice, at: 180 }], lead: 300 },
  ghostDoctrine: { cast: [{ fx: "afterimage", count: 3, color: C.blue, sfx: "cloak" }, { fx: "halo", color: C.violet, rings: 1, at: 200, sfx: "system" }], lead: 340 },
  fadePattern: { cast: [{ fx: "cloak", ms: 360, color: C.blue, sfx: "cloak" }, { fx: "jink", dir: -1, at: 60 }, { fx: "hud", color: C.blue, lines: 2, at: 120 }], lead: 260 },
  blackoutMine: { cast: [], shot: { fx: "bomb", split: 0, ms: 460, color: C.violet, sfx: "bomb" }, impact: { fx: "emp", color: C.violet }, lead: 60 },
  lowObservable: { cast: [{ fx: "cloak", ms: 640, color: C.shade, sfx: "cloak" }, { fx: "halo", color: C.blue, rings: 2, at: 220, sfx: "system" }], lead: 360 },

  /* -------------------------------------------------- EA-18G (lattice) */
  noiseBarrage: { cast: [{ fx: "static", color: C.magenta, bars: 9, on: "target", sfx: "glitch" }, { fx: "hud", color: C.magenta, lines: 1, at: 140 }], lead: 240 },
  designator: { cast: [{ fx: "lines", color: C.red, on: "target", sfx: "ping" }, { fx: "lock", color: C.red, shape: "box", on: "target", at: 140, sfx: "lock" }], lead: 280 },
  patchCycle: { cast: [{ fx: "hud", color: C.violet, lines: 2, sfx: "system" }, { fx: "dome", color: C.violet, hex: false, rings: 1, at: 120 }], lead: 240 },
  burnThrough: { cast: [], shot: { fx: "beam", color: C.flame, width: 6, ms: 380, pulses: 1, sfx: "laser" }, impact: { fx: "embers", color: C.flame }, lead: 60 },
  falseReturn: {
    cast: [{ fx: "ping", rings: 2, color: C.magenta, on: "target", inward: true, sfx: "ping" }, { fx: "afterimage", count: 2, color: C.magenta, at: 60 }, { fx: "dome", color: C.magenta, hex: false, rings: 1, at: 180 }],
    lead: 280,
  },
  cycleSteal: { cast: [{ fx: "siphon", color: C.violet, count: 6, sfx: "glitch" }, { fx: "hud", color: C.violet, lines: 3, at: 160 }], lead: 300 },
  logicBomb: { cast: [], shot: { fx: "packet", color: C.radar, count: 1, ms: 300, sfx: "zap" }, impact: { fx: "embers", color: C.radar }, lead: 60 },
  spectrumFlood: {
    cast: [{ fx: "wave", colors: [C.magenta, C.violet, C.cyan, C.radar], rings: 4, sfx: "glitch" }, { fx: "glitch", ms: 320, at: 60 }, { fx: "lock", color: C.radar, shape: "box", on: "all", at: 240, sfx: "lock" }],
    lead: 380,
  },
  predictiveTrack: {
    cast: [{ fx: "lines", color: C.cyan, on: "all", sfx: "ping" }, { fx: "orbit", count: 3, color: C.cyan, at: 80 }, { fx: "halo", color: C.cyan, rings: 1, at: 240, sfx: "system" }],
    lead: 380,
  },
  powerSurge: { cast: [{ fx: "static", color: C.gold, bars: 5, on: "self", sfx: "crack" }, { fx: "arc", color: C.gold, forks: 3, at: 100, sfx: "power" }], lead: 300 },
  ecmWing: { cast: [{ fx: "wave", colors: [C.magenta], rings: 3, sfx: "glitch" }, { fx: "halo", color: C.magenta, rings: 1, at: 220, sfx: "system" }], lead: 360 },
  spoof: { cast: [{ fx: "afterimage", count: 1, color: C.cyan, sfx: "cloak" }, { fx: "static", color: C.cyan, bars: 4, on: "target", at: 120, sfx: "glitch" }], lead: 260 },
  dataSpike: { cast: [], shot: { fx: "packet", color: C.violet, count: 5, ms: 240, sfx: "zap" }, impact: { fx: "pierce", color: C.violet }, lead: 60 },
  overloadArray: { cast: [{ fx: "glitch", ms: 300, sfx: "glitch" }], shot: { fx: "bolt", color: C.violet, forks: 3, ms: 240, sfx: "zap" }, impact: { fx: "emp", color: C.magenta }, lead: 120 },

  /* -------------------------------------------------------- A-10C (hog) */
  brrt: {
    cast: [{ fx: "spinup", ms: 160, color: C.hot }],
    shot: gun({ rounds: 9, gap: 14, spread: 7, color: C.hot, width: 3.4, origin: "chin", ms: 120, shells: true, sfx: "brrt" }),
    impact: { fx: "pierce", color: C.hot },
    lead: 150,
  },
  bathtub: { cast: [{ fx: "plates", count: 5, color: C.titanium, sfx: "plate" }, { fx: "rivets", count: 6, color: C.brass, at: 200 }], lead: 300 },
  strafeRun: {
    cast: [{ fx: "dip", ms: 520, sfx: "flyby" }],
    shot: gun({ rounds: 12, gap: 16, spread: 5, color: C.amber, width: 3, origin: "chin", ms: 150, shells: true, sfx: "brrt" }),
    impact: { fx: "sparks", color: C.amber },
    lead: 140,
  },
  lowPass: {
    cast: [{ fx: "dip", ms: 420, sfx: "flyby" }, { fx: "plates", count: 1, color: C.bronze, at: 200 }],
    shot: gun({ rounds: 5, gap: 24, spread: 8, color: C.brass, width: 3, origin: "chin" }),
    impact: { fx: "sparks", color: C.hot },
    lead: 120,
  },
  rivetLine: { cast: [{ fx: "rivets", count: 9, color: C.brass, sfx: "plate" }, { fx: "plates", count: 2, color: C.bronze, at: 160 }, { fx: "hud", color: C.bronze, lines: 1, at: 200 }], lead: 300 },
  rocketPods: { cast: [], shot: { fx: "rocket", count: 4, spread: 20, ms: 240, flame: C.hot, sfx: "rocket" }, impact: { fx: "shrapnel", color: C.hot }, lead: 60 },
  maverick: {
    cast: [{ fx: "lock", color: C.white, shape: "cross", on: "target", sfx: "lock" }],
    shot: msl({ loft: 40, ms: 460, size: 1.5, rail: "left", sfx: "heavy" }),
    impact: { fx: "fireball", color: C.hot },
    lead: 240,
  },
  bathtubCharge: {
    cast: [{ fx: "plates", count: 3, color: C.bronze, sfx: "plate" }, { fx: "burner", ms: 260, color: C.bronze, len: 1, at: 80 }],
    shot: { fx: "pass", color: C.bronze, slashes: 1, ms: 300, sfx: "slash" },
    impact: { fx: "shrapnel", color: C.bronze },
    lead: 200,
  },
  speedTape: { cast: [{ fx: "tape", count: 4, color: C.titanium, sfx: "tape" }, { fx: "repair", color: C.heal, sparks: 5, at: 220 }], lead: 320 },
  loiter: { cast: [{ fx: "orbit", count: 3, color: C.amber, sfx: "flyby" }, { fx: "halo", color: C.amber, rings: 1, at: 240, sfx: "system" }], lead: 380 },
  manualReversion: {
    cast: [{ fx: "static", color: C.amber, bars: 4, on: "self", sfx: "crack" }, { fx: "plates", count: 2, color: C.steel, at: 140 }, { fx: "halo", color: C.steel, rings: 2, at: 240, sfx: "system" }],
    lead: 380,
  },
  avenger: {
    cast: [{ fx: "spinup", ms: 240, color: C.brass }],
    shot: gun({ rounds: 7, gap: 12, spread: 9, color: C.brass, width: 4, origin: "chin", ms: 95, shells: true, sfx: "brrt" }),
    impact: { fx: "pierce", color: C.brass },
    lead: 230,
  },
  closeAirSupport: {
    cast: [{ fx: "shells", count: 9, sfx: "reload" }, { fx: "plates", count: 2, color: C.bronze, at: 120 }, { fx: "halo", color: C.hot, rings: 1, at: 240, sfx: "system" }],
    lead: 380,
  },
  survivability: {
    cast: [{ fx: "plates", count: 4, color: C.bronze, sfx: "plate" }, { fx: "dome", color: C.bronze, hex: true, rings: 1, at: 160 }, { fx: "halo", color: C.bronze, rings: 1, at: 260, sfx: "system" }],
    lead: 400,
  },

  /* ------------------------------------------------------------ burden */
  airframeCrack: { cast: [{ fx: "crack", color: C.red, sfx: "crack" }, { fx: "vent", count: 8, color: C.red, at: 100 }], lead: 260 },
};

/** Used for a card id with no recipe of its own, so a new card still animates. */
export const FALLBACK_ANIM: CardAnim = { cast: [{ fx: "halo", color: C.gold, rings: 1 }], shot: gun({}), impact: { fx: "sparks", color: C.amber }, lead: 120 };

export function cardAnim(id: string): CardAnim {
  return CARD_ANIMS[id] ?? FALLBACK_ANIM;
}

/** Longest a card's cast may hold up its first event, to keep play snappy. */
export const MAX_LEAD = 420;
