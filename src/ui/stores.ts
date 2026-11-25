/*
 * The weapons that hang on a jet in the chase view, drawn the way the chase camera sees them: from
 * behind and a little above, so each one shows its motor nozzle and tail fins nearest the camera
 * and its body running away towards the nose. The same drawing is used for the missile on the
 * pylon and for the one that flies off it, so a launch is the hanging missile leaving.
 *
 * Everything is drawn nose-up in a square box of 100 units and turned to the sprite's perspective
 * by the renderer. The box stands for BOX_METRES across the wing, so the stores stay in scale
 * with the airframe they hang on.
 */

import type { SpriteAnchors, Station, StoreKind } from "./anchors";

export type StoreShape = "aim9" | "aim120" | "agm" | "pod";

/** How much wing the store's drawing box covers, in metres. */
export const BOX_METRES = 1.2;
/** Height of the chase camera above the wing when a sprite does not give its own, in metres. */
export const DEFAULT_LIFT = 3.2;

const INK = "#0d1117";

interface Shape {
  /** Length on screen in box units: the real length, foreshortened by the view from astern. */
  len: number;
  /** Body radius at the tail. */
  r: number;
  /** How much thinner the far end looks. */
  taper: number;
  /** Share of the length taken by the nose cone. */
  nose: number;
  /** Reach of the tail fins from the centreline, and their chord along the body. */
  fin: number;
  chord: number;
  /** Forward fins: where along the body (0 tail, 1 nose), their reach and chord. */
  mid?: [at: number, reach: number, chord: number];
  body: string;
  shade: string;
  tip: string;
  /** Painted bands: where along the body, and their colour. */
  bands: [at: number, color: string][];
}

export const SHAPES: Record<StoreShape, Shape> = {
  // AIM-9: slim, dark seeker head, small canards, tail fins with rollerons.
  aim9: { len: 66, r: 6, taper: 0.72, nose: 0.13, fin: 20, chord: 15, mid: [0.8, 10.5, 8], body: "#e9edf2", shade: "#97a4b6", tip: "#2a313b", bands: [[0.6, "#caa23c"], [0.34, "#8d5c3e"]] },
  // AIM-120: longer and fatter, white ogive radome, cropped wings at mid-body.
  aim120: { len: 84, r: 8.2, taper: 0.7, nose: 0.2, fin: 20, chord: 13, mid: [0.5, 15, 12], body: "#dfe4ea", shade: "#8e9aac", tip: "#f7f8fa", bands: [[0.66, "#caa23c"], [0.36, "#8d5c3e"]] },
  // A heavy air-to-ground missile: short, thick, glass seeker dome, long delta wings.
  agm: { len: 62, r: 12, taper: 0.74, nose: 0.13, fin: 25, chord: 30, body: "#cdd3c8", shade: "#7d8878", tip: "#22303e", bands: [[0.72, "#caa23c"]] },
  // A rocket pod: a plain drum with a tapered tail fairing.
  pod: { len: 46, r: 11.5, taper: 0.8, nose: 0, fin: 0, chord: 0, body: "#75806f", shade: "#454e44", tip: "#454e44", bands: [] },
};

/** Which drawing a station carries: Sidewinders on the wingtip rails, AMRAAMs on the pylons. */
export function storeShape(kind: StoreKind, mount?: string): StoreShape {
  if (kind === "pod") return "pod";
  if (kind === "agm") return "agm";
  return mount === "tip" ? "aim9" : "aim120";
}

const n = (v: number) => (Math.round(v * 10) / 10).toString();
const pts = (list: [number, number][]) => list.map(([x, y]) => `${n(x)} ${n(y)}`).join("L");

/** Four fins in an X around the body at `y`, each a thin blade swept back towards the camera. */
function fins(y: number, root: number, reach: number, chord: number, lift: number): string {
  let d = "";
  for (const sy of [-1, 1]) {
    for (const sx of [-1, 1]) {
      d += `M${pts([
        [sx * root * 0.7, y + sy * root * 0.6],
        [sx * reach, y + sy * reach * lift],
        [sx * reach * 0.88, y + sy * reach * lift - chord * 0.5],
        [sx * root * 0.8, y - chord],
      ])}Z`;
    }
  }
  return d;
}

/** The drawing inside the box: nose at the top, tail at the bottom, centred on the store's middle. */
function shapeBody(shape: StoreShape): string {
  const s = SHAPES[shape];
  const tail = s.len / 2;
  const tipY = -s.len / 2;
  const r1 = s.r * s.taper;
  const stroke = `stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"`;
  if (shape === "pod") {
    const tubes = [[0, 0], [-4.6, -2.6], [4.6, -2.6], [-4.6, 2.8], [4.6, 2.8], [0, -5.4], [0, 5.6]].map(([x, y]) => `<circle cx="${n(x)}" cy="${n(tail - 5 + y)}" r="1.5" fill="${INK}"/>`).join("");
    return (
      `<path d="M${pts([[-s.r, tail - 5], [-r1, tipY + 5], [-r1 * 0.6, tipY], [r1 * 0.6, tipY], [r1, tipY + 5], [s.r, tail - 5]])}Z" fill="${s.body}" ${stroke}/>` +
      `<path d="M${pts([[s.r * 0.2, tail - 5], [r1 * 0.2, tipY + 5], [r1, tipY + 5], [s.r, tail - 5]])}Z" fill="${s.shade}"/>` +
      `<circle cx="0" cy="${n(tail - 5)}" r="${n(s.r)}" fill="#59635a" ${stroke}/>${tubes}`
    );
  }
  const shoulder = tipY + s.len * s.nose;
  const curve = shoulder - (shoulder - tipY) * 0.55;
  const outline = `M${n(-s.r)} ${n(tail)}L${n(-r1)} ${n(shoulder)}Q${n(-r1)} ${n(curve)} 0 ${n(tipY)}Q${n(r1)} ${n(curve)} ${n(r1)} ${n(shoulder)}L${n(s.r)} ${n(tail)}Z`;
  const at = (t: number) => tail - t * s.len;
  const radiusAt = (t: number) => s.r + (r1 - s.r) * Math.min(1, t / (1 - s.nose));
  const bands = s.bands.map(([t, color]) => `<path d="M${pts([[-radiusAt(t), at(t)], [radiusAt(t), at(t)], [radiusAt(t + 0.035), at(t + 0.035)], [-radiusAt(t + 0.035), at(t + 0.035)]])}Z" fill="${color}"/>`).join("");
  const blade = `fill="#b3bdcb" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"`;
  const mid = s.mid ? `<path d="${fins(at(s.mid[0]), radiusAt(s.mid[0]) * 1.2, s.mid[1], s.mid[2], 0.5)}" ${blade}/>` : "";
  return (
    mid +
    `<path d="${outline}" fill="${s.body}" ${stroke}/>` +
    `<path d="M${n(s.r * 0.15)} ${n(tail)}L${n(r1 * 0.15)} ${n(shoulder)}L${n(r1)} ${n(shoulder)}L${n(s.r)} ${n(tail)}Z" fill="${s.shade}"/>` +
    bands +
    `<path d="M${n(-r1)} ${n(shoulder)}Q${n(-r1)} ${n(curve)} 0 ${n(tipY)}Q${n(r1)} ${n(curve)} ${n(r1)} ${n(shoulder)}Z" fill="${s.tip}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<path d="M${n(-s.r * 0.55)} ${n(tail - 4)}L${n(-r1 * 0.55)} ${n(shoulder + 2)}" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>` +
    `<path d="${fins(tail - 1, s.r, s.fin, s.chord, 0.82)}" ${blade}/>` +
    `<circle cx="0" cy="${n(tail)}" r="${n(s.r)}" fill="#8a96a8" ${stroke}/>` +
    `<circle cx="0" cy="${n(tail)}" r="${n(s.r * 0.55)}" fill="#161a21"/>`
  );
}

const cache = new Map<StoreShape, string>();

function body(shape: StoreShape): string {
  let svg = cache.get(shape);
  if (!svg) {
    svg = shapeBody(shape);
    cache.set(shape, svg);
  }
  return svg;
}

/** Side of the launched weapon's image in box units: wider than the box, so tail fins that overhang it are not cut off. */
export const IMAGE_UNITS = 140;

/** A complete image of one store, for drawing the launched weapon on the effects canvas. */
export function storeImage(shape: StoreShape): string {
  const half = IMAGE_UNITS / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="280" viewBox="${-half} ${-half} ${IMAGE_UNITS} ${IMAGE_UNITS}">${body(shape)}</svg>`;
}

/** How far below its attachment an underwing store's centreline hangs, in box units. */
export function storeDrop(shape: StoreShape, mount?: string): number {
  return mount === "tip" ? 0 : SHAPES[shape].r + (shape === "pod" ? 7 : 10);
}

/** Width of a store's drawing box as a percentage of its sprite, from the airframe's wingspan. */
export function storeBox(a: SpriteAnchors): number {
  const span = Math.min(13.5, Math.max(9, a.span ?? 11));
  return (100 * BOX_METRES) / span;
}

/**
 * How far a store's nose leans in towards the centreline, in degrees clockwise. Everything that
 * points forward on the jet converges on a point above it, so the further out along the wing a
 * store hangs, the more it leans.
 */
export function storeTilt(x: number, a: SpriteAnchors): number {
  const out = ((50 - x) / 100) * (a.span ?? 11);
  return (Math.atan2(out, a.lift ?? DEFAULT_LIFT) * 180) / Math.PI;
}

/** One weapon station on a rear view: its pylon, the weapon, and markers at the weapon's nose and tail. */
export function hungStore(station: Station, index: number, a: SpriteAnchors, spent: boolean): string {
  const [x, y, kind, mount] = station;
  const shape = storeShape(kind, mount);
  const s = SHAPES[shape];
  const drop = storeDrop(shape, mount);
  const pylon = drop ? `<svg class="pyl" viewBox="-50 -50 100 100"><path d="M-4.6 ${n(-drop - 1.5)}h9.2l-1.4 ${n(drop)}h-6.4z" fill="#4f5966" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/></svg>` : "";
  const style = `left:${n(x)}%;top:${n(y)}%;--sz:${n(storeBox(a))}%;--drop:${n(drop)}%;--tilt:${n(storeTilt(x, a))}deg`;
  return (
    `<i class="store hung store-${kind}${mount ? ` store-${mount}` : ""}${spent ? " spent" : ""}" data-st="${index}" data-kind="${kind}" data-shape="${shape}" style="${style}">${pylon}` +
    `<span class="msl"><svg viewBox="-50 -50 100 100">${body(shape)}</svg><b class="sn" style="top:${n(50 - s.len / 2)}%"></b><b class="st" style="top:${n(50 + s.len / 2)}%"></b></span></i>`
  );
}

/** The gun's blast port, drawn where the muzzle is on jets whose gun sits in a wing root. */
export function gunPort(a: SpriteAnchors): string {
  const [x, y] = a.gun;
  return `<i class="gunport" style="left:${n(x)}%;top:${n(y)}%;--sz:${n(storeBox(a))}%;--tilt:${n(storeTilt(x, a) * 0.5)}deg"><svg viewBox="-50 -50 100 100"><path d="M0 -9Q3.4 -4 2.8 6Q0 9.5 -2.8 6Q-3.4 -4 0 -9Z" fill="#0b0e13" stroke="#303947" stroke-width="1.2"/><path d="M-1.4 -5Q-2 0 -1.6 5" fill="none" stroke="#6b7686" stroke-width="0.9" stroke-linecap="round"/></svg></i>`;
}
