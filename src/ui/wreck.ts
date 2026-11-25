/*
 * A jet's death, drawn. `crashplan.ts` decides which death and how big; this file plays it.
 *
 * Both deaths start from a snapshot of the sprite that is on screen, so what breaks up or falls is
 * the same painting, in the same paint, that was flying a frame before. Fire, smoke, dust and water
 * are all built from the same thing: hard-edged round lobes in three or four flat tones, drawn tone
 * by tone so that neighbours merge into one cel-shaded shape.
 *
 * A mid-air kill is drawn on the effects canvas, over the fight. A crash is drawn behind the fight,
 * on a canvas of its own laid over the moving backdrop, because the jet falls away from the camera
 * to the surface; what it leaves there is pinned to the ground and carried off under the camera.
 */

import { sfx } from "../audio";
import { PLAYER } from "../game/combat";
import { demiseLength, demisePlan, explosionAt, fallPose, landingSpot, pickDemise, pieceCentre, wreckPieces, type Cause, type Demise, type DemisePlan, type Landing } from "./crashplan";
import { groundSurface, groundTrack, horizonY, type GroundPoint } from "./flight";
import { addEffect, fitCanvas } from "./gfx";
import { center, easeOut, lerp, rectOf, reduced, rnd, spriteEl, unitEl, wait, type Pt } from "./geo";

/** The fight's own effects, lent by `fx.ts` so the two files do not import each other. */
export interface WreckKit {
  hitStop: (ms: number) => Promise<void>;
  shake: (power: number) => void;
  flashScreen: () => void;
  burst: (x: number, y: number, size: number, kind: "hit" | "boom" | "big") => void;
}

let kit: WreckKit = { hitStop: async () => {}, shake: () => {}, flashScreen: () => {}, burst: () => {} };

export function initWreck(next: WreckKit) {
  kit = next;
}

const TAU = Math.PI * 2;
const INK = "#0e0f13";

/* ------------------------------------------------------------------ lobes */

/** Shade, body and highlight of something that is not on fire. */
type Tone = readonly [string, string, string];

const SMOKE: Tone = ["#15161b", "#2a2c33", "#474a55"];
const DUST: Tone = ["#6c573b", "#a68b60", "#d4bc8f"];
const WATER: Tone = ["#7fb4d1", "#dcf1fa", "#ffffff"];
const FIRE_RIM = "#6e1a13";
const FIRE_RED = "#d8391b";
const FIRE_ORANGE = "#f7851f";
const FIRE_YELLOW = "#ffd34d";
const FIRE_CORE = "#fff7dc";

interface Lobe {
  x: number;
  y: number;
  r: number;
  /** Speed it is thrown at, in px/s; it bleeds off within a second. */
  vx: number;
  vy: number;
  /** Steady drift in px/s: negative rises. */
  lift: number;
  /** Fall in px/s². */
  g: number;
  born: number;
  life: number;
  /** Seconds it burns before only its tone is left; 0 for something that never burned. */
  heat: number;
  tone: Tone;
  /** Growth per second once it has popped. */
  swell: number;
}

function lobe(init: Partial<Lobe> & Pick<Lobe, "x" | "y" | "r" | "born" | "life">): Lobe {
  return { vx: 0, vy: 0, lift: 0, g: 0, heat: 0, tone: SMOKE, swell: 0.2, ...init };
}

/** Things left hanging in the air slide outward from the vanishing point and grow as the camera flies up on them. */
interface Drift {
  x: number;
  y: number;
  rate: number;
}

const shades = new Map<string, [number, number, number]>();

function channels(hex: string): [number, number, number] {
  let c = shades.get(hex);
  if (!c) {
    c = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    shades.set(hex, c);
  }
  return c;
}

function mix(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const p = channels(a);
  const q = channels(b);
  return `rgb(${Math.round(lerp(p[0], q[0], t))},${Math.round(lerp(p[1], q[1], t))},${Math.round(lerp(p[2], q[2], t))})`;
}

let scratch = new Float32Array(4 * 96);

/**
 * Draws a cluster of lobes at time `t`: every lobe's shade, then every body, then the highlights
 * and the fire's inner tones, so the cluster reads as one shape with a hot heart.
 */
function drawLobes(c: CanvasRenderingContext2D, lobes: Lobe[], t: number, drift?: Drift) {
  const n = lobes.length;
  if (!n) return;
  if (scratch.length < n * 4) scratch = new Float32Array(n * 8);
  let live = 0;
  for (let i = 0; i < n; i++) {
    const l = lobes[i];
    const a = t - l.born;
    const at = i * 4;
    if (a < 0 || a >= l.life) {
      scratch[at + 2] = 0;
      continue;
    }
    const k = a / l.life;
    const pop = easeOut(Math.min(1, a / 0.12));
    const fade = k > 0.6 ? 1 - ((k - 0.6) / 0.4) ** 2 : 1;
    const m = (1 - Math.exp(-2.4 * a)) / 2.4;
    let x = l.x + l.vx * m;
    let y = l.y + l.vy * m + l.lift * a + 0.5 * l.g * a * a;
    let r = l.r * (0.3 + 0.7 * pop) * (1 + l.swell * a) * fade;
    if (drift) {
      const e = Math.exp(drift.rate * a);
      x = drift.x + (x - drift.x) * e;
      y = drift.y + (y - drift.y) * e;
      r *= e;
    }
    scratch[at] = x;
    scratch[at + 1] = y;
    scratch[at + 2] = r;
    scratch[at + 3] = l.heat > 0 ? Math.max(0, 1 - a / l.heat) : 0;
    live += 1;
  }
  if (!live) return;
  for (let i = 0; i < n; i++) {
    const r = scratch[i * 4 + 2];
    if (r < 0.4) continue;
    const hot = scratch[i * 4 + 3];
    c.fillStyle = hot > 0 ? mix(lobes[i].tone[0], FIRE_RIM, hot * 3) : lobes[i].tone[0];
    c.beginPath();
    c.arc(scratch[i * 4], scratch[i * 4 + 1], r, 0, TAU);
    c.fill();
  }
  for (let i = 0; i < n; i++) {
    const r = scratch[i * 4 + 2];
    if (r < 0.4) continue;
    const hot = scratch[i * 4 + 3];
    c.fillStyle = hot > 0 ? mix(lobes[i].tone[1], FIRE_RED, hot * 2.5) : lobes[i].tone[1];
    c.beginPath();
    c.arc(scratch[i * 4] - r * 0.07, scratch[i * 4 + 1] - r * 0.09, r * 0.86, 0, TAU);
    c.fill();
  }
  for (let i = 0; i < n; i++) {
    const r = scratch[i * 4 + 2];
    const hot = scratch[i * 4 + 3];
    if (r < 0.4 || hot >= 0.35) continue;
    c.fillStyle = lobes[i].tone[2];
    c.beginPath();
    c.arc(scratch[i * 4] - r * 0.24, scratch[i * 4 + 1] - r * 0.28, r * 0.44 * (1 - hot / 0.35), 0, TAU);
    c.fill();
  }
  heart(c, n, FIRE_ORANGE, 0.7, 2.2, 0.05);
  heart(c, n, FIRE_YELLOW, 0.47, 1.6, 0.03);
  heart(c, n, FIRE_CORE, 0.27, 1.25, 0);
}

/** One of a fire's inner tones across every burning lobe, as a single fill. */
function heart(c: CanvasRenderingContext2D, n: number, color: string, size: number, hold: number, shift: number) {
  c.fillStyle = color;
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const hot = scratch[i * 4 + 3];
    const r = scratch[i * 4 + 2] * size * Math.min(1, hot * hold);
    if (r < 0.4) continue;
    const x = scratch[i * 4] - scratch[i * 4 + 2] * shift;
    const y = scratch[i * 4 + 1] - scratch[i * 4 + 2] * shift;
    c.moveTo(x + r, y);
    c.arc(x, y, r, 0, TAU);
  }
  c.fill();
}

/** A fireball of `count` lobes around a point, `size` px in radius, that burns for a moment and leaves smoke. */
function fireball(into: Lobe[], x: number, y: number, size: number, at: number, count: number, burn = 1, linger = 1, tone: Tone = SMOKE) {
  into.push(lobe({ x, y, r: size * 0.7, born: at, life: 1.1 * linger, heat: 0.52 * burn, lift: -size * 0.1, swell: 0.22, tone }));
  for (let i = 0; i < count; i++) {
    const a = rnd(0, TAU);
    const d = rnd(0.25, 0.62) * size;
    into.push(
      lobe({
        x: x + Math.cos(a) * d * 1.15,
        y: y + Math.sin(a) * d * 0.75,
        r: size * rnd(0.3, 0.52),
        vx: Math.cos(a) * size * rnd(0.3, 0.9),
        vy: Math.sin(a) * size * rnd(0.3, 0.8),
        lift: -size * rnd(0.08, 0.22),
        born: at + rnd(0, 0.09),
        life: rnd(1, 1.5) * linger,
        heat: rnd(0.3, 0.56) * burn,
        swell: rnd(0.18, 0.32),
        tone,
      }),
    );
  }
}

/* ----------------------------------------------------------------- sprite */

/** A copy of one painting of a jet, at the size it is on screen. */
interface Skin {
  art: HTMLCanvasElement;
  /** The same painting scorched. */
  burnt: HTMLCanvasElement;
  /** Size on screen in CSS pixels. */
  w: number;
  h: number;
}

interface Snap {
  /** Where the jet is on screen. */
  x: number;
  y: number;
  /** The painting that was showing when it was hit. */
  seen: Skin;
  /** Its profile, painted nose to the right, where there is one to hand. */
  side: Skin | null;
}

function sheet(w: number, h: number): HTMLCanvasElement {
  const el = document.createElement("canvas");
  el.width = Math.max(1, Math.round(w));
  el.height = Math.max(1, Math.round(h));
  return el;
}

function showing(who: number): HTMLElement | null {
  const unit = unitEl(who);
  return (unit?.dataset.view === "side" ? unit.querySelector<HTMLElement>(".jet.side") : null) ?? spriteEl(who);
}

/** Copies a painting in its livery, `w` CSS pixels wide, mirrored if it is shown mirrored. */
function skin(img: HTMLImageElement | null | undefined, w: number, aspect: number, flip: boolean): Skin | null {
  if (!img || !img.complete || !img.naturalWidth || w < 4 || !(aspect > 0)) return null;
  const px = Math.min(480, Math.max(64, Math.round(w * Math.min(2, window.devicePixelRatio || 1))));
  const py = Math.max(8, Math.round(px / aspect));
  const art = sheet(px, py);
  const burnt = sheet(px, py);
  const c = art.getContext("2d");
  const b = burnt.getContext("2d");
  if (!c || !b) return null;
  const tint = getComputedStyle(img)
    .filter.replace(/drop-shadow\((?:[^()]|\([^()]*\))*\)/g, "")
    .trim();
  if (tint && tint !== "none" && "filter" in c) c.filter = tint;
  const nat = img.naturalWidth / img.naturalHeight;
  const dw = nat > aspect ? px : py * nat;
  const dh = nat > aspect ? px / nat : py;
  if (flip) {
    c.translate(px, 0);
    c.scale(-1, 1);
  }
  c.drawImage(img, (px - dw) / 2, (py - dh) / 2, dw, dh);
  b.drawImage(art, 0, 0);
  b.globalCompositeOperation = "source-atop";
  b.fillStyle = "rgba(16, 11, 9, 0.66)";
  b.fillRect(0, 0, px, py);
  return { art, burnt, w, h: w / aspect };
}

/** Copies a unit as it is on screen now, and its profile for the parts that read better from the side. */
function snapshot(who: number): Snap | null {
  const el = showing(who);
  const img = el?.querySelector("img");
  if (!el || !img || !el.offsetHeight) return null;
  // A hit flash still playing on the sprite would be baked into the copy.
  for (const anim of img.getAnimations()) anim.cancel();
  const rect = el.getBoundingClientRect();
  const seen = skin(img, rect.width, el.offsetWidth / el.offsetHeight, el.classList.contains("flip"));
  if (!seen) return null;
  const profile = who === PLAYER ? document.querySelector<HTMLImageElement>(".hud-portrait .jet img") : unitEl(who)?.querySelector<HTMLImageElement>(".jet.side img");
  const side = profile?.naturalHeight ? skin(profile, rect.width * 1.12, profile.naturalWidth / profile.naturalHeight, false) : null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, seen, side };
}

/** Whether a cut-out has any airframe in it, or only the empty corner of the sprite's box. */
function hasPaint(art: HTMLCanvasElement): boolean {
  try {
    const probe = sheet(12, 12).getContext("2d", { willReadFrequently: true });
    if (!probe) return true;
    probe.drawImage(art, 0, 0, 12, 12);
    const data = probe.getImageData(0, 0, 12, 12).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 48) n += 1;
    return n >= 5;
  } catch {
    return true;
  }
}

interface Chunk {
  art: HTMLCanvasElement;
  w: number;
  h: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  /** How fast it flips end over end, and where in the flip it starts. */
  tumble: number;
  phase: number;
  age: number;
  life: number;
  puffed: number;
}

/** Cuts the jet along its break lines: each piece keeps its paint, scorched, with a glowing torn edge inked over. */
function cut(snap: Snap): Chunk[] {
  const chunks: Chunk[] = [];
  for (const piece of wreckPieces(!!snap.side)) {
    const from = piece.view === "side" && snap.side ? snap.side : snap.seen;
    const px = from.art.width;
    const py = from.art.height;
    const xs = piece.outline.map((p) => p[0]);
    const ys = piece.outline.map((p) => p[1]);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    const bw = Math.max(...xs) - x0;
    const bh = Math.max(...ys) - y0;
    const art = sheet(bw * px + 4, bh * py + 4);
    const c = art.getContext("2d");
    if (!c) continue;
    c.translate(2 - x0 * px, 2 - y0 * py);
    c.beginPath();
    piece.outline.forEach(([x, y], i) => (i ? c.lineTo(x * px, y * py) : c.moveTo(x * px, y * py)));
    c.closePath();
    c.save();
    c.clip();
    c.drawImage(from.art, 0, 0);
    c.globalAlpha = 0.42;
    c.drawImage(from.burnt, 0, 0);
    c.restore();
    c.globalCompositeOperation = "source-atop";
    c.lineJoin = "round";
    c.strokeStyle = "#ff8126";
    c.lineWidth = Math.max(3, px * 0.014);
    c.stroke();
    c.strokeStyle = INK;
    c.lineWidth = Math.max(1.4, px * 0.006);
    c.stroke();
    if (!hasPaint(art)) continue;
    const [cx, cy] = pieceCentre(piece.outline);
    // The profile's parts start bunched at the middle of the jet, where the fireball hides the join.
    const tight = piece.view === "side" ? 0.4 : 1;
    chunks.push({
      art,
      w: (art.width / px) * from.w,
      h: (art.height / py) * from.h,
      // Until it is thrown, a piece keeps its place in the airframe, measured from the jet's centre.
      x: (x0 + bw / 2 - 0.5) * from.w * tight,
      y: (y0 + bh / 2 - 0.5) * from.h * tight,
      vx: cx - 0.5,
      vy: cy - 0.5,
      rot: 0,
      spin: 0,
      tumble: 0,
      phase: 0,
      age: 0,
      life: 1,
      puffed: 0,
    });
  }
  return chunks;
}

/* ----------------------------------------------------------------- scenes */

interface Cue {
  at: number;
  run: () => void;
  /** Runs even if the scene is cut short: someone is waiting on it. */
  must?: boolean;
}

interface Scene {
  age: number;
  cues: Cue[];
  step: (dt: number, age: number) => void;
  /** Drawn over the fight. */
  top?: (c: CanvasRenderingContext2D) => void;
  /** Drawn behind the fight, on the backdrop. */
  world?: (c: CanvasRenderingContext2D) => void;
  /** Whether there was a backdrop to draw `world` on when the scene began. */
  behind?: boolean;
}

const scenes: Scene[] = [];
let world: HTMLCanvasElement | null = null;
let worldCtx: CanvasRenderingContext2D | null = null;
let painted = -1;

/** The canvas over the fight's moving backdrop, moved into whichever backdrop is up now. */
function backdrop(): CanvasRenderingContext2D | null {
  const slot = document.querySelector<HTMLElement>("#scene .sc-layer:not(.off) .sc-flight-slot");
  if (!world && slot) {
    world = document.createElement("canvas");
    world.className = "sc-world";
    worldCtx = world.getContext("2d");
  }
  if (!world || !worldCtx) return null;
  if (slot && world.parentElement !== slot) slot.appendChild(world);
  // Once the fight's backdrop is on its way out, what is left of a crash fades out with it.
  if (!world.isConnected) return null;
  return worldCtx;
}

/** Repaints everything behind the fight, once a frame however many scenes ask. False when there is no backdrop to paint on. */
function paintWorld(force = false): boolean {
  if (!world && !scenes.some((scene) => scene.world)) return false;
  const c = backdrop();
  if (!c) return false;
  const now = performance.now();
  if (!force && now - painted < 3) return true;
  painted = now;
  // Measured where it is shown, like the effects canvas, so the ground and the sky above it line up.
  fitCanvas(world!, c, 1_800_000);
  for (const scene of scenes) {
    if (!scene.world) continue;
    c.save();
    scene.world(c);
    c.restore();
  }
  return true;
}

/** Plays a scene on the effects clock, so a hit-stop holds it and a tap to hurry speeds it with everything else. */
function play(scene: Scene, life: number): Promise<void> {
  scenes.push(scene);
  scene.behind = !!scene.world && paintWorld(true);
  scene.cues.sort((a, b) => a.at - b.at);
  return addEffect({
    life,
    draw: (c, _k, age) => {
      const dt = Math.max(0, age - scene.age);
      scene.age = age;
      while (scene.cues.length && scene.cues[0].at <= age) scene.cues.shift()!.run();
      scene.step(dt, age);
      c.globalCompositeOperation = "source-over";
      c.globalAlpha = 1;
      // Only where there never was a backdrop does a crash play over the fight instead of behind it.
      if (scene.world && !paintWorld() && !scene.behind) scene.world(c);
      scene.top?.(c);
    },
    done: () => {
      const at = scenes.indexOf(scene);
      if (at >= 0) scenes.splice(at, 1);
      for (const cue of scene.cues.splice(0)) if (cue.must) cue.run();
      paintWorld(true);
    },
  });
}

const pending = new Set<Promise<void>>();

/**
 * Settles once every death in progress has had its explosion and a moment to be seen. It never
 * waits longer than the longest death takes, so a fight cannot hang on an animation that stalled.
 */
export function settleWrecks(): Promise<void> {
  if (!pending.size) return Promise.resolve();
  const all = Promise.all([...pending]).then(() => undefined);
  return Promise.race([all, new Promise<void>((resolve) => window.setTimeout(resolve, 8000))]);
}

function vanishing(): Pt {
  return { x: window.innerWidth / 2, y: horizonY() ?? window.innerHeight * 0.45 };
}

/** The impact frame: a hard white star for an instant, and a ring thrown off it. */
function star(c: CanvasRenderingContext2D, x: number, y: number, size: number, age: number, turn: number) {
  if (age < 0.075) {
    c.fillStyle = FIRE_CORE;
    c.beginPath();
    for (let i = 0; i < 20; i++) {
      const a = turn + (i / 20) * TAU;
      const r = size * (i % 2 ? 0.42 : i % 4 ? 1.15 : 1.7);
      if (i) c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.82);
      else c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.82);
    }
    c.closePath();
    c.fill();
  }
  if (age < 0.34) {
    const k = age / 0.34;
    c.strokeStyle = FIRE_CORE;
    c.globalAlpha = (1 - k) ** 1.5;
    c.lineWidth = Math.max(1.5, size * 0.07 * (1 - k));
    c.beginPath();
    c.ellipse(x, y, size * (0.7 + 1.9 * easeOut(k)), size * (0.55 + 1.5 * easeOut(k)), 0, 0, TAU);
    c.stroke();
    c.globalAlpha = 1;
  }
}

function drawChunks(c: CanvasRenderingContext2D, chunks: Chunk[]) {
  for (const p of chunks) {
    const k = p.age / p.life;
    if (k >= 1) continue;
    const s = 1.2 - 0.25 * k;
    c.save();
    c.globalAlpha = k > 0.72 ? (1 - k) / 0.28 : 1;
    c.translate(p.x, p.y);
    c.rotate(p.rot);
    c.scale(s, s * (0.38 + 0.62 * Math.abs(Math.cos(p.phase + p.tumble * p.age))));
    c.drawImage(p.art, -p.w / 2, -p.h / 2, p.w, p.h);
    c.restore();
  }
}

/** Small explosions walking over an airframe that is about to go: the long goodbye a boss gets. */
function secondaries(cues: Cue[], plan: DemisePlan, at: () => Pt, span: number) {
  for (let i = 0; i < plan.secondaries; i++) {
    cues.push({
      at: 0.04 + (i / plan.secondaries) * (plan.prelude - 0.12),
      run: () => {
        const p = at();
        kit.burst(p.x + rnd(-0.3, 0.3) * span, p.y + rnd(-0.12, 0.12) * span, span * rnd(0.22, 0.32), "boom");
        sfx(i % 2 ? "hit" : "hitBig");
        kit.shake(4);
      },
    });
  }
}

/** Rattles an airframe that is still on screen while it burns. */
function shudder(unit: HTMLElement, seconds: number) {
  const art = unit.querySelector<HTMLElement>(".unit-art");
  if (!art) return;
  const frames: Keyframe[] = [];
  for (let i = 0; i < 14; i++) frames.push({ transform: `translate(${rnd(-5, 5).toFixed(1)}px, ${rnd(-4, 4).toFixed(1)}px) rotate(${rnd(-3, 3).toFixed(1)}deg)` });
  art.animate(frames, { duration: seconds * 1000, easing: "linear" });
}

function boom(plan: DemisePlan) {
  if (plan.flash) kit.flashScreen();
  void kit.hitStop(plan.hitStop).then(() => kit.shake(plan.shake));
}

/* ---------------------------------------------------------------- mid-air */

/** Smoke hanging in open air, a shade lighter than what pours off a fire, so wreckage shows against it. */
const HAZE: Tone = ["#1f2127", "#383b44", "#5a5e6a"];

/** The airframe comes apart where it is: a fireball, and the wings and tail tumbling out of it. */
function midair(who: number, unit: HTMLElement, snap: Snap, plan: DemisePlan, seen: () => void): Scene {
  const lobes: Lobe[] = [];
  const chunks = cut(snap);
  const at = explosionAt(plan);
  const linger = plan.settle / 1.5;
  const span = snap.seen.w;
  const blast = span * 0.5 * plan.size;
  const turn = rnd(0, TAU);
  let drift: Drift = { ...vanishing(), rate: 0.16 };
  let live = false;
  let now = 0;
  const cues: Cue[] = [];
  if (plan.prelude) {
    shudder(unit, plan.prelude);
    secondaries(cues, plan, () => center(who) ?? snap, span);
  }
  cues.push({
    at,
    run: () => {
      // The jet may have bobbed or been knocked since the kill: break up where it is now.
      const here = showing(who)?.getBoundingClientRect();
      if (here?.width) {
        snap.x = here.left + here.width / 2;
        snap.y = here.top + here.height / 2;
      }
      unit.classList.add("crashing");
      drift = { ...vanishing(), rate: 0.16 };
      live = true;
      sfx("breakup");
      boom(plan);
      const big = plan.size > 1.3;
      fireball(lobes, snap.x, snap.y, blast, at, big ? 16 : 11, big ? 1.25 : 1, linger * 0.85, HAZE);
      // A big sprite is a near one: its pieces cross the screen faster, but not in proportion.
      const kick = (150 + span * 0.6) * Math.sqrt(plan.size);
      for (const p of chunks) {
        const a = Math.atan2(p.vy * 1.5 - 0.06, p.vx) + rnd(-0.45, 0.45);
        const speed = kick * rnd(1.1, 2.1);
        p.x += snap.x;
        p.y += snap.y;
        p.vx = Math.cos(a) * speed;
        p.vy = Math.sin(a) * speed - kick * 0.6;
        p.rot = rnd(-0.3, 0.3);
        p.spin = rnd(2.5, 7.5) * (Math.random() < 0.5 ? -1 : 1);
        p.tumble = rnd(2.5, 6.5);
        p.phase = rnd(0, 0.5);
        p.life = rnd(1.05, 1.45) * linger;
      }
      for (let i = 0; i < 12; i++) {
        // Small fragments: burning scraps that arc out past the big pieces.
        const a = rnd(0, TAU);
        lobes.push(lobe({ x: snap.x, y: snap.y, r: blast * rnd(0.05, 0.09), vx: Math.cos(a) * blast * rnd(2.2, 5), vy: Math.sin(a) * blast * rnd(2, 4.4) - blast, g: blast * 2.6, born: at, life: rnd(0.55, 0.95), heat: rnd(0.35, 0.6), swell: 0, tone: HAZE }));
      }
    },
  });
  for (let i = 0; i < plan.aftershocks; i++) {
    const when = at + 0.17 + i * 0.21;
    cues.push({
      at: when,
      run: () => {
        fireball(lobes, snap.x + rnd(-0.55, 0.55) * blast, snap.y + rnd(-0.35, 0.3) * blast, blast * rnd(0.36, 0.5), when, 4, 0.8, linger * 0.7, HAZE);
        sfx(plan.size > 1.3 ? "explode" : "hit");
        if (plan.size > 1.3) kit.shake(5);
      },
    });
  }
  cues.push({ at: at + Math.min(plan.settle, 1.1), run: seen, must: true });
  return {
    age: 0,
    cues,
    step: (dt, age) => {
      now = age;
      if (!live) return;
      for (const p of chunks) {
        p.age += dt;
        if (p.age >= p.life) continue;
        const hold = 0.45 ** dt;
        p.vx *= hold;
        p.vy = p.vy * hold + (250 + span) * dt;
        // Wreckage slows in the air the fight is flying through, so it comes back at the camera.
        p.x += p.vx * dt + (p.x - drift.x) * 0.3 * dt;
        p.y += p.vy * dt + (p.y - drift.y) * 0.3 * dt;
        p.rot += p.spin * dt;
        if (p.age < p.life * 0.55 && p.age - p.puffed >= 0.07) {
          p.puffed = p.age;
          lobes.push(lobe({ x: p.x, y: p.y, r: span * rnd(0.028, 0.05) * Math.sqrt(plan.size), born: age, life: rnd(0.32, 0.5), heat: p.age < p.life * 0.25 ? 0.1 : 0, lift: -14, swell: 0.6, tone: HAZE }));
        }
      }
      if (lobes.length > 220) lobes.splice(0, lobes.length - 220);
    },
    top: (c) => {
      if (!live) return;
      drawLobes(c, lobes, now, drift);
      drawChunks(c, chunks);
      star(c, snap.x, snap.y, blast, now - at, turn);
    },
  };
}

/* ------------------------------------------------------------------ crash */

interface Clod {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  spin: number;
  color: string;
}

/** Fire on an airframe: four flat tones that gutter in the slipstream. */
function flames(c: CanvasRenderingContext2D, x: number, y: number, size: number, t: number) {
  const lick = 0.8 + 0.2 * Math.sin(t * 47) + 0.12 * Math.sin(t * 83);
  for (const [color, part] of [
    [FIRE_RED, 1],
    [FIRE_ORANGE, 0.76],
    [FIRE_YELLOW, 0.5],
    [FIRE_CORE, 0.26],
  ] as const) {
    c.fillStyle = color;
    c.beginPath();
    c.arc(x + Math.sin(t * 31) * size * 0.2, y, size * part * lick, 0, TAU);
    c.fill();
  }
}

/**
 * The jet catches fire and goes down: out of formation, trailing flame and black smoke, shrinking
 * toward the surface, where it blows up. What it leaves there rides the ground back under the camera.
 *
 * An enemy rolls off into its profile and goes down nose first. The player's own jet is seen from
 * behind all the way: the camera stops following, and it falls away ahead.
 */
function crash(snap: Snap, plan: DemisePlan, player: boolean, seen: () => void): Scene {
  const start = { x: snap.x, y: snap.y };
  // An enemy's smoke hangs where it was left. The player's jet is leaving the camera behind, so its smoke comes back fast.
  const drift: Drift = { ...vanishing(), rate: player ? 1.1 : 0.2 };
  const land: Landing = landingSpot(start, { w: window.innerWidth, h: window.innerHeight, horizon: drift.y }, player, Math.random());
  const spiral = Math.random() < 0.55;
  const side = land.x < start.x ? -1 : 1;
  const at = explosionAt(plan);
  const wet = groundSurface() === "water";
  const body = player ? null : snap.side;
  const span = (body ?? snap.seen).w;
  const reach = Math.max(70, Math.abs(land.y - start.y));
  const unit = Math.max(30, snap.seen.w * land.size * 0.8) * plan.size;
  const turn = rnd(0, TAU);
  const trail: Lobe[] = [];
  const ground: Lobe[] = [];
  const clods: Clod[] = [];
  /** `nose` is the profile's heading, turned from level toward straight down; `roll` turns the view from behind. */
  const jet = { x: start.x, y: start.y, size: 1, nose: 0, roll: 0, flat: 1, burn: 0.25, turned: 0 };
  let puffed = -1;
  let pin: (() => GroundPoint | null) | null = null;
  let smoked = 0;
  let now = 0;

  function place(k: number): Pt {
    const pose = fallPose(k, spiral, side, land.size);
    return { x: lerp(start.x, land.x, pose.along ** 1.25) + pose.weave * reach, y: lerp(start.y, land.y, pose.drop) };
  }

  /** Where the fire is on the airframe, and where its smoke comes off. */
  function tail(): Pt {
    if (!body) return { x: jet.x, y: jet.y - span * jet.size * 0.03 };
    const back = span * jet.size * 0.3;
    return { x: jet.x - side * Math.cos(jet.nose) * back, y: jet.y - Math.sin(jet.nose) * back };
  }

  const cues: Cue[] = [];
  cues.push({
    at: 0,
    run: () => {
      sfx("flameout");
      kit.burst(start.x, start.y, snap.seen.w * 0.3, "boom");
      kit.shake(3);
    },
  });
  if (plan.prelude) secondaries(cues, plan, () => jet, snap.seen.w);
  cues.push({ at: plan.prelude, run: () => sfx("dive") });
  cues.push({
    at,
    run: () => {
      pin = groundTrack(land.x, land.y);
      sfx(wet ? "splash" : "groundhit");
      boom(plan);
      // Everything on the ground is placed around the point of impact, in pixels as they were at that moment.
      fireball(ground, 0, -unit * 0.35, unit * (wet ? 0.8 : 1.15), at, wet ? 5 : 9, wet ? 0.7 : 1.15, wet ? 0.8 : 1.5);
      if (wet) {
        for (let i = 0; i < 9; i++) {
          const k = i / 8;
          ground.push(lobe({ x: rnd(-0.22, 0.22) * unit, y: -unit * 0.2, r: unit * lerp(0.72, 0.36, k), vy: -unit * (1.1 + 3 * k) * 2.4, g: unit * 2.4, born: at + k * 0.07, life: rnd(1.15, 1.5), tone: WATER, swell: 0.12 }));
        }
        for (let i = 0; i < 9; i++) {
          const dir = i % 2 ? 1 : -1;
          ground.push(lobe({ x: dir * unit * 0.3, y: -unit * 0.15, r: unit * rnd(0.3, 0.46), vx: dir * unit * rnd(2, 5), vy: -unit * rnd(1.4, 3.6), g: unit * 3.4, born: at + rnd(0, 0.06), life: rnd(0.8, 1.15), tone: WATER, swell: 0.1 }));
        }
      } else {
        for (let i = 0; i < 11; i++) {
          const dir = i % 2 ? 1 : -1;
          ground.push(lobe({ x: dir * unit * rnd(0.2, 0.7), y: unit * 0.05, r: unit * rnd(0.45, 0.75), vx: dir * unit * rnd(1.6, 4.4), vy: -unit * rnd(0.2, 1.1), born: at + rnd(0, 0.08), life: rnd(1.6, 2.3), tone: DUST, swell: 0.36 }));
        }
      }
      for (let i = 0; i < (wet ? 6 : 13); i++) {
        clods.push({ x: rnd(-0.4, 0.4) * unit, y: -unit * 0.2, vx: rnd(-3.2, 3.2) * unit, vy: -rnd(3, 6.5) * unit, size: unit * rnd(0.08, 0.2), rot: rnd(0, TAU), spin: rnd(-9, 9), color: i % 3 ? INK : wet ? "#3b4048" : "#5a4630" });
      }
    },
  });
  for (let i = 0; i < plan.aftershocks; i++) {
    const when = at + 0.28 + i * 0.3;
    cues.push({
      at: when,
      run: () => {
        fireball(ground, rnd(-1.3, 1.3) * unit, -unit * rnd(0.2, 0.6), unit * rnd(0.55, 0.75), when, 5, 1, 1.2);
        sfx("explode");
        kit.shake(5);
      },
    });
  }
  cues.push({ at: at + Math.min(plan.settle, 1.2), run: seen, must: true });

  return {
    age: 0,
    cues,
    step: (dt, age) => {
      now = age;
      if (age < at) {
        const k = Math.max(0, (age - plan.prelude) / plan.fall);
        const pose = fallPose(k, spiral, side, land.size);
        const here = place(k);
        const next = place(Math.min(1, k + 0.02));
        const jitter = age < plan.prelude ? 3 : 0;
        jet.x = here.x + rnd(-jitter, jitter);
        jet.y = here.y + rnd(-jitter, jitter);
        jet.size = pose.size;
        jet.roll = pose.roll;
        // It heads the way it is falling, eased in from level flight as it rolls off.
        jet.nose = lerp(0.12, Math.atan2(next.y - here.y, (next.x - here.x) * side), Math.min(1, k / 0.22));
        jet.flat = body ? (spiral ? Math.cos(k * TAU * 2.1) : 1 - 0.12 * k) : 1 - (spiral ? 0.2 : 0.38) * k;
        jet.burn = Math.min(body ? 0.8 : 0.55, 0.2 + 0.6 * (age / at));
        jet.turned = Math.min(1, age / 0.16);
        const gap = age < plan.prelude ? 0.05 : 0.028;
        if (age - puffed >= gap) {
          puffed = age;
          const from = tail();
          const w = span * jet.size;
          const thick = body ? 1 : 0.6;
          trail.push(lobe({ x: from.x + rnd(-0.04, 0.04) * w, y: from.y + rnd(-0.04, 0.04) * w, r: w * rnd(0.075, 0.125) * thick, vx: rnd(-12, 12), vy: rnd(-8, 8), lift: -10, born: age, life: rnd(0.75, 1.1) * (body ? 1 : 0.8), heat: rnd(0.1, 0.2), swell: body ? 0.5 : 0.1 }));
        }
      } else {
        // The wreck burns on where it fell: smoke keeps rising from it until it is out of sight.
        if (age - smoked >= 0.15 && age < at + plan.settle - 0.5) {
          smoked = age;
          ground.push(lobe({ x: rnd(-0.3, 0.3) * unit, y: -unit * 0.2, r: unit * rnd(0.42, 0.68), vx: rnd(-0.3, 0.3) * unit, lift: -unit * rnd(0.9, 1.5), born: age + (wet ? 0.3 : 0), life: rnd(1.5, 2.1), heat: wet ? 0 : 0.16, swell: 0.3 }));
        }
        for (const p of clods) {
          p.vy += unit * 8 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.spin * dt;
        }
      }
      if (trail.length > 90) trail.splice(0, trail.length - 90);
      if (ground.length > 110) ground.splice(0, ground.length - 110);
    },
    world: (c) => {
      const spot = pin?.();
      if (spot) {
        const since = now - at;
        const left = at + plan.settle - now;
        // Fades as it goes out of time, or as the camera flies into it.
        const alpha = Math.max(0, Math.min(1, left / 0.45, 1 - (spot.scale - 3.4) / 3.2));
        if (alpha > 0) {
          c.save();
          c.translate(spot.x, spot.y);
          c.scale(spot.scale, spot.scale);
          const tilt = Math.max(0.12, Math.min(0.6, spot.tilt));
          if (wet) {
            // Foam: a churned patch and the ring of the splash running out from it.
            const spread = unit * (0.8 + 1.9 * easeOut(Math.min(1, since / 1.5)));
            c.fillStyle = "#dff3fb";
            c.globalAlpha = alpha * 0.5 * Math.max(0.25, 1 - since / 3.2);
            c.beginPath();
            c.ellipse(0, 0, spread, spread * tilt, 0, 0, TAU);
            c.fill();
            if (since < 1.7) {
              c.strokeStyle = "#ffffff";
              c.globalAlpha = alpha * (1 - since / 1.7);
              c.lineWidth = unit * 0.14 * (1 - (since / 1.7) * 0.6);
              c.beginPath();
              c.ellipse(0, 0, spread * 1.12, spread * 1.12 * tilt, 0, 0, TAU);
              c.stroke();
            }
          } else {
            // A scorch on the ground, and the dust the blast drives out along it.
            c.fillStyle = "#17120d";
            c.globalAlpha = alpha * 0.6 * Math.min(1, since / 0.12);
            c.beginPath();
            c.ellipse(0, 0, unit * 1.7, unit * 1.7 * tilt, 0, 0, TAU);
            c.fill();
            if (since < 1) {
              c.strokeStyle = DUST[2];
              c.globalAlpha = alpha * 0.8 * (1 - since);
              c.lineWidth = unit * 0.18;
              c.beginPath();
              c.ellipse(0, 0, unit * (1 + 2.4 * easeOut(since)), unit * (1 + 2.4 * easeOut(since)) * tilt, 0, 0, TAU);
              c.stroke();
            }
          }
          c.globalAlpha = alpha;
          drawLobes(c, ground, now);
          for (const p of clods) {
            if (p.y > unit * 0.3 && p.vy > 0) continue;
            c.save();
            c.translate(p.x, p.y);
            c.rotate(p.rot);
            c.fillStyle = p.color;
            c.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
            c.restore();
          }
          star(c, 0, -unit * 0.3, unit * 1.2, since, turn);
          c.restore();
        }
      }
      drawLobes(c, trail, now, drift);
      if (now >= at) return;
      const w = span * jet.size;
      if (body) {
        // The view from behind gives way to the profile as it rolls off.
        if (jet.turned < 1) {
          c.save();
          c.globalAlpha = 1 - jet.turned;
          c.translate(jet.x, jet.y);
          c.rotate(side * jet.turned * 0.9);
          c.scale(1 - 0.4 * jet.turned, 1);
          c.drawImage(snap.seen.art, -snap.seen.w / 2, -snap.seen.h / 2, snap.seen.w, snap.seen.h);
          c.restore();
        }
        const h = body.h * jet.size;
        // A rolling jet shows its profile, then its edge, then its other side.
        const flat = Math.sign(jet.flat || 1) * Math.max(0.3, Math.abs(jet.flat));
        c.save();
        c.globalAlpha = jet.turned;
        c.translate(jet.x, jet.y);
        c.scale(side, 1);
        c.rotate(jet.nose);
        c.scale(1, flat);
        c.drawImage(body.art, -w / 2, -h / 2, w, h);
        c.globalAlpha = jet.turned * jet.burn;
        c.drawImage(body.burnt, -w / 2, -h / 2, w, h);
        c.restore();
      } else {
        const h = snap.seen.h * jet.size;
        c.save();
        c.translate(jet.x, jet.y);
        c.rotate(jet.roll);
        c.scale(1, jet.flat);
        c.drawImage(snap.seen.art, -w / 2, -h / 2, w, h);
        c.globalAlpha = jet.burn;
        c.drawImage(snap.seen.burnt, -w / 2, -h / 2, w, h);
        c.restore();
      }
      const fire = tail();
      flames(c, fire.x, fire.y, w * (body ? 0.085 : 0.1), now);
      if (body) flames(c, lerp(fire.x, jet.x, 0.7), lerp(fire.y, jet.y, 0.7), w * 0.05, now + 0.4);
    },
  };
}

/* ------------------------------------------------------------------- still */

/** With reduced motion: one fireball that does not move, and fades. */
function still(x: number, y: number, size: number): Promise<void> {
  const lobes: Lobe[] = [];
  fireball(lobes, x, y, size, -0.1, 9);
  for (const l of lobes) {
    l.vx = l.vy = l.lift = l.swell = 0;
    l.born = -0.1;
    l.heat = 1;
    l.life = 9;
  }
  return addEffect({
    life: 0.9,
    draw: (c, k) => {
      c.globalCompositeOperation = "source-over";
      c.globalAlpha = 1 - k * k;
      drawLobes(c, lobes, 0.05);
    },
  });
}

/* -------------------------------------------------------------------- entry */

let forced: Demise | null = null;

/** Makes every death the same kind, for studying one in development; null goes back to choosing. */
export function forceDemise(kind: Demise | null) {
  forced = kind;
}

/**
 * Kills a unit on screen: an enemy, or the player's own jet when the sortie is lost. Settles when
 * the fight can carry on; the death itself may still be playing out behind it, and `settleWrecks`
 * waits for that.
 */
export async function downJet(who: number, cause: Cause, force?: Demise): Promise<void> {
  const unit = unitEl(who);
  if (!unit || unit.classList.contains("crashing")) return;
  const player = who === PLAYER;
  const kind = force ?? forced ?? pickDemise(cause, Math.random(), unit.classList.contains("flying"));
  const plan = demisePlan(kind, { boss: unit.classList.contains("boss"), player });
  const snap = reduced() ? null : snapshot(who);
  if (!snap) {
    const r = rectOf(who);
    unit.classList.add("crashing");
    sfx("explode");
    if (r) pending.add(track(still(r.left + r.width / 2, r.top + r.height / 2, Math.min(r.width, 320) * 0.42 * plan.size)));
    await wait(320);
    return;
  }
  let seen = () => {};
  const shown = new Promise<void>((resolve) => (seen = resolve));
  pending.add(track(shown));
  if (kind === "midair") {
    void play(midair(who, unit, snap, plan, seen), demiseLength(plan) + 0.2);
    // The fight holds through a boss's last moments, then moves on a beat after the explosion.
    if (plan.prelude) await until(plan.prelude);
  } else {
    unit.classList.add("crashing");
    void play(crash(snap, plan, player, seen), explosionAt(plan) + plan.settle);
    if (plan.prelude) await until(plan.prelude);
  }
  await wait(plan.lead);
}

function track(p: Promise<void>): Promise<void> {
  void p.then(() => pending.delete(p));
  return p;
}

/** Waits `seconds` on the effects clock. */
function until(seconds: number): Promise<void> {
  return addEffect({ life: seconds, draw: () => {} });
}
