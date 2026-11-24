import { sfx } from "../audio";
import { PLAYER, type CombatFx } from "../game/combat";

let layer: HTMLElement;
let svg: SVGSVGElement;
let root: HTMLElement;
let speed = 1;
const SVG_NS = "http://www.w3.org/2000/svg";

const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function initFx(appRoot: HTMLElement) {
  root = appRoot;
  layer = document.createElement("div");
  layer.id = "fx";
  layer.setAttribute("aria-hidden", "true");
  svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("fx-svg");
  layer.appendChild(svg);
  document.body.appendChild(layer);
  const resize = () => svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
  resize();
  window.addEventListener("resize", resize);
}

export function fxLayer(): HTMLElement {
  return layer;
}

export function setSpeed(next: number) {
  speed = next;
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, Math.max(0, ms * speed)));
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

/* ------------------------------------------------------------- geometry */

export function unitEl(who: number): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-who="${who}"]`);
}

function artEl(who: number): HTMLElement | null {
  return unitEl(who)?.querySelector<HTMLElement>(".unit-art") ?? null;
}

function center(who: number): { x: number; y: number } | null {
  const el = artEl(who)?.querySelector<HTMLElement>(".jet") ?? artEl(who);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function muzzle(who: number): { x: number; y: number } | null {
  const el = artEl(who)?.querySelector<HTMLElement>(".jet") ?? artEl(who);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const front = who === PLAYER ? r.left + r.width * 0.82 : r.left + r.width * 0.18;
  return { x: front, y: r.top + r.height * 0.55 };
}

/* --------------------------------------------------------------- pieces */

export function floatText(who: number, text: string, cls: string) {
  const c = center(who);
  if (!c) return;
  const el = spawn(`float ${cls}`, c.x + (Math.random() * 60 - 30), c.y - 30 - Math.random() * 20, `<span>${text}</span>`);
  drop(el, 1500);
}

export function burst(x: number, y: number, size: number, kind: "hit" | "boom" | "big" = "hit") {
  if (reduced() && kind === "hit") return;
  const sparks = kind === "hit" ? 6 : kind === "boom" ? 12 : 18;
  let html = `<i class="b-flash"></i><i class="b-ring"></i>`;
  for (let i = 0; i < sparks; i++) {
    const angle = (360 / sparks) * i + Math.random() * 20;
    const len = (0.6 + Math.random() * 0.6) * size;
    html += `<i class="b-spark" style="--a:${angle}deg;--l:${len.toFixed(0)}px;--d:${(Math.random() * 80).toFixed(0)}ms"></i>`;
  }
  if (kind !== "hit") {
    for (let i = 0; i < (kind === "big" ? 9 : 5); i++) {
      const dx = (Math.random() * 2 - 1) * size * 0.5;
      const dy = (Math.random() * 2 - 1) * size * 0.35;
      html += `<i class="b-smoke" style="--x:${dx.toFixed(0)}px;--y:${dy.toFixed(0)}px;--s:${(0.6 + Math.random() * 0.8).toFixed(2)};--d:${(80 + Math.random() * 200).toFixed(0)}ms"></i>`;
    }
    html += `<i class="b-fire"></i>`;
  }
  const el = spawn(`burst burst-${kind}`, x, y, html);
  el.style.setProperty("--size", `${size}px`);
  drop(el, kind === "hit" ? 700 : 1900);
}

function svgPath(d: string, cls: string): SVGPathElement {
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  path.setAttribute("class", cls);
  svg.appendChild(path);
  return path;
}

async function missile(a: { x: number; y: number }, b: { x: number; y: number }, heavy: boolean) {
  const lift = heavy ? -140 : -60 - Math.random() * 60;
  const mx = (a.x + b.x) / 2;
  const my = Math.min(a.y, b.y) + lift;
  const d = `M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`;
  const dur = (heavy ? 520 : 380) * speed;
  const trail = svgPath(d, heavy ? "trail trail-heavy" : "trail");
  const len = trail.getTotalLength();
  trail.style.strokeDasharray = `${len}`;
  trail.style.strokeDashoffset = `${len}`;
  trail.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: dur, easing: "cubic-bezier(.4,0,.8,1)", fill: "forwards" });
  trail.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 900 * speed, delay: dur, fill: "forwards" });
  drop(trail, dur + 1000 * speed);
  const head = spawn(heavy ? "missile heavy" : "missile", 0, 0, "<i></i>");
  head.style.offsetPath = `path("${d}")`;
  const anim = head.animate([{ offsetDistance: "0%" }, { offsetDistance: "100%" }], {
    duration: dur,
    easing: "cubic-bezier(.4,0,.8,1)",
    fill: "forwards",
  });
  await anim.finished.catch(() => undefined);
  head.remove();
}

async function tracer(a: { x: number; y: number }, b: { x: number; y: number }) {
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const dur = 190 * speed;
  const rounds = 4;
  let last: Promise<unknown> = Promise.resolve();
  for (let i = 0; i < rounds; i++) {
    const jy = (Math.random() * 2 - 1) * 10;
    const el = spawn("tracer", a.x, a.y);
    el.style.transform = `rotate(${angle}deg)`;
    const anim = el.animate(
      [
        { transform: `translate(0,0) rotate(${angle}deg)`, opacity: 1 },
        { transform: `translate(${b.x - a.x}px, ${b.y - a.y + jy}px) rotate(${angle}deg)`, opacity: 1 },
      ],
      { duration: dur, delay: i * 45 * speed, easing: "linear", fill: "forwards" },
    );
    last = anim.finished.catch(() => undefined).then(() => el.remove());
  }
  spawn("muzzle", a.x, a.y);
  drop(layer.lastElementChild!, 200);
  await new Promise((resolve) => window.setTimeout(resolve, dur + 45 * speed));
  void last;
}

async function zap(a: { x: number; y: number }, b: { x: number; y: number }) {
  const pts: string[] = [];
  const steps = 9;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t + (i === 0 || i === steps ? 0 : (Math.random() * 2 - 1) * 26);
    pts.push(`${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  const bolt = svgPath(pts.join(" "), "zap");
  const glow = svgPath(pts.join(" "), "zap-glow");
  const frames = [{ opacity: 0 }, { opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }, { opacity: 0 }];
  bolt.animate(frames, { duration: 320 * speed, fill: "forwards" });
  glow.animate(frames, { duration: 320 * speed, fill: "forwards" });
  drop(bolt, 400 * speed);
  drop(glow, 400 * speed);
  await wait(150);
}

export type ShotStyle = "tracer" | "missile" | "heavy" | "zap";

export async function shot(from: number, to: number, style: ShotStyle) {
  const a = muzzle(from);
  const b = center(to);
  if (!a || !b) return;
  if (reduced()) {
    await wait(80);
    return;
  }
  if (style === "tracer") {
    sfx("attack");
    await tracer(a, b);
  } else if (style === "zap") {
    sfx("shield");
    await zap(a, b);
  } else {
    sfx("play");
    await missile(a, b, style === "heavy");
  }
}

function recoil(who: number, hard: boolean) {
  const art = artEl(who);
  if (!art) return;
  const dir = who === PLAYER ? -1 : 1;
  art.animate(
    [
      { transform: "translate(0,0)", filter: "brightness(1)" },
      { transform: `translate(${dir * (hard ? 22 : 12)}px, ${hard ? -4 : -2}px) rotate(${dir * (hard ? 4 : 2)}deg)`, filter: "brightness(2.2) saturate(.3)" },
      { transform: "translate(0,0)", filter: "brightness(1)" },
    ],
    { duration: 320, easing: "cubic-bezier(.2,.8,.3,1)" },
  );
}

export function shake(power: number) {
  if (reduced() || power <= 0) return;
  const p = Math.min(14, 3 + power * 0.6);
  const frames: Keyframe[] = [];
  for (let i = 0; i < 7; i++) {
    const k = 1 - i / 7;
    frames.push({ transform: `translate(${((Math.random() * 2 - 1) * p * k).toFixed(1)}px, ${((Math.random() * 2 - 1) * p * k).toFixed(1)}px)` });
  }
  frames.push({ transform: "translate(0,0)" });
  root.animate(frames, { duration: 380, easing: "ease-out" });
}

function vignette(cls: string) {
  const el = spawn(`vignette ${cls}`, 0, 0);
  drop(el, 700);
}

export function lunge(who: number) {
  const art = artEl(who);
  if (!art || reduced()) return;
  const dir = who === PLAYER ? 1 : -1;
  art.animate(
    [{ transform: "translateX(0)" }, { transform: `translateX(${dir * 46}px) translateY(-6px)` }, { transform: "translateX(0)" }],
    { duration: 420 * speed, easing: "cubic-bezier(.3,.7,.3,1)" },
  );
}

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

export function banner(text: string, sub: string, cls = ""): Promise<void> {
  const el = spawn(`banner ${cls}`, 0, 0, `<div class="banner-inner"><b>${text}</b>${sub ? `<small>${sub}</small>` : ""}</div>`);
  const life = cls.includes("short") ? 1000 : 1700;
  drop(el, life);
  return wait(life * 0.7);
}

export function wipe() {
  if (reduced()) return;
  const el = spawn("wipe", 0, 0, `<i></i><i></i><i></i>`);
  drop(el, 1300);
}

export function pulse(selector: string, cls: string) {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/* ------------------------------------------------------------- timeline */

const STATUS_WORD: Record<string, string> = {
  evasion: "Evasion",
  locked: "Locked",
  jam: "Jam",
  burn: "Burn",
  thrust: "Thrust",
  armor: "Armor",
  suppress: "Suppress",
  static: "Static",
  energy: "Energy",
};

export interface PlayContext {
  /** How shots fired by the player travel during this action. */
  playerShot: ShotStyle;
  bars: Map<number, { hp: number; shield: number }>;
  /** Foes that were alive before the action and are already drawn as down. */
  pendingDown: Set<number>;
}

function enemyShot(amount: number, index: number): ShotStyle {
  if (amount >= 14) return "heavy";
  return index % 2 ? "tracer" : amount >= 8 ? "missile" : "tracer";
}

export async function playEvents(events: CombatFx[], ctx: PlayContext) {
  let lastFrom = Number.NaN;
  let volley = 0;
  for (const event of events) {
    if (event.t === "hit") {
      const sameVolley = event.from === lastFrom;
      volley = sameVolley ? volley + 1 : 0;
      lastFrom = event.from;
      const style = event.from === PLAYER ? ctx.playerShot : enemyShot(event.amount + event.blocked, volley);
      await shot(event.from, event.who, style);
      const c = center(event.who);
      const heavy = event.amount >= 12 || style === "heavy";
      if (c) burst(c.x + (Math.random() * 30 - 15), c.y + (Math.random() * 20 - 10), heavy ? 70 : 40, heavy ? "boom" : "hit");
      recoil(event.who, heavy);
      ctx.bars.set(event.who, { hp: event.hp, shield: event.shield });
      setBar(event.who, event.hp, event.shield);
      if (event.amount > 0) {
        floatText(event.who, String(event.amount), event.who === PLAYER ? "dmg dmg-player" : heavy ? "dmg dmg-big" : "dmg");
        if (event.who === PLAYER) {
          sfx("hurt");
          vignette("hurt");
          shake(event.amount);
        } else shake(heavy ? event.amount * 0.5 : 0);
      } else if (event.blocked > 0) {
        floatText(event.who, "Blocked", "dmg-blocked");
        sfx("shield");
      }
      if (event.blocked > 0 && event.amount > 0) pulseShield(event.who);
      await wait(style === "tracer" ? 70 : 110);
    } else if (event.t === "evade") {
      await shot(event.from, event.who, "missile");
      floatText(event.who, "Evaded", "evade");
      const art = artEl(event.who);
      art?.animate([{ transform: "translateY(0)" }, { transform: "translateY(-34px) rotate(-8deg)" }, { transform: "translateY(0)" }], { duration: 420, easing: "ease-out" });
      await wait(120);
    } else if (event.t === "burn") {
      ctx.bars.set(event.who, { hp: event.hp, shield: ctx.bars.get(event.who)?.shield ?? 0 });
      setBar(event.who, event.hp, ctx.bars.get(event.who)?.shield ?? 0);
      if (event.amount > 0) floatText(event.who, String(event.amount), "dmg dmg-burn");
      const c = center(event.who);
      if (c) burst(c.x, c.y, 34, "hit");
      if (event.who === PLAYER && event.amount > 0) vignette("burn");
      await wait(220);
    } else if (event.t === "shield") {
      const prev = ctx.bars.get(event.who);
      ctx.bars.set(event.who, { hp: prev?.hp ?? 0, shield: event.shield });
      if (prev) setBar(event.who, prev.hp, event.shield);
      floatText(event.who, `+${event.amount}`, "gain-shield");
      pulseShield(event.who);
      sfx("shield");
      await wait(160);
    } else if (event.t === "heal") {
      const prev = ctx.bars.get(event.who);
      ctx.bars.set(event.who, { hp: event.hp, shield: prev?.shield ?? 0 });
      setBar(event.who, event.hp, prev?.shield ?? 0);
      floatText(event.who, `+${event.amount}`, "gain-heal");
      sfx("heal");
      await wait(180);
    } else if (event.t === "status") {
      const word = STATUS_WORD[event.k] ?? event.k;
      floatText(event.who, `${event.n > 0 ? "+" : ""}${event.n} ${word}`, `st-float st-${event.k}`);
      if (event.k === "energy") pulse(".energy-orb", "gain");
      await wait(140);
    } else if (event.t === "move") {
      lastFrom = Number.NaN;
      const unit = unitEl(event.uid);
      unit?.classList.add("acting");
      floatText(event.uid, event.name, "move-name");
      if (event.kind === "attack") lunge(event.uid);
      await wait(event.kind === "attack" ? 260 : 300);
      window.setTimeout(() => unit?.classList.remove("acting"), 700);
    } else if (event.t === "down") {
      const c = center(event.who);
      if (c) {
        burst(c.x, c.y, 120, "big");
        window.setTimeout(() => burst(c.x + 40, c.y - 18, 70, "boom"), 160);
      }
      sfx("attack");
      shake(10);
      const unit = unitEl(event.who);
      if (unit) {
        unit.classList.add("crashing");
        if (ctx.pendingDown.has(event.who)) window.setTimeout(() => unit.classList.add("down"), 1100);
      }
      await wait(380);
    } else if (event.t === "phase") {
      floatText(event.uid, event.text, "phase-float");
      const c = center(event.uid);
      if (c) burst(c.x, c.y, 90, "boom");
      shake(6);
      await wait(500);
    } else if (event.t === "turn") {
      lastFrom = Number.NaN;
    }
  }
}

function pulseShield(who: number) {
  const badge = root.querySelector<HTMLElement>(`[data-bar="${who}"] .bar-shield`);
  badge?.animate([{ transform: "scale(1.5)" }, { transform: "scale(1)" }], { duration: 300, easing: "ease-out" });
}

/* ----------------------------------------------------------------- cards */

/** Throws a copy of a played card from where it sat toward the stage. */
export function throwCard(snapshot: { html: string; rect: DOMRect; rot: number }, attack: boolean) {
  if (reduced()) return;
  const el = document.createElement("div");
  el.className = "card-ghost";
  el.innerHTML = snapshot.html;
  const r = snapshot.rect;
  el.style.left = `${r.left}px`;
  el.style.top = `${r.top}px`;
  el.style.width = `${r.width}px`;
  el.style.height = `${r.width * 1.4}px`;
  el.style.setProperty("--cw", `${r.width}px`);
  layer.appendChild(el);
  const tx = window.innerWidth / 2 - (r.left + r.width / 2);
  const ty = window.innerHeight * (attack ? 0.32 : 0.4) - (r.top + r.height / 2);
  el.animate(
    [
      { transform: `translate(0,0) rotate(${snapshot.rot}deg) scale(1)`, opacity: 1, filter: "brightness(1)" },
      { transform: `translate(${tx * 0.8}px, ${ty * 0.8}px) rotate(0deg) scale(1.08)`, opacity: 1, filter: "brightness(1.4)", offset: 0.55 },
      { transform: `translate(${tx}px, ${ty - 30}px) rotate(0deg) scale(.6)`, opacity: 0, filter: "brightness(3) blur(2px)" },
    ],
    { duration: 420, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" },
  );
  drop(el, 460);
}

/** Slides hand slots from their previous rects into their new places, and deals new ones from the draw pile. */
export function flipHand(before: Map<string, DOMRect>, fresh: boolean) {
  const slots = [...root.querySelectorAll<HTMLElement>(".hand .slot")];
  const pile = root.querySelector<HTMLElement>(".pile-draw")?.getBoundingClientRect();
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
      if (Math.abs(dx) + Math.abs(dy) > 1) {
        card.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], { duration: 260, easing: "cubic-bezier(.2,.8,.3,1)" });
      }
    } else if (pile && !reduced()) {
      const dx = pile.left + pile.width / 2 - (now.left + now.width / 2);
      const dy = pile.top + pile.height / 2 - (now.top + now.height / 2);
      card.animate(
        [
          { translate: `${dx}px ${dy}px`, scale: "0.3", opacity: 0, rotate: "-40deg" },
          { opacity: 1, offset: 0.3 },
          { translate: "0 0", scale: "1", opacity: 1, rotate: "0deg" },
        ],
        { duration: 380, delay: dealt * 70, easing: "cubic-bezier(.2,.8,.3,1)", fill: "backwards" },
      );
      dealt += 1;
    }
  }
}

export function handRects(): Map<string, DOMRect> {
  const out = new Map<string, DOMRect>();
  for (const slot of root.querySelectorAll<HTMLElement>(".hand .slot")) {
    const card = slot.querySelector<HTMLElement>(".card");
    if (card && slot.dataset.uid) out.set(slot.dataset.uid, card.getBoundingClientRect());
  }
  return out;
}

/* ------------------------------------------------------------ aim arrow */

let arrow: SVGPathElement | null = null;
let arrowHead: SVGPathElement | null = null;

export function aim(from: { x: number; y: number } | null, to: { x: number; y: number } | null, hot: boolean) {
  if (!from || !to) {
    arrow?.remove();
    arrowHead?.remove();
    arrow = null;
    arrowHead = null;
    return;
  }
  if (!arrow) {
    arrow = svgPath("", "aim");
    arrowHead = svgPath("", "aim-head");
  }
  const cx = from.x + (to.x - from.x) * 0.2;
  const cy = Math.min(from.y, to.y) - 120;
  arrow.setAttribute("d", `M${from.x} ${from.y} Q${cx} ${cy} ${to.x} ${to.y}`);
  const angle = Math.atan2(to.y - cy, to.x - cx);
  const s = 20;
  const p1 = `${to.x - Math.cos(angle - 0.45) * s} ${to.y - Math.sin(angle - 0.45) * s}`;
  const p2 = `${to.x - Math.cos(angle + 0.45) * s} ${to.y - Math.sin(angle + 0.45) * s}`;
  arrowHead!.setAttribute("d", `M${p1} L${to.x} ${to.y} L${p2}`);
  arrow.classList.toggle("hot", hot);
  arrowHead!.classList.toggle("hot", hot);
}
