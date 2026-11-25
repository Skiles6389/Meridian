import chaseMeta from "../assets/art/chase.json";
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

const chaseFiles = import.meta.glob("../assets/art/chase/*.webp", { eager: true, import: "default" }) as Record<string, string>;
export const CHASE_ART = byName(chaseFiles);

interface ChaseMeta {
  aspect: number;
  /** Lit exhausts on rear views, as [x, y, radius] fractions of the sprite. */
  nozzles: [number, number, number][];
}

const CHASE_META = chaseMeta as unknown as Record<string, ChaseMeta>;

export type ChaseView = "rear" | "front";

/** The three Tornado variants share one airframe in the chase views; their paint comes from a livery tint. */
const CHASE_BODY: Partial<Record<SilhouetteId, string>> = {
  tornado_ids: "tornado",
  tornado_ecr: "tornado",
  tornado_marine: "tornado",
};

const CHASE_TINT: Partial<Record<SilhouetteId, Livery>> = {
  tornado_ecr: "steel",
  tornado_marine: "storm",
};

function chaseName(id: SilhouetteId, view: ChaseView): string {
  return `${CHASE_BODY[id] ?? id}-${view}`;
}

export function hasChaseArt(id: SilhouetteId, view: ChaseView): boolean {
  const name = chaseName(id, view);
  return !!CHASE_ART[name] && !!CHASE_META[name];
}

/** Width over height of a chase-view sprite. */
export function chaseAspect(id: SilhouetteId, view: ChaseView): number {
  return CHASE_META[chaseName(id, view)]?.aspect ?? 2.4;
}

/** One chase-camera sprite. Rear views carry an afterburner flicker over each lit nozzle. */

export function chaseArt(id: SilhouetteId, view: ChaseView, opts: { livery?: Livery; flip?: boolean; cls?: string } = {}): string {
  const name = chaseName(id, view);
  const meta = CHASE_META[name] ?? { aspect: 2.4, nozzles: [] };
  const livery = opts.livery || CHASE_TINT[id];
  const classes = ["cj", `cj-${view}`, opts.flip ? "flip" : "", livery ? `livery-${livery}` : "", opts.cls ?? ""].filter(Boolean).join(" ");
  const glows = meta.nozzles
    .map(([x, y, r]) => `<i class="cj-glow" style="--gx:${(x * 100).toFixed(1)}%;--gy:${(y * 100).toFixed(1)}%;--gr:${Math.max(r * 100, 1.6).toFixed(1)}%"></i>`)
    .join("");
  return `<div class="${classes}" style="--ar:${meta.aspect}"><img src="${CHASE_ART[name] ?? ""}" alt="" draggable="false" decoding="async" />${glows}</div>`;
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
  | "systems"
  | "cannon"
  | "plating";

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
  brrt: "cannon",
  bathtub: "plating",
  strafeRun: "cannon",
  lowPass: "gun",
  rivetLine: "plating",
  rocketPods: "cluster",
  maverick: "missile",
  bathtubCharge: "plating",
  speedTape: "repair",
  loiter: "hud",
  manualReversion: "systems",
  avenger: "cannon",
  closeAirSupport: "cannon",
  survivability: "plating",
  airframeCrack: "crack",
};

export function cardTheme(id: string): CardTheme {
  return THEME_BY_CARD[id] ?? "systems";
}

export function cardArt(id: string): string {
  return CARD_ART[cardTheme(id)] ?? "";
}

export function eventArt(id: string): string {
  return EVENT_ART[id] ?? EVENT_ART.hardstand ?? "";
}

export const ACT_SCENE: Record<ActId, string> = { 1: "act1", 2: "act2", 3: "act3" };

/** Backdrop behind a fight: the act's sky with its ground far below, seen from the chase camera. */
export const CHASE_SCENE: Record<ActId, string> = { 1: "chase-act1", 2: "chase-act2", 3: "chase-act3" };
