import { sfx } from "../audio";
import { PLAYER, type CombatFx } from "../game/combat";
import { attitude, cubic, cubicTangent, flightView, mirrored, sixSpots, sizeAlong, swapIn, swapOut, type CamShape, type CamShot, type Curve, type FlightView, type Spot } from "./camera";
import { C, cardAnim, type Impact, type Shot } from "./cardfx";
import { deflect, ENEMY_IMPACT, enemyShot, fireShot, hullSheen, playImpact, type EnemyStyle } from "./cardplay";
import { addEffect, emit, flash, freezeGfx, glow, initGfx, ring, setGfxRate, smoke, sparks } from "./gfx";
import type { Cause } from "./crashplan";
import { downJet, initWreck } from "./wreck";
import { artEl, center, depth, easeOut, initGeo, lerp, marks, midOf, rectOf, rectOfSel, reduced, rnd, setTimeScale, timeScale, unitEl, wait, type Pt } from "./geo";

export { wait, unitEl } from "./geo";
export { castCard, rearmJet } from "./cardplay";
export { downJet, forceDemise, settleWrecks } from "./wreck";

let layer: HTMLElement;
let svg: SVGSVGElement;
let root: HTMLElement;
const SVG_NS = "http://www.w3.org/2000/svg";

export function initFx(appRoot: HTMLElement) {
  root = appRoot;
  initGeo(appRoot);
  layer = document.createElement("div");
  layer.id = "fx";
  layer.setAttribute("aria-hidden", "true");
  initGfx(layer);
  svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("fx-svg");
  layer.appendChild(svg);
  document.body.appendChild(layer);
  // No viewBox: the layer's own CSS pixels are its units, so client coordinates land where they should on any screen.
  initWreck({ hitStop, shake, flashScreen, burst });
}

export function fxLayer(): HTMLElement {
  return layer;
}

/** Below 1 hurries every running animation along; the player taps during one to skip ahead. */
export function setSpeed(next: number) {
  setTimeScale(next * slowMo);
  setGfxRate(1 / (next * slowMo));
}

let slowMo = 1;

/** Stretches every scripted animation by `factor`, for studying one frame by frame in development. */
export function setSlowMo(factor: number) {
  slowMo = factor;
  setSpeed(1);
}

function spawn(cls: string, x: number, y: number, html = ""): HTMLElement {
  const el = document.createElement("div");
  el.className = cls;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.innerHTML = html;
  layer.appendChild(el);
  return el;
}

function drop(el: Element, ms: number) {
  window.setTimeout(() => el.remove(), ms);
}

function later(ms: number, fn: () => void) {
  window.setTimeout(fn, ms * timeScale());
}

/* --------------------------------------------------------------- pieces */

const recentFloats = new Map<number, number[]>();

export function floatText(who: number, text: string, cls: string) {
  const c = center(who);
  if (!c) return;
  const now = performance.now();
  const recent = (recentFloats.get(who) ?? []).filter((t) => now - t < 650);
  const lane = recent.length % 4;
  recent.push(now);
  recentFloats.set(who, recent);
  const side = lane === 0 ? 0 : lane % 2 ? 1 : -1;
  const x = c.x + side * 54 + (Math.random() * 24 - 12);
  const y = c.y - 30 - (lane >= 2 ? 28 : 0) - Math.random() * 10;
  const el = spawn(`float ${cls}`, x, y, `<span>${text}</span>`);
  el.style.setProperty("--dx", `${(Math.random() * 2 - 1) * 34}px`);
  el.style.setProperty("--rot", `${(Math.random() * 2 - 1) * 7}deg`);
  drop(el, 1500);
}

/** An explosion on the effects canvas: a spark hit, a blast, or a fireball of flame, smoke and fragments. */
export function burst(x: number, y: number, size: number, kind: "hit" | "boom" | "big" = "hit") {
  if (reduced() && kind === "hit") return;
  const k = size / 60;
  if (kind === "hit") {
    flash(x, y, size * 0.45, C.amber, 0.12);
    sparks(x, y, { count: 7, color: C.amber, speed: 260 * k + 80, life: 0.32, size: 1.7 });
    return;
  }
  const big = kind === "big";
  flash(x, y, size * (big ? 0.9 : 0.7), big ? "#ffffff" : C.hot, big ? 0.22 : 0.16);
  sparks(x, y, { count: big ? 28 : 14, color: C.amber, speed: (big ? 300 : 240) * k + 120, life: big ? 0.65 : 0.45, size: 2.1 });
  for (let i = 0; i < (big ? 9 : 5); i++) {
    glow(x + rnd(-0.3, 0.3) * size, y + rnd(-0.22, 0.22) * size, size * rnd(0.22, 0.4), i % 2 ? C.flame : C.hot, rnd(0.3, 0.55), size * 0.8);
  }
  for (let i = 0; i < (big ? 10 : 5); i++) {
    smoke(x + rnd(-0.4, 0.4) * size, y + rnd(-0.3, 0.3) * size, size * rnd(0.4, 0.7), "#34373e", rnd(0.9, 1.4), { alpha: 0.55, delay: 0.05 + Math.random() * 0.18 });
  }
}

function svgPath(d: string, cls: string): SVGPathElement {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  path.setAttribute("class", cls);
  svg.appendChild(path);
  return path;
}

/** Knocks an airframe along the line of fire when a hit lands, with a jolt of roll. */
function recoil(who: number, from: number, hard: boolean) {
  const art = artEl(who);
  if (!art) return;
  hitFlash(who, hard);
  if (reduced()) return;
  const a = center(from);
  const b = center(who);
  const dx = a && b ? b.x - a.x : 0;
  const dy = a && b ? b.y - a.y : -1;
  const len = Math.hypot(dx, dy) || 1;
  const push = (hard ? 18 : 9) * Math.max(0.6, depth(who));
  const roll = (Math.random() < 0.5 ? -1 : 1) * (hard ? 9 : 4);
  const kick = `translate(${((dx / len) * push).toFixed(1)}px, ${((dy / len) * push).toFixed(1)}px) rotate(${roll}deg) scale(${dy < 0 ? 0.95 : 1.04})`;
  const back = `translate(${((-dx / len) * push * 0.25).toFixed(1)}px, ${((-dy / len) * push * 0.25).toFixed(1)}px) rotate(${-roll * 0.3}deg)`;
  art.animate([{ transform: "none" }, { transform: kick, offset: 0.18 }, { transform: back, offset: 0.6 }, { transform: "none" }], { duration: hard ? 420 : 320, easing: "cubic-bezier(.2,.8,.3,1)" });
}

/** The airframe lit for a frame by the hit; the player's jet flashes red instead. */
function hitFlash(who: number, hard: boolean) {
  const peak = who === PLAYER ? "brightness(1.2) sepia(1) saturate(8) hue-rotate(-42deg)" : `brightness(${hard ? 1.9 : 1.5}) saturate(0.6)`;
  for (const jet of artEl(who)?.querySelectorAll<HTMLElement>(".cj img") ?? []) {
    jet.animate([{ filter: "none" }, { filter: peak, offset: 0.12 }, { filter: "brightness(1.25)", offset: 0.4 }, { filter: "none" }], { duration: hard ? 300 : 220, easing: "ease-out" });
  }
}

export function shake(power: number) {
  if (reduced() || power <= 0) return;
  const p = Math.min(16, 3 + power * 0.65);
  const frames: Keyframe[] = [];
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    const k = (1 - i / steps) ** 1.5;
    frames.push({ transform: `translate(${((Math.random() * 2 - 1) * p * k).toFixed(1)}px, ${((Math.random() * 2 - 1) * p * k).toFixed(1)}px) rotate(${((Math.random() * 2 - 1) * 0.25 * k).toFixed(2)}deg)` });
  }
  frames.push({ transform: "none" });
  // The screen body clips its own overflow; shaking #app itself would flash page scrollbars.
  (root.querySelector<HTMLElement>(".battle") ?? root).animate(frames, { duration: 420, easing: "ease-out" });
}

/**
 * Hit-stop: holds the whole fight still for a few frames when a heavy blow lands, then releases
 * it with a small punch-in, so the hit reads as weight rather than as one more spark.
 */
export async function hitStop(ms: number) {
  if (reduced()) return;
  const battle = root.querySelector<HTMLElement>(".battle");
  if (!battle) return;
  freezeGfx(ms);
  const running = battle.getAnimations({ subtree: true }).filter((anim) => anim.playState === "running");
  for (const anim of running) anim.pause();
  await new Promise((resolve) => window.setTimeout(resolve, ms));
  for (const anim of running) {
    try {
      if (anim.playState === "paused") anim.play();
    } catch {
      /* the element was redrawn meanwhile */
    }
  }
  root.querySelector<HTMLElement>(".stage")?.animate([{ scale: "1.022" }, { scale: "1" }], { duration: 260, easing: "cubic-bezier(.2,.8,.3,1)" });
}

function vignette(cls: string) {
  const el = spawn(`vignette ${cls}`, 0, 0);
  drop(el, 700);
}

/** A quick aileron roll in place, for an enemy move that does not fire at the player. */
function barrelRoll(who: number) {
  const art = artEl(who);
  if (!art || reduced()) return;
  const dir = Math.random() < 0.5 ? -1 : 1;
  art.animate([{ rotate: "0deg" }, { rotate: `${dir * 360}deg` }], { duration: 560 * timeScale(), easing: "cubic-bezier(.45,.05,.35,1)" });
  // Vapour off the wingtips as it rolls.
  const k = Math.max(0.4, depth(who));
  for (let i = 1; i < 9; i++) {
    later(i * 56, () => {
      for (const p of marks(who, "tip")) smoke(p.x, p.y, 6 * k, "#ffffff", 0.4, { alpha: 0.28, vx: 0, vy: 20 * k, grow: 14 * k });
    });
  }
}

/** A hard jink to one side, used when a shot is dodged. */
function jink(who: number) {
  const art = artEl(who);
  if (!art || reduced()) return;
  const dir = Math.random() < 0.5 ? -1 : 1;
  const far = Math.max(24, art.getBoundingClientRect().width * 0.32);
  art.animate(
    [{ transform: "none" }, { transform: `translate(${dir * far}px, -10px) rotate(${dir * 28}deg)`, offset: 0.35 }, { transform: `translate(${dir * far * 0.2}px, 0) rotate(${dir * -6}deg)`, offset: 0.8 }, { transform: "none" }],
    { duration: 460, easing: "cubic-bezier(.25,.8,.3,1)" },
  );
  const r = rectOf(who);
  if (r) for (let i = 0; i < 6; i++) smoke(r.left + r.width * (0.5 - dir * 0.4), r.top + r.height * 0.55 + i * 2, r.width * 0.05, "#ffffff", 0.4, { vx: -dir * rnd(40, 90), alpha: 0.4, delay: i * 0.015 });
}

/** A gain on a unit (shield, repair, a buff) shows as light sliding across its hull in the gain's colour. */
function gainFx(who: number, color: string, plus = false) {
  if (reduced()) return;
  hullSheen(who, color, plus ? 0.6 : 0.45, plus ? 0.75 : 0.55);
}

/**
 * Moves the chase camera. "wide" pulls well back to an external view of the player's jet for the
 * enemy turn; "close" pushes back in behind the jet for the player's turn. The stylesheet animates
 * the move; this waits for it to finish.
 */
export async function camera(shot: CamShot): Promise<void> {
  const battle = root.querySelector<HTMLElement>(".battle");
  document.documentElement.dataset.cam = shot;
  if (!battle || battle.classList.contains(`cam-${shot}`)) return;
  battle.classList.remove("cam-close", "cam-wide");
  battle.classList.add(`cam-${shot}`, "cam-moving");
  if (reduced()) {
    battle.classList.remove("cam-moving");
    return;
  }
  sfx("whoosh");
  await wait(shot === "wide" ? 900 : 800);
  battle.classList.remove("cam-moving");
}

/* ------------------------------------------------------------ dogfight */

/** Attackers' swaps in flight, by uid; each resolves when that foe is settled on the six. */
const flights = new Map<number, Promise<void>>();

interface StageBox {
  rect: DOMRect;
  /** One camera unit in pixels, matching the stylesheet's `--u`. */
  u: number;
}

function stageBox(): StageBox | null {
  const el = root.querySelector<HTMLElement>(".stage");
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { rect, u: Math.min(rect.width / 100, rect.height * 0.018) };
}

/** A foe's spot right now, in stage percentages with its width in pixels. */
function spotNow(foe: HTMLElement, box: StageBox): Spot {
  const r = foe.getBoundingClientRect();
  return {
    x: ((r.left + r.width / 2 - box.rect.left) / box.rect.width) * 100,
    y: ((r.top + r.height / 2 - box.rect.top) / box.rect.height) * 100,
    s: r.width,
  };
}

/** A foe's slot ahead of the player in the close shot, as the stylesheet places it. */
function closeSlot(foe: HTMLElement, box: StageBox): Spot {
  const v = (name: string) => Number(foe.style.getPropertyValue(name)) || 0;
  const aspect = v("--box") || 2.4;
  return { x: v("--cx"), y: v("--cy"), s: Math.min(v("--cs") * box.u, aspect * box.rect.height * 0.25) };
}

function showView(foe: HTMLElement, view: FlightView, flip: boolean) {
  foe.dataset.view = view;
  foe.querySelector(".cj-front")?.classList.toggle("flip", view === "front" && flip);
  foe.querySelector(".jet.side")?.classList.toggle("flip", view === "side" && flip);
}

function placeFoe(foe: HTMLElement, p: { x: number; y: number }, width: number) {
  foe.style.left = `${p.x.toFixed(2)}%`;
  foe.style.top = `${p.y.toFixed(2)}%`;
  foe.style.width = `${width.toFixed(1)}px`;
}

/** Hands a flown foe back to the stylesheet, which already places it where the flight ended. */
function landFoe(foe: HTMLElement) {
  foe.style.removeProperty("left");
  foe.style.removeProperty("top");
  foe.style.removeProperty("width");
  delete foe.dataset.view;
  const art = foe.querySelector<HTMLElement>(".unit-art");
  if (art) art.style.rotate = "";
  void foe.offsetWidth;
  foe.classList.remove("flying", "in-flight");
}

function rotated(x: number, y: number, deg: number): { x: number; y: number } {
  const r = (deg * Math.PI) / 180;
  return { x: x * Math.cos(r) - y * Math.sin(r), y: x * Math.sin(r) + y * Math.cos(r) };
}

/** Vapour off the wingtips (or the tail, in profile) at a point along a flight. */
function contrail(c: Pt, width: number, view: FlightView, dx: number, dy: number, roll: number) {
  const size = Math.max(5, width * 0.06);
  if (view === "side") {
    const len = Math.hypot(dx, dy) || 1;
    smoke(c.x - (dx / len) * width * 0.5, c.y - (dy / len) * width * 0.5, size * 1.4, "#ffffff", 0.7, { alpha: 0.42, vx: 0, vy: 0 });
    return;
  }
  for (const sideOf of [-1, 1]) {
    const tip = rotated(sideOf * width * 0.45, width * 0.05, roll);
    smoke(c.x + tip.x, c.y + tip.y, size, "#ffffff", 0.62, { alpha: 0.4, vx: 0, vy: 0 });
  }
}

/** A speed streak trailing an airframe along its heading. */
function zip(c: Pt, width: number, dx: number, dy: number) {
  const len = Math.hypot(dx, dy) || 1;
  const across = (Math.random() * 2 - 1) * width * 0.4;
  const back = width * (0.2 + Math.random() * 0.3);
  const v = 420 + width * 2;
  emit({
    kind: "spark",
    x: c.x - (dx / len) * back - (dy / len) * across,
    y: c.y - (dy / len) * back + (dx / len) * across,
    vx: (-dx / len) * v,
    vy: (-dy / len) * v,
    g: 0,
    drag: 0.05,
    life: 0.2,
    size: 1.6,
    color: "#ffffff",
    stretch: 0.11,
    alpha: 0.55,
  });
}

type Pace = "out" | "in" | "through";

const PACE: Record<Pace, (k: number) => number> = {
  // Leaving: it accelerates away.
  out: (k) => k ** 2.1,
  // Arriving: fast in, easing onto the mark.
  in: (k) => 1 - (1 - k) ** 2.4,
  through: (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2),
};

/**
 * Flies a foe along a curve in stage percentages, sized by how near the camera it comes between
 * the `a` and `b` spots, swapping between rear, profile, and front-quarter paintings as its
 * heading turns, banking into the turn, and trailing vapour and speed streaks.
 */
function fly(foe: HTMLElement, curve: Curve, a: Spot, b: Spot, ms: number, box: StageBox, pace: Pace): Promise<void> {
  const art = foe.querySelector<HTMLElement>(".unit-art");
  foe.classList.add("flying", "in-flight");
  return new Promise((resolve) => {
    const start = performance.now();
    let view: FlightView | undefined;
    let lastTrail: Pt | null = null;
    let lastZip = 0;
    const step = () => {
      if (!foe.isConnected) return resolve();
      const now = performance.now();
      const k = Math.min(1, (now - start) / Math.max(1, ms * timeScale()));
      const t = Math.max(0, Math.min(1, PACE[pace](k)));
      const p = cubic(curve, t);
      const d = cubicTangent(curve, Math.min(0.995, Math.max(0.005, t)));
      const dx = d.x * box.rect.width;
      const dy = d.y * box.rect.height;
      view = flightView(dx, dy, view);
      showView(foe, view, mirrored(view, dx));
      const width = sizeAlong(a, b, p.y);
      placeFoe(foe, p, width);
      const roll = attitude(view, dx, dy);
      if (art) art.style.rotate = `${roll.toFixed(1)}deg`;
      const c = { x: box.rect.left + (p.x / 100) * box.rect.width, y: box.rect.top + (p.y / 100) * box.rect.height };
      if (!lastTrail || Math.hypot(c.x - lastTrail.x, c.y - lastTrail.y) > 12) {
        contrail(c, width, view, dx, dy, roll);
        lastTrail = c;
      }
      if (now - lastZip > 45 && k > 0.05 && k < 0.95) {
        zip(c, width, dx, dy);
        lastZip = now;
      }
      if (k < 1) requestAnimationFrame(step);
      else {
        foe.classList.remove("in-flight");
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}

function threatTag(text: string, six: boolean) {
  const tag = root.querySelector<HTMLElement>(".threat-tag");
  if (!tag) return;
  tag.textContent = text;
  tag.classList.toggle("six", six);
}

/** How far past the stage edge, in percent of its width, a sprite's centre must be to be out of sight. */
function offBy(width: number, box: StageBox): number {
  return ((width * 0.62) / box.rect.width) * 100 + 3;
}

/** Timings of the swap, in ms: each leg, and the beat the foe spends out of sight between them. */
export const SWAP = { out: 380, beat: 120, onto: 500, away: 340, back: 420, stagger: 160 };

/**
 * Sends each attacker round onto the player's six, starting `delay` ms from now and staggered so
 * a pair arrive one after the other: out past the edge of the screen, a beat out of sight, then
 * back in from that side onto the six. Their shots wait on `onSix`.
 */
export function breakTurns(attackers: number[], shape: CamShape, delay = 60, stagger = SWAP.stagger) {
  flights.clear();
  const box = stageBox();
  if (!box) return;
  const foes = attackers
    .map((uid) => ({ uid, el: unitEl(uid) }))
    .filter((foe): foe is { uid: number; el: HTMLElement } => !!foe.el && !foe.el.classList.contains("down"))
    .sort((a, b) => spotNow(a.el, box).x - spotNow(b.el, box).x);
  const six = sixSpots(
    foes.map((foe) => foe.el.classList.contains("boss")),
    shape,
  );
  const aspect = box.rect.width / box.rect.height;
  foes.forEach(({ uid, el }, index) => {
    const boxAspect = Number(el.style.getPropertyValue("--box")) || 2.4;
    const target: Spot = { x: six[index].x, y: six[index].y, s: Math.min(six[index].s * box.u, boxAspect * box.rect.height * 0.3) };
    const flight = wait(delay + index * stagger).then(async () => {
      if (!el.isConnected || el.classList.contains("crashing")) return;
      const from = spotNow(el, box);
      if (reduced()) {
        el.classList.add("flying");
        showView(el, "rear", false);
        placeFoe(el, target, target.s);
      } else {
        const side = from.x < 49 ? -1 : from.x > 51 ? 1 : index % 2 ? 1 : -1;
        const [exit, entry] = swapIn(from, target, side, offBy(target.s, box), aspect);
        sfx("flyby");
        await fly(el, exit, from, target, SWAP.out, box, "out");
        await wait(SWAP.beat);
        if (!el.isConnected) return;
        sfx("whoosh");
        await fly(el, entry, from, target, SWAP.onto, box, "in");
        showView(el, "rear", false);
        const art = el.querySelector<HTMLElement>(".unit-art");
        if (art) art.style.rotate = "0deg";
      }
      if (!root.querySelector(".threat-tag.six")) sfx("lock");
      threatTag("Bandits on your six", true);
    });
    flights.set(uid, flight);
  });
}

/** Resolves once this foe is on the player's six, or straight away if it is not making a run. */
export function onSix(uid: number): Promise<void> {
  return flights.get(uid) ?? Promise.resolve();
}

/**
 * The way back: every foe on the six pulls ahead past the player and off the edge of the screen,
 * then comes back in from that side into its slot ahead.
 */
export async function disengage(): Promise<void> {
  const box = stageBox();
  const runs = [...flights.keys()];
  await Promise.all(flights.values());
  flights.clear();
  threatTag("Bandits inbound", false);
  if (!box) return;
  const aspect = box.rect.width / box.rect.height;
  await Promise.all(
    runs.map(async (uid, index) => {
      const el = unitEl(uid);
      if (!el || !el.classList.contains("flying")) return;
      if (el.classList.contains("crashing") || el.classList.contains("down") || reduced()) {
        landFoe(el);
        return;
      }
      const from = spotNow(el, box);
      const to = closeSlot(el, box);
      const side = to.x < 49 ? -1 : to.x > 51 ? 1 : from.x < 50 ? -1 : 1;
      const [exit, entry] = swapOut(from, to, side, offBy(Math.max(from.s, to.s), box), aspect);
      await wait(index * 70);
      sfx("flyby");
      await fly(el, exit, from, to, SWAP.away, box, "out");
      await wait(SWAP.beat);
      if (!el.isConnected) return;
      await fly(el, entry, from, to, SWAP.back, box, "in");
      landFoe(el);
    }),
  );
}

/* ----------------------------------------------------------- shoot-down */

function flashScreen() {
  if (reduced()) return;
  drop(spawn("flash-screen", 0, 0), 260);
}

/** What last hurt each unit, so that when one dies the death fits the weapon. */
const lastCause = new Map<number, Cause>();

/** The player's own jet going down, when the sortie is lost. */
export function downPlayer(): Promise<void> {
  const cause = lastCause.get(PLAYER) ?? "other";
  lastCause.clear();
  return downJet(PLAYER, cause);
}

/* ---------------------------------------------------------------- bars */

export function setBar(who: number, hp: number, shield: number) {
  const bar = root.querySelector<HTMLElement>(`[data-bar="${who}"]`);
  if (!bar) return;
  const max = Number(bar.dataset.max) || 1;
  const pct = `${Math.max(0, Math.min(100, (hp / max) * 100))}%`;
  bar.querySelector<HTMLElement>(".bar-fill")!.style.width = pct;
  bar.querySelector<HTMLElement>(".bar-ghost")!.style.width = pct;
  bar.querySelector<HTMLElement>(".bar-text")!.textContent = `${Math.max(0, hp)}/${max}`;
  const badge = bar.querySelector<HTMLElement>(".bar-shield b");
  if (badge) badge.textContent = String(shield);
  bar.classList.toggle("shielded", shield > 0);
  if (who === PLAYER) {
    const hud = document.querySelector<HTMLElement>(".hud-hp b");
    if (hud) hud.innerHTML = `${Math.max(0, hp)}<small>/${max}</small>`;
  }
}

export function snapBars(values: Map<number, { hp: number; shield: number }>) {
  for (const [who, v] of values) {
    const bar = root.querySelector<HTMLElement>(`[data-bar="${who}"]`);
    if (!bar) continue;
    bar.classList.add("instant");
    setBar(who, v.hp, v.shield);
    void bar.offsetWidth;
    bar.classList.remove("instant");
  }
}

/** Restarts a one-shot CSS animation class on an element. */
function rekick(el: Element | null, cls: string) {
  if (!el) return;
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
}

function barKick(who: number, cls: "hurt" | "mend" | "guard") {
  rekick(root.querySelector(`[data-bar="${who}"]`), cls);
}

function statusRow(who: number): HTMLElement | null {
  return who === PLAYER ? root.querySelector<HTMLElement>(".pilot .st-row") : unitEl(who)?.querySelector<HTMLElement>(".st-row") ?? null;
}

export function banner(text: string, sub: string, cls = ""): Promise<void> {
  const el = spawn(`banner ${cls}`, 0, 0, `<div class="banner-inner"><i class="banner-streak"></i><b>${text}</b>${sub ? `<small>${sub}</small>` : ""}</div>`);
  const life = cls.includes("short") ? 820 : 1400;
  drop(el, life);
  const final = cls.includes("win") || cls.includes("loss");
  return final ? new Promise((resolve) => window.setTimeout(resolve, life)) : wait(life * 0.7);
}

export function wipe() {
  if (reduced()) return;
  const el = spawn("wipe", 0, 0, `<i></i><i></i><i></i>`);
  drop(el, 1300);
}

export function pulse(selector: string, cls: string) {
  rekick(root.querySelector<HTMLElement>(selector), cls);
}

/* ------------------------------------------------------------- timeline */

const STATUS_WORD: Record<string, string> = {
  evasion: "Evasion",
  locked: "Locked",
  jam: "Jam",
  burn: "Burn",
  thrust: "Thrust",
  armor: "Armor",
  plating: "Plating",
  suppress: "Suppress",
  static: "Static",
  energy: "Energy",
};

const STATUS_TINT: Record<string, string> = {
  evasion: C.cyan,
  locked: C.red,
  jam: C.magenta,
  burn: C.flame,
  thrust: C.gold,
  armor: C.steel,
  plating: C.bronze,
  suppress: C.violet,
  static: C.violet,
  energy: C.gold,
};

export interface PlayContext {
  /** The card being played, whose recipe draws the player's shots. Absent for turn events. */
  card?: string;
  /** True for a card that hits every enemy: its shots at each target fly together. */
  salvo?: boolean;
  bars: Map<number, { hp: number; shield: number }>;
}

/** Shot and impact for the player's damage that does not come from a card's own shot: a snap burst from the gun. */
const PASSIVE_SHOT: Shot = { fx: "gun", rounds: 3, gap: 30, spread: 8, caliber: 1, ms: 150, sfx: "cannon" };
const PASSIVE_IMPACT: Impact = { fx: "sparks", color: "#ffd9a0" };

function enemyStyle(amount: number, index: number): EnemyStyle {
  if (amount >= 14) return "heavy";
  return index % 2 ? "tracer" : amount >= 8 ? "missile" : "tracer";
}

export async function playEvents(events: CombatFx[], ctx: PlayContext) {
  let lastFrom = Number.NaN;
  let volley = 0;
  let cardHits = 0;
  const anim = ctx.card ? cardAnim(ctx.card) : null;
  const shotOf = anim?.shot ?? PASSIVE_SHOT;
  const impactOf = anim?.shot ? anim.impact ?? PASSIVE_IMPACT : PASSIVE_IMPACT;
  const prefired = new Set<number>();
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (event.t === "hit") {
      const sameVolley = event.from === lastFrom;
      volley = sameVolley ? volley + 1 : 0;
      lastFrom = event.from;
      let impact: Impact;
      let heavyShot = false;
      let cause: Cause;
      if (event.from === PLAYER) {
        cause = shotOf.fx === "gun" ? "gun" : shotOf.fx === "ew" ? "other" : "blast";
        impact = impactOf;
        heavyShot = impact.fx === "fireball";
        if (!prefired.has(i)) {
          if (ctx.salvo) {
            // One wave of an all-enemies card: every target's shot flies at once.
            const wave = [i];
            const seen = new Set([event.who]);
            for (let j = i + 1; j < events.length; j++) {
              const next = events[j];
              if (next.t === "turn" || next.t === "move") break;
              if (next.t !== "hit" || next.from !== PLAYER) continue;
              if (seen.has(next.who)) break;
              seen.add(next.who);
              wave.push(j);
            }
            const base = cardHits;
            cardHits += wave.length;
            for (const j of wave) prefired.add(j);
            await Promise.all(wave.map((j, n) => fireShot(shotOf, PLAYER, (events[j] as { who: number }).who, base + n)));
          } else {
            await fireShot(shotOf, PLAYER, event.who, cardHits);
            cardHits += 1;
          }
        } else await wait(50);
      } else {
        const style = enemyStyle(event.amount + event.blocked, volley);
        cause = style === "tracer" ? "gun" : "blast";
        impact = ENEMY_IMPACT[style];
        heavyShot = style === "heavy";
        await fireShot(enemyShot(style), event.from, event.who, volley);
      }
      if (event.amount > 0) lastCause.set(event.who, cause);
      const heavy = event.amount >= 12 || (heavyShot && event.amount > 0);
      const crit = event.amount >= 15;
      ctx.bars.set(event.who, { hp: event.hp, shield: event.shield });
      setBar(event.who, event.hp, event.shield);
      if (event.blocked > 0) deflect(event.who, event.from);
      if (event.amount > 0) {
        playImpact(impact, event.who, event.from, heavy ? 1.2 : 1);
        recoil(event.who, event.from, heavy);
        barKick(event.who, "hurt");
        sfx(crit ? "crit" : heavy ? "hitBig" : "hit");
        floatText(event.who, String(event.amount), event.who === PLAYER ? `dmg dmg-player${crit ? " dmg-crit" : ""}` : heavy ? `dmg dmg-big${crit ? " dmg-crit" : ""}` : "dmg");
        if (event.who === PLAYER) {
          sfx("hurt");
          vignette("hurt");
        }
        if (heavy) {
          await hitStop(crit ? 120 : 80);
          shake(event.who === PLAYER ? event.amount : event.amount * 0.6);
        } else if (event.who === PLAYER) shake(event.amount >= 6 ? event.amount : 0);
      } else if (event.blocked > 0) {
        floatText(event.who, "Blocked", "dmg-blocked");
        barKick(event.who, "guard");
        sfx("block");
      }
      if (event.blocked > 0 && event.amount > 0) pulseShield(event.who);
      await wait(shotOf.fx === "gun" && event.from === PLAYER ? 50 : 100);
    } else if (event.t === "evade") {
      const dodge = fireShot(enemyShot("missile"), event.from, event.who, volley, true);
      later(180, () => jink(event.who));
      await dodge;
      floatText(event.who, "Evaded", "evade");
      sfx("evade");
      await wait(110);
    } else if (event.t === "burn") {
      ctx.bars.set(event.who, { hp: event.hp, shield: ctx.bars.get(event.who)?.shield ?? 0 });
      setBar(event.who, event.hp, ctx.bars.get(event.who)?.shield ?? 0);
      if (event.amount > 0) {
        lastCause.set(event.who, "burn");
        floatText(event.who, String(event.amount), "dmg dmg-burn");
        barKick(event.who, "hurt");
      }
      playImpact({ fx: "embers", color: C.flame }, event.who, event.who, 0.8);
      if (event.who === PLAYER && event.amount > 0) vignette("burn");
      await wait(200);
    } else if (event.t === "shield") {
      const prev = ctx.bars.get(event.who);
      ctx.bars.set(event.who, { hp: prev?.hp ?? 0, shield: event.shield });
      if (prev) setBar(event.who, prev.hp, event.shield);
      floatText(event.who, `+${event.amount}`, "gain-shield");
      pulseShield(event.who);
      barKick(event.who, "guard");
      if (event.who !== PLAYER || !anim) gainFx(event.who, C.cyan);
      sfx("shield");
      await wait(140);
    } else if (event.t === "heal") {
      const prev = ctx.bars.get(event.who);
      ctx.bars.set(event.who, { hp: event.hp, shield: prev?.shield ?? 0 });
      setBar(event.who, event.hp, prev?.shield ?? 0);
      floatText(event.who, `+${event.amount}`, "gain-heal");
      barKick(event.who, "mend");
      gainFx(event.who, C.heal, true);
      sfx("heal");
      await wait(160);
    } else if (event.t === "status") {
      const word = STATUS_WORD[event.k] ?? event.k;
      floatText(event.who, `${event.n > 0 ? "+" : ""}${event.n} ${word}`, `st-float st-${event.k}`);
      if (event.k === "energy") {
        pulse(".energy-orb", "gain");
        sfx("energy");
        const orb = rectOfSel(".energy-orb");
        if (orb && !reduced()) void ring(orb.left + orb.width / 2, orb.top + orb.height / 2, orb.width * 0.3, orb.width * 0.85, C.gold, 0.4, 3);
      } else {
        rekick(statusRow(event.who)?.querySelector(`.st-${event.k}`) ?? null, "pop");
        if (event.who !== PLAYER || !anim) gainFx(event.who, STATUS_TINT[event.k] ?? C.gold);
      }
      await wait(120);
    } else if (event.t === "move") {
      lastFrom = Number.NaN;
      const unit = unitEl(event.uid);
      unit?.classList.add("acting");
      if (flights.has(event.uid)) {
        await onSix(event.uid);
        floatText(event.uid, event.name, "move-name");
        await wait(90);
      } else {
        floatText(event.uid, event.name, "move-name");
        if (event.kind !== "attack" && event.kind !== "mixed") barrelRoll(event.uid);
        await wait(event.kind === "attack" ? 280 : 340);
      }
      window.setTimeout(() => unit?.classList.remove("acting"), 700);
    } else if (event.t === "down") {
      await downJet(event.who, lastCause.get(event.who) ?? "other");
      lastCause.delete(event.who);
    } else if (event.t === "phase") {
      floatText(event.uid, event.text, "phase-float");
      const c = center(event.uid);
      if (c) {
        burst(c.x, c.y, 90, "boom");
      }
      sfx("boss");
      shake(6);
      await wait(500);
    } else if (event.t === "turn") {
      lastFrom = Number.NaN;
    }
  }
}

function pulseShield(who: number) {
  rekick(root.querySelector<HTMLElement>(`[data-bar="${who}"] .bar-shield`), "pop");
}

/* ----------------------------------------------------------------- cards */

const TINT: Record<string, string> = { attack: "#ff9a52", maneuver: "#5fe3d6", system: "#c79cff", burden: "#b0a090" };

export interface CardSnap {
  html: string;
  /** The card's own box, before the fan's rotation. */
  rect: DOMRect;
  rot: number;
  /** A phone hand's cropped card. */
  mini: boolean;
}

/** A hand slot's card as it looks now, to animate after the hand has been redrawn. */
export function snapCard(slot: HTMLElement): CardSnap | undefined {
  const card = slot.querySelector<HTMLElement>(".card");
  if (!card) return undefined;
  const box = card.getBoundingClientRect();
  const lifted = slot.classList.contains("hover") || slot.classList.contains("dragging");
  const mini = !!slot.closest(".hand.mini") && !slot.classList.contains("hover");
  const rot = lifted ? 0 : Number.parseFloat(slot.style.getPropertyValue("--r")) || 0;
  if (lifted) return { html: card.outerHTML, rect: box, rot, mini };
  // The bounding box of a fanned card is wider than the card: rebuild its own box about the centre.
  const w = card.offsetWidth;
  const h = card.offsetHeight;
  return { html: card.outerHTML, rect: new DOMRect(box.left + box.width / 2 - w / 2, box.top + box.height / 2 - h / 2, w, h), rot, mini };
}

function ghost(snap: CardSnap): HTMLElement {
  const el = document.createElement("div");
  el.className = snap.mini ? "card-ghost hand mini" : "card-ghost";
  el.innerHTML = `<div class="slot">${snap.html}</div>`;
  const r = snap.rect;
  el.style.left = `${r.left}px`;
  el.style.top = `${r.top}px`;
  el.style.width = `${r.width}px`;
  el.style.height = `${r.height}px`;
  el.style.setProperty("--cw", `${r.width}px`);
  el.style.setProperty("--ch", `${r.height}px`);
  layer.appendChild(el);
  return el;
}

/**
 * The played card lifts out of the hand, flares in its type's colour, and is flicked towards the
 * player's jet, where it breaks up. A card that exhausts burns away from the bottom up instead.
 */
export function throwCard(snap: CardSnap, type: string, exhaust: boolean) {
  sfx("play");
  if (reduced()) return;
  const el = ghost(snap);
  const tint = TINT[type] ?? "#ffd36a";
  el.style.setProperty("--tint", tint);
  const r = snap.rect;
  const from = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const lift = Math.min(70, r.height * 0.4);
  const jet = center(PLAYER) ?? { x: window.innerWidth / 2, y: window.innerHeight * 0.45 };
  const speed = timeScale();
  if (exhaust) {
    sfx("exhaust");
    el.classList.add("burning");
    el.animate(
      [
        { transform: `translate(0,0) rotate(${snap.rot}deg) scale(1)`, clipPath: "inset(0 0 0 0)", filter: "brightness(1)" },
        { transform: `translate(0, ${-lift}px) rotate(0deg) scale(1.12)`, clipPath: "inset(0 0 0 0)", filter: "brightness(1.3)", offset: 0.24 },
        { transform: `translate(0, ${-lift - 26}px) rotate(-2deg) scale(1.1)`, clipPath: "inset(0 0 100% 0)", filter: "brightness(.5) sepia(1) saturate(4) hue-rotate(-20deg)" },
      ],
      { duration: 560 * speed, easing: "cubic-bezier(.3,.6,.4,1)", fill: "forwards" },
    );
    drop(el, 560 * speed + 40);
    void addEffect({
      life: 0.42,
      delay: 0.13,
      draw: (_c, k) => {
        // The burn line climbs the card, shedding embers.
        const y = r.bottom - lift - r.height * 1.1 * k;
        for (let i = 0; i < 2; i++) {
          const x = r.left + Math.random() * r.width;
          emit({ kind: "glow", x, y, vx: rnd(-30, 30), vy: rnd(-120, -40), g: -80, life: rnd(0.3, 0.6), size: rnd(3, 6), color: i ? C.flame : C.hot, flicker: 0.5 });
        }
        if (Math.random() < 0.4) smoke(r.left + Math.random() * r.width, y, 18, "#2e2a28", 0.6, { alpha: 0.4, vy: -70 });
      },
    });
    return;
  }
  const tx = jet.x - from.x;
  const ty = jet.y - from.y;
  el.animate(
    [
      { transform: `translate(0,0) rotate(${snap.rot}deg) scale(1)`, opacity: 1, filter: "brightness(1)" },
      { transform: `translate(0, ${-lift * 0.86}px) rotate(${(-snap.rot * 0.2).toFixed(1)}deg) scale(1.2)`, opacity: 1, filter: "brightness(1.2)", offset: 0.26, easing: "cubic-bezier(.3,0,.2,1)" },
      { transform: `translate(0, ${-lift}px) rotate(0deg) scale(1.15)`, opacity: 1, filter: "brightness(1.6)", offset: 0.44, easing: "cubic-bezier(.6,0,.9,.4)" },
      { transform: `translate(${(tx * 0.6).toFixed(0)}px, ${(ty * 0.6 - lift * 0.4).toFixed(0)}px) rotate(${tx < 0 ? -14 : 14}deg) scale(.1)`, opacity: 0, filter: "brightness(3.2)" },
    ],
    { duration: 330 * speed, fill: "forwards" },
  );
  drop(el, 330 * speed + 40);
  later(130, () => {
    const o = { x: from.x, y: from.y - lift };
    flash(o.x, o.y, r.width * 0.5, tint, 0.14);
    for (let i = 0; i < 10; i++) {
      const a = { x: o.x + rnd(-0.4, 0.4) * r.width, y: o.y + rnd(-0.4, 0.4) * r.height };
      emit({ kind: "dot", x: a.x, y: a.y, vx: (jet.x - a.x) * 0.5, vy: (jet.y - a.y) * 0.5 - 40, g: 0, drag: 0.1, life: rnd(0.16, 0.3), size: rnd(1.4, 2.4), color: i % 3 ? tint : "#ffffff", flicker: 0.4 });
    }
  });
}

/** The cards left in hand at end of turn fly to the discard pile. */
export function discardHand(snaps: CardSnap[]) {
  const pile = rectOfSel(".pile-discard");
  if (!pile || reduced() || !snaps.length) return;
  const to = midOf(pile);
  const speed = timeScale();
  snaps.forEach((snap, i) => {
    const el = ghost(snap);
    const r = snap.rect;
    const tx = to.x - (r.left + r.width / 2);
    const ty = to.y - (r.top + r.height / 2);
    el.animate(
      [
        { transform: `translate(0,0) rotate(${snap.rot}deg) scale(1)`, opacity: 1 },
        { transform: `translate(${(tx * 0.1).toFixed(0)}px, -22px) rotate(${snap.rot}deg) scale(1.04)`, opacity: 1, offset: 0.2 },
        { transform: `translate(${tx.toFixed(0)}px, ${ty.toFixed(0)}px) rotate(${(40 + i * 12).toFixed(0)}deg) scale(.14)`, opacity: 0.2 },
      ],
      { duration: 300 * speed, delay: i * 38 * speed, easing: "cubic-bezier(.5,0,.6,.9)", fill: "both" },
    );
    drop(el, (300 + i * 38) * speed + 40);
    later(i * 38, () => sfx("discard"));
  });
  later(300 + snaps.length * 38 - 80, () => pulse(".pile-discard", "bump"));
}

/** The discard pile is shuffled back into the draw pile: card backs arc across the tray. */
export function shuffleFx() {
  const a = rectOfSel(".pile-discard");
  const b = rectOfSel(".pile-draw");
  sfx("shuffle");
  pulse(".pile-draw", "bump");
  if (!a || !b || reduced()) return;
  const from = midOf(a);
  const to = midOf(b);
  const lift = Math.min(90, Math.abs(to.x - from.x) * 0.16 + 30);
  for (let i = 0; i < 7; i++) {
    void addEffect({
      life: 0.34,
      delay: i * 0.035,
      draw: (c, k) => {
        const e = easeOut(k);
        const x = lerp(from.x, to.x, e);
        const y = lerp(from.y, to.y, e) - Math.sin(k * Math.PI) * lift;
        c.translate(x, y);
        c.rotate(k * Math.PI * 2 * (i % 2 ? 1 : -1));
        c.globalAlpha = k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1;
        c.fillStyle = "#16242e";
        c.strokeStyle = "#5fe3d6";
        c.lineWidth = 1.5;
        c.beginPath();
        c.roundRect(-9, -13, 18, 26, 3);
        c.fill();
        c.stroke();
      },
    });
  }
}

/** Slides hand slots from their previous rects into their new places, and deals new ones from the draw pile. */
export function flipHand(before: Map<string, DOMRect>, fresh: boolean, delay = 0) {
  const slots = [...root.querySelectorAll<HTMLElement>(".hand .slot")];
  const pile = root.querySelector<HTMLElement>(".pile-draw")?.getBoundingClientRect();
  const speed = timeScale();
  let dealt = 0;
  for (const slot of slots) {
    const uid = slot.dataset.uid ?? "";
    const card = slot.querySelector<HTMLElement>(".card");
    if (!card) continue;
    const now = card.getBoundingClientRect();
    const prev = before.get(uid);
    if (prev && !fresh) {
      const dx = prev.left - now.left;
      const dy = prev.top - now.top;
      if (Math.abs(dx) + Math.abs(dy) > 1 && !reduced()) {
        card.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], { duration: 300, easing: "cubic-bezier(.3,1.35,.5,1)" });
      }
    } else if (pile) {
      const at = delay + dealt * 62;
      later(at, () => sfx("draw"));
      dealt += 1;
      if (reduced()) continue;
      const dx = pile.left + pile.width / 2 - (now.left + now.width / 2);
      const dy = pile.top + pile.height / 2 - (now.top + now.height / 2);
      card.animate(
        [
          { translate: `${dx}px ${dy}px`, scale: "0.2", opacity: 0, rotate: "-30deg", filter: "brightness(2.4)" },
          { translate: `${(dx * 0.45).toFixed(0)}px ${(dy * 0.45 - 46).toFixed(0)}px`, scale: "0.8", opacity: 1, rotate: "-9deg", filter: "brightness(1.5)", offset: 0.45 },
          { translate: "0 -12px", scale: "1.06", opacity: 1, rotate: "1.5deg", filter: "brightness(1.15)", offset: 0.78 },
          { translate: "0 0", scale: "1", opacity: 1, rotate: "0deg", filter: "brightness(1)" },
        ],
        { duration: 420 * speed, delay: at * speed, easing: "cubic-bezier(.3,.7,.3,1)", fill: "backwards" },
      );
    }
  }
  if (dealt) later(delay, () => pulse(".pile-draw", "bump"));
}

export function handRects(): Map<string, DOMRect> {
  const out = new Map<string, DOMRect>();
  for (const slot of root.querySelectorAll<HTMLElement>(".hand .slot")) {
    const card = slot.querySelector<HTMLElement>(".card");
    if (card && slot.dataset.uid) out.set(slot.dataset.uid, card.getBoundingClientRect());
  }
  return out;
}

/** Every card in hand as it looks now, for the fly-to-discard animation after the hand is redrawn. */
export function handSnaps(): CardSnap[] {
  const out: CardSnap[] = [];
  for (const slot of root.querySelectorAll<HTMLElement>(".hand .slot")) {
    const snap = snapCard(slot);
    if (snap) out.push(snap);
  }
  return out;
}

/* ----------------------------------------------------------- interface */

/** A pop of sparks and a ring over an element: a purchase, a pick, a reward taken. */
export function sparkle(rect: DOMRect | null, color: string = C.gold) {
  if (!rect || reduced()) return;
  const p = midOf(rect);
  flash(p.x, p.y, Math.min(rect.width, rect.height) * 0.45, color, 0.16);
  void ring(p.x, p.y, Math.min(rect.width, rect.height) * 0.3, Math.max(rect.width, rect.height) * 0.7, color, 0.42, 3);
  for (let i = 0; i < 16; i++) {
    emit({ kind: "dot", x: rect.left + Math.random() * rect.width, y: rect.top + Math.random() * rect.height, vx: rnd(-60, 60), vy: rnd(-140, -30), g: 160, life: rnd(0.4, 0.8), size: rnd(1.6, 3.2), color: i % 3 ? color : "#ffffff", flicker: 0.6, delay: Math.random() * 0.1 });
  }
}

/**
 * Flies small tokens from one place to another along arcs: coins to the purse, a card to the deck,
 * a relic to the top bar. Resolves as the first one lands.
 */
export function flyTokens(from: DOMRect | null, to: DOMRect | null, kind: "coin" | "card" | "relic", count = 1, color: string = C.gold): Promise<void> {
  if (!from || !to || reduced()) return Promise.resolve();
  const a = midOf(from);
  const b = midOf(to);
  const life = 0.46;
  for (let i = 0; i < count; i++) {
    const start = { x: a.x + rnd(-0.3, 0.3) * from.width, y: a.y + rnd(-0.3, 0.3) * from.height };
    const bend = rnd(-70, 70);
    const liftY = rnd(40, 110);
    void addEffect({
      life,
      delay: i * 0.035,
      draw: (c, k, age) => {
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        const x = lerp(start.x, b.x, e) + Math.sin(k * Math.PI) * bend;
        const y = lerp(start.y, b.y, e) - Math.sin(k * Math.PI) * liftY;
        c.translate(x, y);
        c.globalAlpha = k > 0.9 ? (1 - k) / 0.1 : 1;
        if (kind === "coin") {
          c.scale(Math.abs(Math.cos(age * 14 + i)) * 0.8 + 0.2, 1);
          c.fillStyle = "#ffd36a";
          c.strokeStyle = "#8a5a12";
          c.lineWidth = 1.5;
          c.beginPath();
          c.arc(0, 0, 6, 0, Math.PI * 2);
          c.fill();
          c.stroke();
        } else if (kind === "card") {
          c.rotate(k * 5);
          c.scale(lerp(1.6, 0.6, k), lerp(1.6, 0.6, k));
          c.fillStyle = "#16242e";
          c.strokeStyle = color;
          c.lineWidth = 2;
          c.beginPath();
          c.roundRect(-10, -14, 20, 28, 3);
          c.fill();
          c.stroke();
        } else {
          c.rotate(age * 6);
          c.fillStyle = color;
          c.beginPath();
          for (let q = 0; q < 8; q++) {
            const r = q % 2 ? 4 : 11;
            const ang = (Math.PI / 4) * q;
            if (q) c.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
            else c.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
          }
          c.closePath();
          c.fill();
        }
        if (Math.random() < 0.5) emit({ kind: "dot", x, y, size: 2, color, life: 0.25, flicker: 0.5 });
      },
      done: () => {
        if (i === 0) {
          flash(b.x, b.y, 18, color, 0.14);
          void ring(b.x, b.y, 4, 26, color, 0.3, 2);
        }
      },
    });
  }
  return wait(life * 1000);
}

/* ------------------------------------------------------------ aim arrow */

let arrow: SVGPathElement | null = null;
let arrowGlow: SVGPathElement | null = null;
let arrowHead: SVGPathElement | null = null;

export function aim(from: { x: number; y: number } | null, to: { x: number; y: number } | null, hot: boolean) {
  if (!from || !to) {
    arrow?.remove();
    arrowGlow?.remove();
    arrowHead?.remove();
    arrow = null;
    arrowGlow = null;
    arrowHead = null;
    return;
  }
  if (!arrow) {
    arrowGlow = svgPath("", "aim-glow");
    arrow = svgPath("", "aim");
    arrowHead = svgPath("", "aim-head");
  }
  const cx = from.x + (to.x - from.x) * 0.2;
  const cy = Math.min(from.y, to.y) - 120;
  const d = `M${from.x} ${from.y} Q${cx} ${cy} ${to.x} ${to.y}`;
  arrow.setAttribute("d", d);
  arrowGlow!.setAttribute("d", d);
  const angle = Math.atan2(to.y - cy, to.x - cx);
  const s = 20;
  const p1 = `${to.x - Math.cos(angle - 0.45) * s} ${to.y - Math.sin(angle - 0.45) * s}`;
  const p2 = `${to.x - Math.cos(angle + 0.45) * s} ${to.y - Math.sin(angle + 0.45) * s}`;
  arrowHead!.setAttribute("d", `M${p1} L${to.x} ${to.y} L${p2} Z`);
  for (const el of [arrow, arrowGlow!, arrowHead!]) el.classList.toggle("hot", hot);
}
