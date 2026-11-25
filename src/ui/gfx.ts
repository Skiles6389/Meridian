/*
 * The effects canvas: one full-viewport 2D canvas that draws every particle and drawn effect
 * (tracers, missiles, smoke, flares, explosions). Particles are plain pooled objects stepped by a single
 * requestAnimationFrame loop that only runs while something is alive, so a busy fight costs no DOM
 * nodes and an idle screen costs nothing.
 */

export type ParticleKind = "glow" | "smoke" | "spark" | "shard" | "dot";

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Downward acceleration in px/s². */
  g: number;
  /** Fraction of velocity kept after one second. */
  drag: number;
  life: number;
  age: number;
  size: number;
  /** Size change in px/s. */
  grow: number;
  color: string;
  alpha: number;
  rot: number;
  vr: number;
  /** Sparks: streak length as seconds of travel. Shards: aspect. */
  stretch: number;
  /** 0..1 random brightness flicker. */
  flicker: number;
  /** Seconds before the particle appears. */
  delay: number;
}

export type ParticleInit = Partial<Particle> & { x: number; y: number };

export interface Effect {
  /** Seconds. */
  life: number;
  delay?: number;
  /** `k` runs 0..1 over the life; `age` is seconds since the effect started. */
  draw: (ctx: CanvasRenderingContext2D, k: number, age: number) => void;
  done?: () => void;
}

interface LiveEffect extends Effect {
  age: number;
}

/** Hard cap so a pile-up of effects can never drag the frame rate down. */
export const MAX_PARTICLES = 700;

const particles: Particle[] = [];
const pool: Particle[] = [];
const effects: LiveEffect[] = [];

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let scale = 1;
let running = false;
let last = 0;
let rate = 1;
let frozenUntil = 0;

const DEFAULTS: Omit<Particle, "x" | "y"> = {
  kind: "glow",
  vx: 0,
  vy: 0,
  g: 0,
  drag: 1,
  life: 0.5,
  age: 0,
  size: 8,
  grow: 0,
  color: "#ffd9a0",
  alpha: 1,
  rot: 0,
  vr: 0,
  stretch: 0.03,
  flicker: 0,
  delay: 0,
};

export function emit(init: ParticleInit) {
  let p: Particle;
  if (particles.length >= MAX_PARTICLES) {
    // Recycle the oldest so a new burst always shows.
    p = particles.shift()!;
  } else p = pool.pop() ?? ({} as Particle);
  Object.assign(p, DEFAULTS, init);
  particles.push(p);
  kick();
}

/** Adds a drawn effect; the promise settles when it has played out. */
export function addEffect(effect: Effect): Promise<void> {
  return new Promise((resolve) => {
    const done = effect.done;
    effects.push({ ...effect, age: -(effect.delay ?? 0), done: () => (done?.(), resolve()) });
    kick();
    if (!canvas) {
      // No canvas (tests, or before init): settle on a timer so awaiting callers still move on.
      setTimeout(resolve, ((effect.delay ?? 0) + effect.life) * 1000);
    }
  });
}

export function particleCount(): number {
  return particles.length;
}

export function effectCount(): number {
  return effects.length;
}

/** Advances every particle by `dt` seconds and retires the dead ones. */
export function stepParticles(dt: number) {
  let keep = 0;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.delay > 0) {
      p.delay -= dt;
      particles[keep++] = p;
      continue;
    }
    p.age += dt;
    if (p.age >= p.life) {
      pool.push(p);
      continue;
    }
    if (p.drag !== 1) {
      const d = p.drag ** dt;
      p.vx *= d;
      p.vy *= d;
    }
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.size = Math.max(0.1, p.size + p.grow * dt);
    p.rot += p.vr * dt;
    particles[keep++] = p;
  }
  particles.length = keep;
}

function stepEffects(dt: number) {
  let keep = 0;
  for (let i = 0; i < effects.length; i++) {
    const e = effects[i];
    e.age += dt;
    if (e.age >= e.life) {
      e.done?.();
      continue;
    }
    effects[keep++] = e;
  }
  effects.length = keep;
}

export function clearGfx() {
  pool.push(...particles);
  particles.length = 0;
  for (const e of effects) e.done?.();
  effects.length = 0;
}

/** Plays effects faster (rate above 1) when the player taps to hurry an animation along. */
export function setGfxRate(next: number) {
  rate = next;
}

/** Holds every particle and effect still for a beat, to give a heavy hit its weight. */
export function freezeGfx(ms: number) {
  frozenUntil = Math.max(frozenUntil, performance.now() + ms);
}

/* ---------------------------------------------------------------- canvas */

const sprites = new Map<string, HTMLCanvasElement>();

/** A cached soft round sprite in one colour, for effects that draw their own glows. */
export function fxSprite(kind: "glow" | "smoke", color: string): HTMLCanvasElement {
  const key = kind + color;
  let s = sprites.get(key);
  if (s) return s;
  s = document.createElement("canvas");
  s.width = s.height = 64;
  const c = s.getContext("2d")!;
  const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  if (kind === "glow") {
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.18, color);
    grad.addColorStop(0.5, color + "66");
    grad.addColorStop(1, color + "00");
  } else {
    grad.addColorStop(0, color + "cc");
    grad.addColorStop(0.55, color + "77");
    grad.addColorStop(1, color + "00");
  }
  c.fillStyle = grad;
  c.fillRect(0, 0, 64, 64);
  sprites.set(key, s);
  return s;
}

export function initGfx(parent: HTMLElement) {
  canvas = document.createElement("canvas");
  canvas.className = "fx-canvas";
  parent.appendChild(canvas);
  ctx = canvas.getContext("2d");
  const resize = () => {
    if (!canvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Soft glows do not need retina sharpness: cap the backing store at about two megapixels.
    scale = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(2_200_000 / Math.max(1, w * h)));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
  };
  resize();
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) last = 0;
  });
}

function kick() {
  if (running || !canvas || typeof requestAnimationFrame === "undefined") return;
  running = true;
  last = 0;
  requestAnimationFrame(frame);
}

function frame(now: number) {
  if (!ctx || !canvas) return;
  // Real elapsed time, so effects stay in step with the fight's timeline even when frames run long.
  const raw = last ? Math.min(0.25, (now - last) / 1000) : 0.016;
  last = now;
  const dt = now < frozenUntil ? 0 : raw * rate;
  stepParticles(dt);
  stepEffects(dt);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, canvas.width / scale, canvas.height / scale);
  drawParticles(ctx);
  for (const e of effects) {
    if (e.age < 0) continue;
    ctx.save();
    e.draw(ctx, Math.min(1, e.age / e.life), e.age);
    ctx.restore();
  }
  if (particles.length || effects.length) requestAnimationFrame(frame);
  else running = false;
}

function drawParticles(c: CanvasRenderingContext2D) {
  // Smoke and shards first with normal blending, then everything bright on top additively.
  c.globalCompositeOperation = "source-over";
  for (const p of particles) {
    if (p.delay > 0 || (p.kind !== "smoke" && p.kind !== "shard")) continue;
    const k = p.age / p.life;
    if (p.kind === "smoke") {
      c.globalAlpha = p.alpha * (k < 0.12 ? k / 0.12 : (1 - k) ** 1.4);
      const s = p.size;
      c.drawImage(fxSprite("smoke", p.color), p.x - s, p.y - s, s * 2, s * 2);
    } else {
      c.globalAlpha = p.alpha * (1 - k * k);
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.fillStyle = p.color;
      c.fillRect(-p.size / 2, (-p.size * p.stretch) / 2, p.size, p.size * p.stretch);
      c.restore();
    }
  }
  c.globalCompositeOperation = "lighter";
  c.lineCap = "round";
  for (const p of particles) {
    if (p.delay > 0 || p.kind === "smoke" || p.kind === "shard") continue;
    const k = p.age / p.life;
    let a = p.alpha * (1 - k) ** 1.2;
    if (p.flicker) a *= 1 - p.flicker * Math.random();
    c.globalAlpha = a;
    if (p.kind === "glow") {
      const s = p.size;
      c.drawImage(fxSprite("glow", p.color), p.x - s, p.y - s, s * 2, s * 2);
    } else if (p.kind === "spark") {
      c.strokeStyle = p.color;
      c.lineWidth = p.size;
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(p.x - p.vx * p.stretch, p.y - p.vy * p.stretch);
      c.stroke();
    } else {
      c.fillStyle = p.color;
      c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
  c.globalAlpha = 1;
}

/* ---------------------------------------------------------- emitters */

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export interface BurstOpts {
  count: number;
  color: string;
  speed?: number;
  size?: number;
  life?: number;
  g?: number;
  /** Centre direction in radians and half-spread; omit for a full circle. */
  dir?: number;
  spread?: number;
  drag?: number;
  stretch?: number;
}

/** A spray of spark streaks from a point. */
export function sparks(x: number, y: number, o: BurstOpts) {
  const speed = o.speed ?? 320;
  for (let i = 0; i < o.count; i++) {
    const a = o.dir === undefined ? Math.random() * Math.PI * 2 : o.dir + rnd(-1, 1) * (o.spread ?? 0.5);
    const v = speed * rnd(0.35, 1);
    emit({
      kind: "spark",
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      g: o.g ?? 260,
      drag: o.drag ?? 0.12,
      life: (o.life ?? 0.45) * rnd(0.6, 1.1),
      size: (o.size ?? 2) * rnd(0.7, 1.3),
      color: o.color,
      stretch: o.stretch ?? 0.045,
    });
  }
}

export function glow(x: number, y: number, size: number, color: string, life = 0.25, grow = 0, alpha = 1) {
  emit({ kind: "glow", x, y, size, color, life, grow, alpha });
}

export function smoke(x: number, y: number, size: number, color = "#d8dde6", life = 0.9, o: Partial<Particle> = {}) {
  emit({
    kind: "smoke",
    x: x + rnd(-2, 2),
    y: y + rnd(-2, 2),
    vx: rnd(-10, 10),
    vy: rnd(-18, -4),
    size: size * 0.5,
    grow: size * 0.9,
    life: life * rnd(0.8, 1.15),
    color,
    alpha: 0.55,
    drag: 0.4,
    ...o,
  });
}

/** Tumbling solid fragments that arc and fall. */
export function shards(x: number, y: number, count: number, color: string, speed = 240, size = 7) {
  for (let i = 0; i < count; i++) {
    const a = rnd(-Math.PI, 0) + rnd(-0.4, 0.4);
    const v = speed * rnd(0.4, 1);
    emit({
      kind: "shard",
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      g: 620,
      drag: 0.5,
      life: rnd(0.7, 1.2),
      size: size * rnd(0.6, 1.4),
      stretch: rnd(0.3, 0.6),
      rot: rnd(0, 6),
      vr: rnd(-14, 14),
      color,
    });
  }
}

/** An expanding stroked ring. */
export function ring(x: number, y: number, from: number, to: number, color: string, life = 0.4, width = 3, delay = 0): Promise<void> {
  return addEffect({
    life,
    delay,
    draw: (c, k) => {
      const e = 1 - (1 - k) ** 3;
      c.globalCompositeOperation = "lighter";
      c.globalAlpha = (1 - k) ** 1.5;
      c.strokeStyle = color;
      c.lineWidth = Math.max(0.5, width * (1 - k * 0.7));
      c.beginPath();
      c.arc(x, y, from + (to - from) * e, 0, Math.PI * 2);
      c.stroke();
    },
  });
}

/** A bright flash that pops and fades at a point. */
export function flash(x: number, y: number, size: number, color: string, life = 0.16) {
  glow(x, y, size, color, life, size * 2.5);
  glow(x, y, size * 0.5, "#ffffff", life * 0.7, size);
}
