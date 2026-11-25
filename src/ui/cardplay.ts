/*
 * Draws the card recipes from cardfx.ts. Everything starts from a real place on the jet's sprite,
 * read from the anchor markers the renderer lays over it: tracer leaves the gun's muzzle, a missile
 * flies off the pylon it was hanging on, flares come out of the dispensers. Particles and drawn
 * effects go to the canvas in gfx.ts; the jet's own pose and its weapon stations are DOM.
 */

import { sfx } from "../audio";
import { PLAYER } from "../game/combat";
import type { StoreKind } from "./anchors";
import { cardAnim, MAX_LEAD, type Impact, type Maneuver, type Shot, type Step, type Where } from "./cardfx";
import { addEffect, emit, flash, fxSprite, glow, shards, smoke, sparks } from "./gfx";
import { anchor, artEl, center, depth, easeInOut, easeOut, hullPoint, lerp, livingFoes, mark, marks, midOf, muzzle, nozzles, rectOf, reduced, rnd, spriteEl, stations, timeScale, wait, type Pt } from "./geo";
import { rearm, takeStation } from "./loadout";
import { IMAGE_UNITS, SHAPES, storeImage, storeShape, type StoreShape } from "./stores";

type Ctx2 = CanvasRenderingContext2D;
type StepOf<K extends Step["fx"]> = Extract<Step, { fx: K }>;
type ShotOf<K extends Shot["fx"]> = Extract<Shot, { fx: K }>;

interface CastCtx {
  target: number | null;
}

const TAU = Math.PI * 2;
const INK = "#0d1117";
const TRACER = "#ff8a3c";
const FIRE = "#ffb347";
const FLAME = "#ff8a3c";

/** Runs `fn` every frame for `life` seconds with the time since the last frame. */
function tick(life: number, fn: (dt: number, k: number, age: number, c: Ctx2) => void, delay = 0): Promise<void> {
  let prev = 0;
  return addEffect({
    life,
    delay,
    draw: (c, k, age) => {
      const dt = age - prev;
      prev = age;
      fn(dt, k, age, c);
    },
  });
}

function later(ms: number, fn: () => void) {
  window.setTimeout(fn, ms * timeScale());
}

function targetsOf(on: Where, ctx: CastCtx): number[] {
  if (on === "self") return [PLAYER];
  const living = livingFoes();
  if (on === "all") return living;
  if (ctx.target !== null && living.includes(ctx.target)) return [ctx.target];
  return living.slice(0, 1);
}

/** In and out: rises quickly, holds, and fades over the last part of its life. */
const pulse = (k: number, rise = 0.18, fall = 0.4) => (k < rise ? k / rise : k > 1 - fall ? (1 - k) / fall : 1);

function pose(who: number, frames: Keyframe[], ms: number, easing = "cubic-bezier(.3,.7,.3,1)") {
  if (reduced()) return;
  artEl(who)?.animate(frames, { duration: ms * timeScale(), easing });
}

function shudder(who: number, ms: number, power = 3) {
  const frames: Keyframe[] = [{ transform: "none" }];
  for (let i = 0; i < 7; i++) frames.push({ transform: `translate(${rnd(-1, 1) * power}px, ${rnd(-1, 1) * power}px) rotate(${rnd(-0.6, 0.6)}deg)` });
  frames.push({ transform: "none" });
  pose(who, frames, ms, "linear");
}

/** How big an explosion on this airframe should be drawn, from how far away it is. */
const blastScale = (who: number) => Math.max(0.45, Math.min(1.3, depth(who) * 1.15));

/* ------------------------------------------------------------------ hull */

let scratch: HTMLCanvasElement | null = null;

/**
 * Paints onto a unit's hull and nowhere else: `paint` draws into a box the size of the sprite, and
 * the result is clipped to the sprite's own silhouette before it reaches the screen. This is how
 * armour catches the light, a jet goes dark, or interference crawls over a jammed airframe without
 * anything spilling into the air around it.
 */
function hullFx(who: number, life: number, paint: (c: Ctx2, w: number, h: number, k: number) => void, blend: GlobalCompositeOperation = "lighter", delay = 0): Promise<void> {
  if (reduced() || typeof document === "undefined") return Promise.resolve();
  return tick(
    life,
    (_dt, k, _age, c) => {
      const el = spriteEl(who);
      const img = el?.querySelector("img");
      if (!el || !img || !img.complete || !img.naturalWidth) return;
      const r = img.getBoundingClientRect();
      if (r.width < 8 || r.height < 4) return;
      scratch ??= document.createElement("canvas");
      const s = Math.min(1, 360 / r.width);
      const w = Math.max(2, Math.round(r.width * s));
      const h = Math.max(2, Math.round(r.height * s));
      scratch.width = w;
      scratch.height = h;
      const o = scratch.getContext("2d")!;
      paint(o, w, h, k);
      o.globalAlpha = 1;
      o.globalCompositeOperation = "destination-in";
      if (el.classList.contains("flip")) {
        o.translate(w, 0);
        o.scale(-1, 1);
      }
      o.drawImage(img, 0, 0, w, h);
      c.globalCompositeOperation = blend;
      c.drawImage(scratch, r.left, r.top, r.width, r.height);
    },
    delay,
  );
}

/** A band of reflected light sliding across a hull, in `tint` (six-digit hex). */
export function hullSheen(who: number, tint: string, life = 0.5, strength = 0.8) {
  void hullFx(who, life, (o, w, h, k) => {
    const x = lerp(-0.35, 1.35, easeInOut(k)) * w;
    const g = o.createLinearGradient(x - w * 0.2, 0, x + w * 0.2, h * 0.5);
    g.addColorStop(0, tint + "00");
    g.addColorStop(0.38, tint + "99");
    g.addColorStop(0.5, "#ffffff");
    g.addColorStop(0.62, tint + "99");
    g.addColorStop(1, tint + "00");
    o.globalAlpha = strength * pulse(k, 0.15, 0.3);
    o.fillStyle = g;
    o.fillRect(0, 0, w, h);
  });
}

/** The gun's flash lighting the skin around the muzzle for as long as it fires. */
function muzzleLight(who: number, life: number) {
  const box = spriteEl(who)?.querySelector("img")?.getBoundingClientRect();
  const m = muzzle(who);
  if (!box || !m || box.width < 8) return;
  const fx = (m.x - box.left) / box.width;
  const fy = (m.y - box.top) / box.height;
  void hullFx(who, life, (o, w, h, k) => {
    const r = w * 0.2;
    const g = o.createRadialGradient(fx * w, fy * h, 0, fx * w, fy * h, r);
    g.addColorStop(0, "#fff3d0");
    g.addColorStop(0.3, "#ffb84dcc");
    g.addColorStop(1, "#ff8a3c00");
    o.globalAlpha = (0.55 + 0.45 * Math.random()) * pulse(k, 0.05, 0.3);
    o.fillStyle = g;
    o.fillRect(fx * w - r, fy * h - r, r * 2, r * 2);
  });
}

/** Interference crawling over a hull: flickering bars, clipped to the airframe. */
function hullStatic(who: number, life: number, delay = 0) {
  let frame = -1;
  let bars: number[][] = [];
  void hullFx(
    who,
    life,
    (o, w, h, k) => {
      const f = Math.floor((k * life) / 0.045);
      if (f !== frame) {
        frame = f;
        bars = Array.from({ length: 7 }, () => [Math.random(), Math.random(), rnd(0.2, 0.9), rnd(0.03, 0.09), Math.random()]);
      }
      for (const [fx, fy, fw, fh, bright] of bars) {
        o.globalAlpha = (0.2 + bright * 0.45) * pulse(k, 0.1, 0.4);
        o.fillStyle = bright > 0.7 ? "#ffffff" : "#bfe9ff";
        o.fillRect((1 - fw) * fx * w, fy * h, fw * w, Math.max(1, fh * h));
      }
    },
    "lighter",
    delay,
  );
}

/** Where the last shot at each unit landed, so the impact goes off on the spot the round struck. */
const landed = new Map<number, { p: Pt; at: number }>();

function setLanding(who: number, p: Pt) {
  landed.set(who, { p, at: performance.now() });
}

function landing(who: number, take: boolean): Pt | null {
  const hit = landed.get(who);
  if (!hit) return null;
  if (take) landed.delete(who);
  return performance.now() - hit.at < 500 * Math.max(1, timeScale()) ? hit.p : null;
}

/**
 * A hit turned by armour or a shield: the hull flashes where the round glanced off, and ricochets
 * skip away back along the line of fire. No bubble, no dome: just metal doing its job.
 */
export function deflect(who: number, from: number) {
  if (reduced()) return;
  const p = landing(who, false) ?? hullPoint(who, 0.8);
  const r = spriteEl(who)?.getBoundingClientRect();
  if (!p || !r || !r.width) return;
  const k = blastScale(who);
  const fx = (p.x - r.left) / r.width;
  const fy = (p.y - r.top) / r.height;
  void hullFx(who, 0.26, (o, w, h, t) => {
    const g = o.createRadialGradient(fx * w, fy * h, 0, fx * w, fy * h, w * 0.2);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, "#cfe8ff");
    g.addColorStop(1, "#cfe8ff00");
    o.globalAlpha = (1 - t) ** 1.3;
    o.fillStyle = g;
    o.fillRect(0, 0, w, h);
  });
  const a = center(from);
  const back = a ? Math.atan2(a.y - p.y, a.x - p.x) : Math.PI / 2;
  sparks(p.x, p.y, { count: 7, color: "#fff1d0", speed: 300 * k + 80, life: 0.28, size: 1.4, dir: back, spread: 1.1, g: 220 });
  flash(p.x, p.y, 9 * k + 3, "#ffffff", 0.08);
}

/* ------------------------------------------------------- weapon stations */

/** Puts fresh rounds on a jet's empty pylons where it stands, and returns the stations it refilled. */
export function rearmJet(who: number): HTMLElement[] {
  rearm(who);
  const empty = stations(who).filter((el) => el.classList.contains("spent"));
  empty.forEach((el, i) => {
    el.style.setProperty("--i", String(i));
    el.classList.remove("spent");
    el.classList.add("fresh");
  });
  return empty;
}

interface Hang {
  /** The middle of the weapon on screen. */
  p: Pt;
  /** Which way it points, tail to nose, as a unit vector. */
  dir: Pt;
  /** Its length on screen, nose to tail. */
  len: number;
}

interface Launch extends Hang {
  shape: StoreShape;
  bay: boolean;
  /** -1 for the left wing, 1 for the right. */
  side: number;
  /** Where the station is on screen now: read again each frame, so a weapon leaves a jet that is moving from where its pylon has got to. */
  now: () => Hang;
}

const spotOf = (el: Element): Pt => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/** Where the weapon on a station is on screen, and how it lies: from its nose and tail markers, or from the station's box. */
function hang(el: Element, bay: boolean): Hang {
  const nose = el.querySelector(".sn");
  const tail = el.querySelector(".st");
  if (nose && tail) {
    const a = spotOf(tail);
    const b = spotOf(nose);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { p: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dir: { x: (b.x - a.x) / len, y: (b.y - a.y) / len }, len };
  }
  const r = el.getBoundingClientRect();
  return { p: { x: r.left + r.width / 2, y: r.top + r.height * (bay ? 0.25 : 0.62) }, dir: { x: 0, y: -1 }, len: r.width * (bay ? 0.8 : 0.9) };
}

/**
 * Takes the next weapon of the wanted kinds off a jet: its pylon is left empty, or its bay door
 * opens. The launch is given the exact place and heading of the weapon that was hanging there.
 */
function release(who: number, want: StoreKind[]): Launch | null {
  const all = stations(who);
  const index = takeStation(
    who,
    all.map((el) => el.dataset.kind as StoreKind),
    want,
  );
  const el = all[index];
  const mid = center(who);
  const fallback: StoreShape = want.includes("agm") ? "agm" : "aim120";
  if (!el) {
    // Nothing left on the wings: it comes from the gun's place on the jet, which is still on the airframe.
    const at = (): Hang | null => {
      const p = muzzle(who);
      return p ? { p, dir: { x: 0, y: -1 }, len: 34 * depth(who) } : null;
    };
    const first = at();
    return first ? { ...first, shape: fallback, bay: false, side: Math.random() < 0.5 ? -1 : 1, now: () => at() ?? first } : null;
  }
  const kind = el.dataset.kind as StoreKind;
  const bay = kind === "bay";
  if (bay) {
    el.classList.add("open");
    later(720, () => el.classList.remove("open"));
  } else if (kind !== "pod") el.classList.add("spent");
  el.classList.remove("fresh");
  const first = hang(el, bay);
  const shape = bay ? fallback : el.querySelector(".sn") ? ((el.dataset.shape as StoreShape) ?? storeShape(kind)) : storeShape(kind);
  // A re-render replaces the station's element: the launch then keeps the last place it read.
  let last = first;
  const now = () => (el.isConnected ? (last = hang(el, bay)) : last);
  return { ...first, shape, bay, side: mid && first.p.x < mid.x ? -1 : 1, now };
}

/* ----------------------------------------------------------------- casts */

const POSES: Record<Maneuver, (dir: number, w: number) => Keyframe[]> = {
  roll: (d) => [{ rotate: "0deg" }, { rotate: `${d * 360}deg` }],
  jink: (d, w) => [
    { transform: "none" },
    { transform: `translate(${d * w * 0.3}px, -8px) rotate(${d * 30}deg)`, offset: 0.35 },
    { transform: `translate(${d * w * 0.06}px, 0) rotate(${d * -6}deg)`, offset: 0.8 },
    { transform: "none" },
  ],
  loop: (_d, w) => [
    { transform: "none" },
    { transform: `translate(0, ${-w * 0.16}px) scale(0.8) rotate(-6deg)`, offset: 0.4 },
    { transform: `translate(0, ${-w * 0.05}px) scale(0.92) rotate(5deg)`, offset: 0.75 },
    { transform: "none" },
  ],
  dip: (_d, w) => [
    { transform: "none" },
    { transform: `translate(0, ${w * 0.07}px) scale(1.05) rotate(-3deg)`, offset: 0.4 },
    { transform: `translate(0, ${w * 0.03}px) rotate(2deg)`, offset: 0.75 },
    { transform: "none" },
  ],
  wiggle: () => [{ rotate: "0deg" }, { rotate: "14deg", offset: 0.25 }, { rotate: "-12deg", offset: 0.6 }, { rotate: "0deg" }],
  bank: (d, w) => [
    { transform: "none" },
    { transform: `translate(${d * w * 0.08}px, 0) rotate(${d * 24}deg)`, offset: 0.35 },
    { transform: `translate(${d * w * 0.08}px, 0) rotate(${d * 24}deg)`, offset: 0.65 },
    { transform: "none" },
  ],
  shudder: () => [],
};

/** Vapour streaming off the wingtips while the jet pulls. */
function tipVapour(who: number, ms: number) {
  const k = Math.max(0.5, depth(who));
  let since = 1;
  void tick(ms / 1000, (dt, t) => {
    since += dt;
    if (since < 0.022 || t < 0.08 || t > 0.9) return;
    since = 0;
    for (const p of marks(who, "tip")) smoke(p.x, p.y, 7 * k, "#ffffff", 0.42, { alpha: 0.3, vx: 0, vy: 26 * k, grow: 16 * k });
  });
}

/** The points a jamming signal leaves from: the pods, or the radome on a jet that carries none. */
function emitters(who: number): Pt[] {
  const pods = marks(who, "pod");
  if (pods.length) return pods;
  const nose = mark(who, "nose") ?? muzzle(who);
  return nose ? [nose] : [];
}

/**
 * A faint ripple in the air towards `b`: the only sign of a jamming signal on its way. It leaves
 * emitter number `index` on `who`, read each frame, so it stays on a jet that is moving.
 */
function shimmer(who: number, index: number, aimAt: (o: Pt) => Pt, life: number, delay: number, waves: number) {
  void addEffect({
    life,
    delay,
    draw: (c, k) => {
      const from = emitters(who);
      const o = from[index % Math.max(1, from.length)];
      if (!o) return;
      const b = aimAt(o);
      const dir = Math.atan2(b.y - o.y, b.x - o.x);
      const dist = Math.hypot(b.x - o.x, b.y - o.y);
      c.globalCompositeOperation = "lighter";
      c.lineWidth = 1.1;
      for (let j = 0; j < waves; j++) {
        const t = k * 1.3 - j * 0.11;
        if (t <= 0.02 || t >= 1) continue;
        c.globalAlpha = 0.3 * Math.sin(Math.PI * t);
        c.strokeStyle = j % 2 ? "#d8c8ff" : "#bfe9ff";
        c.beginPath();
        c.arc(o.x, o.y, dist * t, dir - 0.15, dir + 0.15);
        c.stroke();
      }
    },
  });
}

const STEPS: { [K in Step["fx"]]: (s: StepOf<K>, ctx: CastCtx) => void } = {
  flares(s) {
    const k = Math.max(0.6, depth(PLAYER));
    const mid = center(PLAYER);
    if (!mid) return;
    const list = Array.from({ length: s.count }, (_, i) => ({
      port: i,
      delay: s.salvo ? Math.floor(i / 2) * 0.04 : i * 0.085,
      x: 0,
      y: 0,
      vx: rnd(150, 300) * k,
      vy: rnd(30, 120) * k,
      age: 0,
      life: rnd(0.85, 1.2),
      size: rnd(5.5, 8) * k,
      lit: false,
    }));
    const longest = Math.max(...list.map((f) => f.delay + f.life));
    void tick(longest, (dt, _k, age, c) => {
      for (const f of list) {
        if (age < f.delay) continue;
        // The frame a flare is lit is spent at the dispenser, however long that frame took.
        const fresh = !f.lit;
        if (fresh) {
          // Each flare leaves the dispenser where the jet is at that moment.
          const ports = marks(PLAYER, "flare");
          const p = ports.length ? ports[f.port % ports.length] : anchor(PLAYER, f.port % 2 ? 0.6 : 0.4, 0.85);
          if (!p) continue;
          f.x = p.x;
          f.y = p.y;
          f.vx *= p.x < mid.x ? -1 : 1;
          f.lit = true;
          flash(p.x, p.y, 7 * k, "#fff1c4", 0.06);
        } else {
          f.age += dt;
          if (f.age >= f.life) continue;
          f.vy += 430 * k * dt;
          f.vx *= 0.3 ** dt;
          f.x += f.vx * dt;
          f.y += f.vy * dt;
        }
        const t = f.age / f.life;
        // It falls behind towards the camera, so it swells as it burns out.
        const r = f.size * (1 + t * 1.5) * rnd(0.85, 1.15);
        c.globalCompositeOperation = "lighter";
        c.globalAlpha = (1 - t) ** 0.7;
        c.drawImage(fxSprite("glow", "#ffe2a0"), f.x - r * 2.4, f.y - r * 2.4, r * 4.8, r * 4.8);
        c.drawImage(fxSprite("glow", "#ffffff"), f.x - r, f.y - r, r * 2, r * 2);
        if (Math.random() < 0.75) smoke(f.x, f.y, r * 1.2, "#efe9df", 0.7, { alpha: 0.26, vx: 0, vy: -8, grow: r * 2.2 });
        if (Math.random() < 0.22) emit({ kind: "spark", x: f.x, y: f.y, vx: rnd(-50, 50), vy: rnd(20, 120), g: 300, life: 0.3, size: 1.2, color: "#ffe2a0" });
      }
    });
  },

  chaff(s) {
    const k = Math.max(0.6, depth(PLAYER));
    for (let b = 0; b < s.bursts; b++) {
      later(b * 120, () => {
        const p = mark(PLAYER, "chaff") ?? anchor(PLAYER, 0.5, 0.9);
        if (!p) return;
        const side = b % 2 ? 1 : -1;
        const n = Math.round(30 * s.size);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU;
          const v = rnd(30, 190) * k * s.size;
          // Strips of foil tumbling in the airflow: each one glints as it turns.
          emit({ kind: "dot", x: p.x, y: p.y, vx: Math.cos(a) * v + side * 40 * k, vy: Math.sin(a) * v * 0.7 + 90 * k, g: 40, drag: 0.06, life: rnd(0.7, 1.5), size: rnd(1, 2.2), color: i % 3 ? "#eaf4ff" : "#ffffff", flicker: 0.92 });
        }
        for (let i = 0; i < 3; i++) smoke(p.x + rnd(-8, 8) * k, p.y + rnd(0, 10) * k, 22 * k * s.size, "#dfe6ee", 1, { alpha: 0.16, vx: side * 20 * k, vy: 60 * k, grow: 60 * k * s.size });
      });
    }
  },

  jam(s, ctx) {
    const count = emitters(PLAYER).length;
    if (!count) return;
    if (s.on === "self") {
      // Barrage jamming: the pods radiate out to both sides.
      for (let i = 0; i < count; i++) {
        shimmer(
          PLAYER,
          i,
          (o) => {
            const mid = center(PLAYER);
            return { x: o.x + (mid && o.x < mid.x ? -1 : 1) * 190, y: o.y - 150 };
          },
          0.6,
          0,
          s.power + 1,
        );
      }
      return;
    }
    for (const who of targetsOf(s.on, ctx)) {
      const b = center(who);
      if (!b) continue;
      for (let i = 0; i < count; i++) shimmer(PLAYER, i, () => b, 0.55, i * 0.05, s.power + 1);
      hullStatic(who, 0.22 + s.power * 0.08, 0.3);
    }
  },

  armor(s) {
    const k = Math.max(0.6, depth(PLAYER));
    hullSheen(PLAYER, s.tint, 0.58, 0.85);
    for (let i = 0; i < s.rivets; i++) {
      later(120 + i * 38, () => {
        const p = hullPoint(PLAYER, 1.5);
        if (!p) return;
        emit({ kind: "glow", x: p.x, y: p.y, size: 4.5 * k, color: s.tint, life: 0.24, flicker: 0.3 });
        emit({ kind: "dot", x: p.x, y: p.y, size: 2, color: "#ffffff", life: 0.2 });
      });
    }
  },

  pose(s) {
    if (s.move === "shudder") {
      shudder(PLAYER, s.ms, 4);
      return;
    }
    const w = rectOf(PLAYER)?.width ?? 300;
    const dir = s.dir ?? (Math.random() < 0.5 ? -1 : 1);
    pose(PLAYER, POSES[s.move](dir, w), s.ms, s.move === "roll" ? "cubic-bezier(.45,.05,.35,1)" : "cubic-bezier(.3,.7,.3,1)");
    if (s.move !== "dip") tipVapour(PLAYER, s.ms);
  },

  burner(s) {
    const lit = s.power >= 1;
    const k = Math.max(0.6, depth(PLAYER));
    const to = { scale: String(lit ? 1 + 0.4 * s.power : s.power), opacity: lit ? 1 : 0.55 };
    for (const g of artEl(PLAYER)?.querySelectorAll<HTMLElement>(".cj-glow") ?? []) {
      g.animate([{ scale: "1", opacity: 1 }, { ...to, offset: 0.25 }, { ...to, offset: 0.75 }, { scale: "1", opacity: 1 }], { duration: s.ms * timeScale(), easing: "ease-in-out" });
    }
    if (!lit) return;
    pose(PLAYER, [{ transform: "none" }, { transform: "translate(0, -2.5%) scale(0.97)", offset: 0.4 }, { transform: "none" }], s.ms, "ease-in-out");
    void tick(s.ms / 1000, (_dt, t, _age, c) => {
      c.globalCompositeOperation = "lighter";
      for (const p of nozzles(PLAYER)) {
        // The plume points at the camera, so it reads as a hot disc that swells and a wash of heat.
        const r = (14 + 12 * s.power) * k * pulse(t, 0.2, 0.3) * rnd(0.9, 1.1);
        c.globalAlpha = 0.75 * pulse(t, 0.2, 0.3);
        c.drawImage(fxSprite("glow", "#ffb060"), p.x - r, p.y - r * 0.8, r * 2, r * 2.5);
        if (Math.random() < 0.45) smoke(p.x, p.y + r * 0.4, 9 * k, "#ffd9b8", 0.4, { alpha: 0.1, vx: rnd(-10, 10), vy: 130 * k, grow: 46 * k });
      }
    });
  },

  vent(s) {
    const k = Math.max(0.6, depth(PLAYER));
    const p = mark(PLAYER, "chaff") ?? anchor(PLAYER, 0.5, 0.9);
    if (!p) return;
    for (let i = 0; i < s.puffs; i++) smoke(p.x + rnd(-14, 14) * k, p.y + rnd(-4, 6) * k, 13 * k, s.tint, 0.85, { alpha: 0.3, vx: rnd(-18, 18), vy: rnd(50, 100) * k, grow: 44 * k, delay: i * 0.045 });
  },

  dim(s) {
    void hullFx(
      PLAYER,
      s.ms / 1000,
      (o, w, h, k) => {
        o.globalAlpha = 0.62 * pulse(k, 0.25, 0.35);
        o.fillStyle = "#04070d";
        o.fillRect(0, 0, w, h);
      },
      "source-over",
    );
    for (const g of artEl(PLAYER)?.querySelectorAll<HTMLElement>(".cj-glow") ?? []) {
      g.animate([{ opacity: 1 }, { opacity: 0.2, offset: 0.25 }, { opacity: 0.2, offset: 0.7 }, { opacity: 1 }], { duration: s.ms * timeScale(), easing: "ease-in-out" });
    }
  },

  designate(s, ctx) {
    for (const who of targetsOf(s.on, ctx)) {
      void tick(0.72, (_dt, k, _age, c) => {
        const r = rectOf(who);
        if (!r) return;
        const p = midOf(r);
        const h = Math.max(15, Math.min(r.width * 0.36, r.height * 0.9)) * lerp(1.8, 1, easeOut(Math.min(1, k / 0.22)));
        const settling = k > 0.22 && k < 0.5 && Math.floor(k * 22) % 2 === 0;
        c.globalAlpha = 0.9 * pulse(k, 0.08, 0.25) * (settling ? 0.45 : 1);
        c.strokeStyle = s.tint;
        c.lineWidth = 1.5;
        c.beginPath();
        if (s.shape === "diamond") {
          c.moveTo(p.x, p.y - h);
          c.lineTo(p.x + h, p.y);
          c.lineTo(p.x, p.y + h);
          c.lineTo(p.x - h, p.y);
          c.closePath();
        } else {
          const arm = h * (s.shape === "cross" ? 0.5 : 0.42);
          for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            if (s.shape === "box") {
              c.moveTo(p.x + sx * h, p.y + sy * (h - arm));
              c.lineTo(p.x + sx * h, p.y + sy * h);
              c.lineTo(p.x + sx * (h - arm), p.y + sy * h);
            } else {
              // Four ticks closing on the target, like a gun cross.
              const ax = sx === sy ? sx : 0;
              const ay = sx === sy ? 0 : sy;
              c.moveTo(p.x + ax * h, p.y + ay * h);
              c.lineTo(p.x + ax * (h - arm), p.y + ay * (h - arm));
            }
          }
          if (s.shape === "cross") c.rect(p.x - 1, p.y - 1, 2, 2);
        }
        c.stroke();
      });
    }
  },

  scan(s, ctx) {
    for (const who of targetsOf(s.on, ctx)) {
      void tick(0.34 * s.sweeps, (_dt, k, _age, c) => {
        const r = rectOf(who);
        if (!r) return;
        const t = (k * s.sweeps) % 1;
        const x = r.left + r.width * (-0.12 + 1.24 * t);
        c.globalCompositeOperation = "lighter";
        c.globalAlpha = 0.55 * Math.sin(Math.PI * t);
        c.strokeStyle = "#7dffb0";
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(x, r.top - 6);
        c.lineTo(x, r.bottom + 6);
        c.moveTo(x - 4, r.top - 6);
        c.lineTo(x + 4, r.top - 6);
        c.moveTo(x - 4, r.bottom + 6);
        c.lineTo(x + 4, r.bottom + 6);
        c.stroke();
      });
    }
  },

  repair(s) {
    const k = Math.max(0.6, depth(PLAYER));
    const spots = Math.max(1, Math.ceil(s.sparks / 4));
    for (let i = 0; i < spots; i++) {
      later(i * 85, () => {
        const p = hullPoint(PLAYER, 1.3);
        if (!p) return;
        glow(p.x, p.y, 9 * k, s.tint, 0.14);
        sparks(p.x, p.y, { count: 4, color: "#ffd9a0", speed: 170 * k, life: 0.4, size: 1.3, dir: Math.PI / 2, spread: 1.3, g: 520 });
      });
    }
  },

  reload(s) {
    const refilled = rearmJet(PLAYER);
    if (reduced()) return;
    const k = Math.max(0.6, depth(PLAYER));
    const shown = (refilled.length ? refilled : stations(PLAYER)).slice(0, s.glint);
    shown.forEach((el, i) => {
      later(160 + i * 45, () => {
        const r = el.getBoundingClientRect();
        emit({ kind: "glow", x: r.left + r.width / 2, y: r.top + r.height * 0.6, size: 6 * k, color: "#ffffff", life: 0.2 });
      });
    });
  },

  strobe(s) {
    const k = Math.max(0.6, depth(PLAYER));
    for (let i = 0; i < s.blinks; i++) {
      later(i * 190, () => {
        const tips = marks(PLAYER, "tip");
        const mid = center(PLAYER);
        // Port is red, starboard green; the white strobe is on the tail.
        for (const p of tips) glow(p.x, p.y, 10 * k, mid && p.x < mid.x ? "#ff4a4a" : "#5aff8a", 0.16);
        const tail = mark(PLAYER, "chaff");
        if (tail && i === s.blinks - 1) later(90, () => glow(tail.x, tail.y, 12 * k, "#ffffff", 0.1));
      });
    }
  },

  spinup(s) {
    const k = Math.max(0.6, depth(PLAYER));
    let since = 1;
    void tick(s.ms / 1000, (dt) => {
      since += dt;
      if (since < 0.03) return;
      since = 0;
      const p = muzzle(PLAYER);
      if (p) smoke(p.x, p.y, 6 * k, "#d5d9de", 0.4, { alpha: 0.2, vx: rnd(-20, 20), vy: rnd(10, 40) * k, grow: 22 * k });
    });
  },

  crack(s) {
    const k = Math.max(0.6, depth(PLAYER));
    const p = hullPoint(PLAYER, 1.2);
    shudder(PLAYER, 320, 4);
    if (!p) return;
    flash(p.x, p.y, 10 * k, "#fff1d0", 0.08);
    shards(p.x, p.y, s.pieces, "#59626e", 220 * k, 6 * k);
    sparks(p.x, p.y, { count: 6, color: "#ffd9a0", speed: 220 * k, life: 0.3, size: 1.4 });
    for (let i = 0; i < 3; i++) smoke(p.x, p.y, 14 * k, "#3a3d44", 0.8, { alpha: 0.45, vy: 50 * k, grow: 36 * k, delay: i * 0.06 });
  },
};

/** Every cast animation the runtime can draw, for the test that checks the recipes against it. */
export const STEP_KINDS = Object.keys(STEPS) as Step["fx"][];

/**
 * Plays a card's cast on the player's jet and resolves once its events should start. With reduced
 * motion the cast is skipped; its sounds still play, and pylons are still rearmed.
 */
export async function castCard(id: string, target: number | null): Promise<void> {
  const anim = cardAnim(id);
  const ctx: CastCtx = { target };
  for (const step of anim.cast) {
    later(step.at ?? 0, () => {
      if (step.sfx) sfx(step.sfx);
      if (!reduced() || step.fx === "reload") (STEPS[step.fx] as (s: Step, ctx: CastCtx) => void)(step, ctx);
    });
  }
  await wait(reduced() ? Math.min(anim.lead, 90) : Math.min(anim.lead, MAX_LEAD));
}

/* ----------------------------------------------------------------- shots */

interface Aim {
  from: number;
  to: number;
  index: number;
  /** The target's centre when the shot was fired. */
  b: Pt;
  /** How near the camera the shooter and the target are. */
  ka: number;
  kb: number;
  /** The shot is dodged: it goes past instead of landing. */
  miss: boolean;
}

const SMOKE = {
  white: { color: "#f2f4f7", size: 3.4, life: 1.35, alpha: 0.8 },
  grey: { color: "#c3c9d2", size: 4.2, life: 1.6, alpha: 0.75 },
  thin: { color: "#e6ebf1", size: 1.9, life: 0.6, alpha: 0.45 },
};

/** A missile or bomb seen from dead astern: its tail fins in an X, and the motor's glare if it is burning. */
function sternView(c: Ctx2, x: number, y: number, r: number, lit: number, body = "#e3e8ee") {
  c.globalCompositeOperation = "source-over";
  c.lineCap = "round";
  const f = r * 1.75;
  c.beginPath();
  c.moveTo(x - f, y - f);
  c.lineTo(x + f, y + f);
  c.moveTo(x + f, y - f);
  c.lineTo(x - f, y + f);
  c.strokeStyle = INK;
  c.lineWidth = Math.max(1, r * 0.6);
  c.stroke();
  c.strokeStyle = "#aab6c6";
  c.lineWidth = Math.max(0.5, r * 0.24);
  c.stroke();
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fillStyle = body;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = Math.max(0.7, r * 0.28);
  c.stroke();
  c.beginPath();
  c.arc(x, y, r * 0.45, 0, TAU);
  c.fillStyle = "#161a21";
  c.fill();
  if (lit <= 0) return;
  const alpha = c.globalAlpha;
  c.globalCompositeOperation = "lighter";
  c.globalAlpha = alpha * lit;
  const g = r * rnd(4.2, 5.4) + 3;
  c.drawImage(fxSprite("glow", FIRE), x - g, y - g, g * 2, g * 2);
  const w = r * 1.8 + 1.5;
  c.drawImage(fxSprite("glow", "#ffffff"), x - w, y - w, w * 2, w * 2);
  c.globalAlpha = alpha;
}

const storeImages = new Map<StoreShape, HTMLImageElement>();

/** The drawing of a store as an image for the canvas, once it has decoded. */
function storeSprite(shape: StoreShape): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  let img = storeImages.get(shape);
  if (!img) {
    img = new Image();
    img.src = `data:image/svg+xml,${encodeURIComponent(storeImage(shape))}`;
    storeImages.set(shape, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

if (typeof Image !== "undefined") for (const shape of Object.keys(SHAPES) as StoreShape[]) storeSprite(shape);

/**
 * A weapon in flight, drawn with the very picture that hung on the pylon: centred on `p`, pointing
 * along `dir`, `len` long on screen. `lit` is how hard its motor is burning.
 */
function drawWeapon(c: Ctx2, shape: StoreShape, p: Pt, dir: Pt, len: number, lit: number) {
  const s = SHAPES[shape];
  const box = (len * 100) / s.len;
  const tail = { x: p.x - (dir.x * len) / 2, y: p.y - (dir.y * len) / 2 };
  const r = (s.r * box) / 100;
  const img = storeSprite(shape);
  if (img && box >= 9) {
    c.save();
    c.globalCompositeOperation = "source-over";
    c.translate(p.x, p.y);
    c.rotate(Math.atan2(dir.y, dir.x) + Math.PI / 2);
    const side = (box * IMAGE_UNITS) / 100;
    c.drawImage(img, -side / 2, -side / 2, side, side);
    c.restore();
  } else sternView(c, tail.x, tail.y, Math.max(0.8, r), 0);
  if (lit <= 0) return;
  const alpha = c.globalAlpha;
  c.globalCompositeOperation = "lighter";
  c.globalAlpha = alpha * Math.min(1, lit);
  const g = r * rnd(3.4, 4.4) + 3;
  c.drawImage(fxSprite("glow", FIRE), tail.x - g, tail.y - g, g * 2, g * 2);
  const w = r * 1.6 + 1.5;
  c.drawImage(fxSprite("glow", "#ffffff"), tail.x - w, tail.y - w, w * 2, w * 2);
  c.globalAlpha = alpha;
}

function bezier(a: Pt, c1: Pt, c2: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
  };
}

/** How long the flash stays on the muzzle after the last round of a burst has left, in seconds. */
const FLASH_TAIL = 0.11;

/**
 * The gun firing: a star of flame on the muzzle, stabbing towards the target for as long as the
 * burst lasts. It is drawn where the gun port is on screen in each frame, so it stays on a jet that
 * is swaying or flying a pass, and it is there in the very frame the first round leaves.
 */
function muzzleFire(who: number, toward: Pt, k: number, cal: number, life: number) {
  let beat = -1;
  let s = 0;
  let turn = 0;
  void addEffect({
    life,
    draw: (c, _t, age) => {
      const m = muzzle(who);
      if (!m) return;
      // A fresh shape every few hundredths of a second: the flash flickers with the rounds rather than glowing.
      const now = Math.floor(age / 0.032);
      if (now !== beat) {
        beat = now;
        s = (13 + 8 * cal) * k * rnd(0.75, 1.25);
        turn = rnd(-0.1, 0.1);
      }
      c.globalCompositeOperation = "lighter";
      c.globalAlpha = age > life - FLASH_TAIL ? Math.max(0, (life - age) / FLASH_TAIL) : 1;
      c.translate(m.x, m.y);
      c.rotate(Math.atan2(toward.y - m.y, toward.x - m.x) + turn);
      const lit = c.globalAlpha;
      const halo = s * 2;
      c.globalAlpha = lit * 0.6;
      c.drawImage(fxSprite("glow", "#ffb347"), -halo, -halo, halo * 2, halo * 2);
      c.globalAlpha = lit;
      const g = c.createLinearGradient(0, 0, s * 3.2, 0);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.35, "#ffd27a");
      g.addColorStop(1, "#ff7a2a00");
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-s * 0.2, 0);
      c.quadraticCurveTo(s * 0.5, -s * 0.62, s * 3.2, 0);
      c.quadraticCurveTo(s * 0.5, s * 0.62, -s * 0.2, 0);
      c.fill();
      // The gases that escape sideways at the muzzle make the flash a star.
      c.fillStyle = "#ffe2a6";
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(-s * 0.16, 0);
        c.lineTo(s * 0.1, side * s * 1.25);
        c.lineTo(s * 0.34, 0);
        c.fill();
      }
      c.beginPath();
      c.arc(0, 0, s * 0.42, 0, TAU);
      c.fillStyle = "#ffffff";
      c.fill();
    },
  });
}

/** What one round leaves at the muzzle as it goes: a pop of light and a wisp of smoke swept back. */
function muzzlePuff(a: Pt, k: number, cal: number, round: number) {
  const s = (12 + 8 * cal) * k * rnd(0.8, 1.2);
  flash(a.x, a.y, s * 1.1, "#ffd27a", 0.09);
  if (round % 2 === 0) smoke(a.x, a.y, (6 + 5 * cal) * k, "#d5d9de", 0.45 + 0.2 * cal, { alpha: 0.12 + 0.1 * cal, vx: rnd(-14, 14), vy: rnd(14, 44) * k, grow: (16 + 12 * cal) * k });
}

/** One round striking metal. */
function roundHit(p: Pt, k: number, cal: number) {
  flash(p.x, p.y, (5 + 3 * cal) * k + 2, "#fff1d0", 0.07);
  sparks(p.x, p.y, { count: 3 + Math.round(cal * 2), color: "#ffd9a0", speed: 220 * k + 70, life: 0.22, size: 1.1 + 0.3 * cal, dir: Math.PI / 2, spread: 1.5, g: 320 });
  if (Math.random() < 0.35 * cal) smoke(p.x, p.y, (7 + 4 * cal) * k, "#8a9099", 0.45, { alpha: 0.3 });
}

/** A small warhead or bomblet going off. */
function pop(p: Pt, k: number) {
  flash(p.x, p.y, 15 * k + 4, FIRE, 0.1);
  sparks(p.x, p.y, { count: 6, color: "#ffd9a0", speed: 240 * k + 60, life: 0.28, size: 1.3 });
  glow(p.x, p.y, 9 * k + 2, FLAME, 0.22, 30 * k);
  smoke(p.x, p.y, 16 * k + 4, "#4a4e56", 0.6, { alpha: 0.4 });
}

/** The shooter presses in close behind its target for a gun pass, then drops back. */
function closeIn(from: number, to: number, ms: number) {
  const a = center(from);
  const b = center(to);
  if (!a || !b) return;
  const move = `translate(${((b.x - a.x) * 0.3).toFixed(0)}px, ${((b.y - a.y) * 0.34).toFixed(0)}px) scale(0.8)`;
  pose(from, [{ transform: "none" }, { transform: move, offset: 0.3 }, { transform: move, offset: 0.68 }, { transform: "none" }], ms, "ease-in-out");
}

const SHOTS: { [K in Shot["fx"]]: (s: ShotOf<K>, aim: Aim) => Promise<void> } = {
  gun(s, aim) {
    const { from, to, ka, kb } = aim;
    const cal = s.caliber;
    const flight = s.ms / 1000;
    const rect = spriteEl(to)?.getBoundingClientRect();
    const burst = (s.rounds - 1) * s.gap;
    if (aim.index === 0) {
      muzzleLight(from, (burst + 140) / 1000);
      if (s.pass) closeIn(from, to, burst + s.ms + 320);
      else if (cal > 1.3) shudder(from, burst + 140, 2.5);
    }
    muzzleFire(from, hullPoint(to, 0) ?? aim.b, ka, cal, burst / 1000 + FLASH_TAIL);
    let struck: Pt | null = null;
    for (let i = 0; i < s.rounds; i++) {
      const t = s.rounds > 1 ? i / (s.rounds - 1) - 0.5 : 0;
      const hull = hullPoint(to, 0.8) ?? aim.b;
      const land = { x: hull.x + t * (s.walk ?? 0) * kb + rnd(-1, 1) * s.spread * kb * 0.4, y: hull.y + rnd(-1, 1) * s.spread * kb * 0.25 };
      // Not every round connects: some go wide and carry on past the target.
      const wide = aim.miss || Math.random() < (s.spread > 20 ? 0.45 : 0.14);
      if (wide && rect) {
        land.x += (Math.random() < 0.5 ? -1 : 1) * rect.width * rnd(0.45, 0.8);
        land.y -= rect.height * rnd(0.3, 1);
      } else struck = land;
      const far = wide ? kb * 0.55 : kb;
      let a: Pt | null = null;
      let drawn = 0;
      void addEffect({
        life: flight * (wide ? 1.25 : 1),
        delay: (i * s.gap) / 1000,
        draw: (c, k) => {
          if (!a) {
            // Read the muzzle as the round leaves, so a jet that is moving still fires from its gun.
            a = muzzle(from);
            if (!a) return;
            muzzlePuff(a, ka, cal, i);
          }
          // A round flying away from the camera closes on its vanishing point: fast at first, then slower.
          const e = 1 - (1 - k) ** 1.45;
          // Its first frame shows it just clear of the barrel, with its tail still in the gun.
          const clear = Math.min(0.2, (16 * ka + 8) / (Math.hypot(land.x - a.x, land.y - a.y) || 1));
          const head = Math.max(e, clear);
          // The streak covers all the ground the round crossed since the last frame. At a full frame
          // rate that is a short dash; when frames drop it is a line back to where it was last seen,
          // so tracer always reads as coming from the gun and never appears in mid-air.
          const tail = Math.min(drawn, Math.max(0, head - 0.14 * (1 - head * 0.6)));
          drawn = head;
          const sc = lerp(ka, far, head);
          const hx = lerp(a.x, land.x, head);
          const hy = lerp(a.y, land.y, head);
          c.globalCompositeOperation = "lighter";
          c.lineCap = "round";
          c.globalAlpha = wide ? 1 - k * k : 1;
          c.strokeStyle = TRACER;
          c.lineWidth = 2.2 * cal * sc + 0.8;
          c.beginPath();
          c.moveTo(lerp(a.x, land.x, tail), lerp(a.y, land.y, tail));
          c.lineTo(hx, hy);
          c.stroke();
          c.strokeStyle = "#fff3d6";
          c.lineWidth = cal * sc + 0.4;
          c.beginPath();
          c.moveTo(lerp(a.x, land.x, (tail + head) / 2), lerp(a.y, land.y, (tail + head) / 2));
          c.lineTo(hx, hy);
          c.stroke();
          const g = 5 * cal * sc + 2;
          c.drawImage(fxSprite("glow", TRACER), hx - g, hy - g, g * 2, g * 2);
        },
        done: () => {
          if (!wide) roundHit(land, kb, cal);
        },
      });
    }
    if (struck) setLanding(to, struck);
    return wait(s.ms + burst * 0.55);
  },

  async missile(s, aim) {
    const { from, to, ka, kb } = aim;
    const store = release(from, s.store === "agm" ? ["agm", "bay"] : ["aam", "bay"]);
    if (!store) return wait(s.ms);
    const trail = SMOKE[s.smoke];
    const { shape, len } = store;
    const body = (SHAPES[shape].r / SHAPES[shape].len) * len;
    let p0 = store.p;
    let dir0 = store.dir;
    if (store.bay) {
      // A bay throws its weapon clear of the jet before the motor lights.
      await wait(130);
      const fall = len * 0.9;
      await tick(0.15 * (from === PLAYER ? 1 : 0.8), (_dt, k, _age, c) => {
        p0 = store.now().p;
        drawWeapon(c, shape, { x: p0.x, y: p0.y + fall * k * k }, dir0, len, 0);
      });
      p0 = { x: p0.x, y: p0.y + fall };
    }
    const tailOf = (p: Pt, dir: Pt, l: number): Pt => ({ x: p.x - (dir.x * l) / 2, y: p.y - (dir.y * l) / 2 });
    /** Seconds the motor burns on the rail before the missile moves. */
    const rail = store.bay ? 0 : 0.06;
    const flight = (s.ms / 1000) * (aim.miss ? 1.2 : 1);
    const far = (kb / ka) * (aim.miss ? 0.5 : 1);
    let land: Pt = aim.b;
    let path: { c1: Pt; c2: Pt } | null = null;
    let lit = false;
    let prev = 0;
    let last: Pt = p0;
    let heading = dir0;
    await addEffect({
      life: rail + flight,
      draw: (c, _k, age) => {
        if (age < rail || !lit) {
          // On the rail it is still part of the jet: it is drawn where the pylon is in this frame.
          if (!store.bay) ({ p: p0, dir: dir0 } = store.now());
          heading = dir0;
        }
        if (!lit) {
          lit = true;
          // The motor lights where the missile hangs: a flare at its tail and smoke blown back past the wing.
          const t0 = tailOf(p0, dir0, len);
          last = t0;
          flash(t0.x, t0.y, body * 4.5 * s.size, FIRE, 0.14);
          for (let i = 0; i < 5; i++) smoke(t0.x, t0.y, body * trail.size * 1.3, trail.color, trail.life, { alpha: trail.alpha, vx: -dir0.x * rnd(20, 70) * ka + rnd(-14, 14), vy: -dir0.y * rnd(20, 70) * ka + rnd(10, 40) * ka, grow: body * trail.size * 3.2 });
        }
        if (age < rail) {
          drawWeapon(c, shape, p0, dir0, len, (age / rail) * s.size ** 0.5);
          return;
        }
        if (!path) {
          const rect = spriteEl(to)?.getBoundingClientRect();
          const hull = hullPoint(to, 0.6) ?? aim.b;
          // A dodged missile loses its lock and sails by wide of the target.
          land = aim.miss && rect ? { x: hull.x + store.side * rect.width * 0.75, y: hull.y - rect.height * 1.3 } : hull;
          // It runs straight off the rail the way it was pointing, then the seeker pulls it round onto the target.
          const reach = Math.hypot(land.x - p0.x, land.y - p0.y) * 0.3 + s.loft * ka * 0.4 + len;
          path = { c1: { x: p0.x + dir0.x * reach, y: p0.y + dir0.y * reach }, c2: { x: land.x + store.side * (16 + s.loft * 0.4) * kb * 2, y: land.y + (36 - s.loft * 0.3) * kb } };
        }
        const { c1, c2 } = path;
        const k = Math.min(1, (age - rail) / flight);
        const e = (k ** 1.7 * (1 - 0.25 * k)) / 0.75;
        // Seen from behind it shrinks as it goes, and shortens as it turns end-on to the camera.
        const lenAt = (t: number) => len * lerp(1, far, t) * (1 - 0.3 * t);
        // Smoke is laid along every part of the path crossed since the last frame, so the trail runs unbroken back to the pylon.
        const steps = Math.max(1, Math.ceil((e - prev) / 0.012));
        for (let i = 1; i <= steps; i++) {
          const t = prev + ((e - prev) * i) / steps;
          const q = tailOf(bezier(p0, c1, c2, land, t), heading, lenAt(t));
          const r = body * lerp(1, far, t) * s.size;
          if (Math.hypot(q.x - last.x, q.y - last.y) < r * 1.5) continue;
          last = q;
          smoke(q.x, q.y, r * trail.size, trail.color, trail.life, { alpha: trail.alpha * (aim.miss ? 0.7 : 1), vx: rnd(-4, 4), vy: rnd(2, 12), grow: r * trail.size * 1.5 });
        }
        prev = e;
        const p = bezier(p0, c1, c2, land, e);
        const ahead = bezier(p0, c1, c2, land, Math.min(1, e + 0.02));
        const d = Math.hypot(ahead.x - p.x, ahead.y - p.y);
        if (d > 0.5) heading = { x: (ahead.x - p.x) / d, y: (ahead.y - p.y) / d };
        if (aim.miss) c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        drawWeapon(c, shape, p, heading, lenAt(e), (0.7 + Math.min(1, k * 6) * 0.5) * s.size ** 0.5);
      },
    });
    if (!aim.miss) setLanding(to, land);
  },

  rocket(s, aim) {
    const { from, to, ka, kb } = aim;
    const pods = stations(from).filter((el) => el.dataset.kind === "pod");
    let struck: Pt | null = null;
    for (let i = 0; i < s.count; i++) {
      const hull = hullPoint(to, 1) ?? aim.b;
      const land = { x: hull.x + rnd(-1, 1) * s.spread * kb, y: hull.y + rnd(-1, 1) * s.spread * kb * 0.5 };
      struck = land;
      let a: Pt | null = null;
      let last: Pt | null = null;
      void addEffect({
        life: s.ms / 1000,
        delay: i * 0.07,
        draw: (c, k) => {
          if (!a) {
            // Rockets ripple out of alternate pods.
            const pod = pods[(i + aim.index) % Math.max(1, pods.length)];
            const mouth = pod?.querySelector(".sn");
            a = mouth ? spotOf(mouth) : pod ? spotOf(pod) : muzzle(from);
            if (!a) return;
            flash(a.x, a.y, 9 * ka, FIRE, 0.07);
            smoke(a.x, a.y, 9 * ka, "#d5d9de", 0.5, { alpha: 0.3, vy: 60 * ka, grow: 30 * ka });
          }
          const e = k ** 1.3;
          const p = { x: lerp(a.x, land.x, e), y: lerp(a.y, land.y, e) };
          const r = 2.4 * lerp(ka, kb, e) + 0.6;
          if (!last || Math.hypot(p.x - last.x, p.y - last.y) > r * 2.4) {
            last = p;
            smoke(p.x, p.y, r * 1.6, "#e6ebf1", 0.45, { alpha: 0.34, vx: 0, vy: 4, grow: r * 2.4 });
          }
          c.globalCompositeOperation = "lighter";
          c.drawImage(fxSprite("glow", FIRE), p.x - r * 2.6, p.y - r * 2.6, r * 5.2, r * 5.2);
          c.drawImage(fxSprite("glow", "#ffffff"), p.x - r, p.y - r, r * 2, r * 2);
        },
        done: () => pop(land, kb),
      });
    }
    if (struck) setLanding(to, struck);
    return wait(s.ms + (s.count - 1) * 70 * 0.6);
  },

  async bomb(s, aim) {
    const { from, to, ka, kb } = aim;
    const bay = stations(from).find((el) => el.dataset.kind === "bay");
    let a = mark(from, "belly") ?? muzzle(from);
    if (bay) {
      const r = bay.getBoundingClientRect();
      a = { x: r.left + r.width / 2, y: r.top + r.height * 0.3 };
      bay.classList.add("open");
      later(620, () => bay.classList.remove("open"));
      await wait(90);
      if (bay.isConnected) {
        // The jet has moved on while the doors opened.
        const now = bay.getBoundingClientRect();
        a = { x: now.left + now.width / 2, y: now.top + now.height * 0.3 };
      }
    }
    if (!a) return wait(s.ms);
    const start = a;
    const land = hullPoint(to, 0.5) ?? aim.b;
    const r0 = 4.6 * s.size * ka;
    // It sinks away under the jet first, then its own speed carries it on to the target.
    const sag = { x: lerp(start.x, land.x, 0.3), y: start.y + 60 * ka };
    const split = s.split > 0 ? 0.72 : 1;
    const at = (t: number): Pt => ({ x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * sag.x + t * t * land.x, y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * sag.y + t * t * land.y });
    await addEffect({
      life: (s.ms / 1000) * split,
      draw: (c, k) => {
        const p = at(k * split);
        sternView(c, p.x, p.y, Math.max(0.9, r0 * lerp(1, kb / ka, k * split)), 0, "#5d6a58");
      },
    });
    if (!s.split) {
      setLanding(to, land);
      return;
    }
    // The casing opens short of the target and scatters its bomblets across it.
    const open = at(split);
    flash(open.x, open.y, 10 * kb + 3, "#ffffff", 0.08);
    smoke(open.x, open.y, 12 * kb + 3, "#c9ced6", 0.5, { alpha: 0.35 });
    for (let i = 0; i < s.split; i++) {
      const hull = hullPoint(to, 1.3) ?? land;
      void addEffect({
        life: (s.ms / 1000) * (1 - split) * rnd(0.9, 1.3),
        delay: i * 0.02,
        draw: (c, k) => {
          c.fillStyle = "#2a2f36";
          c.beginPath();
          c.arc(lerp(open.x, hull.x, k), lerp(open.y, hull.y, k) - Math.sin(Math.PI * k) * 8 * kb, 1.4 * kb + 0.6, 0, TAU);
          c.fill();
        },
        done: () => pop(hull, kb * 0.8),
      });
    }
    setLanding(to, land);
    await wait(s.ms * (1 - split));
  },

  ew(s, aim) {
    const b = hullPoint(aim.to, 0.5) ?? aim.b;
    const count = emitters(aim.from).length;
    for (let i = 0; i < s.pulses; i++) for (let n = 0; n < count; n++) shimmer(aim.from, n, () => b, (s.ms / 1000) * 1.2, i * 0.08 + n * 0.03, 3);
    hullStatic(aim.to, 0.3, (s.ms / 1000) * 0.6);
    setLanding(aim.to, b);
    return wait(s.ms);
  },
};

export const SHOT_KINDS = Object.keys(SHOTS) as Shot["fx"][];

/**
 * Fires one hit's worth of a shot from `from`'s own gun or pylons and resolves when it reaches the
 * target. A `miss` is flown the same way but goes wide instead of landing.
 */
export function fireShot(shot: Shot, from: number, to: number, index = 0, miss = false): Promise<void> {
  const b = center(to);
  if (!b) return Promise.resolve();
  if (reduced()) {
    // The pylon still empties, so the loadout stays true to what was fired.
    if (shot.fx === "missile") release(from, shot.store === "agm" ? ["agm", "bay"] : ["aam", "bay"]);
    return wait(70);
  }
  if (index === 0 || shot.sfx !== "brrt") sfx(shot.sfx);
  const aim: Aim = { from, to, index, b, ka: Math.max(0.35, depth(from)), kb: Math.max(0.3, depth(to)), miss };
  return (SHOTS[shot.fx] as (s: Shot, aim: Aim) => Promise<void>)(shot, aim);
}

/* --------------------------------------------------------------- impacts */

const IMPACTS: Record<Impact["fx"], (p: Pt, k: number, color: string, dir: number, who: number) => void> = {
  sparks(p, k, color) {
    flash(p.x, p.y, 14 * k + 4, color, 0.1);
    sparks(p.x, p.y, { count: 8, color, speed: 280 * k + 80, life: 0.3, size: 1.5, dir: Math.PI / 2, spread: 1.6 });
  },
  shells(p, k, color, _dir, who) {
    // Cannon strikes stitched across the skin, each kicking out sparks and a puff of smoke.
    for (let i = 0; i < 3; i++) {
      const q = i ? hullPoint(who, 0.7) ?? p : p;
      later(i * 35, () => {
        flash(q.x, q.y, 12 * k + 3, color, 0.08);
        sparks(q.x, q.y, { count: 6, color, speed: 300 * k + 80, life: 0.3, size: 1.5, dir: Math.PI / 2, spread: 1.4, g: 320 });
        smoke(q.x, q.y, 12 * k + 3, "#80868f", 0.5, { alpha: 0.32 });
      });
    }
    shards(p.x, p.y, 2, "#59626e", 220 * k + 40, 4 * k + 2);
  },
  pierce(p, k, color, dir) {
    // Rounds going clean through: sparks out of the far side along the line of fire.
    flash(p.x, p.y, 14 * k + 4, "#ffffff", 0.08);
    sparks(p.x, p.y, { count: 14, color, speed: 600 * k + 140, life: 0.3, size: 1.8, dir, spread: 0.34, g: 90 });
    sparks(p.x, p.y, { count: 5, color: "#ffffff", speed: 200 * k + 60, life: 0.25, size: 1.3, dir: dir + Math.PI, spread: 1 });
    shards(p.x, p.y, 3, "#59626e", 260 * k + 60, 5 * k + 2);
    for (let i = 0; i < 2; i++) smoke(p.x, p.y, 15 * k + 4, "#6f757e", 0.6, { alpha: 0.4, delay: i * 0.05 });
  },
  blast(p, k, color) {
    flash(p.x, p.y, 38 * k + 8, color, 0.14);
    flash(p.x, p.y, 18 * k + 4, "#ffffff", 0.08);
    sparks(p.x, p.y, { count: 14, color: "#ffd9a0", speed: 380 * k + 80, life: 0.42, size: 1.8 });
    for (let i = 0; i < 4; i++) glow(p.x + rnd(-12, 12) * k, p.y + rnd(-8, 8) * k, 15 * k + 4, i % 2 ? FLAME : color, rnd(0.25, 0.4), 44 * k);
    for (let i = 0; i < 5; i++) smoke(p.x + rnd(-14, 14) * k, p.y + rnd(-10, 10) * k, 30 * k + 6, "#4b4f57", 0.9, { alpha: 0.5, delay: 0.04 + Math.random() * 0.1 });
    shards(p.x, p.y, 3, "#3d434c", 260 * k + 60, 5 * k + 2);
  },
  fireball(p, k, color) {
    flash(p.x, p.y, 58 * k + 10, color, 0.18);
    flash(p.x, p.y, 28 * k + 6, "#ffffff", 0.1);
    sparks(p.x, p.y, { count: 22, color: "#ffd9a0", speed: 460 * k + 100, life: 0.55, size: 2 });
    for (let i = 0; i < 7; i++) glow(p.x + rnd(-22, 22) * k, p.y + rnd(-16, 16) * k, 20 * k + 5, i % 2 ? FLAME : color, rnd(0.3, 0.5), 60 * k);
    for (let i = 0; i < 8; i++) smoke(p.x + rnd(-24, 24) * k, p.y + rnd(-16, 16) * k, 42 * k + 8, "#2f3238", 1.15, { alpha: 0.58, delay: 0.05 + Math.random() * 0.14 });
    shards(p.x, p.y, 7, "#3d434c", 320 * k + 60, 6 * k + 2);
    later(130, () => pop({ x: p.x + rnd(-20, 20) * k, y: p.y + rnd(-12, 12) * k }, k));
  },
  shrapnel(p, k, color, _dir, who) {
    flash(p.x, p.y, 22 * k + 5, color, 0.1);
    sparks(p.x, p.y, { count: 16, color: "#ffd9a0", speed: 480 * k + 100, life: 0.36, size: 1.4, stretch: 0.03 });
    for (let i = 0; i < 4; i++) {
      const q = hullPoint(who, 1.3) ?? p;
      later(40 + i * 45, () => pop(q, k * 0.7));
    }
  },
  short(p, k, color, _dir, who) {
    // Electronics letting go: arcs snapping across the skin, then smoke from inside.
    hullStatic(who, 0.34);
    for (let i = 0; i < 3; i++) {
      const q = i ? hullPoint(who, 1) ?? p : p;
      later(i * 70, () => {
        flash(q.x, q.y, 9 * k + 3, color, 0.07);
        sparks(q.x, q.y, { count: 5, color, speed: 200 * k + 60, life: 0.2, size: 1.2, stretch: 0.02, g: 0 });
        void addEffect({
          life: 0.12,
          draw: (c, t) => {
            c.globalCompositeOperation = "lighter";
            c.globalAlpha = 1 - t;
            c.strokeStyle = "#ffffff";
            c.lineWidth = 1.2;
            c.beginPath();
            c.moveTo(q.x, q.y);
            let x = q.x;
            let y = q.y;
            for (let n = 0; n < 4; n++) {
              x += rnd(-9, 9) * k;
              y += rnd(-7, 7) * k;
              c.lineTo(x, y);
            }
            c.stroke();
          },
        });
      });
    }
    for (let i = 0; i < 3; i++) smoke(p.x, p.y, 14 * k + 4, "#5a5f68", 0.8, { alpha: 0.4, vy: -30, delay: 0.15 + i * 0.07 });
  },
  embers(p, k, color) {
    // Something inside is burning: flame licking out of the hull under a streamer of smoke.
    flash(p.x, p.y, 18 * k + 5, color, 0.12);
    for (let i = 0; i < 10; i++) {
      emit({ kind: "glow", x: p.x + rnd(-12, 12) * k, y: p.y + rnd(-6, 6) * k, vx: rnd(-30, 30), vy: rnd(-90, -20), g: -50, drag: 0.4, life: rnd(0.4, 0.8), size: rnd(3, 6) * k + 1, color: i % 2 ? color : FIRE, flicker: 0.5, delay: Math.random() * 0.15 });
    }
    for (let i = 0; i < 4; i++) smoke(p.x + rnd(-8, 8), p.y, 22 * k + 5, "#33363c", 0.95, { alpha: 0.48, vy: -36, delay: i * 0.06 });
  },
};

export const IMPACT_KINDS = Object.keys(IMPACTS) as Impact["fx"][];

/** Plays an impact on a unit's hull where the shot struck, scaled to how near the camera it is. */
export function playImpact(impact: Impact, who: number, from: number, scale = 1) {
  const p = landing(who, true) ?? hullPoint(who, 0.6) ?? center(who);
  if (!p || reduced()) return;
  const a = center(from);
  const dir = a && from !== who ? Math.atan2(p.y - a.y, p.x - a.x) : -Math.PI / 2;
  IMPACTS[impact.fx](p, blastScale(who) * scale, impact.color, dir, who);
}

/* ------------------------------------------------------------ enemy fire */

export type EnemyStyle = "tracer" | "missile" | "heavy";

/** Enemies fire the same weapons the same way: their own gun's muzzle, their own pylons. */
const ENEMY_SHOTS: Record<EnemyStyle, Shot> = {
  tracer: { fx: "gun", rounds: 5, gap: 36, spread: 12, caliber: 1, ms: 180, sfx: "cannon" },
  missile: { fx: "missile", store: "aam", size: 1, smoke: "white", loft: 40, ms: 420, sfx: "missile" },
  heavy: { fx: "missile", store: "agm", size: 1.4, smoke: "grey", loft: 80, ms: 520, sfx: "heavy" },
};

export function enemyShot(style: EnemyStyle): Shot {
  return ENEMY_SHOTS[style];
}

export const ENEMY_IMPACT: Record<EnemyStyle, Impact> = {
  tracer: { fx: "shells", color: "#ffd9a0" },
  missile: { fx: "blast", color: FIRE },
  heavy: { fx: "fireball", color: FLAME },
};
