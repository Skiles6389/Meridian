/*
 * All sound is synthesized at runtime with Web Audio: no samples, no recordings.
 * Two buses (music, effects) feed a master gain and a gentle compressor.
 */

export type Cue =
  | "click"
  | "draw"
  | "play"
  | "cannon"
  | "missile"
  | "heavy"
  | "zap"
  | "hit"
  | "hitBig"
  | "explode"
  | "shield"
  | "block"
  | "heal"
  | "hurt"
  | "evade"
  | "error"
  | "turn"
  | "win"
  | "lose"
  | "unlock"
  | "whoosh"
  | "gold"
  | "boss"
  | "flare"
  | "chaff"
  | "lock"
  | "ping"
  | "glitch"
  | "laser"
  | "brrt"
  | "rocket"
  | "bomb"
  | "slash"
  | "plate"
  | "shieldUp"
  | "cloak"
  | "burner"
  | "vent"
  | "repair"
  | "tape"
  | "reload"
  | "power"
  | "crack"
  | "system"
  | "flyby"
  | "tick"
  | "shuffle"
  | "discard"
  | "exhaust"
  | "energy"
  | "crit"
  | "flip"
  | "node"
  | "travel";

/** Every cue, for tests that check effect recipes name real sounds. */
export const CUE_NAMES: Cue[] = [
  "click", "draw", "play", "cannon", "missile", "heavy", "zap", "hit", "hitBig", "explode", "shield", "block", "heal", "hurt", "evade", "error",
  "turn", "win", "lose", "unlock", "whoosh", "gold", "boss", "flare", "chaff", "lock", "ping", "glitch", "laser", "brrt", "rocket", "bomb", "slash",
  "plate", "shieldUp", "cloak", "burner", "vent", "repair", "tape", "reload", "power", "crack", "system", "flyby", "tick", "shuffle", "discard",
  "exhaust", "energy", "crit", "flip", "node", "travel",
];

export type Track = "title" | "act1" | "act2" | "act3" | "boss";

export interface AudioSettings {
  mute: boolean;
  /** 0..1 */
  music: number;
  /** 0..1 */
  sfx: number;
}

const settings: AudioSettings = { mute: false, music: 0.6, sfx: 0.8 };

let ctx: AudioContext | null = null;
let master: GainNode;
let musicBus: GainNode;
let sfxBus: GainNode;
let noiseBuf: AudioBuffer;
let brownBuf: AudioBuffer;
let ambience: GainNode | null = null;
let meter: AnalyserNode | null = null;
let output: AudioNode | null = null;

let wantTrack: Track | null = null;
let wantAmbience = false;
let player: Player | null = null;

const level = (v: number) => Math.max(0, Math.min(1, v)) ** 2;

export function configureAudio(next: Partial<AudioSettings>) {
  Object.assign(settings, next);
  applyLevels();
}

export function setMuted(next: boolean) {
  configureAudio({ mute: next });
}

export function isMuted(): boolean {
  return settings.mute;
}

function applyLevels() {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(settings.mute ? 0 : MAKEUP, t, 0.03);
  musicBus.gain.setTargetAtTime(level(settings.music) * 0.55, t, 0.06);
  sfxBus.gain.setTargetAtTime(level(settings.sfx), t, 0.03);
}

function makeNoise(seconds: number, brown: boolean): AudioBuffer {
  const length = Math.floor(ctx!.sampleRate * seconds);
  const buffer = ctx!.createBuffer(1, length, ctx!.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else data[i] = white;
  }
  return buffer;
}

/** Drives the mix into the compressor, which keeps the peaks in check. */
const MAKEUP = 1.6;

/** Call from a user gesture. Creates the audio graph the first time and resumes it after. */
export function unlockAudio() {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  if (!ctx) {
    ctx = new Ctx();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    master = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus.gain.value = 0;
    sfxBus.gain.value = 0;
    musicBus.connect(master);
    sfxBus.connect(master);
    master.connect(comp);
    comp.connect(ctx.destination);
    output = comp;
    meter = ctx.createAnalyser();
    meter.fftSize = 2048;
    comp.connect(meter);
    noiseBuf = makeNoise(2, false);
    brownBuf = makeNoise(3, true);
    applyLevels();
    document.addEventListener("visibilitychange", () => {
      if (!ctx) return;
      if (document.hidden) void ctx.suspend();
      else void ctx.resume();
    });
    const track = wantTrack;
    wantTrack = null;
    setMusic(track);
    setAmbience(wantAmbience);
  }
  if (ctx.state === "suspended" && !document.hidden) void ctx.resume();
}

/* ------------------------------------------------------------- building blocks */

interface FilterSpec {
  type: BiquadFilterType;
  freq: number;
  to?: number;
  q?: number;
}

interface ToneSpec {
  type: OscillatorType;
  freq: number;
  to?: number;
  dur: number;
  gain: number;
  at?: number;
  attack?: number;
  detune?: number;
  filter?: FilterSpec;
  out?: AudioNode;
}

function filtered(src: AudioNode, spec: FilterSpec | undefined, t: number, dur: number): AudioNode {
  if (!spec) return src;
  const f = ctx!.createBiquadFilter();
  f.type = spec.type;
  f.frequency.setValueAtTime(spec.freq, t);
  if (spec.to) f.frequency.exponentialRampToValueAtTime(spec.to, t + dur);
  if (spec.q !== undefined) f.Q.value = spec.q;
  src.connect(f);
  return f;
}

function envelope(t: number, dur: number, peak: number, attack: number): GainNode {
  const g = ctx!.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return g;
}

function tone(spec: ToneSpec) {
  if (!ctx) return;
  const t = spec.at ?? ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.freq, t);
  if (spec.to) osc.frequency.exponentialRampToValueAtTime(spec.to, t + spec.dur);
  if (spec.detune) osc.detune.value = spec.detune;
  const g = envelope(t, spec.dur, spec.gain, spec.attack ?? 0.005);
  filtered(osc, spec.filter, t, spec.dur).connect(g);
  g.connect(spec.out ?? sfxBus);
  osc.start(t);
  osc.stop(t + spec.dur + 0.05);
}

interface NoiseSpec {
  dur: number;
  gain: number;
  filter: FilterSpec;
  at?: number;
  attack?: number;
  out?: AudioNode;
  rate?: number;
}

function hiss(spec: NoiseSpec) {
  if (!ctx) return;
  const t = spec.at ?? ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  if (spec.rate) src.playbackRate.value = spec.rate;
  const g = envelope(t, spec.dur, spec.gain, spec.attack ?? 0.003);
  filtered(src, spec.filter, t, spec.dur).connect(g);
  g.connect(spec.out ?? sfxBus);
  src.start(t, Math.random() * 1.5);
  src.stop(t + spec.dur + 0.05);
}

/* ------------------------------------------------------------------- effects */

const lastCue = new Map<Cue, number>();

export function sfx(cue: Cue) {
  if (!ctx || settings.mute || settings.sfx <= 0) return;
  const now = ctx.currentTime;
  if (now - (lastCue.get(cue) ?? -1) < 0.03) return;
  lastCue.set(cue, now);
  CUES[cue](now);
}

const CUES: Record<Cue, (t: number) => void> = {
  click: (t) => {
    tone({ type: "square", freq: 1250, to: 900, dur: 0.035, gain: 0.04, at: t, filter: { type: "lowpass", freq: 3200 } });
  },
  draw: (t) => {
    hiss({ dur: 0.07, gain: 0.11, at: t, filter: { type: "bandpass", freq: 2400, to: 5200, q: 1.2 } });
    tone({ type: "triangle", freq: 620, to: 940, dur: 0.05, gain: 0.025, at: t });
  },
  play: (t) => {
    hiss({ dur: 0.14, gain: 0.12, at: t, attack: 0.02, filter: { type: "bandpass", freq: 700, to: 3400, q: 0.9 } });
    tone({ type: "triangle", freq: 320, to: 760, dur: 0.12, gain: 0.05, at: t });
  },
  cannon: (t) => {
    for (let i = 0; i < 5; i++) {
      const at = t + i * 0.052;
      hiss({ dur: 0.05, gain: 0.22, at, filter: { type: "bandpass", freq: 1700 + Math.random() * 400, q: 0.8 } });
      tone({ type: "square", freq: 150, to: 60, dur: 0.05, gain: 0.05, at, filter: { type: "lowpass", freq: 1200 } });
      tone({ type: "sine", freq: 110, to: 42, dur: 0.07, gain: 0.18, at });
    }
  },
  missile: (t) => {
    tone({ type: "sine", freq: 170, to: 55, dur: 0.14, gain: 0.22, at: t });
    hiss({ dur: 0.55, gain: 0.2, at: t, attack: 0.02, filter: { type: "bandpass", freq: 1500, to: 420, q: 1.4 } });
    hiss({ dur: 0.4, gain: 0.05, at: t + 0.03, filter: { type: "highpass", freq: 4200 } });
  },
  heavy: (t) => {
    tone({ type: "sine", freq: 130, to: 38, dur: 0.22, gain: 0.3, at: t });
    tone({ type: "sawtooth", freq: 78, to: 40, dur: 0.5, gain: 0.05, at: t, filter: { type: "lowpass", freq: 500 } });
    hiss({ dur: 0.8, gain: 0.24, at: t, attack: 0.03, filter: { type: "bandpass", freq: 1100, to: 260, q: 1.2 } });
  },
  zap: (t) => {
    tone({ type: "sawtooth", freq: 1900, to: 280, dur: 0.16, gain: 0.05, at: t, filter: { type: "lowpass", freq: 4000 } });
    tone({ type: "square", freq: 2600, to: 3400, dur: 0.1, gain: 0.015, at: t, filter: { type: "bandpass", freq: 3000, q: 4 } });
    hiss({ dur: 0.12, gain: 0.05, at: t, filter: { type: "highpass", freq: 5000 } });
  },
  hit: (t) => {
    hiss({ dur: 0.15, gain: 0.28, at: t, filter: { type: "lowpass", freq: 2600, to: 500 } });
    tone({ type: "square", freq: 230, to: 90, dur: 0.08, gain: 0.05, at: t, filter: { type: "lowpass", freq: 1400 } });
    tone({ type: "sine", freq: 130, to: 48, dur: 0.12, gain: 0.25, at: t });
  },
  hitBig: (t) => {
    tone({ type: "sine", freq: 120, to: 34, dur: 0.35, gain: 0.42, at: t });
    hiss({ dur: 0.45, gain: 0.36, at: t, filter: { type: "lowpass", freq: 2200, to: 180 } });
    tone({ type: "square", freq: 180, to: 60, dur: 0.14, gain: 0.05, at: t, filter: { type: "lowpass", freq: 1000 } });
  },
  explode: (t) => {
    tone({ type: "sine", freq: 115, to: 26, dur: 1.0, gain: 0.55, at: t });
    hiss({ dur: 1.4, gain: 0.5, at: t, filter: { type: "lowpass", freq: 2400, to: 110 } });
    hiss({ dur: 0.25, gain: 0.25, at: t, filter: { type: "bandpass", freq: 900, q: 0.7 } });
    for (let i = 0; i < 7; i++) {
      hiss({ dur: 0.04, gain: 0.07 + Math.random() * 0.06, at: t + 0.12 + Math.random() * 0.75, filter: { type: "highpass", freq: 2200 } });
    }
  },
  shield: (t) => {
    tone({ type: "sine", freq: 640, to: 980, dur: 0.28, gain: 0.07, at: t, attack: 0.015 });
    tone({ type: "sine", freq: 1290, to: 1960, dur: 0.22, gain: 0.025, at: t + 0.02, attack: 0.015 });
    hiss({ dur: 0.22, gain: 0.03, at: t, attack: 0.02, filter: { type: "highpass", freq: 3500 } });
  },
  block: (t) => {
    hiss({ dur: 0.05, gain: 0.14, at: t, filter: { type: "bandpass", freq: 3200, q: 1 } });
    tone({ type: "sine", freq: 742, dur: 0.38, gain: 0.06, at: t });
    tone({ type: "sine", freq: 1113, dur: 0.3, gain: 0.04, at: t });
    tone({ type: "sine", freq: 1637, dur: 0.22, gain: 0.03, at: t });
  },
  heal: (t) => {
    [523, 659, 784].forEach((freq, i) => tone({ type: "triangle", freq, dur: 0.16, gain: 0.045, at: t + i * 0.07 }));
  },
  hurt: (t) => {
    tone({ type: "sawtooth", freq: 170, to: 70, dur: 0.24, gain: 0.07, at: t, filter: { type: "lowpass", freq: 900 } });
    hiss({ dur: 0.16, gain: 0.2, at: t, filter: { type: "lowpass", freq: 1600, to: 300 } });
  },
  evade: (t) => {
    hiss({ dur: 0.3, gain: 0.12, at: t, attack: 0.05, filter: { type: "bandpass", freq: 700, to: 2600, q: 1.5 } });
  },
  error: (t) => {
    tone({ type: "square", freq: 190, dur: 0.08, gain: 0.035, at: t, filter: { type: "lowpass", freq: 1500 } });
    tone({ type: "square", freq: 142, dur: 0.1, gain: 0.035, at: t + 0.08, filter: { type: "lowpass", freq: 1500 } });
  },
  turn: (t) => {
    tone({ type: "triangle", freq: 392, dur: 0.08, gain: 0.05, at: t });
    tone({ type: "triangle", freq: 587, dur: 0.12, gain: 0.05, at: t + 0.06 });
  },
  win: (t) => {
    [523, 659, 784, 1046].forEach((freq, i) => {
      tone({ type: "triangle", freq, dur: 0.2, gain: 0.06, at: t + i * 0.1 });
      tone({ type: "square", freq, dur: 0.16, gain: 0.015, at: t + i * 0.1, filter: { type: "lowpass", freq: 3000 } });
    });
    [523, 659, 784].forEach((freq) => tone({ type: "triangle", freq: freq * 2, dur: 0.9, gain: 0.03, at: t + 0.42, attack: 0.02 }));
  },
  lose: (t) => {
    [330, 262, 196, 147].forEach((freq, i) => tone({ type: "sawtooth", freq, dur: 0.24, gain: 0.04, at: t + i * 0.14, filter: { type: "lowpass", freq: 900 } }));
  },
  unlock: (t) => {
    [659, 880, 1175, 1568].forEach((freq, i) => tone({ type: "sine", freq, dur: 0.18, gain: 0.045, at: t + i * 0.07 }));
  },
  whoosh: (t) => {
    hiss({ dur: 0.62, gain: 0.13, at: t, attack: 0.2, filter: { type: "bandpass", freq: 380, to: 2200, q: 1.1 } });
    tone({ type: "sine", freq: 150, to: 90, dur: 0.45, gain: 0.03, at: t, attack: 0.1 });
  },
  gold: (t) => {
    tone({ type: "square", freq: 988, dur: 0.07, gain: 0.035, at: t, filter: { type: "lowpass", freq: 5000 } });
    tone({ type: "square", freq: 1319, dur: 0.28, gain: 0.035, at: t + 0.07, filter: { type: "lowpass", freq: 5000 } });
    tone({ type: "triangle", freq: 2637, dur: 0.2, gain: 0.012, at: t + 0.08 });
  },
  boss: (t) => {
    for (let i = 0; i < 6; i++) {
      tone({ type: "sawtooth", freq: i % 2 ? 330 : 440, dur: 0.22, gain: 0.06, at: t + i * 0.22, attack: 0.02, filter: { type: "lowpass", freq: 1500 } });
    }
    tone({ type: "sine", freq: 55, dur: 1.5, gain: 0.18, at: t, attack: 0.1 });
  },
  flare: (t) => {
    for (let i = 0; i < 4; i++) {
      const at = t + i * 0.035;
      hiss({ dur: 0.09, gain: 0.16, at, filter: { type: "bandpass", freq: 2600 + i * 300, q: 1.4 } });
      tone({ type: "sine", freq: 210, to: 90, dur: 0.07, gain: 0.1, at });
    }
    hiss({ dur: 0.55, gain: 0.07, at: t + 0.05, attack: 0.05, filter: { type: "highpass", freq: 3800 } });
  },
  chaff: (t) => {
    tone({ type: "sine", freq: 160, to: 70, dur: 0.09, gain: 0.14, at: t });
    hiss({ dur: 0.5, gain: 0.12, at: t, attack: 0.02, filter: { type: "highpass", freq: 5200 } });
    for (let i = 0; i < 6; i++) tone({ type: "triangle", freq: 3200 + Math.random() * 2400, dur: 0.05, gain: 0.012, at: t + 0.04 + Math.random() * 0.3 });
  },
  lock: (t) => {
    tone({ type: "square", freq: 1480, dur: 0.045, gain: 0.03, at: t, filter: { type: "lowpass", freq: 4200 } });
    tone({ type: "square", freq: 1480, dur: 0.045, gain: 0.03, at: t + 0.085, filter: { type: "lowpass", freq: 4200 } });
    tone({ type: "square", freq: 1976, dur: 0.16, gain: 0.035, at: t + 0.17, filter: { type: "lowpass", freq: 4800 } });
  },
  ping: (t) => {
    tone({ type: "sine", freq: 1320, to: 1180, dur: 0.5, gain: 0.07, at: t, attack: 0.004 });
    tone({ type: "sine", freq: 2640, to: 2360, dur: 0.3, gain: 0.02, at: t });
    tone({ type: "sine", freq: 1320, to: 1180, dur: 0.35, gain: 0.02, at: t + 0.19 });
  },
  glitch: (t) => {
    for (let i = 0; i < 6; i++) {
      const at = t + i * 0.035 + Math.random() * 0.015;
      tone({ type: "square", freq: 300 + Math.random() * 2600, dur: 0.03, gain: 0.028, at, filter: { type: "bandpass", freq: 1800, q: 0.6 } });
    }
    hiss({ dur: 0.26, gain: 0.1, at: t, filter: { type: "bandpass", freq: 3400, q: 0.5 }, rate: 0.5 });
  },
  laser: (t) => {
    tone({ type: "sawtooth", freq: 880, to: 620, dur: 0.34, gain: 0.05, at: t, attack: 0.02, filter: { type: "bandpass", freq: 1800, q: 2 } });
    tone({ type: "sine", freq: 1760, to: 1240, dur: 0.3, gain: 0.03, at: t, attack: 0.02 });
    hiss({ dur: 0.3, gain: 0.04, at: t, attack: 0.03, filter: { type: "highpass", freq: 5000 } });
  },
  brrt: (t) => {
    // One long burst: a buzzing rotary cannon rather than separate reports.
    tone({ type: "sawtooth", freq: 74, to: 62, dur: 0.62, gain: 0.16, at: t, attack: 0.02, filter: { type: "lowpass", freq: 900 } });
    tone({ type: "square", freq: 148, to: 124, dur: 0.6, gain: 0.05, at: t, attack: 0.02, filter: { type: "lowpass", freq: 1600 } });
    hiss({ dur: 0.62, gain: 0.22, at: t, attack: 0.03, filter: { type: "bandpass", freq: 1500, q: 0.6 } });
    hiss({ dur: 0.5, gain: 0.08, at: t + 0.15, attack: 0.1, filter: { type: "lowpass", freq: 500 } });
  },
  rocket: (t) => {
    for (let i = 0; i < 4; i++) {
      const at = t + i * 0.045;
      hiss({ dur: 0.26, gain: 0.13, at, attack: 0.01, filter: { type: "bandpass", freq: 2200, to: 700, q: 1.6 } });
      tone({ type: "sine", freq: 190, to: 80, dur: 0.08, gain: 0.1, at });
    }
  },
  bomb: (t) => {
    tone({ type: "sine", freq: 90, to: 60, dur: 0.1, gain: 0.16, at: t });
    tone({ type: "sine", freq: 1500, to: 520, dur: 0.46, gain: 0.03, at: t + 0.04, attack: 0.08 });
    hiss({ dur: 0.4, gain: 0.05, at: t + 0.04, attack: 0.15, filter: { type: "bandpass", freq: 1200, to: 500, q: 2 } });
  },
  slash: (t) => {
    hiss({ dur: 0.2, gain: 0.2, at: t, attack: 0.05, filter: { type: "bandpass", freq: 900, to: 5200, q: 1.3 } });
    tone({ type: "triangle", freq: 2400, to: 900, dur: 0.1, gain: 0.03, at: t + 0.1 });
  },
  plate: (t) => {
    for (let i = 0; i < 3; i++) {
      const at = t + 0.12 + i * 0.055;
      tone({ type: "square", freq: 190 - i * 20, to: 80, dur: 0.07, gain: 0.07, at, filter: { type: "lowpass", freq: 1100 } });
      hiss({ dur: 0.04, gain: 0.14, at, filter: { type: "bandpass", freq: 2800, q: 1 } });
      tone({ type: "sine", freq: 880 + i * 120, dur: 0.2, gain: 0.018, at });
    }
  },
  shieldUp: (t) => {
    tone({ type: "sine", freq: 330, to: 660, dur: 0.34, gain: 0.08, at: t, attack: 0.03 });
    tone({ type: "sine", freq: 495, to: 990, dur: 0.34, gain: 0.04, at: t + 0.03, attack: 0.03 });
    tone({ type: "triangle", freq: 1320, dur: 0.4, gain: 0.03, at: t + 0.22, attack: 0.01 });
    hiss({ dur: 0.3, gain: 0.04, at: t, attack: 0.1, filter: { type: "highpass", freq: 4200 } });
  },
  cloak: (t) => {
    hiss({ dur: 0.5, gain: 0.09, at: t, attack: 0.2, filter: { type: "bandpass", freq: 3200, to: 500, q: 2.2 } });
    tone({ type: "sine", freq: 880, to: 220, dur: 0.45, gain: 0.03, at: t, attack: 0.05 });
  },
  burner: (t) => {
    tone({ type: "sine", freq: 70, to: 46, dur: 0.6, gain: 0.3, at: t, attack: 0.02 });
    hiss({ dur: 0.7, gain: 0.26, at: t, attack: 0.04, filter: { type: "lowpass", freq: 600, to: 2600 } });
    tone({ type: "sawtooth", freq: 110, to: 190, dur: 0.5, gain: 0.04, at: t, attack: 0.05, filter: { type: "lowpass", freq: 700 } });
  },
  vent: (t) => {
    hiss({ dur: 0.55, gain: 0.16, at: t, attack: 0.02, filter: { type: "highpass", freq: 2600, to: 700 } });
    tone({ type: "sine", freq: 520, to: 180, dur: 0.4, gain: 0.02, at: t });
  },
  repair: (t) => {
    for (let i = 0; i < 5; i++) hiss({ dur: 0.05, gain: 0.1, at: t + i * 0.06 + Math.random() * 0.02, filter: { type: "bandpass", freq: 4200 + Math.random() * 1500, q: 2 } });
    [587, 740, 880].forEach((freq, i) => tone({ type: "triangle", freq, dur: 0.16, gain: 0.035, at: t + 0.18 + i * 0.06 }));
  },
  tape: (t) => {
    for (let i = 0; i < 4; i++) {
      const at = t + i * 0.075;
      hiss({ dur: 0.07, gain: 0.14, at, attack: 0.02, filter: { type: "bandpass", freq: 1400, to: 3800, q: 2.5 } });
      tone({ type: "square", freq: 240, to: 120, dur: 0.03, gain: 0.03, at: at + 0.06, filter: { type: "lowpass", freq: 1000 } });
    }
  },
  reload: (t) => {
    tone({ type: "square", freq: 420, to: 240, dur: 0.04, gain: 0.05, at: t, filter: { type: "lowpass", freq: 1800 } });
    hiss({ dur: 0.04, gain: 0.12, at: t, filter: { type: "bandpass", freq: 3000, q: 1.5 } });
    tone({ type: "square", freq: 620, to: 320, dur: 0.05, gain: 0.05, at: t + 0.1, filter: { type: "lowpass", freq: 2200 } });
    hiss({ dur: 0.05, gain: 0.14, at: t + 0.1, filter: { type: "bandpass", freq: 2200, q: 1.5 } });
    for (let i = 0; i < 4; i++) tone({ type: "triangle", freq: 2800 + Math.random() * 1400, dur: 0.05, gain: 0.014, at: t + 0.16 + i * 0.05 });
  },
  power: (t) => {
    tone({ type: "sawtooth", freq: 110, to: 660, dur: 0.3, gain: 0.05, at: t, attack: 0.02, filter: { type: "lowpass", freq: 2400 } });
    tone({ type: "sine", freq: 880, to: 1320, dur: 0.22, gain: 0.04, at: t + 0.2 });
    hiss({ dur: 0.1, gain: 0.05, at: t, filter: { type: "highpass", freq: 5000 } });
  },
  crack: (t) => {
    hiss({ dur: 0.07, gain: 0.3, at: t, filter: { type: "highpass", freq: 1800 } });
    tone({ type: "square", freq: 320, to: 70, dur: 0.14, gain: 0.07, at: t, filter: { type: "lowpass", freq: 1500 } });
    hiss({ dur: 0.2, gain: 0.1, at: t + 0.05, filter: { type: "bandpass", freq: 900, q: 1 } });
  },
  system: (t) => {
    [440, 660, 880].forEach((freq, i) => tone({ type: "sine", freq, dur: 0.2, gain: 0.035, at: t + i * 0.05, attack: 0.01 }));
    tone({ type: "triangle", freq: 1760, dur: 0.3, gain: 0.015, at: t + 0.15 });
  },
  flyby: (t) => {
    hiss({ dur: 0.5, gain: 0.2, at: t, attack: 0.16, filter: { type: "bandpass", freq: 500, to: 2600, q: 1.4 } });
    hiss({ dur: 0.4, gain: 0.12, at: t + 0.18, attack: 0.02, filter: { type: "lowpass", freq: 1600, to: 240 } });
    tone({ type: "sawtooth", freq: 210, to: 120, dur: 0.5, gain: 0.03, at: t, attack: 0.1, filter: { type: "lowpass", freq: 700 } });
  },
  tick: (t) => {
    tone({ type: "square", freq: 2100, dur: 0.02, gain: 0.02, at: t, filter: { type: "lowpass", freq: 5000 } });
    hiss({ dur: 0.02, gain: 0.05, at: t, filter: { type: "bandpass", freq: 4000, q: 2 } });
  },
  shuffle: (t) => {
    for (let i = 0; i < 7; i++) hiss({ dur: 0.045, gain: 0.07, at: t + i * 0.04, filter: { type: "bandpass", freq: 2000 + i * 260, q: 1.4 } });
  },
  discard: (t) => {
    hiss({ dur: 0.12, gain: 0.08, at: t, attack: 0.01, filter: { type: "bandpass", freq: 3200, to: 1100, q: 1.2 } });
  },
  exhaust: (t) => {
    hiss({ dur: 0.5, gain: 0.14, at: t, attack: 0.04, filter: { type: "bandpass", freq: 2600, to: 420, q: 0.9 } });
    tone({ type: "sine", freq: 300, to: 90, dur: 0.4, gain: 0.04, at: t, attack: 0.02 });
  },
  energy: (t) => {
    tone({ type: "sine", freq: 520, to: 1040, dur: 0.16, gain: 0.05, at: t, attack: 0.01 });
    tone({ type: "triangle", freq: 1560, dur: 0.2, gain: 0.02, at: t + 0.09 });
  },
  crit: (t) => {
    tone({ type: "sine", freq: 96, to: 30, dur: 0.5, gain: 0.5, at: t });
    hiss({ dur: 0.1, gain: 0.3, at: t, filter: { type: "highpass", freq: 2400 } });
    hiss({ dur: 0.6, gain: 0.3, at: t + 0.02, filter: { type: "lowpass", freq: 1800, to: 140 } });
  },
  flip: (t) => {
    hiss({ dur: 0.06, gain: 0.1, at: t, filter: { type: "bandpass", freq: 3000, to: 5600, q: 1.2 } });
    tone({ type: "triangle", freq: 880, to: 1320, dur: 0.07, gain: 0.025, at: t + 0.02 });
  },
  node: (t) => {
    tone({ type: "triangle", freq: 660, dur: 0.07, gain: 0.03, at: t });
    tone({ type: "triangle", freq: 990, dur: 0.12, gain: 0.03, at: t + 0.05 });
  },
  travel: (t) => {
    hiss({ dur: 0.7, gain: 0.14, at: t, attack: 0.25, filter: { type: "bandpass", freq: 420, to: 1800, q: 1.2 } });
    tone({ type: "sawtooth", freq: 120, to: 200, dur: 0.6, gain: 0.03, at: t, attack: 0.2, filter: { type: "lowpass", freq: 600 } });
  },
};

/* ------------------------------------------------------------------ ambience */

/** A low jet-engine bed under battles: rumble, a slow throb, and a faint turbine whine. */
export function setAmbience(on: boolean) {
  wantAmbience = on;
  if (!ctx) return;
  if (!ambience) {
    if (!on) return;
    ambience = ctx.createGain();
    ambience.gain.value = 0;
    ambience.connect(sfxBus);

    const rumble = ctx.createBufferSource();
    rumble.buffer = brownBuf;
    rumble.loop = true;
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 260;
    const sub = ctx.createBiquadFilter();
    sub.type = "highpass";
    sub.frequency.value = 38;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.55;
    rumble.connect(sub).connect(low).connect(rumbleGain).connect(ambience);

    const throb = ctx.createOscillator();
    throb.frequency.value = 0.31;
    const throbDepth = ctx.createGain();
    throbDepth.gain.value = 70;
    throb.connect(throbDepth).connect(low.frequency);

    const whine = ctx.createBufferSource();
    whine.buffer = noiseBuf;
    whine.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1900;
    band.Q.value = 9;
    const whineGain = ctx.createGain();
    whineGain.gain.value = 0.05;
    whine.connect(band).connect(whineGain).connect(ambience);
    const drift = ctx.createOscillator();
    drift.frequency.value = 0.11;
    const driftDepth = ctx.createGain();
    driftDepth.gain.value = 140;
    drift.connect(driftDepth).connect(band.frequency);

    const hum = ctx.createOscillator();
    hum.type = "sawtooth";
    hum.frequency.value = 47;
    const hum2 = ctx.createOscillator();
    hum2.type = "sawtooth";
    hum2.frequency.value = 47.6;
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = "lowpass";
    humFilter.frequency.value = 170;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.05;
    hum.connect(humFilter);
    hum2.connect(humFilter);
    humFilter.connect(humGain).connect(ambience);

    for (const node of [rumble, throb, whine, drift, hum, hum2]) node.start();
  }
  ambience.gain.setTargetAtTime(on ? 0.2 : 0, ctx.currentTime, on ? 0.8 : 0.4);
}

/* --------------------------------------------------------------------- music */

interface Song {
  bpm: number;
  /** MIDI note of the tonic, around the bass register. */
  root: number;
  scale: number[];
  /** Scale degree of the chord for each of the 8 bars. */
  prog: number[];
  lead: OscillatorType;
  leadCut: number;
  drums: "soft" | "march" | "drive" | "boss";
  bass: "long" | "eighths" | "pulse" | "gallop";
  arp: 0 | 8 | 16;
  pad: boolean;
  density: number;
  seed: number;
  swing: number;
}

const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const HARMONIC = [0, 2, 3, 5, 7, 8, 11];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];

const SONGS: Record<Track, Song> = {
  title: { bpm: 90, root: 50, scale: AEOLIAN, prog: [0, 5, 2, 6, 0, 5, 3, 4], lead: "triangle", leadCut: 2600, drums: "soft", bass: "long", arp: 8, pad: true, density: 0.42, seed: 7, swing: 0.08 },
  act1: { bpm: 108, root: 45, scale: AEOLIAN, prog: [0, 5, 2, 6, 0, 5, 6, 4], lead: "square", leadCut: 2200, drums: "march", bass: "eighths", arp: 8, pad: true, density: 0.5, seed: 11, swing: 0.05 },
  act2: { bpm: 120, root: 52, scale: DORIAN, prog: [0, 3, 0, 6, 0, 3, 5, 4], lead: "square", leadCut: 2600, drums: "drive", bass: "pulse", arp: 16, pad: false, density: 0.56, seed: 23, swing: 0 },
  act3: { bpm: 128, root: 42, scale: HARMONIC, prog: [0, 5, 3, 4, 0, 5, 1, 4], lead: "sawtooth", leadCut: 2000, drums: "drive", bass: "pulse", arp: 16, pad: true, density: 0.6, seed: 31, swing: 0 },
  boss: { bpm: 146, root: 48, scale: PHRYGIAN, prog: [0, 0, 1, 0, 6, 5, 1, 4], lead: "sawtooth", leadCut: 2400, drums: "boss", bass: "gallop", arp: 16, pad: false, density: 0.68, seed: 41, swing: 0 },
};

export interface Note {
  step: number;
  part: "lead" | "bass" | "arp" | "pad" | "kick" | "snare" | "hat";
  midi: number;
  /** Length in sixteenth steps. */
  len: number;
  vel: number;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STEPS_PER_BAR = 16;
const BARS = 8;

function degreeNote(song: Song, degree: number, octave: number): number {
  const oct = Math.floor(degree / 7);
  const idx = ((degree % 7) + 7) % 7;
  return song.root + 12 * (octave + oct) + song.scale[idx];
}

const DRUMS: Record<Song["drums"], { kick: number[]; snare: number[]; hat: number[] }> = {
  soft: { kick: [0, 10], snare: [], hat: [4, 12] },
  march: { kick: [0, 8, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
  drive: { kick: [0, 6, 8, 11], snare: [4, 12], hat: [2, 6, 10, 14, 3, 7, 11, 15] },
  boss: { kick: [0, 3, 6, 8, 11, 14], snare: [4, 12], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
};

/** Builds an 8-bar loop: a 2-bar motif stated over the changes, then a cadence back to the tonic. */
function compose(song: Song): Note[] {
  const rand = rng(song.seed);
  const notes: Note[] = [];
  const motif: { at: number; off: number; len: number }[] = [];
  let off = 4;
  for (let at = 0; at < 32; at += 2) {
    const strong = at % 8 === 0;
    if (!strong && rand() > song.density) continue;
    if (strong) off = [0, 2, 4, 7][Math.floor(rand() * 4)];
    else off = Math.max(-2, Math.min(9, off + [-2, -1, 1, 2, 1, -1][Math.floor(rand() * 6)]));
    motif.push({ at, off, len: 2 });
  }
  for (let i = 0; i < motif.length; i++) motif[i].len = Math.min(6, (motif[i + 1]?.at ?? 32) - motif[i].at);

  const leadOct = Math.round((69 - song.root) / 12);
  const fold = (d: number) => (d > 9 ? d - 7 : d < -3 ? d + 7 : d);
  for (let bar = 0; bar < BARS; bar++) {
    const deg = song.prog[bar];
    const base = bar * STEPS_PER_BAR;
    const chord = [deg, deg + 2, deg + 4];
    if (bar < BARS - 1) {
      const half = bar % 2;
      for (const m of motif) {
        if (Math.floor(m.at / 16) !== half) continue;
        const variation = bar >= 4 && m.at % 8 === 6 ? 1 : 0;
        notes.push({ step: base + (m.at % 16), part: "lead", midi: degreeNote(song, fold(deg + m.off + variation), leadOct), len: m.len, vel: m.at % 8 === 0 ? 1 : 0.8 });
      }
    } else {
      notes.push({ step: base, part: "lead", midi: degreeNote(song, 4, leadOct), len: 4, vel: 0.9 });
      notes.push({ step: base + 4, part: "lead", midi: degreeNote(song, 1, leadOct), len: 4, vel: 0.85 });
      notes.push({ step: base + 8, part: "lead", midi: degreeNote(song, 0, leadOct), len: 8, vel: 1 });
    }

    const root = degreeNote(song, deg, 0);
    if (song.bass === "long") {
      notes.push({ step: base, part: "bass", midi: root, len: 8, vel: 1 });
      notes.push({ step: base + 8, part: "bass", midi: degreeNote(song, deg + 4, 0), len: 8, vel: 0.8 });
    } else if (song.bass === "eighths") {
      for (let s = 0; s < 16; s += 2) notes.push({ step: base + s, part: "bass", midi: s === 6 || s === 14 ? root + 12 : root, len: 2, vel: s % 4 === 0 ? 1 : 0.75 });
    } else if (song.bass === "pulse") {
      for (let s = 0; s < 16; s += 1) if (s % 4 !== 3) notes.push({ step: base + s, part: "bass", midi: s % 8 === 6 ? root + 12 : root, len: 1, vel: s % 4 === 0 ? 1 : 0.6 });
    } else {
      for (let s = 0; s < 16; s += 1) {
        if (s % 4 === 1) continue;
        const approach = s >= 14 && bar % 2 === 1 ? 1 : 0;
        notes.push({ step: base + s, part: "bass", midi: root + approach, len: 1, vel: s % 4 === 0 ? 1 : 0.65 });
      }
    }

    if (song.arp) {
      const every = song.arp === 16 ? 1 : 2;
      const tones = [chord[0], chord[1], chord[2], chord[0] + 7, chord[2], chord[1]];
      for (let s = 0, k = 0; s < 16; s += every, k++) notes.push({ step: base + s, part: "arp", midi: degreeNote(song, tones[k % tones.length], 1), len: every, vel: 0.7 });
    }
    if (song.pad) for (const d of chord) notes.push({ step: base, part: "pad", midi: degreeNote(song, d, 1), len: 16, vel: 1 });

    const kit = DRUMS[song.drums];
    for (const s of kit.kick) notes.push({ step: base + s, part: "kick", midi: 0, len: 1, vel: s === 0 ? 1 : 0.8 });
    for (const s of kit.snare) notes.push({ step: base + s, part: "snare", midi: 0, len: 1, vel: 1 });
    for (const s of kit.hat) notes.push({ step: base + s, part: "hat", midi: 0, len: 1, vel: s % 2 ? 0.5 : 0.9 });
    if (bar === BARS - 1 && song.drums !== "soft") for (const s of [12, 13, 14, 15]) notes.push({ step: base + s, part: "snare", midi: 0, len: 1, vel: 0.5 + (s - 12) * 0.15 });
  }
  return notes;
}

/** The composed loop for a track, plus the scale it is written in. */
export function songLoop(track: Track): { notes: Note[]; root: number; scale: number[]; steps: number } {
  const song = SONGS[track];
  return { notes: compose(song), root: song.root, scale: song.scale, steps: BARS * STEPS_PER_BAR };
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

class Player {
  readonly out: GainNode;
  private readonly byStep: Note[][];
  private readonly stepDur: number;
  private step = 0;
  private next = 0;
  private timer = 0;

  constructor(readonly track: Track) {
    const song = SONGS[track];
    this.stepDur = 60 / song.bpm / 4;
    this.byStep = Array.from({ length: BARS * STEPS_PER_BAR }, () => []);
    for (const note of compose(song)) this.byStep[note.step].push(note);
    this.out = ctx!.createGain();
    this.out.gain.value = 0.0001;
    this.out.connect(musicBus);
  }

  start() {
    const t = ctx!.currentTime;
    this.out.gain.setValueAtTime(0.0001, t);
    this.out.gain.exponentialRampToValueAtTime(1, t + 1.2);
    this.next = t + 0.08;
    this.timer = window.setInterval(() => this.tick(), 30);
    this.tick();
  }

  stop() {
    const t = ctx!.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(0.0001, t, 0.25);
    window.clearInterval(this.timer);
    window.setTimeout(() => this.out.disconnect(), 1500);
  }

  private tick() {
    const now = ctx!.currentTime;
    if (this.next < now - 0.2) this.next = now + 0.05;
    const song = SONGS[this.track];
    const silent = settings.mute || settings.music <= 0;
    while (this.next < now + 0.15) {
      if (!silent) for (const note of this.byStep[this.step]) this.voice(song, note, this.next);
      const swing = this.step % 2 === 0 ? 1 + song.swing : 1 - song.swing;
      this.next += this.stepDur * swing;
      this.step = (this.step + 1) % this.byStep.length;
    }
  }

  private voice(song: Song, note: Note, t: number) {
    const len = note.len * this.stepDur;
    const out = this.out;
    if (note.part === "lead") {
      tone({ type: song.lead, freq: hz(note.midi), dur: len * 0.95 + 0.05, gain: 0.05 * note.vel, at: t, attack: 0.012, filter: { type: "lowpass", freq: song.leadCut, q: 1 }, out });
      tone({ type: "triangle", freq: hz(note.midi), dur: len * 0.95 + 0.05, gain: 0.025 * note.vel, at: t + 0.006, detune: 8, out });
    } else if (note.part === "bass") {
      tone({ type: song.bass === "long" ? "triangle" : "square", freq: hz(note.midi), dur: len * 0.9 + 0.03, gain: 0.09 * note.vel, at: t, attack: 0.006, filter: { type: "lowpass", freq: 520 }, out });
    } else if (note.part === "arp") {
      tone({ type: "triangle", freq: hz(note.midi + 12), dur: Math.min(0.22, len * 1.4), gain: 0.022 * note.vel, at: t, out });
    } else if (note.part === "pad") {
      for (const detune of [-7, 7]) {
        tone({ type: "sawtooth", freq: hz(note.midi), dur: len + 0.3, gain: 0.012, at: t, attack: 0.35, detune, filter: { type: "lowpass", freq: 900 }, out });
      }
    } else if (note.part === "kick") {
      tone({ type: "sine", freq: 150, to: 44, dur: 0.16, gain: 0.32 * note.vel, at: t, out });
    } else if (note.part === "snare") {
      hiss({ dur: 0.14, gain: 0.14 * note.vel, at: t, filter: { type: "bandpass", freq: 1900, q: 0.8 }, out });
      tone({ type: "triangle", freq: 200, to: 150, dur: 0.07, gain: 0.06 * note.vel, at: t, out });
    } else {
      hiss({ dur: 0.03, gain: 0.05 * note.vel, at: t, filter: { type: "highpass", freq: 7200 }, out });
    }
  }
}

/** Crossfades to `track`, or fades the music out for null. Waits for the first gesture if needed. */
export function setMusic(track: Track | null) {
  if (!ctx) {
    wantTrack = track;
    return;
  }
  if (player?.track === track) return;
  player?.stop();
  player = null;
  wantTrack = track;
  if (!track) return;
  player = new Player(track);
  player.start();
}

/** Snapshot for diagnostics: context state, current track, and the output level right now. */
export function audioDebug(): { state: string; track: Track | null; ambience: boolean; rms: number } {
  let rms = 0;
  if (meter) {
    const data = new Float32Array(meter.fftSize);
    meter.getFloatTimeDomainData(data);
    rms = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
  }
  return { state: ctx?.state ?? "none", track: player?.track ?? null, ambience: wantAmbience, rms };
}

/** A live copy of the final mix, for recording a session. */
export function captureStream(): MediaStream | null {
  if (!ctx || !output) return null;
  const dest = ctx.createMediaStreamDestination();
  output.connect(dest);
  return dest.stream;
}
