import jetMeta from "../assets/art/jets.json";
import type { ActId, Livery, SilhouetteId } from "../game/types";

const jetFiles = import.meta.glob("../assets/art/jets/*.webp", { eager: true, import: "default" }) as Record<string, string>;
const cardFiles = import.meta.glob("../assets/art/cards/*.webp", { eager: true, import: "default" }) as Record<string, string>;
const eventFiles = import.meta.glob("../assets/art/events/*.webp", { eager: true, import: "default" }) as Record<string, string>;
const sceneFiles = import.meta.glob("../assets/art/scenes/*.webp", { eager: true, import: "default" }) as Record<string, string>;

function byName(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(files)) {
    const name = path.split("/").pop()!.replace(/\.webp$/, "");
    out[name] = url;
  }
  return out;
}

export const JET_ART = byName(jetFiles);
export const CARD_ART = byName(cardFiles);
export const EVENT_ART = byName(eventFiles);
export const SCENE_ART = byName(sceneFiles);

interface JetMeta {
  aspect: number;
  nozzle: [number, number];
}

const META = jetMeta as unknown as Record<string, JetMeta>;

export function hasJetArt(id: SilhouetteId): boolean {
  return !!JET_ART[id] && !!META[id];
}

export function jetArt(id: SilhouetteId, opts: { flip?: boolean; livery?: Livery; cls?: string } = {}): string {
  const meta = META[id] ?? { aspect: 3, nozzle: [0.15, 0.6] };
  const src = JET_ART[id] ?? "";
  const classes = ["jet", opts.flip ? "flip" : "", opts.livery ? `livery-${opts.livery}` : "", opts.cls ?? ""].filter(Boolean).join(" ");
  return `<div class="${classes}" style="--ar:${meta.aspect};--nx:${(meta.nozzle[0] * 100).toFixed(1)}%;--ny:${(meta.nozzle[1] * 100).toFixed(1)}%"><div class="jet-body"><i class="burner"></i><img src="${src}" alt="" draggable="false" decoding="async" /></div></div>`;
}

export type CardTheme =
  | "gun"
  | "missile"
  | "heavy"
  | "cluster"
  | "flare"
  | "chaff"
  | "maneuver"
  | "radar"
  | "jam"
  | "armor"
  | "burner"
  | "hud"
  | "stealth"
  | "repair"
  | "crack"
  | "surge"
  | "dogfight"
  | "systems";

const THEME_BY_CARD: Record<string, CardTheme> = {
  gunBurst: "gun",
  flarePop: "flare",
  snapTurn: "maneuver",
  probeLock: "radar",
  armorCheck: "armor",
  ironDart: "missile",
  fade: "stealth",
  silentPing: "radar",
  holdFire: "stealth",
  noiseBarrage: "jam",
  designator: "radar",
  patchCycle: "hud",
  sidewinder: "missile",
  flareWall: "flare",
  quickLock: "radar",
  cannonRake: "gun",
  emergencyApu: "repair",
  spareMagazine: "hud",
  chaffCloud: "chaff",
  missilePair: "missile",
  hotStart: "burner",
  targetPod: "systems",
  countermeasures: "chaff",
  immelmann: "maneuver",
  warningShot: "gun",
  fuelConserve: "burner",
  breaker: "heavy",
  stitchFire: "gun",
  boomSlice: "dogfight",
  knifePass: "dogfight",
  overbank: "maneuver",
  vectorDraw: "hud",
  leadPursuit: "dogfight",
  afterburnDash: "burner",
  wingFlash: "dogfight",
  trimAuthority: "systems",
  merge: "dogfight",
  cruiseMissile: "heavy",
  clusterDrop: "cluster",
  bunkerBuster: "heavy",
  hardenedSkin: "armor",
  brace: "armor",
  overpressure: "heavy",
  sacrificialBay: "surge",
  ordnanceCycle: "systems",
  platingWeld: "repair",
  siegeRadar: "radar",
  heavySalvo: "cluster",
  anvilProtocol: "armor",
  whisperShot: "stealth",
  coldPass: "stealth",
  shroud: "chaff",
  noPicture: "jam",
  patience: "stealth",
  bleedRadar: "radar",
  unseenStrike: "stealth",
  heatSink: "systems",
  ghostDoctrine: "stealth",
  fadePattern: "maneuver",
  blackoutMine: "surge",
  lowObservable: "stealth",
  burnThrough: "surge",
  falseReturn: "jam",
  cycleSteal: "hud",
  logicBomb: "surge",
  spectrumFlood: "jam",
  predictiveTrack: "radar",
  powerSurge: "surge",
  ecmWing: "jam",
  spoof: "jam",
  dataSpike: "surge",
  overloadArray: "jam",
  airframeCrack: "crack",
};

export function cardTheme(id: string): CardTheme {
  return THEME_BY_CARD[id] ?? "systems";
}

export function cardArt(id: string): string {
  return CARD_ART[cardTheme(id)] ?? "";
}

/** How an attack card's shot travels on the battle stage. */
export function shotStyle(id: string): "tracer" | "missile" | "heavy" | "zap" {
  const theme = cardTheme(id);
  if (theme === "gun" || theme === "dogfight") return "tracer";
  if (theme === "heavy" || theme === "cluster") return "heavy";
  if (theme === "surge" || theme === "jam" || theme === "radar") return "zap";
  return "missile";
}

export function eventArt(id: string): string {
  return EVENT_ART[id] ?? EVENT_ART.hardstand ?? "";
}

export const ACT_SCENE: Record<ActId, string> = { 1: "act1", 2: "act2", 3: "act3" };
