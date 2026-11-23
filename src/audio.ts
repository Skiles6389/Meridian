type Cue = "click" | "play" | "attack" | "shield" | "heal" | "hurt" | "error" | "turn" | "win" | "lose" | "unlock";

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(next: boolean) {
  muted = next;
}

export function isMuted(): boolean {
  return muted;
}

export function unlockAudio() {
  if (muted) return;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  if (!ctx) ctx = new Ctx();
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0) {
  if (!ctx || muted) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.value = gain;
  osc.connect(amp);
  amp.connect(ctx.destination);
  const t = ctx.currentTime + delay;
  osc.start(t);
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, gain: number) {
  if (!ctx || muted) return;
  const length = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = ctx.createBufferSource();
  const amp = ctx.createGain();
  src.buffer = buffer;
  amp.gain.value = gain;
  src.connect(amp);
  amp.connect(ctx.destination);
  src.start();
}

export function sfx(cue: Cue) {
  if (muted) return;
  unlockAudio();
  if (!ctx) return;
  if (cue === "click") tone(740, 0.04, "square", 0.03);
  else if (cue === "play") tone(240, 0.08, "triangle", 0.05);
  else if (cue === "attack") {
    noise(0.09, 0.08);
    tone(130, 0.12, "sawtooth", 0.04);
  }
  else if (cue === "shield") tone(520, 0.1, "sine", 0.05);
  else if (cue === "heal") {
    tone(520, 0.08, "sine", 0.04);
    tone(680, 0.1, "sine", 0.04, 0.07);
  }
  else if (cue === "hurt") tone(90, 0.16, "sawtooth", 0.05);
  else if (cue === "error") tone(140, 0.1, "square", 0.04);
  else if (cue === "turn") tone(300, 0.07, "triangle", 0.04);
  else if (cue === "win") {
    [523, 659, 784, 1046].forEach((freq, i) => tone(freq, 0.14, "triangle", 0.05, i * 0.09));
  }
  else if (cue === "lose") {
    [320, 240, 160].forEach((freq, i) => tone(freq, 0.16, "sawtooth", 0.04, i * 0.1));
  }
  else if (cue === "unlock") {
    [440, 554, 659].forEach((freq, i) => tone(freq, 0.12, "sine", 0.05, i * 0.08));
  }
}
