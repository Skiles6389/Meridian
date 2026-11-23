import type { JetId, SilhouetteId } from "./types";

export interface JetDef {
  id: JetId;
  code: string;
  name: string;
  role: string;
  maker: string;
  callsign: string;
  hp: number;
  blurb: string;
  play: string;
  relic: string;
  deck: string[];
  silhouette: SilhouetteId;
  accent: string;
}

function copies(id: string, n: number): string[] {
  return Array.from({ length: n }, () => id);
}

export const JETS: Record<JetId, JetDef> = {
  kite: {
    id: "kite",
    code: "CF-9",
    name: "Kite",
    role: "Interceptor",
    maker: "Calder Flightworks",
    callsign: "CALDER 9",
    hp: 70,
    blurb: "A light interceptor with more control surface than sense. It wins by getting the first nose around.",
    play: "Cheap attacks, Evasion, and extra draws. Vector Vanes discounts your first Attack each turn.",
    relic: "vectorVanes",
    deck: [...copies("gunBurst", 4), ...copies("flarePop", 4), "snapTurn", "probeLock"],
    silhouette: "kite",
    accent: "#3ee0c5",
  },
  bulwark: {
    id: "bulwark",
    code: "AS-4",
    name: "Bulwark",
    role: "Strike fighter",
    maker: "Ardent Systems",
    callsign: "ARDENT 4",
    hp: 86,
    blurb: "A heavy striker that treats the merge like a loading dock. It arrives with more iron than the runway liked.",
    play: "Big missiles, thick Shield, and Armor. Ordnance Bay adds damage to your first Attack each turn.",
    relic: "ordnanceBay",
    deck: [...copies("gunBurst", 4), ...copies("flarePop", 3), ...copies("armorCheck", 2), "ironDart"],
    silhouette: "bulwark",
    accent: "#f0a35e",
  },
  moth: {
    id: "moth",
    code: "VX-7",
    name: "Moth",
    role: "Stealth jet",
    maker: "Vesper Experimental",
    callsign: "VESPER 7",
    hp: 64,
    blurb: "A quiet demonstrator that would rather not be in the picture. When it is, the picture ends.",
    play: "Evasion and setup. Moth Dust grants 1 Evasion at the start of every turn.",
    relic: "mothDust",
    deck: [...copies("gunBurst", 3), ...copies("flarePop", 4), "fade", "silentPing", "holdFire"],
    silhouette: "moth",
    accent: "#c3b0ff",
  },
  lattice: {
    id: "lattice",
    code: "EW-2",
    name: "Lattice",
    role: "Electronic warfare",
    maker: "Helion Dynamics",
    callsign: "HELION 2",
    hp: 74,
    blurb: "An electronic-warfare jet that fights the other aircraft's instruments first and the aircraft second.",
    play: "Jam, Locked, and card draw. Spectrum Mast jams the lead enemy every turn.",
    relic: "spectrumMast",
    deck: [...copies("gunBurst", 3), ...copies("flarePop", 3), "noiseBarrage", "designator", ...copies("patchCycle", 2)],
    silhouette: "lattice",
    accent: "#8ebfff",
  },
};

export const JET_ORDER: JetId[] = ["kite", "bulwark", "moth", "lattice"];

export function unlockBlurb(id: JetId, mysteries: number): string {
  if (id === "kite") return "On the line from the first briefing.";
  if (id === "bulwark") return "Defeat the Act 1 boss, Graue Eule.";
  if (id === "moth") return "Win a full sortie — clear Act 3.";
  return `Resolve 5 mystery events across sorties (${mysteries}/5).`;
}
