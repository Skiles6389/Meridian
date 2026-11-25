/*
 * Draws the card recipes from cardfx.ts: the cast on the player's jet, each shot on its way to a
 * target, and the impact where it lands. Particles and drawn effects go to the canvas in gfx.ts;
 * only the jet's own pose changes (rolls, jinks, cloaks) touch the DOM.
 */

import { sfx } from "../audio";
import { PLAYER } from "../game/combat";
import { C, cardAnim, MAX_LEAD, type Impact, type Shot, type Step, type Where } from "./cardfx";
import { addEffect, emit, flash, glow, ring, shards, smoke, sparks } from "./gfx";
import { anchor, appRoot, artEl, center, depth, easeBack, easeOut, lerp, livingFoes, midOf, muzzle, nozzles, rectOf, rectOfSel, reduced, rnd, timeScale, wait, type Pt } from "./geo";

type Ctx2 = CanvasRenderingContext2D;
type StepOf<K extends Step["fx"]> = Extract<Step, { fx: K }>;
type ShotOf<K extends Shot["fx"]> = Extract<Shot, { fx: K }>;

interface CastCtx {
  target: number | null;
}

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

function line(c: Ctx2, a: Pt, b: Pt, color: string, width: number, alpha = 1) {
  c.globalAlpha = alpha;
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(a.x, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
}

function jagged(a: Pt, b: Pt, steps: number, sway: number): Pt[] {
  const pts: Pt[] = [];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const off = i === 0 || i === steps ? 0 : rnd(-1, 1) * sway;
    pts.push({ x: a.x + dx * t - (dy / len) * off, y: a.y + dy * t + (dx / len) * off });
  }
  return pts;
}

function poly(c: Ctx2, pts: Pt[], color: string, width: number, alpha = 1) {
  c.globalAlpha = alpha;
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineJoin = "round";
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.stroke();
}

/** Flickering horizontal bars of interference over a box. */
function staticBars(r: DOMRect, color: string, bars: number, life: number, delay = 0) {
  const box = { x: r.left - r.width * 0.08, y: r.top - r.height * 0.15, w: r.width * 1.16, h: r.height * 1.3 };
  let frame = -1;
  let cells: number[][] = [];
  void tick(
    life,
    (_dt, k, age, c) => {
      const f = Math.floor(age / 0.045);
      if (f !== frame) {
        frame = f;
        cells = Array.from({ length: bars }, () => [Math.random(), Math.random(), rnd(0.25, 1), rnd(2, 7), Math.random()]);
      }
      c.globalCompositeOperation = "lighter";
      for (const [fx, fy, fw, h, bright] of cells) {
        c.globalAlpha = (0.25 + bright * 0.6) * pulse(k, 0.1, 0.35);
        c.fillStyle = bright > 0.8 ? "#ffffff" : color;
        const w = box.w * fw;
        c.fillRect(box.x + (box.w - w) * fx, box.y + box.h * fy, w, h);
      }
    },
    delay,
  );
}

function pose(who: number, frames: Keyframe[], ms: number, easing = "cubic-bezier(.3,.7,.3,1)") {
  if (reduced()) return;
  artEl(who)?.animate(frames, { duration: ms * timeScale(), easing });
}

/* ----------------------------------------------------------------- casts */

const STEPS: { [K in Step["fx"]]: (s: StepOf<K>, ctx: CastCtx) => void } = {
  flares(s) {
    const r = rectOf(PLAYER);
    if (!r) return;
    const k = Math.max(0.6, depth(PLAYER));
    const life = s.fall ? 1.0 : 0.72;
    const pts = Array.from({ length: s.count }, (_, i) => {
      const t = s.count > 1 ? i / (s.count - 1) - 0.5 : 0;
      // Thrown up and out to both sides, then arcing over and falling away behind the jet.
      const ang = ((-90 + t * s.spread * 1.7) * Math.PI) / 180;
      const v = rnd(560, 760) * k;
      return {
        x: r.left + r.width * (0.5 + t * 0.34),
        y: r.top + r.height * 0.55,
        vx: Math.cos(ang) * v * 1.2,
        vy: Math.sin(ang) * v * (s.fall ? 0.3 : 0.62),
        smoke: 0,
        delay: Math.abs(t) * (s.fall ? 0.18 : 0.08),
      };
    });
    flash(r.left + r.width / 2, r.top + r.height * 0.6, 40 * k, s.color);
    void tick(life, (dt, kk, age) => {
      for (const p of pts) {
        if (age < p.delay) continue;
        const d = 0.08 ** dt;
        p.vx *= d;
        p.vy = p.vy * d + (s.fall ? 620 : 420) * k * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const fade = 1 - kk ** 2;
        emit({ kind: "glow", x: p.x, y: p.y, size: (17 + Math.random() * 9) * k * fade + 2, color: s.color, life: 0.08, alpha: 0.95 });
        emit({ kind: "glow", x: p.x, y: p.y, size: 6 * k * fade + 1, color: "#ffffff", life: 0.06 });
        p.smoke += dt;
        if (p.smoke > 0.03) {
          p.smoke = 0;
          smoke(p.x, p.y, 13 * k, "#e8dccb", 0.55, { alpha: 0.32 });
          if (Math.random() < 0.5) emit({ kind: "spark", x: p.x, y: p.y, vx: rnd(-40, 40), vy: rnd(20, 90), g: 300, life: 0.3, size: 1.4, color: s.color });
        }
      }
    });
  },

  chaff(s) {
    const r = rectOf(PLAYER);
    if (!r) return;
    const o = { x: r.left + r.width / 2, y: r.top + r.height * 0.62 };
    const reach = r.width * s.radius;
    flash(o.x, o.y, 28, s.color, 0.12);
    for (let i = 0; i < s.count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = reach * rnd(0.6, 2.6);
      emit({
        kind: "dot",
        x: o.x + rnd(-8, 8),
        y: o.y + rnd(-4, 4),
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v * 0.55,
        g: 30,
        drag: 0.03,
        life: rnd(0.6, 1.15),
        size: rnd(1.4, 3.2),
        color: Math.random() < 0.3 ? "#ffffff" : s.color,
        flicker: 0.85,
        delay: Math.random() * 0.08,
      });
    }
    for (let i = 0; i < 5; i++) smoke(o.x + rnd(-reach, reach) * 0.3, o.y + rnd(-10, 10), reach * 0.34, s.color, 0.8, { alpha: 0.16 });
  },

  dome(s) {
    const r = rectOf(PLAYER);
    if (!r) return;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height * 0.52;
    const rx = r.width * 0.6;
    const ry = Math.max(r.height * 0.86, r.width * 0.3);
    const cell = Math.max(12, r.width * 0.075);
    void addEffect({
      life: 0.72,
      draw: (c, k, age) => {
        const grow = k < 0.3 ? easeBack(k / 0.3) : 1;
        const a = pulse(k, 0.12, 0.45);
        c.globalCompositeOperation = "lighter";
        c.translate(cx, cy);
        c.scale(grow, grow);
        const fill = c.createRadialGradient(0, -ry * 0.3, ry * 0.1, 0, 0, rx);
        fill.addColorStop(0, s.color + "00");
        fill.addColorStop(0.75, s.color + "22");
        fill.addColorStop(1, s.color + "66");
        c.globalAlpha = a;
        c.fillStyle = fill;
        c.beginPath();
        c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        c.fill();
        if (s.hex) {
          c.save();
          c.clip();
          c.strokeStyle = s.color;
          c.lineWidth = 1.2;
          const hgt = cell * 0.866;
          for (let row = -Math.ceil(ry / hgt); row <= Math.ceil(ry / hgt); row++) {
            for (let col = -Math.ceil(rx / (cell * 1.5)); col <= Math.ceil(rx / (cell * 1.5)); col++) {
              const hx = col * cell * 1.5;
              const hy = row * hgt * 2 + (col & 1 ? hgt : 0);
              const dist = Math.hypot(hx / rx, hy / ry);
              if (dist > 1.05) continue;
              const wave = Math.max(0, 1 - Math.abs(dist - age * 2.2) * 3.2);
              c.globalAlpha = a * (0.12 + dist * 0.25 + wave * 0.75);
              c.beginPath();
              for (let i = 0; i < 6; i++) {
                const ang = (Math.PI / 3) * i;
                const px = hx + Math.cos(ang) * cell * 0.5;
                const py = hy + Math.sin(ang) * cell * 0.5;
                if (i) c.lineTo(px, py);
                else c.moveTo(px, py);
              }
              c.closePath();
              c.stroke();
            }
          }
          c.restore();
        }
        for (let i = 0; i < s.rings; i++) {
          const rk = (age * 1.6 + i / s.rings) % 1;
          c.globalAlpha = a * (i === 0 ? 1 : 1 - rk);
          c.strokeStyle = i === 0 ? "#ffffff" : s.color;
          c.lineWidth = i === 0 ? 2.2 : 1.6;
          const m = i === 0 ? 1 : 1 + rk * 0.22;
          c.beginPath();
          c.ellipse(0, 0, rx * m, ry * m, 0, 0, Math.PI * 2);
          c.stroke();
        }
        // A bright glint that runs round the rim.
        const ga = age * 7;
        c.globalAlpha = a;
        c.drawImage(glintSprite(s.color), Math.cos(ga) * rx - 14, Math.sin(ga) * ry - 14, 28, 28);
      },
    });
  },

  plates(s) {
    const r = rectOf(PLAYER);
    if (!r) return;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height * 0.52;
    const rx = r.width * 0.44;
    const ry = Math.max(r.height * 0.62, r.width * 0.2);
    const w = Math.max(18, r.width * 0.17);
    const h = w * 0.5;
    const slots = Array.from({ length: s.count }, (_, i) => {
      const ang = -Math.PI / 2 + ((i + 0.5) / s.count) * Math.PI * 2;
      return { ang, x: Math.cos(ang) * rx, y: Math.sin(ang) * ry, at: i * 0.045, hit: false };
    });
    void addEffect({
      life: 0.5 + s.count * 0.045 + 0.3,
      draw: (c, k, age) => {
        const fade = k > 0.75 ? (1 - k) / 0.25 : 1;
        c.translate(cx, cy);
        for (const p of slots) {
          const t = Math.min(1, Math.max(0, (age - p.at) / 0.2));
          if (t <= 0) continue;
          const far = 1 + (1 - t ** 2.4) * 1.6;
          const x = p.x * far;
          const y = p.y * far;
          if (t >= 1 && !p.hit) {
            p.hit = true;
            flash(cx + p.x, cy + p.y, w * 0.55, "#ffffff", 0.1);
            sparks(cx + p.x, cy + p.y, { count: 4, color: C.brass, speed: 190, life: 0.25, size: 1.4 });
          }
          c.save();
          c.translate(x, y);
          c.rotate(p.ang + Math.PI / 2 + (1 - t) * 0.9);
          const settle = t >= 1 ? 1 + Math.max(0, 0.18 - (age - p.at - 0.2)) * 0.9 : 1;
          c.scale(settle, settle);
          c.globalAlpha = fade * Math.min(1, t * 3);
          const g = c.createLinearGradient(0, -h / 2, 0, h / 2);
          g.addColorStop(0, "#ffffff");
          g.addColorStop(0.18, s.color);
          g.addColorStop(1, "#3a4350");
          c.fillStyle = g;
          c.beginPath();
          c.moveTo(-w / 2 + 3, -h / 2);
          c.lineTo(w / 2 - 3, -h / 2);
          c.lineTo(w / 2, h / 2);
          c.lineTo(-w / 2, h / 2);
          c.closePath();
          c.fill();
          c.strokeStyle = "#0c1218";
          c.lineWidth = 1.2;
          c.stroke();
          c.fillStyle = "#101820";
          c.fillRect(-w / 2 + 4, 0, 2, 2);
          c.fillRect(w / 2 - 6, 0, 2, 2);
          c.restore();
        }
      },
    });
  },

  roll(s) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    pose(PLAYER, [{ rotate: "0deg" }, { rotate: `${dir * 360 * s.turns}deg` }], s.ms, "cubic-bezier(.45,.05,.3,1)");
  },

  jink(s) {
    const r = rectOf(PLAYER);
    const far = (r?.width ?? 200) * 0.3 * s.dir;
    pose(PLAYER, [{ transform: "none" }, { transform: `translate(${far}px, -4%) rotate(${s.dir * 32}deg)`, offset: 0.4 }, { transform: `translate(${far * 0.5}px, 0) rotate(${s.dir * -8}deg)`, offset: 0.75 }, { transform: "none" }], 460);
  },

  loop(s) {
    pose(
      PLAYER,
      [
        { transform: "translateY(0) scale(1) rotate(0deg)" },
        { transform: "translateY(-26%) scale(.84) rotate(0deg)", offset: 0.34 },
        { transform: "translateY(-34%) scale(.78) rotate(180deg)", offset: 0.62 },
        { transform: "translateY(-10%) scale(.94) rotate(360deg)", offset: 0.86 },
        { transform: "translateY(0) scale(1) rotate(360deg)" },
      ],
      s.ms,
      "cubic-bezier(.4,.1,.3,1)",
    );
  },

  dip(s) {
    pose(PLAYER, [{ transform: "none" }, { transform: "translateY(16%) scale(1.07) rotate(-3deg)", offset: 0.4 }, { transform: "translateY(12%) scale(1.05) rotate(2deg)", offset: 0.65 }, { transform: "none" }], s.ms);
  },

  cloak(s) {
    const r = rectOf(PLAYER);
    const img = artEl(PLAYER)?.querySelector<HTMLElement>(".cj img");
    if (!r || !img) return;
    if (!reduced()) {
      img.animate([{ opacity: 1 }, { opacity: 0.16, offset: 0.25 }, { opacity: 0.22, offset: 0.7 }, { opacity: 1 }], { duration: s.ms * timeScale(), easing: "ease-in-out" });
    }
    const life = s.ms / 1000;
    void tick(life, (_dt, k, age, c) => {
      // A shimmer line sweeps across the fading airframe.
      c.globalCompositeOperation = "lighter";
      const x = r.left + r.width * ((age * 1.8) % 1);
      const g = c.createLinearGradient(x - 26, 0, x + 26, 0);
      g.addColorStop(0, s.color + "00");
      g.addColorStop(0.5, s.color + "aa");
      g.addColorStop(1, s.color + "00");
      c.globalAlpha = pulse(k, 0.2, 0.4) * 0.8;
      c.fillStyle = g;
      c.fillRect(x - 26, r.top + r.height * 0.1, 52, r.height * 0.8);
    });
    for (let i = 0; i < 14; i++) {
      emit({ kind: "dot", x: r.left + Math.random() * r.width, y: r.top + r.height * rnd(0.2, 0.8), vy: rnd(-50, -15), life: rnd(0.3, life), size: rnd(1.2, 2.6), color: s.color, flicker: 0.7, delay: Math.random() * life * 0.5 });
    }
  },

  afterimage(s) {
    const art = artEl(PLAYER);
    const src = art?.querySelector<HTMLElement>(".cj");
    if (!art || !src || reduced()) return;
    for (let i = 0; i < s.count; i++) {
      const ghost = src.cloneNode(true) as HTMLElement;
      ghost.classList.add("cj-ghost");
      ghost.style.setProperty("--tint", s.color);
      art.appendChild(ghost);
      const dir = i % 2 ? 1 : -1;
      const far = (20 + Math.floor(i / 2) * 14) * dir;
      const anim = ghost.animate(
        [
          { translate: "0 0", opacity: 0.7 },
          { translate: `${far}% ${-4 - i * 2}%`, opacity: 0.45, offset: 0.45 },
          { translate: `${far * 1.25}% 0`, opacity: 0 },
        ],
        { duration: (420 + i * 60) * timeScale(), easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" },
      );
      anim.finished.catch(() => undefined).then(() => ghost.remove());
    }
  },

  burner(s) {
    const r = rectOf(PLAYER);
    const pts = nozzles(PLAYER);
    if (!r || !pts.length) return;
    const base = r.width * 0.07 * s.len;
    for (const p of pts) {
      flash(p.x, p.y, base * 2.2, s.color, 0.18);
      void ring(p.x, p.y, base * 0.4, base * 3.4, s.color, 0.32, 2.5);
    }
    pose(PLAYER, [{ transform: "none" }, { transform: `translateY(${-3 * s.len}%) scale(${1 - 0.03 * s.len})`, offset: 0.3 }, { transform: "none" }], s.ms, "cubic-bezier(.2,.8,.3,1)");
    void tick(s.ms / 1000, (_dt, k) => {
      const power = pulse(k, 0.12, 0.5);
      for (const p of pts) {
        emit({ kind: "glow", x: p.x + rnd(-1, 1), y: p.y + rnd(0, base * 0.3), size: base * (1.3 + Math.random() * 0.7) * power + 2, color: s.color, life: 0.08 });
        if (Math.random() < 0.7) {
          emit({ kind: "spark", x: p.x + rnd(-base, base) * 0.3, y: p.y, vx: rnd(-30, 30), vy: rnd(160, 380) * s.len, life: 0.26, size: 1.8, color: s.color, stretch: 0.05, g: 0 });
        }
      }
    });
  },

  vapor(s) {
    const r = rectOf(PLAYER);
    if (!r) return;
    for (const side of [-1, 1]) {
      const tip = { x: r.left + r.width * (0.5 + side * 0.44), y: r.top + r.height * 0.56 };
      for (let i = 0; i < 9; i++) {
        smoke(tip.x - side * i * r.width * 0.012, tip.y + i * 2, r.width * 0.05, s.color, 0.5, { vx: side * rnd(20, 70), vy: rnd(30, 120), alpha: 0.5, delay: i * 0.018 });
      }
      emit({ kind: "spark", x: tip.x, y: tip.y, vx: side * 60, vy: 260, life: 0.3, size: 2, color: s.color, stretch: 0.12, g: 0 });
    }
  },

  vent(s) {
    const r = rectOf(PLAYER);
    if (!r) return;
    for (let i = 0; i < s.count; i++) {
      emit({
        kind: "glow",
        x: r.left + r.width * rnd(0.25, 0.75),
        y: r.top + r.height * rnd(0.35, 0.7),
        vx: rnd(-60, 60),
        vy: rnd(-150, -50),
        g: -90,
        drag: 0.4,
        life: rnd(0.5, 0.95),
        size: rnd(3, 7),
        color: s.color,
        flicker: 0.5,
        delay: Math.random() * 0.2,
      });
    }
    for (let i = 0; i < 4; i++) smoke(r.left + r.width * rnd(0.35, 0.65), r.top + r.height * 0.5, r.width * 0.1, "#3c3f48", 0.8, { vy: -60, alpha: 0.35 });
  },

  ping(s, ctx) {
    const from = center(PLAYER);
    if (!from) return;
    const jet = rectOf(PLAYER)!;
    if (s.on === "self") {
      for (let i = 0; i < s.rings; i++) void ring(from.x, from.y, jet.width * 0.2, jet.width * 1.5, s.color, 0.6, 3, i * 0.11);
      return;
    }
    void ring(from.x, from.y, jet.width * 0.12, jet.width * 0.5, s.color, 0.28, 2.5);
    for (const uid of targetsOf(s.on, ctx)) {
      const to = center(uid);
      const tr = rectOf(uid);
      if (!to || !tr) continue;
      const size = Math.max(tr.width, tr.height) * 0.75;
      // The pulse runs out to the contact as an arc, then rings it.
      void addEffect({
        life: 0.2,
        draw: (c, k) => {
          const x = lerp(from.x, to.x, k);
          const y = lerp(from.y, to.y, k);
          const ang = Math.atan2(to.y - from.y, to.x - from.x);
          c.globalCompositeOperation = "lighter";
          c.globalAlpha = 0.9;
          c.strokeStyle = s.color;
          c.lineWidth = 3;
          c.beginPath();
          c.arc(x, y, lerp(30, 14, k), ang - 0.9, ang + 0.9);
          c.stroke();
        },
      });
      for (let i = 0; i < s.rings; i++) {
        if (s.inward) void ring(to.x, to.y, size * 1.9, size * 0.3, s.color, 0.42, 2.5, 0.16 + i * 0.1);
        else void ring(to.x, to.y, size * 0.2, size * 1.3, s.color, 0.5, 2.5, 0.18 + i * 0.12);
      }
      later(190, () => glow(to.x, to.y, size * 0.5, s.color, 0.3, 0, 0.6));
    }
  },

  sweep(s) {
    const o = anchor(PLAYER, 0.5, 0.3);
    if (!o) return;
    const foes = livingFoes().map((uid) => center(uid)).filter((p): p is Pt => !!p);
    const reach = Math.max(180, ...foes.map((p) => Math.hypot(p.x - o.x, p.y - o.y) + 40));
    const arc = (s.arc * Math.PI) / 180;
    const start = -Math.PI / 2 - arc / 2;
    void addEffect({
      life: 0.6,
      draw: (c, k) => {
        const lead = start + arc * easeOut(k);
        const tail = Math.max(start, lead - 0.9);
        c.globalCompositeOperation = "lighter";
        const g = c.createRadialGradient(o.x, o.y, 8, o.x, o.y, reach);
        g.addColorStop(0, s.color + "55");
        g.addColorStop(1, s.color + "00");
        c.globalAlpha = pulse(k, 0.1, 0.3);
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(o.x, o.y);
        c.arc(o.x, o.y, reach, tail, lead);
        c.closePath();
        c.fill();
        line(c, o, { x: o.x + Math.cos(lead) * reach, y: o.y + Math.sin(lead) * reach }, s.color, 2, pulse(k, 0.1, 0.3));
      },
    });
    foes.forEach((p, i) => void ring(p.x, p.y, 4, 30, s.color, 0.4, 2.5, 0.22 + i * 0.08));
  },

  lock(s, ctx) {
    targetsOf(s.on, ctx).forEach((uid, i) => {
      const r = rectOf(uid);
      if (!r) return;
      const p = midOf(r);
      const size = Math.max(26, Math.max(r.width * 0.5, r.height * 0.75));
      void addEffect({
        life: 0.52,
        delay: i * 0.07,
        draw: (c, k) => {
          const t = Math.min(1, k / 0.42);
          const m = lerp(2.3, 1, easeOut(t));
          const blink = k > 0.42 && Math.floor((k - 0.42) / 0.1) % 2 === 1 ? 0.35 : 1;
          c.globalCompositeOperation = "lighter";
          c.translate(p.x, p.y);
          c.strokeStyle = s.color;
          c.lineWidth = 2.4;
          c.globalAlpha = Math.min(1, t * 2.5) * blink * (k > 0.85 ? (1 - k) / 0.15 : 1);
          const half = size * m;
          if (s.shape === "circle") {
            c.rotate((1 - t) * 2.2);
            for (let q = 0; q < 4; q++) {
              c.beginPath();
              c.arc(0, 0, half, q * (Math.PI / 2) + 0.25, (q + 1) * (Math.PI / 2) - 0.25);
              c.stroke();
            }
            c.fillStyle = s.color;
            c.fillRect(-2, -2, 4, 4);
          } else if (s.shape === "cross") {
            const gap = half * 0.3;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              c.beginPath();
              c.moveTo(dx * gap, dy * gap);
              c.lineTo(dx * half * 1.3, dy * half * 1.3);
              c.stroke();
            }
            c.strokeRect(-gap, -gap, gap * 2, gap * 2);
          } else {
            c.rotate((s.shape === "diamond" ? Math.PI / 4 : 0) + (1 - t) * 1.2);
            const arm = half * 0.42;
            for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
              c.beginPath();
              c.moveTo(sx * half, sy * (half - arm));
              c.lineTo(sx * half, sy * half);
              c.lineTo(sx * (half - arm), sy * half);
              c.stroke();
            }
          }
        },
      });
      later(i * 70 + 210, () => glow(p.x, p.y, size * 0.7, s.color, 0.2, 0, 0.5));
    });
  },

  lines(s, ctx) {
    const from = muzzle(PLAYER);
    if (!from) return;
    targetsOf(s.on, ctx).forEach((uid, i) => {
      const to = center(uid);
      if (!to) return;
      void addEffect({
        life: 0.55,
        delay: i * 0.06,
        draw: (c, k, age) => {
          const t = Math.min(1, k / 0.3);
          const end = { x: lerp(from.x, to.x, easeOut(t)), y: lerp(from.y, to.y, easeOut(t)) };
          c.globalCompositeOperation = "lighter";
          c.setLineDash([8, 6]);
          c.lineDashOffset = -age * 160;
          line(c, from, end, s.color, 2, pulse(k, 0.08, 0.35));
          c.setLineDash([]);
          c.translate(end.x, end.y);
          c.rotate(Math.PI / 4);
          c.strokeRect(-6, -6, 12, 12);
        },
      });
    });
  },

  static(s, ctx) {
    for (const uid of targetsOf(s.on, ctx)) {
      const r = rectOf(uid);
      if (r) staticBars(r, s.color, s.bars, 0.42);
    }
  },

  glitch(s) {
    const stage = appRoot().querySelector<HTMLElement>(".stage");
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    if (!reduced()) {
      const frames: Keyframe[] = [];
      for (let i = 0; i < 6; i++) frames.push({ transform: `translate(${rnd(-7, 7).toFixed(1)}px, ${rnd(-2, 2).toFixed(1)}px) skewX(${rnd(-1.2, 1.2).toFixed(2)}deg)` });
      frames.push({ transform: "none" });
      stage.animate(frames, { duration: s.ms * timeScale(), easing: "steps(7, end)" });
    }
    let frame = -1;
    let bars: number[][] = [];
    void tick(s.ms / 1000, (_dt, k, age, c) => {
      const f = Math.floor(age / 0.05);
      if (f !== frame) {
        frame = f;
        bars = Array.from({ length: 7 }, () => [Math.random(), rnd(3, 22), Math.random(), rnd(-30, 30)]);
      }
      c.globalCompositeOperation = "lighter";
      for (const [fy, h, hue, dx] of bars) {
        c.globalAlpha = 0.16 * pulse(k, 0.1, 0.4);
        c.fillStyle = hue < 0.33 ? C.magenta : hue < 0.66 ? C.cyan : "#ffffff";
        c.fillRect(r.left + dx, r.top + r.height * fy, r.width, h);
      }
    });
  },

  wave(s) {
    const o = center(PLAYER);
    const stage = rectOfSel(".stage");
    if (!o || !stage) return;
    const reach = Math.hypot(stage.width, stage.height) * 0.75;
    for (let i = 0; i < s.rings; i++) {
      const color = s.colors[i % s.colors.length];
      void addEffect({
        life: 0.62,
        delay: i * 0.075,
        draw: (c, k) => {
          const e = easeOut(k);
          c.globalCompositeOperation = "lighter";
          c.globalAlpha = (1 - k) ** 1.3;
          c.strokeStyle = color;
          c.lineWidth = lerp(7, 1.5, k);
          c.beginPath();
          c.ellipse(o.x, o.y, reach * e, reach * e * 0.62, 0, Math.PI * 1.05, Math.PI * 1.95);
          c.stroke();
          c.globalAlpha *= 0.4;
          c.beginPath();
          c.ellipse(o.x, o.y, reach * e, reach * e * 0.62, 0, Math.PI * 0.05, Math.PI * 0.95);
          c.stroke();
        },
      });
    }
  },

  hud(s) {
    const pile = rectOfSel(".pile-draw");
    const hand = rectOfSel(".hand");
    const jet = rectOf(PLAYER);
    if (jet) {
      // Head-up brackets snap in around the jet.
      const p = midOf(jet);
      void addEffect({
        life: 0.4,
        draw: (c, k) => {
          const w = jet.width * lerp(0.75, 0.6, easeOut(k));
          const h = Math.max(jet.height * 0.7, 28);
          c.globalCompositeOperation = "lighter";
          c.strokeStyle = s.color;
          c.lineWidth = 2;
          c.globalAlpha = pulse(k, 0.15, 0.5);
          for (const side of [-1, 1]) {
            c.beginPath();
            c.moveTo(p.x + side * (w - 10), p.y - h);
            c.lineTo(p.x + side * w, p.y - h);
            c.lineTo(p.x + side * w, p.y + h);
            c.lineTo(p.x + side * (w - 10), p.y + h);
            c.stroke();
          }
        },
      });
    }
    if (!pile || !hand) return;
    const a = midOf(pile);
    for (let i = 0; i < s.lines; i++) {
      const b = { x: hand.left + hand.width * (0.3 + (0.4 * (i + 0.5)) / s.lines), y: hand.top + hand.height * 0.3 };
      const ctl = { x: lerp(a.x, b.x, 0.4), y: Math.min(a.y, b.y) - 70 };
      let prev: Pt = a;
      void tick(
        0.26,
        (_dt, k) => {
          const e = easeOut(k);
          const u = 1 - e;
          const p = { x: u * u * a.x + 2 * u * e * ctl.x + e * e * b.x, y: u * u * a.y + 2 * u * e * ctl.y + e * e * b.y };
          emit({ kind: "spark", x: p.x, y: p.y, vx: (p.x - prev.x) * 60, vy: (p.y - prev.y) * 60, life: 0.16, size: 2.4, color: s.color, stretch: 0.05, g: 0, drag: 0.001 });
          emit({ kind: "glow", x: p.x, y: p.y, size: 7, color: s.color, life: 0.1 });
          prev = p;
        },
        i * 0.06,
      );
    }
    flash(a.x, a.y, 20, s.color, 0.14);
  },

  siphon(s, ctx) {
    const foes = targetsOf(ctx.target === null ? "all" : "target", ctx);
    const hand = rectOfSel(".hand");
    if (!foes.length || !hand) return;
    const b = { x: hand.left + hand.width / 2, y: hand.top + hand.height * 0.3 };
    for (let i = 0; i < s.count; i++) {
      const a = center(foes[i % foes.length]);
      if (!a) continue;
      const bend = rnd(-90, 90);
      void addEffect({
        life: 0.34,
        delay: i * 0.04,
        draw: (c, k) => {
          const e = k * k;
          const x = lerp(a.x, b.x, e) + Math.sin(k * Math.PI) * bend;
          const y = lerp(a.y, b.y, e);
          c.globalCompositeOperation = "lighter";
          c.fillStyle = s.color;
          for (let t = 0; t < 3; t++) {
            c.globalAlpha = (1 - t * 0.3) * pulse(k, 0.1, 0.2);
            const size = 7 - t * 1.6;
            c.fillRect(x - size / 2, y - size / 2 - t * 9 * (b.y > a.y ? 1 : -1), size, size);
          }
        },
      });
    }
    later(260, () => flash(b.x, b.y, 26, s.color, 0.18));
  },

  repair(s) {
    const r = rectOf(PLAYER);
    if (!r) return;
    const spots = Math.max(2, Math.round(s.sparks / 5));
    for (let i = 0; i < spots; i++) {
      later(i * 70, () => {
        const x = r.left + r.width * rnd(0.22, 0.78);
        const y = r.top + r.height * rnd(0.35, 0.7);
        flash(x, y, 16, "#ffffff", 0.12);
        sparks(x, y, { count: Math.ceil(s.sparks / spots), color: s.color, speed: 260, life: 0.4, size: 1.6, g: 520 });
      });
    }
    const motes = Array.from({ length: 5 }, () => ({ x: r.left + r.width * rnd(0.25, 0.75), y: r.top + r.height * rnd(0.3, 0.7), d: Math.random() * 0.2, s: rnd(5, 9) }));
    void addEffect({
      life: 0.75,
      draw: (c, _k, age) => {
        c.globalCompositeOperation = "lighter";
        c.fillStyle = s.color;
        for (const m of motes) {
          const t = (age - m.d) / 0.55;
          if (t <= 0 || t >= 1) continue;
          c.globalAlpha = pulse(t, 0.2, 0.5);
          const y = m.y - t * 46;
          c.fillRect(m.x - m.s, y - m.s / 3, m.s * 2, (m.s * 2) / 3);
          c.fillRect(m.x - m.s / 3, y - m.s, (m.s * 2) / 3, m.s * 2);
        }
      },
    });
  },

  tape(s) {
    const r = rectOf(PLAYER);
    if (!r) return;
    const strips = Array.from({ length: s.count }, (_, i) => ({
      x: r.left + r.width * (0.26 + (0.48 * (i + 0.5)) / s.count),
      y: r.top + r.height * rnd(0.42, 0.62),
      rot: rnd(-0.7, 0.7),
      at: i * 0.075,
      hit: false,
    }));
    const len = Math.max(26, r.width * 0.2);
    const thick = Math.max(6, r.width * 0.035);
    void addEffect({
      life: 0.5 + s.count * 0.075 + 0.25,
      draw: (c, k, age) => {
        const fade = k > 0.78 ? (1 - k) / 0.22 : 1;
        for (const t of strips) {
          const u = Math.min(1, (age - t.at) / 0.12);
          if (u <= 0) continue;
          if (u >= 1 && !t.hit) {
            t.hit = true;
            flash(t.x, t.y, 14, "#ffffff", 0.08);
          }
          c.save();
          c.translate(t.x, t.y);
          c.rotate(t.rot);
          const m = lerp(1.9, 1, u * u);
          c.scale(m, m);
          c.globalAlpha = fade * u;
          const g = c.createLinearGradient(0, -thick / 2, 0, thick / 2);
          g.addColorStop(0, "#ffffff");
          g.addColorStop(0.4, s.color);
          g.addColorStop(1, "#7d8794");
          c.fillStyle = g;
          c.fillRect(-len / 2, -thick / 2, len, thick);
          c.restore();
        }
      },
    });
  },

  rivets(s) {
    const r = rectOf(PLAYER);
    if (!r) return;
    for (let i = 0; i < s.count; i++) {
      later(i * 34, () => {
        const t = (i + 0.5) / s.count;
        const x = r.left + r.width * (0.14 + t * 0.72);
        const y = r.top + r.height * (0.56 - Math.abs(t - 0.5) * 0.12);
        flash(x, y, 9, "#ffffff", 0.08);
        sparks(x, y, { count: 3, color: s.color, speed: 150, life: 0.22, size: 1.3, dir: -Math.PI / 2, spread: 1 });
        emit({ kind: "dot", x, y, size: 3, color: s.color, life: 0.5 });
        if (i % 3 === 0) sfx("tick");
      });
    }
  },

  arc(s) {
    const a = center(PLAYER);
    const orb = rectOfSel(".energy-orb");
    if (!a || !orb) return;
    const b = midOf(orb);
    let frame = -1;
    let bolts: Pt[][] = [];
    void tick(0.32, (_dt, k, age, c) => {
      const f = Math.floor(age / 0.045);
      if (f !== frame) {
        frame = f;
        bolts = Array.from({ length: s.forks }, () => jagged(a, b, 8, 22));
      }
      c.globalCompositeOperation = "lighter";
      for (const pts of bolts) {
        poly(c, pts, s.color, 5, 0.3 * (1 - k));
        poly(c, pts, "#ffffff", 1.6, 0.95 * (1 - k * 0.6));
      }
      if (Math.random() < 0.6) sparks(b.x, b.y, { count: 1, color: s.color, speed: 200, life: 0.25, size: 1.5 });
    });
    glow(b.x, b.y, orb.width * 0.7, s.color, 0.4, 30, 0.8);
    void ring(b.x, b.y, orb.width * 0.3, orb.width * 0.9, s.color, 0.4, 3, 0.1);
  },

  crack(s) {
    const r = rectOf(PLAYER);
    if (!r) return;
    const o = midOf(r);
    const cracks = Array.from({ length: 4 }, (_, i) => {
      const ang = (Math.PI * 2 * i) / 4 + rnd(-0.5, 0.5);
      const len = r.width * rnd(0.22, 0.4);
      return jagged(o, { x: o.x + Math.cos(ang) * len, y: o.y + Math.sin(ang) * len * 0.6 }, 5, 7);
    });
    void addEffect({
      life: 0.6,
      draw: (c, k) => {
        const shown = Math.min(1, k / 0.12);
        c.globalCompositeOperation = "lighter";
        for (const pts of cracks) {
          const part = pts.slice(0, Math.max(2, Math.ceil(pts.length * shown)));
          poly(c, part, s.color, 5, 0.45 * pulse(k, 0.05, 0.5));
          poly(c, part, "#ffffff", 1.6, pulse(k, 0.05, 0.5));
        }
      },
    });
    flash(o.x, o.y, r.width * 0.2, s.color, 0.16);
    shards(o.x, o.y, 5, "#59626e", 200, 6);
    pose(PLAYER, [{ transform: "none" }, { transform: "translate(-5px, 3px) rotate(-3deg)" }, { transform: "translate(5px, -2px) rotate(2.4deg)" }, { transform: "translate(-3px, 1px) rotate(-1deg)" }, { transform: "none" }], 300, "linear");
  },

  halo(s) {
    const r = rectOf(PLAYER);
    if (!r) return;
    const cx = r.left + r.width / 2;
    const rx = r.width * 0.56;
    const ry = Math.max(8, r.width * 0.09);
    for (let i = 0; i < s.rings; i++) {
      void addEffect({
        life: 0.55,
        delay: i * 0.1,
        draw: (c, k) => {
          const y = lerp(r.bottom + ry, r.top - ry, easeOut(k));
          const a = pulse(k, 0.15, 0.45);
          c.globalCompositeOperation = "lighter";
          c.strokeStyle = s.color;
          c.lineWidth = 3;
          c.globalAlpha = a;
          c.beginPath();
          c.ellipse(cx, y, rx, ry, 0, 0, Math.PI * 2);
          c.stroke();
          c.strokeStyle = "#ffffff";
          c.lineWidth = 1;
          c.beginPath();
          c.ellipse(cx, y, rx, ry, 0, Math.PI * 0.1, Math.PI * 0.9);
          c.stroke();
          const g = c.createLinearGradient(0, y, 0, y + 46);
          g.addColorStop(0, s.color + "44");
          g.addColorStop(1, s.color + "00");
          c.globalAlpha = a * 0.8;
          c.fillStyle = g;
          c.fillRect(cx - rx, y, rx * 2, 46);
        },
      });
    }
    for (let i = 0; i < 8; i++) {
      emit({ kind: "dot", x: cx + rnd(-rx, rx), y: r.bottom - Math.random() * r.height, vy: rnd(-120, -60), life: rnd(0.35, 0.6), size: rnd(1.5, 2.8), color: s.color, flicker: 0.5, delay: Math.random() * 0.3 });
    }
  },

  orbit(s) {
    const r = rectOf(PLAYER);
    if (!r) return;
    const o = midOf(r);
    const rx = r.width * 0.58;
    const ry = Math.max(r.height * 0.5, r.width * 0.16);
    void tick(0.75, (_dt, k, age) => {
      for (let i = 0; i < s.count; i++) {
        const ang = age * 9 + (Math.PI * 2 * i) / s.count;
        const m = pulse(k, 0.15, 0.3);
        emit({ kind: "glow", x: o.x + Math.cos(ang) * rx, y: o.y + Math.sin(ang) * ry, size: 6 * m + 1, color: s.color, life: 0.22 });
      }
    });
  },

  shells(s) {
    const p = anchor(PLAYER, 0.5, 0.5);
    if (!p) return;
    for (let i = 0; i < s.count; i++) later(i * 28, () => casing(p, i % 2 ? 1 : -1));
  },

  spinup(s) {
    const p = anchor(PLAYER, 0.5, 0.44);
    const r = rectOf(PLAYER);
    if (!p || !r) return;
    const size = r.width * 0.06;
    void tick(s.ms / 1000, (_dt, k) => {
      emit({ kind: "glow", x: p.x, y: p.y, size: size * (0.6 + k * 1.6) * rnd(0.8, 1.2), color: s.color, life: 0.07 });
      if (Math.random() < 0.5 + k * 0.5) sparks(p.x, p.y, { count: 1, color: s.color, speed: 220, life: 0.2, size: 1.4, dir: -Math.PI / 2, spread: 1.3 });
    });
  },
};

/** Every cast primitive the runtime can draw, for the test that checks the recipes against it. */
export const STEP_KINDS = Object.keys(STEPS) as Step["fx"][];

let glint: HTMLCanvasElement | null = null;
let glintColor = "";

function glintSprite(color: string): HTMLCanvasElement {
  if (glint && glintColor === color) return glint;
  glint = document.createElement("canvas");
  glint.width = glint.height = 28;
  const c = glint.getContext("2d")!;
  const g = c.createRadialGradient(14, 14, 0, 14, 14, 14);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.3, color);
  g.addColorStop(1, color + "00");
  c.fillStyle = g;
  c.fillRect(0, 0, 28, 28);
  glintColor = color;
  return glint;
}

function casing(p: Pt, side: number) {
  emit({ kind: "shard", x: p.x, y: p.y, vx: side * rnd(90, 190), vy: rnd(-150, -40), g: 900, drag: 0.6, life: rnd(0.5, 0.8), size: 7, stretch: 0.4, rot: rnd(0, 6), vr: rnd(-20, 20), color: "#e8b653" });
}

/**
 * Plays a card's cast on the player's jet and resolves once its events should start. With reduced
 * motion the cast is skipped; its sounds still play.
 */
export async function castCard(id: string, target: number | null): Promise<void> {
  const anim = cardAnim(id);
  const ctx: CastCtx = { target };
  for (const step of anim.cast) {
    later(step.at ?? 0, () => {
      if (step.sfx) sfx(step.sfx);
      if (!reduced()) (STEPS[step.fx] as (s: Step, ctx: CastCtx) => void)(step, ctx);
    });
  }
  await wait(reduced() ? Math.min(anim.lead, 90) : Math.min(anim.lead, MAX_LEAD));
}

/* ----------------------------------------------------------------- shots */

const SMOKE: Record<string, { color: string; size: number; life: number; gap: number; alpha: number }> = {
  white: { color: "#e6ebf2", size: 15, life: 1.0, gap: 9, alpha: 0.65 },
  grey: { color: "#aab2be", size: 20, life: 1.25, gap: 8, alpha: 0.5 },
  dark: { color: "#4a4f58", size: 20, life: 1.3, gap: 7, alpha: 0.6 },
  thin: { color: "#dfe6ee", size: 10, life: 0.5, gap: 10, alpha: 0.5 },
};

function gunPort(who: number, origin: "nose" | "wings" | "chin", index: number): Pt | null {
  if (who !== PLAYER) return muzzle(who);
  if (origin === "wings") return anchor(who, index % 2 ? 0.66 : 0.34, 0.5);
  if (origin === "chin") return anchor(who, 0.5, 0.44);
  return muzzle(who);
}

function rail(who: number, side: "left" | "right" | "both" | "belly", index: number): { p: Pt; dir: number } | null {
  if (who !== PLAYER) {
    const p = muzzle(who);
    return p ? { p, dir: index % 2 ? 1 : -1 } : null;
  }
  const dir = side === "left" ? -1 : side === "right" ? 1 : side === "both" ? (index % 2 ? 1 : -1) : 0;
  const p = anchor(who, 0.5 + dir * 0.22, dir ? 0.56 : 0.62);
  return p ? { p, dir: dir || (Math.random() < 0.5 ? -1 : 1) } : null;
}

function quad(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

interface Aim {
  from: number;
  to: number;
  /** Which hit of the card this is, so pairs alternate rails and bursts walk. */
  index: number;
  b: Pt;
  ka: number;
  kb: number;
}

const SHOTS: { [K in Shot["fx"]]: (s: ShotOf<K>, aim: Aim) => Promise<void> } = {
  tracer(s, aim) {
    const { b, ka, kb } = aim;
    const life = s.ms / 1000;
    for (let i = 0; i < s.rounds; i++) {
      const a = gunPort(aim.from, s.origin, aim.index * s.rounds + i);
      if (!a) continue;
      const walk = s.walk ? ((i + 0.5) / s.rounds - 0.5) * s.walk * kb * (aim.index % 2 ? -1 : 1) : 0;
      const end = { x: b.x + walk + rnd(-1, 1) * s.spread * kb, y: b.y + rnd(-1, 1) * s.spread * 0.6 * kb };
      const dx = end.x - a.x;
      const dy = end.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const delay = (i * s.gap) / 1000;
      void addEffect({
        life,
        delay,
        draw: (c, k) => {
          const head = { x: a.x + dx * k, y: a.y + dy * k };
          // A round can only trail as far as it has flown: it grows out of the muzzle.
          const streak = Math.min(len * k, lerp(120 * ka, 46 * kb, k));
          const tail = { x: head.x - (dx / len) * streak, y: head.y - (dy / len) * streak };
          const w = s.width * lerp(ka * 1.9, kb * 1.25, k);
          c.globalCompositeOperation = "lighter";
          c.lineCap = "round";
          line(c, tail, head, s.color, w * 3.6, 0.22);
          line(c, tail, head, s.color, w * 1.5, 0.9);
          line(c, { x: lerp(tail.x, head.x, 0.35), y: lerp(tail.y, head.y, 0.35) }, head, "#ffffff", w * 0.7, 1);
        },
        done: () => {
          emit({ kind: "glow", x: end.x, y: end.y, size: 9 * kb + 3, color: s.color, life: 0.1 });
          sparks(end.x, end.y, { count: 2, color: s.color, speed: 200 * kb + 60, life: 0.22, size: 1.4 });
        },
      });
      later(i * s.gap, () => {
        emit({ kind: "glow", x: a.x, y: a.y, size: (26 + Math.random() * 12) * ka * (s.width / 2.5), color: s.color, life: 0.07 });
        emit({ kind: "glow", x: a.x, y: a.y, size: 10 * ka, color: "#ffffff", life: 0.05 });
        sparks(a.x, a.y, { count: 2, color: s.color, speed: 420 * ka, life: 0.12, size: 1.6, dir: Math.atan2(dy, dx), spread: 0.35, g: 0 });
        if (s.shells && i % 2 === 0) casing(a, i % 4 ? 1 : -1);
      });
    }
    return wait(s.ms + s.rounds * s.gap * 0.35);
  },

  missile(s, aim) {
    const { b, ka, kb } = aim;
    const start = rail(aim.from, s.rail, aim.index);
    if (!start) return Promise.resolve();
    const a = start.p;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const ctl = { x: mid.x + start.dir * (50 + Math.random() * 50) * ka, y: Math.min(a.y, b.y) - s.loft * ka + (s.loft < 0 ? Math.abs(a.y - b.y) * 0.6 : 0) };
    const trail = s.trail === "none" ? null : SMOKE[s.trail];
    flash(a.x, a.y, 20 * s.size * ka, s.flame, 0.14);
    if (trail) for (let i = 0; i < 3; i++) smoke(a.x, a.y + 4, 24 * s.size * ka, trail.color, 0.6);
    let last = a;
    let lastPuff = a;
    return tick(s.ms / 1000, (_dt, k, _age, c) => {
      const e = k ** 1.6;
      const p = quad(a, ctl, b, e);
      const scale = Math.max(0.55, lerp(ka, kb, e)) * s.size * 1.5;
      const ang = Math.atan2(p.y - last.y, p.x - last.x);
      if (s.wobble) {
        const off = Math.sin(k * Math.PI * 5) * s.wobble * (1 - e) * ka;
        p.x += -Math.sin(ang) * off;
        p.y += Math.cos(ang) * off;
      }
      if (trail) {
        const run = Math.hypot(p.x - lastPuff.x, p.y - lastPuff.y);
        const n = Math.floor(run / trail.gap);
        for (let i = 1; i <= n; i++) {
          const f = (i * trail.gap) / run;
          smoke(lerp(lastPuff.x, p.x, f), lerp(lastPuff.y, p.y, f), trail.size * scale, trail.color, trail.life, { alpha: trail.alpha });
        }
        if (n) lastPuff = { x: lerp(lastPuff.x, p.x, (n * trail.gap) / run), y: lerp(lastPuff.y, p.y, (n * trail.gap) / run) };
      }
      const tail = { x: p.x - Math.cos(ang) * 9 * scale, y: p.y - Math.sin(ang) * 9 * scale };
      emit({ kind: "glow", x: tail.x, y: tail.y, size: (trail ? 13 : 8) * scale * rnd(0.8, 1.2) + 1, color: s.flame, life: trail ? 0.09 : 0.16 });
      emit({ kind: "glow", x: tail.x, y: tail.y, size: 5 * scale, color: "#ffffff", life: 0.05 });
      if (trail) {
        // A hot streak of exhaust behind the motor, so the eye can follow it at speed.
        c.globalCompositeOperation = "lighter";
        line(c, { x: p.x - Math.cos(ang) * 46 * scale, y: p.y - Math.sin(ang) * 46 * scale }, tail, s.flame, 3.2 * scale, 0.5);
        c.globalCompositeOperation = "source-over";
      }
      c.translate(p.x, p.y);
      c.rotate(ang);
      c.scale(scale, scale);
      c.globalAlpha = trail ? 1 : 0.75;
      c.fillStyle = trail ? "#eef2f6" : "#5d6a80";
      c.fillRect(-9, -2, 16, 4);
      c.fillStyle = "#2a3038";
      c.beginPath();
      c.moveTo(7, -2);
      c.lineTo(12, 0);
      c.lineTo(7, 2);
      c.fill();
      c.fillRect(-10, -4.5, 4, 9);
      last = p;
    });
  },

  rocket(s, aim) {
    const { b, ka, kb } = aim;
    for (let i = 0; i < s.count; i++) {
      const a = anchor(aim.from, i % 2 ? 0.74 : 0.26, 0.56) ?? b;
      const end = { x: b.x + rnd(-1, 1) * s.spread * kb, y: b.y + rnd(-1, 1) * s.spread * 0.6 * kb };
      const ang = Math.atan2(end.y - a.y, end.x - a.x);
      let puff = 0;
      later(i * 45, () => flash(a.x, a.y, 12 * ka, s.flame, 0.1));
      void tick(
        s.ms / 1000,
        (dt, k, _age, c) => {
          const e = k ** 1.3;
          const p = { x: lerp(a.x, end.x, e), y: lerp(a.y, end.y, e) };
          const scale = lerp(ka, kb, e);
          puff += dt;
          if (puff > 0.018) {
            puff = 0;
            smoke(p.x, p.y, 7 * scale, "#d9dee6", 0.4, { alpha: 0.4 });
          }
          emit({ kind: "glow", x: p.x, y: p.y, size: 7 * scale + 1, color: s.flame, life: 0.06 });
          c.globalCompositeOperation = "lighter";
          c.lineCap = "round";
          line(c, { x: p.x - Math.cos(ang) * 16 * scale, y: p.y - Math.sin(ang) * 16 * scale }, p, s.flame, 2.4 * scale, 0.9);
        },
        (i * 45) / 1000,
      ).then(() => {
        flash(end.x, end.y, 14 * kb + 4, s.flame, 0.12);
        sparks(end.x, end.y, { count: 4, color: s.flame, speed: 180 * kb + 60, life: 0.25, size: 1.5 });
      });
    }
    return wait(s.ms + (s.count - 1) * 45 * 0.5);
  },

  bomb(s, aim) {
    const { b, ka, kb } = aim;
    const a = anchor(aim.from, 0.5, 0.62) ?? b;
    const ctl = { x: lerp(a.x, b.x, 0.35) + rnd(-20, 20), y: a.y + 54 * ka };
    const splitAt = 0.68;
    const lets = Array.from({ length: s.split }, (_, i) => {
      const ang = (Math.PI * 2 * i) / Math.max(1, s.split) + rnd(-0.3, 0.3);
      return { x: Math.cos(ang) * 38 * kb, y: Math.sin(ang) * 22 * kb };
    });
    let split = false;
    return tick(s.ms / 1000, (_dt, k, age, c) => {
      const e = k ** 1.35;
      const p = quad(a, ctl, b, e);
      const scale = lerp(ka * 1.1, kb, e);
      if (s.split && k >= splitAt) {
        if (!split) {
          split = true;
          flash(p.x, p.y, 16 * scale, "#ffffff", 0.1);
          sparks(p.x, p.y, { count: 6, color: s.color, speed: 120, life: 0.2, size: 1.2 });
        }
        const u = (k - splitAt) / (1 - splitAt);
        const at = quad(a, ctl, b, splitAt ** 1.35);
        c.fillStyle = "#2c3138";
        for (const l of lets) {
          const x = lerp(at.x, b.x + l.x, u);
          const y = lerp(at.y, b.y + l.y, u * u);
          c.fillRect(x - 2 * scale, y - 2 * scale, 4 * scale, 4 * scale);
          if (Math.random() < 0.3) emit({ kind: "dot", x, y, size: 1.6, color: s.color, life: 0.15 });
        }
        return;
      }
      c.translate(p.x, p.y);
      c.rotate(age * 7);
      c.scale(scale, scale);
      c.fillStyle = "#2c3138";
      c.beginPath();
      c.ellipse(0, 0, 9, 3.6, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = s.color;
      c.fillRect(-11, -4.5, 4, 9);
      if (Math.random() < 0.5) emit({ kind: "glow", x: p.x, y: p.y, size: 5 * scale + 1, color: s.color, life: 0.12, alpha: 0.6 });
    });
  },

  beam(s, aim) {
    const a = muzzle(aim.from);
    const { b, ka, kb } = aim;
    if (!a) return Promise.resolve();
    void tick(s.ms / 1000, (_dt, k, _age, c) => {
      const reach = Math.min(1, k / 0.14);
      const tip = { x: lerp(a.x, b.x, reach), y: lerp(a.y, b.y, reach) };
      const beat = s.pulses > 1 ? 0.35 + 0.65 * Math.abs(Math.sin(k * Math.PI * s.pulses)) : pulse(k, 0.1, 0.3);
      const w = s.width * lerp(ka * 1.4, kb, 0.5);
      c.globalCompositeOperation = "lighter";
      c.lineCap = "round";
      line(c, a, tip, s.color, w * 3.2, 0.22 * beat);
      line(c, a, tip, s.color, w * 1.4, 0.75 * beat);
      line(c, a, tip, "#ffffff", w * 0.5, beat);
      emit({ kind: "glow", x: a.x, y: a.y, size: 10 * ka * beat + 2, color: s.color, life: 0.06 });
      if (reach >= 1) {
        emit({ kind: "glow", x: b.x, y: b.y, size: (14 + s.width * 2) * kb * beat + 2, color: s.color, life: 0.07 });
        if (Math.random() < 0.7) sparks(b.x, b.y, { count: 1, color: s.color, speed: 220 * kb + 50, life: 0.25, size: 1.4 });
      }
    });
    return wait(s.ms * 0.45);
  },

  bolt(s, aim) {
    const a = muzzle(aim.from);
    const { b } = aim;
    if (!a) return Promise.resolve();
    let frame = -1;
    let bolts: Pt[][] = [];
    void tick(s.ms / 1000, (_dt, k, age, c) => {
      const f = Math.floor(age / 0.04);
      if (f !== frame) {
        frame = f;
        bolts = Array.from({ length: s.forks }, (_, i) => jagged(a, { x: b.x + (i ? rnd(-18, 18) : 0), y: b.y + (i ? rnd(-12, 12) : 0) }, 9, i ? 30 : 18));
      }
      c.globalCompositeOperation = "lighter";
      bolts.forEach((pts, i) => {
        poly(c, pts, s.color, i ? 3 : 6, (i ? 0.25 : 0.4) * (1 - k * 0.7));
        poly(c, pts, "#ffffff", i ? 1 : 2, (i ? 0.6 : 1) * (1 - k * 0.5));
      });
    });
    flash(a.x, a.y, 18, s.color, 0.1);
    return wait(s.ms * 0.4);
  },

  packet(s, aim) {
    const a = muzzle(aim.from);
    const { b, ka, kb } = aim;
    if (!a) return Promise.resolve();
    const big = s.count === 1;
    for (let i = 0; i < s.count; i++) {
      const bend = big ? 0 : rnd(-26, 26);
      void addEffect({
        life: s.ms / 1000,
        delay: i * 0.04,
        draw: (c, k, age) => {
          c.globalCompositeOperation = "lighter";
          for (let t = 0; t < 4; t++) {
            const kk = Math.max(0, k - t * 0.05);
            const e = kk ** 1.4;
            const scale = lerp(ka, kb, e) * (big ? 2.2 : 1);
            const x = lerp(a.x, b.x, e) + Math.sin(kk * Math.PI) * bend;
            const y = lerp(a.y, b.y, e);
            const size = (8 - t * 1.5) * scale;
            c.save();
            c.translate(x, y);
            c.rotate(big ? age * 8 : Math.PI / 4);
            c.globalAlpha = (1 - t * 0.26) * (big && Math.floor(age / 0.05) % 2 ? 0.6 : 1);
            c.fillStyle = t === 0 ? "#ffffff" : s.color;
            c.fillRect(-size / 2, -size / 2, size, size);
            c.strokeStyle = s.color;
            c.lineWidth = 1.5;
            c.strokeRect(-size * 0.9, -size * 0.9, size * 1.8, size * 1.8);
            c.restore();
          }
        },
      });
    }
    flash(a.x, a.y, 14, s.color, 0.1);
    return wait(s.ms);
  },

  shock(s, aim) {
    const a = muzzle(aim.from);
    const { b, ka, kb } = aim;
    if (!a) return Promise.resolve();
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    flash(a.x, a.y, 30 * ka, s.color, 0.14);
    for (let i = 0; i < s.rings; i++) {
      void addEffect({
        life: s.ms / 1000,
        delay: i * 0.055,
        draw: (c, k) => {
          const e = easeOut(k);
          const x = lerp(a.x, b.x, e);
          const y = lerp(a.y, b.y, e);
          const r = lerp(16 * ka, 58 * kb + 10, e);
          c.globalCompositeOperation = "lighter";
          c.strokeStyle = s.color;
          c.lineCap = "round";
          c.lineWidth = lerp(6, 2, k);
          c.globalAlpha = (1 - k) ** 0.8;
          c.beginPath();
          c.arc(x - Math.cos(ang) * r, y - Math.sin(ang) * r, r, ang - 0.95, ang + 0.95);
          c.stroke();
        },
      });
    }
    return wait(s.ms * 0.85);
  },

  pass(s, aim) {
    const a = center(aim.from);
    const { b, kb } = aim;
    if (!a) return Promise.resolve();
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    pose(
      aim.from,
      [
        { transform: "translate(0, 0) scale(1) rotate(0deg)" },
        { transform: `translate(${(-dx * 0.03).toFixed(0)}px, ${(-dy * 0.05).toFixed(0)}px) scale(1.05) rotate(0deg)`, offset: 0.12 },
        { transform: `translate(${(dx * 0.42).toFixed(0)}px, ${(dy * 0.42).toFixed(0)}px) scale(.66) rotate(${dx < 0 ? -22 : 22}deg)`, offset: 0.48 },
        { transform: `translate(${(dx * 0.3).toFixed(0)}px, ${(dy * 0.36).toFixed(0)}px) scale(.72) rotate(${dx < 0 ? 14 : -14}deg)`, offset: 0.62 },
        { transform: "translate(0, 0) scale(1) rotate(0deg)" },
      ],
      s.ms * 2.4,
      "cubic-bezier(.45,.05,.3,1)",
    );
    const ang = Math.atan2(dy, dx);
    void tick(s.ms / 1000, (_dt, k) => {
      const p = { x: a.x + dx * 0.42 * k + rnd(-18, 18), y: a.y + dy * 0.42 * k + rnd(-10, 10) };
      emit({ kind: "spark", x: p.x, y: p.y, vx: -Math.cos(ang) * 500, vy: -Math.sin(ang) * 500, life: 0.16, size: 1.8, color: s.color, stretch: 0.09, g: 0 });
    });
    later(s.ms * 0.8, () => {
      const size = 44 * kb + 16;
      for (let i = 0; i < s.slashes; i++) {
        const tilt = -0.9 + i * (1.8 / Math.max(1, s.slashes - 1 || 1)) + (s.slashes === 1 ? 0.6 : 0);
        void addEffect({
          life: 0.22,
          delay: i * 0.05,
          draw: (c, k) => {
            const e = easeOut(k);
            c.globalCompositeOperation = "lighter";
            c.translate(b.x, b.y);
            c.rotate(tilt);
            c.lineCap = "round";
            const reach = size * 1.5;
            const head = { x: lerp(-reach, reach, e), y: 0 };
            const tail = { x: lerp(-reach, reach, Math.max(0, e - 0.55)), y: 0 };
            line(c, tail, head, s.color, lerp(9, 2, k), 0.5 * (1 - k));
            line(c, tail, head, "#ffffff", lerp(3.5, 1, k), 1 - k * k);
          },
        });
      }
    });
    return wait(s.ms);
  },
};

export const SHOT_KINDS = Object.keys(SHOTS) as Shot["fx"][];

/** Fires one hit's worth of a shot and resolves when it reaches the target. */
export function fireShot(shot: Shot, from: number, to: number, index = 0): Promise<void> {
  const b = center(to);
  if (!b) return Promise.resolve();
  if (reduced()) return wait(70);
  if (index === 0 || shot.sfx !== "brrt") sfx(shot.sfx);
  const aim: Aim = { from, to, index, b, ka: depth(from), kb: depth(to) };
  return (SHOTS[shot.fx] as (s: Shot, aim: Aim) => Promise<void>)(shot, aim);
}

/* --------------------------------------------------------------- impacts */

const IMPACTS: Record<Impact["fx"], (p: Pt, k: number, color: string, dir: number, who: number) => void> = {
  sparks(p, k, color) {
    flash(p.x, p.y, 22 * k + 6, color, 0.12);
    sparks(p.x, p.y, { count: 9, color, speed: 300 * k + 80, life: 0.35, size: 1.8 });
    void ring(p.x, p.y, 4, 30 * k + 8, color, 0.22, 2);
  },
  blast(p, k, color) {
    flash(p.x, p.y, 40 * k + 8, color, 0.16);
    void ring(p.x, p.y, 8, 74 * k + 10, color, 0.34, 3.5);
    sparks(p.x, p.y, { count: 14, color, speed: 380 * k + 80, life: 0.45, size: 2 });
    for (let i = 0; i < 4; i++) smoke(p.x + rnd(-14, 14) * k, p.y + rnd(-10, 10) * k, 34 * k + 6, "#6b6f78", 0.8, { alpha: 0.45 });
    for (let i = 0; i < 3; i++) glow(p.x + rnd(-12, 12) * k, p.y + rnd(-8, 8) * k, 16 * k + 4, C.flame, 0.3, 40 * k);
  },
  fireball(p, k, color) {
    flash(p.x, p.y, 62 * k + 10, color, 0.2);
    void ring(p.x, p.y, 10, 110 * k + 14, color, 0.42, 4.5);
    void ring(p.x, p.y, 6, 70 * k + 10, "#ffffff", 0.3, 2, 0.06);
    sparks(p.x, p.y, { count: 22, color, speed: 460 * k + 100, life: 0.55, size: 2.2 });
    for (let i = 0; i < 6; i++) glow(p.x + rnd(-22, 22) * k, p.y + rnd(-16, 16) * k, 22 * k + 5, i % 2 ? C.flame : color, rnd(0.3, 0.5), 60 * k);
    for (let i = 0; i < 7; i++) smoke(p.x + rnd(-24, 24) * k, p.y + rnd(-16, 16) * k, 46 * k + 8, "#35383f", 1.1, { alpha: 0.55, delay: 0.05 + Math.random() * 0.12 });
    shards(p.x, p.y, 6, "#3d434c", 300 * k + 60, 6 * k + 2);
  },
  emp(p, k, color, _dir, who) {
    flash(p.x, p.y, 30 * k + 6, color, 0.14);
    void ring(p.x, p.y, 6, 90 * k + 12, color, 0.45, 3.5);
    void ring(p.x, p.y, 6, 60 * k + 8, "#ffffff", 0.35, 1.5, 0.08);
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rnd(60, 260) * k;
      emit({ kind: "dot", x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.05, life: rnd(0.3, 0.6), size: rnd(1.5, 3), color, flicker: 0.8 });
    }
    const r = rectOf(who);
    if (r) staticBars(r, color, 5, 0.3);
  },
  shrapnel(p, k, color) {
    flash(p.x, p.y, 30 * k + 6, color, 0.12);
    sparks(p.x, p.y, { count: 20, color, speed: 520 * k + 100, life: 0.4, size: 1.5, stretch: 0.03 });
    for (let i = 0; i < 4; i++) {
      const x = p.x + rnd(-40, 40) * k;
      const y = p.y + rnd(-26, 26) * k;
      later(40 + i * 45, () => {
        flash(x, y, 16 * k + 4, color, 0.1);
        sparks(x, y, { count: 4, color, speed: 200 * k + 60, life: 0.25, size: 1.3 });
        smoke(x, y, 18 * k + 4, "#6b6f78", 0.5, { alpha: 0.35 });
      });
    }
  },
  slash(p, k, color, dir) {
    flash(p.x, p.y, 24 * k + 6, "#ffffff", 0.1);
    sparks(p.x, p.y, { count: 12, color, speed: 420 * k + 100, life: 0.3, size: 1.8, dir: dir + Math.PI / 2, spread: 0.5 });
    sparks(p.x, p.y, { count: 6, color: "#ffffff", speed: 300 * k + 80, life: 0.25, size: 1.4, dir: dir - Math.PI / 2, spread: 0.5 });
  },
  glitch(p, k, color, _dir, who) {
    flash(p.x, p.y, 20 * k + 6, color, 0.1);
    sparks(p.x, p.y, { count: 6, color, speed: 260 * k + 60, life: 0.3, size: 1.6 });
    const r = rectOf(who);
    if (r) staticBars(r, color, 6, 0.32);
  },
  pierce(p, k, color, dir) {
    flash(p.x, p.y, 20 * k + 6, "#ffffff", 0.1);
    sparks(p.x, p.y, { count: 14, color, speed: 620 * k + 140, life: 0.3, size: 2, dir, spread: 0.32, g: 80 });
    sparks(p.x, p.y, { count: 5, color: "#ffffff", speed: 200 * k + 60, life: 0.25, size: 1.4, dir: dir + Math.PI, spread: 1 });
    void ring(p.x, p.y, 3, 26 * k + 6, color, 0.2, 1.6);
    smoke(p.x, p.y, 16 * k + 4, "#8a8f98", 0.5, { alpha: 0.35 });
  },
  embers(p, k, color) {
    flash(p.x, p.y, 34 * k + 8, color, 0.16);
    void ring(p.x, p.y, 6, 50 * k + 8, color, 0.3, 2.5);
    for (let i = 0; i < 14; i++) {
      emit({ kind: "glow", x: p.x + rnd(-18, 18) * k, y: p.y + rnd(-10, 10) * k, vx: rnd(-50, 50), vy: rnd(-140, -30), g: -60, drag: 0.4, life: rnd(0.5, 1), size: rnd(3, 6) * k + 1, color, flicker: 0.5, delay: Math.random() * 0.15 });
    }
    for (let i = 0; i < 3; i++) smoke(p.x + rnd(-10, 10), p.y, 26 * k + 5, "#3a3d44", 0.9, { alpha: 0.45, vy: -40 });
  },
};

export const IMPACT_KINDS = Object.keys(IMPACTS) as Impact["fx"][];

/** Plays an impact on a unit, scaled to how near the camera it is; `from` sets its direction. */
export function playImpact(impact: Impact, who: number, from: number, scale = 1) {
  const p = center(who);
  if (!p || reduced()) return;
  const a = center(from);
  const dir = a ? Math.atan2(p.y - a.y, p.x - a.x) : -Math.PI / 2;
  const k = Math.max(0.45, Math.min(1.3, depth(who) * 1.15)) * scale;
  IMPACTS[impact.fx]({ x: p.x + rnd(-10, 10) * k, y: p.y + rnd(-6, 6) * k }, k, impact.color, dir, who);
}

/* ------------------------------------------------------------ enemy fire */

const ENEMY_SHOTS: Record<"tracer" | "missile" | "heavy", Shot> = {
  tracer: { fx: "tracer", rounds: 5, gap: 40, spread: 12, color: "#ff8a5a", width: 2.6, origin: "nose", ms: 180, sfx: "cannon" },
  missile: { fx: "missile", loft: 46, trail: "white", ms: 400, size: 1, rail: "both", flame: C.hot, sfx: "missile" },
  heavy: { fx: "missile", loft: 100, trail: "dark", ms: 520, size: 1.5, rail: "both", flame: C.red, sfx: "heavy" },
};

export function enemyShot(style: "tracer" | "missile" | "heavy"): Shot {
  return ENEMY_SHOTS[style];
}

export const ENEMY_IMPACT: Record<"tracer" | "missile" | "heavy", Impact> = {
  tracer: { fx: "sparks", color: "#ff8a5a" },
  missile: { fx: "blast", color: C.hot },
  heavy: { fx: "fireball", color: C.red },
};
