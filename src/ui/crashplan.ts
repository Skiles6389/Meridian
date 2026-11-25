/*
 * How a jet dies. This file is data and arithmetic only: which of the two deaths a kill gets, how
 * long and how big it is, and where the airframe breaks. `wreck.ts` draws it.
 *
 * A jet either comes apart in the air (a fireball, with the wings and tail tumbling away as
 * separate pieces) or goes down (it catches fire, trails black smoke out of formation, and hits the
 * sea or the ground, which carries the mark away behind). What killed it decides which is likelier:
 * a warhead tends to blow it apart, gunfire and fire tend to bring it down burning.
 */

export type Demise = "midair" | "crash";

/** What dealt the last damage: a missile, rocket or bomb; gunfire; fire aboard; or anything else. */
export type Cause = "blast" | "gun" | "burn" | "other";

/** Chance that a kill by each cause is a mid-air break-up rather than a crash. */
export const MIDAIR_CHANCE: Record<Cause, number> = { blast: 0.8, gun: 0.25, burn: 0, other: 0.5 };

/**
 * Picks the death. `roll` is a random number from 0 up to 1. A jet at knife range behind the
 * player has no room to fall through the frame, so it always breaks up where it is.
 */
export function pickDemise(cause: Cause, roll: number, onSix = false): Demise {
  return onSix || roll < MIDAIR_CHANCE[cause] ? "midair" : "crash";
}

export interface DemisePlan {
  kind: Demise;
  /** Size of the explosion and its debris against a line jet's. */
  size: number;
  /** Seconds of secondary explosions on the airframe before the end: only the big ones linger. */
  prelude: number;
  /** How many secondary explosions go off in that time. */
  secondaries: number;
  /** Seconds from catching fire to hitting the surface. Zero for a mid-air kill. */
  fall: number;
  /** Seconds the fireball, debris and smoke take to clear after the explosion. */
  settle: number;
  /** Milliseconds everything freezes on the explosion. */
  hitStop: number;
  /** Screen shake at the explosion, in the units `shake()` takes. */
  shake: number;
  /** Whether the whole screen flashes. */
  flash: boolean;
  /** Smaller explosions that follow the main one. */
  aftershocks: number;
  /** Milliseconds the fight waits before carrying on, when the kill does not end it. */
  lead: number;
}

export interface DemiseWho {
  boss?: boolean;
  /** The player's own jet, lost with the sortie. */
  player?: boolean;
}

/** The numbers for one death. A boss gets a longer, bigger version; so, a little, does the player's own jet. */
export function demisePlan(kind: Demise, who: DemiseWho = {}): DemisePlan {
  const big = who.boss ? 1.6 : who.player ? 1.25 : 1;
  const long = who.boss ? 1.7 : who.player ? 1.2 : 1;
  const prelude = who.boss ? 0.8 : 0;
  if (kind === "midair") {
    return {
      kind,
      size: big,
      prelude,
      secondaries: who.boss ? 4 : 0,
      fall: 0,
      settle: 1.5 * long,
      hitStop: Math.round(110 * big),
      shake: Math.round(13 * big),
      flash: true,
      aftershocks: who.boss ? 3 : who.player ? 2 : 1,
      lead: 420,
    };
  }
  return {
    kind,
    size: big,
    prelude,
    secondaries: who.boss ? 3 : 0,
    fall: 1.25 * long,
    settle: 2.6 * long,
    hitStop: Math.round(90 * big),
    shake: Math.round(9 * big),
    flash: !!who.boss || !!who.player,
    aftershocks: who.boss ? 2 : 0,
    lead: 520,
  };
}

export interface Landing {
  x: number;
  y: number;
  /** How much of its size the jet has left when it gets there. */
  size: number;
}

/**
 * Where on screen a falling jet meets the surface. It lands a little below the horizon, far enough
 * out that the mark has ground to cross before it passes under the camera, and to the side it was
 * already on, clear of the player's own jet in the middle of the frame. The player's jet noses over
 * and goes in ahead, so the camera flies over where it hit.
 */
export function landingSpot(from: { x: number; y: number }, screen: { w: number; h: number; horizon: number }, player: boolean, roll: number): Landing {
  const { w, h, horizon } = screen;
  const side = Math.abs(from.x - w / 2) < w * 0.04 ? (roll < 0.5 ? -1 : 1) : from.x < w / 2 ? -1 : 1;
  if (player) return { x: from.x + side * w * 0.06, y: horizon + h * 0.12, size: 0.14 };
  const y = Math.min(h * 0.84, Math.max(horizon + h * 0.14, from.y + h * 0.15));
  // Out past the player's wingtips, so the impact is not hidden behind the jet in the middle.
  const out = from.x + side * w * (0.07 + 0.09 * roll);
  const clear = w / 2 + side * w * (0.2 + 0.05 * roll);
  const x = Math.min(w * 0.94, Math.max(w * 0.06, side < 0 ? Math.min(out, clear) : Math.max(out, clear)));
  return { x, y, size: Math.min(0.5, Math.max(0.22, 0.2 + (1.1 * (y - horizon)) / h)) };
}

/** Seconds from the kill to the explosion the hit-stop, shake and sound are timed to. */
export function explosionAt(plan: DemisePlan): number {
  return plan.prelude + plan.fall;
}

/** Seconds the whole death takes. A fight that ends on the kill waits this long before its banner. */
export function demiseLength(plan: DemisePlan): number {
  return explosionAt(plan) + plan.settle;
}

/** A fragment of an airframe, as a polygon in fractions of its sprite's box. */
export interface WreckPiece {
  name: string;
  /** Which painting it is cut from: the view from behind, or the profile (painted nose to the right). */
  view: "rear" | "side";
  outline: [number, number][];
}

/**
 * Where the view from behind breaks: the outer and inner wing on each side, the tail above the
 * centre, and the body in two halves below it. The cuts are jagged, and neighbours share them, so
 * the pieces fit together as the whole sprite at the instant it comes apart.
 */
export const REAR_PIECES: WreckPiece[] = [
  { name: "left wingtip", view: "rear", outline: [[0, 0], [0.2, 0], [0.17, 0.34], [0.22, 0.58], [0.16, 1], [0, 1]] },
  { name: "left wing", view: "rear", outline: [[0.2, 0], [0.33, 0], [0.33, 0.3], [0.39, 0.47], [0.35, 0.6], [0.4, 0.74], [0.34, 1], [0.16, 1], [0.22, 0.58], [0.17, 0.34]] },
  { name: "tail", view: "rear", outline: [[0.33, 0], [0.67, 0], [0.67, 0.3], [0.61, 0.47], [0.52, 0.4], [0.46, 0.46], [0.39, 0.47], [0.33, 0.3]] },
  { name: "left body", view: "rear", outline: [[0.39, 0.47], [0.46, 0.46], [0.52, 0.4], [0.5, 0.62], [0.54, 0.78], [0.48, 1], [0.34, 1], [0.4, 0.74], [0.35, 0.6]] },
  { name: "right body", view: "rear", outline: [[0.52, 0.4], [0.61, 0.47], [0.65, 0.6], [0.6, 0.74], [0.66, 1], [0.48, 1], [0.54, 0.78], [0.5, 0.62]] },
  { name: "right wing", view: "rear", outline: [[0.67, 0], [0.8, 0], [0.83, 0.34], [0.78, 0.58], [0.84, 1], [0.66, 1], [0.6, 0.74], [0.65, 0.6], [0.61, 0.47], [0.67, 0.3]] },
  { name: "right wingtip", view: "rear", outline: [[0.8, 0], [1, 0], [1, 1], [0.84, 1], [0.78, 0.58], [0.83, 0.34]] },
];

/** Where the profile breaks: the tail with its fin, the middle of the body, and the nose with the cockpit. */
export const SIDE_PIECES: WreckPiece[] = [
  { name: "tail section", view: "side", outline: [[0, 0], [0.36, 0], [0.31, 0.3], [0.38, 0.52], [0.32, 0.74], [0.36, 1], [0, 1]] },
  { name: "centre section", view: "side", outline: [[0.36, 0], [0.64, 0], [0.68, 0.26], [0.62, 0.5], [0.67, 0.76], [0.63, 1], [0.36, 1], [0.32, 0.74], [0.38, 0.52], [0.31, 0.3]] },
  { name: "nose section", view: "side", outline: [[0.64, 0], [1, 0], [1, 1], [0.63, 1], [0.67, 0.76], [0.62, 0.5], [0.68, 0.26]] },
];

/**
 * The pieces a jet breaks into. From behind, a body is a sliver; so where the profile is to hand
 * the wings come from the view the player was looking at and the tail, body and nose from the
 * profile, which is where they read as what they are.
 */
export function wreckPieces(profile: boolean): WreckPiece[] {
  return profile ? [...REAR_PIECES.filter((piece) => piece.name.includes("wing")), ...SIDE_PIECES] : REAR_PIECES;
}

/** Area of a polygon in the same units as its points. */
export function pieceArea(outline: [number, number][]): number {
  let sum = 0;
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    sum += x0 * y1 - x1 * y0;
  }
  return Math.abs(sum) / 2;
}

/** The middle of a piece: where it is thrown from, and the point it spins about. */
export function pieceCentre(outline: [number, number][]): [number, number] {
  let x = 0;
  let y = 0;
  for (const [px, py] of outline) {
    x += px;
    y += py;
  }
  return [x / outline.length, y / outline.length];
}

export interface FallPose {
  /** Position along the way from where the jet was hit (0) to where it lands (1). */
  along: number;
  /** Height fallen, 0 to 1: slow at first, then gathering speed. */
  drop: number;
  /** Sideways weave as a fraction of the fall's width, for a spiral. */
  weave: number;
  /** Roll in radians. */
  roll: number;
  /** How much of its size is left as it falls away from the camera. */
  size: number;
}

/**
 * Where a falling jet is `k` of the way through its fall (0 to 1). A spiral rolls right round, more
 * than once, and corkscrews; a dive rolls onto one wing and goes straight in. `side` is -1 or 1.
 */
export function fallPose(k: number, spiral: boolean, side: number, endSize = 0.3): FallPose {
  const t = Math.max(0, Math.min(1, k));
  const drop = t * t * (0.55 + 0.45 * t);
  return {
    along: t,
    drop,
    weave: spiral ? Math.sin(t * Math.PI * 3.2) * 0.22 * (1 - t * 0.6) : 0,
    roll: side * (spiral ? t * (1 + t) * Math.PI * 1.6 : (1 - (1 - t) ** 2) * 1.35),
    size: 1 - (1 - endSize) * (0.25 * t + 0.75 * t * t),
  };
}
