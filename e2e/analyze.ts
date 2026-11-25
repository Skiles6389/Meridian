/* Reads the effects probe's log: where each shot first appeared, measured against where the jet's gun and pylons were on screen in that same frame. */

import { anchorsOf } from "../src/ui/anchors";

export type Xy = [number, number];

export interface Op {
  frame: number;
  t: number;
  op: "stroke" | "fill" | "image";
  alpha: number;
  style?: string;
  from?: "picture" | "canvas";
  /** For a sprite the effects drew for themselves: its colour, as red, green and blue. */
  tint?: [number, number, number];
  size?: number;
  pts: Xy[];
}

export interface StationShot {
  index: number;
  kind: string;
  at: Xy;
  box: [number, number, number, number];
}

export interface UnitShot {
  sprite: string;
  flip: boolean;
  box: [number, number, number, number];
  w: number;
  h: number;
  guns: Xy[];
  flares: Xy[];
  stores: StationShot[];
}

export interface FrameShot {
  t: number;
  units: Record<string, UnitShot>;
  canvas: { box: [number, number, number, number]; width: number; height: number } | null;
  view: Xy;
}

export interface Release extends StationShot {
  frame: number;
  t: number;
  who: string | null;
}

export interface Log {
  ops: Op[];
  frames: Record<string, FrameShot>;
  releases: Release[];
}

export const PLAYER = "-1";
/** The colour tracer is stroked in (cardplay.ts). */
export const TRACER = "#ff8a3c";

export const dist = (a: Xy, b: Xy) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function toSegment(p: Xy, a: Xy, b: Xy): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
  return dist(p, [a[0] + dx * t, a[1] + dy * t]);
}

/**
 * Where the anchor table puts a point on a sprite as it is drawn on screen, worked out from the
 * sprite's screen-space bounding box alone. The box of a sprite that is tilted and scaled is larger
 * than the sprite; knowing the sprite's own proportions, the box gives back the scale and the size
 * of the tilt, though not which way it leans, so there are two candidates. They coincide when the
 * jet is level.
 */
export function project(unit: UnitShot, at: [number, number]): Xy[] {
  const dx = ((unit.flip ? 100 - at[0] : at[0]) / 100 - 0.5) * unit.w;
  const dy = (at[1] / 100 - 0.5) * unit.h;
  const cx = unit.box[0] + unit.box[2] / 2;
  const cy = unit.box[1] + unit.box[3] / 2;
  const { w, h } = unit;
  const span = w * w - h * h || 1;
  // The box is (w·c + h·n) wide and (w·n + h·c) high, for c = scale·cos(tilt) and n = scale·|sin(tilt)|.
  const c = (w * unit.box[2] - h * unit.box[3]) / span;
  const n = Math.max(0, (w * unit.box[3] - h * unit.box[2]) / span);
  return [1, -1].map((lean) => [cx + c * dx - lean * n * dy, cy + lean * n * dx + c * dy]);
}

/** How far a unit's gun marker is from where the anchor table puts the muzzle on its rendered sprite. */
export function muzzleGap(unit: UnitShot): number {
  return Math.min(...project(unit, anchorsOf(unit.sprite).gun).map((p) => dist(unit.guns[0], p)));
}

export interface TracerReport {
  /** Tracer strokes seen. */
  strokes: number;
  /** Frames that drew tracer. */
  frames: number;
  /** How far from the nearest gun muzzle the first tracer drawn began. */
  first: number;
  /** The first tracer's starting point, and the muzzle it was measured against. */
  firstAt: Xy | null;
  muzzle: Xy | null;
  /** The worst gap between where a streak began and anything it could have come from: a muzzle, or tracer already drawn. */
  worst: number;
  worstAt: Xy | null;
  /** Whether the frame that drew the first tracer also drew a muzzle flash on the gun. */
  flash: boolean;
  /** How long the flash stayed on the gun, in frames. */
  flashFrames: number;
}

/**
 * Where the gun muzzles are on screen in one frame: the anchor table's muzzle projected onto each
 * sprite's screen-space bounding box. This does not use the game's own markers.
 */
function muzzlesOf(shot: FrameShot | undefined, shooters?: string[]): Xy[] {
  return Object.entries(shot?.units ?? {})
    .filter(([who]) => !shooters || shooters.includes(who))
    .flatMap(([, unit]) => project(unit, anchorsOf(unit.sprite).gun));
}

/**
 * Follows every tracer streak. A round must start at a gun muzzle as it is on screen in that frame,
 * and from then on each streak must carry on from tracer already drawn: nothing may appear in
 * mid-air. `shooters` limits which units' guns count; by default any jet on screen.
 */
export function tracers(log: Log, shooters?: string[], reach = 4): TracerReport {
  const seen: [Xy, Xy][] = [];
  const report: TracerReport = { strokes: 0, frames: 0, first: Infinity, firstAt: null, muzzle: null, worst: 0, worstAt: null, flash: false, flashFrames: 0 };
  const frames = new Set<number>();
  let firstFrame = -1;
  for (const op of log.ops) {
    if (op.op !== "stroke" || op.style !== TRACER || op.pts.length < 2) continue;
    const shot = log.frames[op.frame];
    const muzzles = muzzlesOf(shot, shooters);
    const start = op.pts[0];
    let gap = Infinity;
    let from: Xy | null = null;
    for (const m of muzzles) {
      const d = dist(start, m);
      if (d < gap) {
        gap = d;
        from = m;
      }
    }
    if (report.strokes === 0) {
      report.first = gap;
      report.firstAt = start;
      report.muzzle = from;
      firstFrame = op.frame;
    }
    for (const [a, b] of seen) gap = Math.min(gap, toSegment(start, a, b));
    if (gap > report.worst) {
      report.worst = gap;
      report.worstAt = start;
    }
    for (let i = 1; i < op.pts.length; i++) seen.push([op.pts[i - 1], op.pts[i]]);
    report.strokes++;
    frames.add(op.frame);
  }
  report.frames = frames.size;
  if (report.muzzle) {
    const lit = new Set<number>();
    for (const op of log.ops) {
      if (op.op !== "fill" || op.frame < firstFrame) continue;
      const guns = muzzlesOf(log.frames[op.frame], shooters);
      if (op.pts.some((p) => guns.some((m) => dist(p, m) <= reach))) lit.add(op.frame);
    }
    report.flash = lit.has(firstFrame);
    report.flashFrames = lit.size;
  }
  return report;
}

export interface LaunchReport {
  who: string | null;
  kind: string;
  /** How near the weapon was drawn to the station it left, as that station was on screen in the same frame. */
  gap: number;
  at: Xy | null;
  station: Xy;
  /** Frames between the station being emptied and the weapon being drawn on it. */
  late: number;
  /** Whether that was the first frame after the release to draw any weapon at all. */
  first: boolean;
}

/** Where a weapon leaves a station: the middle of the round on a pylon, or the mouth of a bay. */
const mouth = (s: StationShot): Xy => (s.kind === "bay" ? [s.box[0] + s.box[2] / 2, s.box[1] + s.box[3] * 0.25] : s.at);

/**
 * For each weapon station fired, finds the weapon in the frames that follow and measures it against
 * the station. A weapon is drawn from its own picture, so it is the only drawing on the effects
 * canvas that comes from an image rather than another canvas. A bay holds its weapon for a moment
 * before it drops, so the search runs for `window` milliseconds.
 */
export function launches(log: Log, window = 1500): LaunchReport[] {
  return log.releases.map((release) => {
    const report: LaunchReport = { who: release.who, kind: release.kind, gap: Infinity, at: null, station: mouth(release), late: Infinity, first: false };
    let firstFrame = -1;
    for (const op of log.ops) {
      if (op.op !== "image" || op.from !== "picture" || op.frame < release.frame) continue;
      if (op.t > release.t + window) break;
      if (firstFrame < 0) firstFrame = op.frame;
      const live = log.frames[op.frame]?.units[release.who ?? ""]?.stores.find((s) => s.index === release.index);
      for (const station of live ? [live, release] : [release]) {
        const d = dist(op.pts[0], mouth(station));
        if (d >= report.gap) continue;
        report.gap = d;
        report.at = op.pts[0];
        report.station = mouth(station);
        report.late = op.frame - release.frame;
        report.first = op.frame === firstFrame;
      }
    }
    return report;
  });
}

/** How far the effects canvas's drawing surface is from covering exactly the box it is shown in. */
export function canvasFit(shot: FrameShot): number {
  if (!shot.canvas) return Infinity;
  const [left, top, w, h] = shot.canvas.box;
  return Math.max(Math.abs(left), Math.abs(top), Math.abs(w - shot.view[0]), Math.abs(h - shot.view[1]));
}

export interface FlareReport {
  /** Flare glows drawn in the first frame that drew any. */
  lit: number;
  /** The furthest any of them was from a flare dispenser, as projected onto the sprite's screen box. */
  worst: number;
  worstAt: Xy | null;
}

/** The colour flares burn with in the game (cardplay.ts). */
const FLARE: [number, number, number] = [0xff, 0xe2, 0xa0];

/**
 * The first frame of a flare salvo: every flare in it must sit on one of the jet's flare dispensers.
 * A flare is told from the other glows on screen (the played card dissolving, say) by its colour.
 */
export function flares(log: Log, who = PLAYER): FlareReport {
  const flare = (op: Op) => op.op === "image" && !!op.tint && op.tint.every((v, i) => Math.abs(v - FLARE[i]) <= 10);
  const first = log.ops.find(flare);
  const report: FlareReport = { lit: 0, worst: 0, worstAt: null };
  if (!first) return report;
  const unit = log.frames[first.frame]?.units[who];
  const ports = unit ? (anchorsOf(unit.sprite).flares ?? []).flatMap((at) => project(unit, at)) : [];
  for (const op of log.ops) {
    if (op.frame !== first.frame || !flare(op)) continue;
    const gap = Math.min(...ports.map((p) => dist(op.pts[0], p)));
    report.lit++;
    if (gap > report.worst) {
      report.worst = gap;
      report.worstAt = op.pts[0];
    }
  }
  return report;
}
