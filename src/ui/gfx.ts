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
  /** Set once the particle has had a frame at its starting point. */
  born: boolean;
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
  /** Set once the effect has been drawn at the very start of its life. */
  born: boolean;
}

/** Hard cap so a pile-up of effects can never drag the frame rate down. */
export const MAX_PARTICLES = 700;

const particles: Particle[] = [];
const pool: Particle[] = [];
const effects: LiveEffect[] = [];

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
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
  born: false,
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
    effects.push({ ...effect, age: effect.delay ? -effect.delay : 0, born: false, done: () => (done?.(), resolve()) });
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

/**
 * Advances every particle by `dt` seconds and retires the dead ones.
 *
 * A particle's first frame is always spent where it was emitted, however long that frame took: a
 * flash is seen on the muzzle it came from even when the frame rate drops, instead of being moved on
 * or burnt out before it was ever drawn.
 */
export function stepParticles(dt: number) {
  let keep = 0;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.delay > 0) {
      p.delay -= dt;
      particles[keep++] = p;
      continue;
    }
    if (!p.born) {
      p.born = true;
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

/**
 * One frame of the drawn effects: advances them by `dt` seconds, draws each one that is due on `c`,
 * and retires those that have finished.
 *
 * An effect is always drawn at both ends of its life, however long the frames run. Its clock is
 * held at zero until it has been drawn once, so a round is first seen at the muzzle and a missile
 * on its rail; and it is held at the end until that has been drawn too, so the round is seen
 * reaching its target. A dropped frame can only shorten the middle.
 */
export function playEffects(dt: number, c: CanvasRenderingContext2D) {
  for (const e of effects) e.age = e.born ? Math.min(e.life, e.age + dt) : Math.min(0, e.age + dt);
  // Effects added while drawing join the same frame, so a flash started by a round shows with it.
  for (const e of effects) {
    if (e.age < 0) continue;
    e.born = true;
    c.save();
    e.draw(c, e.life > 0 ? Math.min(1, e.age / e.life) : 1, e.age);
    c.restore();
  }
  let keep = 0;
  for (let i = 0; i < effects.length; i++) {
    const e = effects[i];
    if (e.born && e.age >= e.life) {
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

export interface Fit {
  /** Backing-store pixels per CSS pixel, across and down. */
  sx: number;
  sy: number;
  /** The canvas's box on screen, in client coordinates. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** The backing store the box needs. */
  pixelsWide: number;
  pixelsHigh: number;
}

/**
 * How a canvas shown in `box` must be sized and transformed so that drawing at a client coordinate
 * (the kind getBoundingClientRect returns) lands on that very point of the screen. `budget` caps
 * the backing store in pixels: soft glows do not need retina sharpness.
 */
export function fitBox(box: { left: number; top: number; width: number; height: number }, dpr: number, budget: number): Fit {
  const width = Math.max(1, box.width);
  const height = Math.max(1, box.height);
  const scale = Math.min(dpr || 1, 2, Math.sqrt(budget / (width * height)));
  const pixelsWide = Math.max(1, Math.round(width * scale));
  const pixelsHigh = Math.max(1, Math.round(height * scale));
  return { sx: pixelsWide / width, sy: pixelsHigh / height, left: box.left, top: box.top, width, height, pixelsWide, pixelsHigh };
}

/**
 * Lines a full-screen canvas up with the page for this frame and clears it. The canvas is measured
 * where it is actually shown rather than assumed to match the window: a phone browser's toolbars,
 * a zoomed page or a layer that is offset would otherwise shift every effect away from the jets.
 */
export function fitCanvas(target: HTMLCanvasElement, c: CanvasRenderingContext2D, budget: number): Fit {
  const shown = target.getBoundingClientRect();
  const box = shown.width > 0 && shown.height > 0 ? shown : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  const fit = fitBox(box, window.devicePixelRatio || 1, budget);
  if (target.width !== fit.pixelsWide || target.height !== fit.pixelsHigh) {
    target.width = fit.pixelsWide;
    target.height = fit.pixelsHigh;
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, target.width, target.height);
  c.setTransform(fit.sx, 0, 0, fit.sy, -fit.left * fit.sx, -fit.top * fit.sy);
  return fit;
}

export function initGfx(parent: HTMLElement) {
  canvas = document.createElement("canvas");
  canvas.className = "fx-canvas";
  parent.appendChild(canvas);
  ctx = canvas.getContext("2d");
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

function frame() {
  if (!ctx || !canvas) return;
  // Real elapsed time, read from the same clock as the fight's timers, so effects stay in step with them even when frames run long.
  const now = performance.now();
  const raw = last ? Math.min(0.25, (now - last) / 1000) : 0.016;
  last = now;
  const dt = now < frozenUntil ? 0 : raw * rate;
  stepParticles(dt);
  fitCanvas(canvas, ctx, 2_200_000);
  drawParticles(ctx);
  playEffects(dt, ctx);
  if (particles.length || effects.length) requestAnimationFrame(frame);
  else {
    running = false;
    // Nothing left to draw: leave the canvas empty rather than holding the last frame.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
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
