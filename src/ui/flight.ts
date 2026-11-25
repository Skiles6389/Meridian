/*
 * The battle backdrop in motion. One WebGL canvas draws the world the fight is flying through:
 * the act's painted sky, held steady above the horizon; the sea or land below it as a textured
 * plane in perspective, rushing out of the horizon and under the camera; and cloud layers between,
 * each nearer the camera than the last and so faster across the screen. Far ridges barely move,
 * the ground streams, and the cloud just under the jet whips past.
 *
 * The camera sways and bobs with the player's jet: `sway` is the one motion both follow, so when
 * the jet rolls into a gentle bank the horizon tilts the other way and the ground slides sideways.
 * On the enemy turn the stylesheet's camera pulls back; here the view widens and the world speeds
 * up a little. With reduced motion the world creeps and nothing sways.
 *
 * Everything is a single full-screen fragment shader: no per-frame DOM work, a handful of texture
 * lookups per pixel, and a drawing buffer that shrinks if the frame rate cannot be held.
 */

import { SCENE_ART } from "./art";

type Rgb = [number, number, number];

export interface FlightLook {
  /** The act's painting; only the part above `horizonRow` is used, as the sky. */
  sky: string;
  /** The square top-down texture tiled over the ground plane. */
  ground: string;
  /** How far down the painting its horizon is, 0 to 1. */
  horizonRow: number;
  /** The part of the sky, 0 to 1 across, kept in view on a narrow screen: where the sun or aurora is. */
  focus: number;
  /** Ground texture repeats per unit of distance: higher is higher altitude. */
  tile: number;
  /** Forward speed in the same units per second. */
  speed: number;
  /** How much of the mirrored sky shows in the ground: high over water, low over land. */
  reflect: number;
  /** How quickly the ground comes out of the horizon haze. */
  haze: number;
  /** Lit and shaded tones of the cloud layers. */
  cloudLit: Rgb;
  cloudShade: Rgb;
  /** Cloud cover of the deck below, the wisps just under the jet, and the wisps overhead, 0 to 1. */
  cover: Rgb;
  /** Far ridges on the horizon: height in screen heights, how sparse they are, and their two tones. */
  ridge: { height: number; gap: number; freq: number; dark: Rgb; lit: Rgb } | null;
}

export const FLIGHT_LOOKS: Record<number, FlightLook> = {
  // Baltic Shelf: a storm sea at dusk, scud below and the odd island on the horizon.
  1: {
    sky: "chase-act1",
    ground: "ground-act1",
    horizonRow: 0.468,
    focus: 0.78,
    tile: 0.3,
    speed: 2.3,
    reflect: 0.55,
    haze: 16,
    cloudLit: [0.98, 0.72, 0.56],
    cloudShade: [0.2, 0.24, 0.42],
    cover: [0.3, 0.34, 0.42],
    ridge: { height: 0.03, gap: 0.6, freq: 0.9, dark: [0.07, 0.1, 0.2], lit: [0.5, 0.3, 0.3] },
  },
  // The river valley at sunset, with hill country out to the horizon.
  2: {
    sky: "chase-act2",
    ground: "ground-act2",
    horizonRow: 0.372,
    focus: 0.72,
    tile: 0.19,
    speed: 2.6,
    reflect: 0.03,
    haze: 13,
    cloudLit: [1.0, 0.8, 0.66],
    cloudShade: [0.5, 0.38, 0.5],
    cover: [0.26, 0.3, 0.3],
    ridge: { height: 0.07, gap: 0.2, freq: 1.5, dark: [0.16, 0.12, 0.24], lit: [0.72, 0.42, 0.34] },
  },
  // Glass Meridian: very high over a polar sea under the aurora.
  3: {
    sky: "chase-act3",
    ground: "ground-act3",
    horizonRow: 0.452,
    focus: 0.5,
    tile: 0.42,
    speed: 2.0,
    reflect: 0.6,
    haze: 12,
    cloudLit: [0.82, 0.9, 1.0],
    cloudShade: [0.2, 0.3, 0.62],
    cover: [0.2, 0.26, 0.22],
    ridge: null,
  },
};

/* ------------------------------------------------------------------ motion */

export interface Sway {
  /** Roll of the player's jet in degrees, positive clockwise. */
  roll: number;
  /** Its drift as a percentage of its own width and height. */
  x: number;
  y: number;
}

const STILL: Sway = { roll: 0, x: 0, y: 0 };

/**
 * The gentle weave of the player's jet at time `t` in seconds: a slow bank from side to side with
 * a faster, smaller one on top, and a bob. The backdrop's camera follows the same curve.
 */
export function swayAt(t: number, still = false): Sway {
  if (still) return STILL;
  const a = Math.sin((t * Math.PI * 2) / 7.3);
  const b = Math.sin((t * Math.PI * 2) / 3.1 + 1.2);
  return {
    roll: 1.7 * a + 0.6 * b,
    x: 1.3 * a + 0.3 * b,
    y: 1.5 * Math.sin((t * Math.PI * 2) / 5.3 + 0.4),
  };
}

export type FlightShot = "close" | "wide";

/** How the world is framed for each camera shot: wide shows more of it and runs a little faster. */
export const SHOT_VIEW: Record<FlightShot, { zoom: number; speed: number }> = {
  close: { zoom: 1.14, speed: 1 },
  wide: { zoom: 0.9, speed: 1.3 },
};

/** Fraction of normal speed the world moves at with reduced motion. */
export const REDUCED_SPEED = 0.015;

const prefersStill = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Seconds on the clock every part of the motion reads. */
const clock = () => performance.now() / 1000;

/** The jet's sway right now, as an inline style for its sprite. */
export function swayStyle(): string {
  const s = swayAt(clock(), prefersStill());
  return `translate:${s.x.toFixed(2)}% ${s.y.toFixed(2)}%;rotate:${s.roll.toFixed(2)}deg`;
}

/* ------------------------------------------------------------------ shader */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uSky;
uniform sampler2D uGround;
uniform sampler2D uNoise;
uniform vec2 uRes;
uniform float uHz;
uniform float uRoll;
uniform float uPitch;
uniform float uZoom;
uniform float uYaw;
uniform vec2 uTravel;
uniform float uHRow;
uniform float uFocus;
uniform float uTile;
uniform float uReflect;
uniform float uHaze;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform vec3 uCover;
uniform vec4 uRidge;
uniform vec3 uRidgeDark;
uniform vec3 uRidgeLit;

const float SKY_SPAN = 0.6;

vec3 sky(float x, float up, float bias) {
  float v = uHRow * (1.0 - up / SKY_SPAN);
  float u = uFocus + x * uHRow / (SKY_SPAN * 1.7778) + uYaw * 0.012;
  return texture2D(uSky, vec2(u, clamp(v, 0.004, uHRow - 0.006)), bias).rgb;
}

float luma(vec3 c) {
  return dot(c, vec3(0.3, 0.59, 0.11));
}

float fbm(vec2 p) {
  return texture2D(uNoise, p).r * 0.5 + texture2D(uNoise, p * 2.7 + 0.37).r * 0.32 + texture2D(uNoise, p * 6.1 + 0.71).r * 0.18;
}

float fbm2(vec2 p) {
  return texture2D(uNoise, p).r * 0.62 + texture2D(uNoise, p * 2.7 + 0.37).r * 0.38;
}

/* Thin cloud on a plane, for the wisps that streak past just above and below the camera. */
float wisps(vec2 p, float cover, float edge) {
  float t = 1.0 - cover;
  return smoothstep(t, t + edge, fbm2(p));
}

/* The ground texture, patched from two different places in it so the repeat never lines up. */
vec3 groundAt(vec2 g) {
  vec3 a = texture2D(uGround, g).rgb;
  vec3 b = texture2D(uGround, mat2(0.94, 0.342, -0.342, 0.94) * g * 0.87 + vec2(0.31, 0.67)).rgb;
  return mix(a, b, smoothstep(0.44, 0.56, texture2D(uNoise, g * 0.23 + 0.11).r));
}

/* A far ridge line: rolling high ground with a few sharper tops. */
float ridgeLine(float rx) {
  return 0.5 + 0.27 * sin(rx * 1.3 + 0.6) + 0.13 * sin(rx * 3.1 + 2.2) + 0.07 * sin(rx * 7.3 + 4.0) + 0.05 * (1.0 - abs(sin(rx * 11.0 + 1.0)));
}

/* One range of hills on the horizon: a flat tone that sinks into the haze at its foot, the sun on its crest. */
vec4 ridge(float x, float up, float px, float scale, float offset, vec3 haze, float far) {
  float rx = x * uRidge.z / scale + uYaw * 0.4 / scale + offset;
  float n = ridgeLine(rx);
  float h = uRidge.x * scale * max(0.0, (n - uRidge.y) / (1.0 - uRidge.y));
  float m = smoothstep(h + px, h - px, up) * step(0.0006, h);
  float crest = smoothstep(h - 0.003 - px, h - 0.003 + px, up);
  vec3 tone = mix(uRidgeDark, uRidgeLit, crest * 0.6);
  return vec4(mix(haze, tone, (1.0 - far) * (0.35 + 0.65 * smoothstep(0.0, uRidge.x * scale * 0.6, up))), m);
}

void main() {
  float aspect = uRes.x / uRes.y;
  vec2 q = vec2((vUv.x - 0.5) * aspect, vUv.y - 0.5);
  float c = cos(uRoll);
  float s = sin(uRoll);
  q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  float x = q.x / uZoom;
  float y = (q.y - (uHz - 0.5)) / uZoom - uPitch;
  float px = 1.5 / (uRes.y * uZoom);
  vec3 haze = sky(x, 0.03, 5.0);
  vec3 col;
  if (y < 0.0) {
    float up = -y;
    col = sky(x, up, 0.0);
    col = mix(col, haze, 0.75 * smoothstep(0.03, 0.0, up));
    if (uRidge.x > 0.0) {
      vec4 far = ridge(x, up, px, 1.0, 0.13, haze, 0.55);
      col = mix(col, far.rgb, far.a);
      vec4 near = ridge(x, up, px, 0.62, 0.58, haze, 0.25);
      col = mix(col, near.rgb, near.a);
    }
    // Wisps on a layer just above the camera: they streak overhead at the top of the frame.
    float d = max(up, 0.001);
    float high = wisps((vec2(x / d, 1.0 / d) * 0.3 + uTravel) * vec2(0.2, 0.045), uCover.z, 0.1 + 0.012 / d);
    col = mix(col, mix(col, uCloudLit, 0.55), high * 0.5 * smoothstep(0.16, 0.4, up));
  } else {
    float d = max(y, 0.0012);
    vec2 w = vec2(x / d, 1.0 / d);
    vec2 g = (w + uTravel) * uTile;
    vec3 ground = groundAt(g);
    // A second, wider look at the same texture takes over towards the horizon, so it does not read as tiles.
    vec3 wide = texture2D(uGround, mat2(0.8, 0.6, -0.6, 0.8) * g * 0.29 + 0.37).rgb;
    ground = mix(ground, wide, 0.4 * smoothstep(0.16, 0.02, d));
    // The sky mirrored in the surface, brightest on the crests.
    vec3 mirror = sky(x + (luma(ground) - 0.3) * 0.06, d * 0.85 + 0.012, 1.5);
    ground += mirror * uReflect * (0.25 + 1.5 * luma(ground)) * smoothstep(0.62, 0.0, d);
    // The cloud deck part-way down to the ground: nearer the camera, so it moves faster across the
    // screen. Each cloud is cel-shaded: a sunlit top, and under it the shaded side that faces the camera.
    float t = 1.0 - uCover.x;
    float edge = 0.012 + 0.012 / d;
    vec2 top = (w * 0.46 + uTravel) * 0.16;
    vec2 base = (w * 0.54 + uTravel) * 0.16;
    float nTop = fbm(top);
    float aTop = smoothstep(t, t + edge, nTop);
    float aBase = smoothstep(t, t + edge, fbm2(base));
    float rim = smoothstep(t + 0.03, t + 0.03 + edge, nTop);
    ground *= 1.0 - 0.28 * smoothstep(t - 0.03, t + 0.03, texture2D(uNoise, (w * 0.62 + uTravel) * 0.16 + vec2(0.02, 0.0)).r);
    ground = mix(ground, uCloudShade * 0.74, aBase);
    ground = mix(ground, mix(uCloudShade, uCloudLit, rim), aTop);
    float fog = 1.0 - exp(-d * uHaze);
    col = mix(haze, ground, fog);
    // Wisps on a layer just under the camera: long streaks that whip past at the bottom of the frame.
    float low = wisps((w * 0.1 + uTravel) * vec2(0.55, 0.1), uCover.y, 0.1 + 0.01 / d);
    col = mix(col, mix(col, uCloudLit, 0.7), low * 0.44 * smoothstep(0.1, 0.34, d));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

/* ---------------------------------------------------------------- renderer */

const UNIFORMS = [
  "uSky", "uGround", "uNoise", "uRes", "uHz", "uRoll", "uPitch", "uZoom", "uYaw", "uTravel", "uHRow", "uFocus", "uTile",
  "uReflect", "uHaze", "uCloudLit", "uCloudShade", "uCover", "uRidge", "uRidgeDark", "uRidgeLit",
] as const;

type UniformName = (typeof UNIFORMS)[number];

interface Gpu {
  gl: WebGLRenderingContext;
  u: Record<UniformName, WebGLUniformLocation | null>;
  noise: WebGLTexture;
  aniso: { ext: EXT_texture_filter_anisotropic; max: number } | null;
}

let canvas: HTMLCanvasElement | null = null;
let gpu: Gpu | null = null;
let failed = false;
let act = 0;
let frame = 0;
let last = 0;
let slow = 0;
let quality = 1;
/** Distance flown, forward and sideways. */
const travel = { x: 0, y: 0 };
let yaw = 0;
let zoom = SHOT_VIEW.close.zoom;
let pace = 1;
const images = new Map<string, HTMLImageElement>();
const textures = new Map<string, WebGLTexture>();

/** Smooth tiling noise, the same every time: cloud shapes and ridge lines are read from it. */
function noiseData(size: number): Uint8Array {
  let seed = 20261;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const sum = new Float32Array(size * size);
  let weight = 0;
  for (let cells = 4, amp = 1; cells <= 64; cells *= 2, amp *= 0.55) {
    const lattice = new Float32Array(cells * cells);
    for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
    const step = cells / size;
    for (let py = 0; py < size; py++) {
      const fy = py * step;
      const y0 = Math.floor(fy);
      const ty = fy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      const ya = (y0 % cells) * cells;
      const yb = ((y0 + 1) % cells) * cells;
      for (let px = 0; px < size; px++) {
        const fx = px * step;
        const x0 = Math.floor(fx);
        const tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const xa = x0 % cells;
        const xb = (x0 + 1) % cells;
        const top = lattice[ya + xa] + (lattice[ya + xb] - lattice[ya + xa]) * sx;
        const bottom = lattice[yb + xa] + (lattice[yb + xb] - lattice[yb + xa]) * sx;
        sum[py * size + px] += (top + (bottom - top) * sy) * amp;
      }
    }
    weight += amp;
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of sum) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const out = new Uint8Array(size * size);
  for (let i = 0; i < out.length; i++) out[i] = Math.round(((sum[i] - lo) / (hi - lo)) * 255);
  void weight;
  return out;
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  if (import.meta.env.DEV) console.error(gl.getShaderInfoLog(shader));
  return null;
}

function setup(target: HTMLCanvasElement): Gpu | null {
  const gl = target.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power", preserveDrawingBuffer: false });
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // One triangle that covers the screen.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const at = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  const u = {} as Gpu["u"];
  for (const name of UNIFORMS) u[name] = gl.getUniformLocation(program, name);
  const ext = gl.getExtension("EXT_texture_filter_anisotropic");
  const aniso = ext ? { ext, max: Math.min(8, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number) } : null;
  const noise = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, noise);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 256, 256, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, noiseData(256));
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return { gl, u, noise, aniso };
}

/** Uploads an image at a power-of-two size, which mipmaps and repeating need. */
function upload(g: Gpu, key: string, img: HTMLImageElement, w: number, h: number, repeat: boolean): WebGLTexture {
  const { gl } = g;
  const scratch = document.createElement("canvas");
  scratch.width = w;
  scratch.height = h;
  scratch.getContext("2d")!.drawImage(img, 0, 0, w, h);
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, scratch);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat ? gl.REPEAT : gl.MIRRORED_REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  if (repeat && g.aniso) gl.texParameterf(gl.TEXTURE_2D, g.aniso.ext.TEXTURE_MAX_ANISOTROPY_EXT, g.aniso.max);
  textures.set(key, tex);
  return tex;
}

function image(name: string): HTMLImageElement | null {
  let img = images.get(name);
  if (!img) {
    const src = SCENE_ART[name];
    if (!src) return null;
    img = new Image();
    img.decoding = "async";
    img.src = src;
    images.set(name, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

function texture(g: Gpu, name: string, w: number, h: number, repeat: boolean): WebGLTexture | null {
  const have = textures.get(name);
  if (have) return have;
  const img = image(name);
  return img ? upload(g, name, img, w, h, repeat) : null;
}

/** Where the horizon sits on screen, from the top: a little higher on a tall phone, under the enemy formation. */
function horizonOn(w: number, h: number): number {
  return w < h ? 0.4 : h <= 560 ? 0.47 : 0.45;
}

function resize(target: HTMLCanvasElement) {
  const cssW = target.clientWidth || window.innerWidth;
  const cssH = target.clientHeight || window.innerHeight;
  let scale = Math.min(window.devicePixelRatio || 1, 1.5) * quality;
  const budget = 900_000;
  if (cssW * cssH * scale * scale > budget) scale = Math.sqrt(budget / (cssW * cssH));
  const w = Math.max(2, Math.round(cssW * scale));
  const h = Math.max(2, Math.round(cssH * scale));
  if (target.width !== w || target.height !== h) {
    target.width = w;
    target.height = h;
  }
}

function render(now: number) {
  frame = 0;
  if (!canvas || !canvas.isConnected || !act) return;
  frame = requestAnimationFrame(render);
  const still = prefersStill();
  const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
  // With reduced motion a few frames a second is plenty for a world that barely moves.
  if (still && last && now - last < 120) return;
  if (!still && last) {
    // Drop the drawing buffer a notch if frames keep coming late.
    slow = now - last > 24 ? slow + 1 : Math.max(0, slow - 0.25);
    if (slow > 45 && quality > 0.5) {
      quality *= 0.8;
      slow = 0;
    }
  }
  last = now;
  const look = FLIGHT_LOOKS[act];
  const t = clock();
  const shot = SHOT_VIEW[document.documentElement.dataset.cam === "wide" ? "wide" : "close"];
  const ease = 1 - Math.exp(-dt * 3.2);
  zoom += (shot.zoom - zoom) * ease;
  pace += ((still ? REDUCED_SPEED : shot.speed) - pace) * ease;
  const jet = swayAt(t, still);
  // The camera trails the jet: it rolls a little the other way a moment later.
  const trail = swayAt(t - 0.35, still);
  const bank = (trail.roll * Math.PI) / 180;
  yaw += bank * dt * 1.4;
  travel.y = (travel.y + look.speed * pace * dt) % 4096;
  travel.x = (travel.x + (bank * 1.6 + 0.045) * look.speed * pace * dt) % 4096;
  const ally = document.querySelector<HTMLElement>(".ally .unit-art");
  if (ally) {
    ally.style.translate = `${jet.x.toFixed(2)}% ${jet.y.toFixed(2)}%`;
    ally.style.rotate = `${jet.roll.toFixed(2)}deg`;
  }
  if (!gpu || failed) return;
  const { gl, u } = gpu;
  resize(canvas);
  const sky = texture(gpu, look.sky, 2048, 1024, false);
  const ground = texture(gpu, look.ground, 1024, 1024, true);
  if (!sky || !ground) return;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sky);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, ground);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, gpu.noise);
  gl.uniform1i(u.uSky, 0);
  gl.uniform1i(u.uGround, 1);
  gl.uniform1i(u.uNoise, 2);
  gl.uniform2f(u.uRes, canvas.width, canvas.height);
  gl.uniform1f(u.uHz, horizonOn(canvas.width, canvas.height));
  gl.uniform1f(u.uRoll, -bank * 0.7);
  gl.uniform1f(u.uPitch, -trail.y * 0.0035);
  gl.uniform1f(u.uZoom, zoom);
  gl.uniform1f(u.uYaw, yaw);
  gl.uniform2f(u.uTravel, travel.x, travel.y);
  gl.uniform1f(u.uHRow, look.horizonRow);
  // On a wide screen the whole sky is in view; on a narrow one, centre on its focus.
  const narrow = Math.max(0, Math.min(1, 1.5 - canvas.width / canvas.height));
  gl.uniform1f(u.uFocus, 0.5 + (look.focus - 0.5) * narrow);
  gl.uniform1f(u.uTile, look.tile);
  gl.uniform1f(u.uReflect, look.reflect);
  gl.uniform1f(u.uHaze, look.haze);
  gl.uniform3fv(u.uCloudLit, look.cloudLit);
  gl.uniform3fv(u.uCloudShade, look.cloudShade);
  gl.uniform3fv(u.uCover, look.cover);
  const r = look.ridge;
  gl.uniform4f(u.uRidge, r ? r.height : 0, r ? r.gap : 0, r ? r.freq : 1, 0);
  gl.uniform3fv(u.uRidgeDark, r ? r.dark : [0, 0, 0]);
  gl.uniform3fv(u.uRidgeLit, r ? r.lit : [0, 0, 0]);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  canvas.classList.add("on");
}

function start() {
  if (!frame) {
    last = 0;
    frame = requestAnimationFrame(render);
  }
}

/**
 * Shows the moving backdrop for `nextAct` inside `slot`, or stops it with 0. Without WebGL the
 * canvas never appears and the painted sky under it stays as the backdrop; the jet still sways.
 */
export function setFlight(nextAct: number, slot?: HTMLElement | null) {
  act = FLIGHT_LOOKS[nextAct] ? nextAct : 0;
  if (!act || !slot || typeof document === "undefined") return;
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.className = "sc-flight";
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      gpu = null;
      textures.clear();
      canvas?.classList.remove("on");
    });
    canvas.addEventListener("webglcontextrestored", () => {
      gpu = canvas ? setup(canvas) : null;
    });
    try {
      gpu = setup(canvas);
    } catch {
      gpu = null;
    }
    failed = !gpu;
  }
  // Start the pictures loading before the first frame asks for them.
  image(FLIGHT_LOOKS[act].sky);
  image(FLIGHT_LOOKS[act].ground);
  canvas.classList.remove("on");
  slot.appendChild(canvas);
  start();
}
