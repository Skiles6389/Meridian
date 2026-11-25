import chaseMeta from "../assets/art/chase.json";
import jetMeta from "../assets/art/jets.json";
import type { ActId, Livery, SilhouetteId } from "../game/types";
import { anchorsOf, type StoreKind, type Xy } from "./anchors";
import { gunPort, hungStore } from "./stores";

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

const pct = (n: number) => `${n.toFixed(1)}%`;

/** The doors of an internal bay seen from astern: shut and invisible until a weapon comes out. */
const BAY_STERN = `<svg viewBox="0 0 20 30"><g class="door"><path d="M3 0h14l-1.5 4.5h-11z" fill="#07090d"/><path d="M4 1 .5 15h4L7 3z" fill="#b4bdc9" stroke="#0d1117" stroke-width="1.3" stroke-linejoin="round"/><path d="M16 1l3.5 14h-4L13 3z" fill="#8792a1" stroke="#0d1117" stroke-width="1.3" stroke-linejoin="round"/></g></svg>`;

/** The same store on a jet seen from its front quarter, nose to the left. */
function quarterStore(kind: StoreKind): string {
  if (kind === "bay") {
    return `<svg viewBox="0 0 60 18"><g class="door"><path d="M6 0h48l-3 3H9z" fill="#0b0e13"/><path d="M8 2h44l-4 9H14z" fill="#7f8a98" stroke="#0d1117" stroke-width="1.4" stroke-linejoin="round"/></g></svg>`;
  }
  const pylon = `<path class="pyl" d="M22 0h16l-3 6H26z" fill="#56606e" stroke="#0d1117" stroke-width="1.4" stroke-linejoin="round"/>`;
  if (kind === "pod") {
    return `<svg viewBox="0 0 60 18">${pylon}<g class="msl"><path d="M8 6h40l5 5-5 5H8l-4-5z" fill="#6d7868" stroke="#0d1117" stroke-width="1.5" stroke-linejoin="round"/><path d="M6 12h46l-4 4H8z" fill="#434c42"/><path d="M9 7.4h38" stroke="#d9f4ff" stroke-width="1" stroke-linecap="round"/></g></svg>`;
  }
  const h = kind === "agm" ? 3.4 : 2.4;
  const y = 6 + h + 1;
  return `<svg viewBox="0 0 60 18">${pylon}<g class="msl"><path d="M45 ${y - h}l5 -3.4h4v3.4zM45 ${y + h}l5 3.4h4v-3.4z" fill="#aab6c6" stroke="#0d1117" stroke-width="1.2" stroke-linejoin="round"/><path d="M2 ${y}Q6 ${y - h} 12 ${y - h}H54V${y + h}H12Q6 ${y + h} 2 ${y}z" fill="${kind === "agm" ? "#c9d0d8" : "#e9edf2"}" stroke="#0d1117" stroke-width="1.4" stroke-linejoin="round"/><path d="M5 ${y + h * 0.3}Q8 ${y + h} 12 ${y + h}H54V${y + h * 0.2}z" fill="#8b97a8"/><path d="M18 ${y - h}l3 -3h5l-2 3zM18 ${y + h}l3 3h5l-2 -3z" fill="#aab6c6" stroke="#0d1117" stroke-width="1" stroke-linejoin="round"/><path d="M9 ${y - h + 0.9}H50" stroke="#d9f4ff" stroke-width="0.9" stroke-linecap="round"/></g></svg>`;
}

/**
 * The weapons and anchor markers laid over a chase sprite. Stores are drawn missiles on their
 * pylons; markers are invisible zero-size points the effects read their positions from.
 */
function overlay(name: string, view: ChaseView, spent?: ReadonlySet<number>): string {
  const a = anchorsOf(name);
  const stores = a.pylons
    .map((station, i) => {
      const [x, y, kind, mount] = station;
      const gone = !!spent?.has(i);
      // Rear views carry their weapons in perspective; a bay only ever shows its doors.
      if (view === "rear" && kind !== "bay") return hungStore(station, i, a, gone);
      return `<i class="store store-${kind}${mount ? ` store-${mount}` : ""}${gone ? " spent" : ""}" data-st="${i}" data-kind="${kind}" style="left:${pct(x)};top:${pct(y)}">${view === "rear" ? BAY_STERN : quarterStore(kind)}</i>`;
    })
    .join("");
  const ap = (kind: string, pts: Xy[] | undefined) => (pts ?? []).map(([x, y]) => `<i class="ap" data-ap="${kind}" style="left:${pct(x)};top:${pct(y)}"></i>`).join("");
  const one = (p: Xy | undefined) => (p ? [p] : undefined);
  const port = view === "rear" && a.port ? gunPort(a) : "";
  return `<div class="cj-over">${port}${stores}${ap("gun", [a.gun])}${ap("flare", a.flares)}${ap("chaff", one(a.chaff))}${ap("pod", a.pods)}${ap("tip", a.tips)}${ap("belly", one(a.belly))}${ap("nose", one(a.nose))}</div>`;
}

/**
 * One chase-camera sprite. Rear views carry an afterburner flicker over each lit nozzle, and every
 * view carries its weapon stations; `spent` lists the stations whose missile has been fired.
 */
export function chaseArt(id: SilhouetteId, view: ChaseView, opts: { livery?: Livery; flip?: boolean; cls?: string; spent?: ReadonlySet<number> } = {}): string {
  const name = chaseName(id, view);
  const meta = CHASE_META[name] ?? { aspect: 2.4, nozzles: [] };
  const livery = opts.livery || CHASE_TINT[id];
  const classes = ["cj", `cj-${view}`, opts.flip ? "flip" : "", livery ? `livery-${livery}` : "", opts.cls ?? ""].filter(Boolean).join(" ");
  const glows = meta.nozzles
    .map(([x, y, r]) => `<i class="cj-glow" style="--gx:${(x * 100).toFixed(1)}%;--gy:${(y * 100).toFixed(1)}%;--gr:${Math.max(r * 100, 1.6).toFixed(1)}%"></i>`)
    .join("");
  return `<div class="${classes}" data-sprite="${name}" style="--ar:${meta.aspect}"><img src="${CHASE_ART[name] ?? ""}" alt="" draggable="false" decoding="async" />${overlay(name, view, opts.spent)}${glows}</div>`;
}

/** The anchor table's name for a jet's chase sprite. */
export function chaseSprite(id: SilhouetteId, view: ChaseView): string {
  return chaseName(id, view);
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
