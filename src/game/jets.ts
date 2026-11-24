import type { JetId, MetaStats, SilhouetteId } from "./types";

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

/**
 * Internal ids (kite, bulwark, moth, lattice) predate the real-aircraft reskin; hog came later.
 * They are kept so saved unlocks and sorties load unchanged.
 */
export const JETS: Record<JetId, JetDef> = {
  kite: {
    id: "kite",
    code: "F-16C",
    name: "Fighting Falcon",
    role: "Multirole fighter",
    maker: "General Dynamics",
    callsign: "VIPER 1",
    hp: 73,
    blurb: "The lightweight fighter that out-turned its own spec sheet. Fly-by-wire, a bubble canopy, and a nose that comes around first.",
    play: "Cheap attacks, Evasion, and extra draws. Fly-by-Wire discounts your first Attack each turn.",
    relic: "vectorVanes",
    deck: [...copies("gunBurst", 4), ...copies("flarePop", 4), "snapTurn", "probeLock"],
    silhouette: "f16",
    accent: "#3ee0c5",
  },
  bulwark: {
    id: "bulwark",
    code: "F-15E",
    name: "Strike Eagle",
    role: "Strike fighter",
    maker: "McDonnell Douglas",
    callsign: "MUDHEN 2",
    hp: 106,
    blurb: "Two crew, two engines, conformal tanks, and more ordnance than the runway liked. It treats the merge like a loading dock.",
    play: "Big missiles, thick Shield, and Armor. Conformal Stations add damage to your first Attack each turn.",
    relic: "ordnanceBay",
    deck: [...copies("gunBurst", 4), ...copies("flarePop", 3), ...copies("armorCheck", 2), "ironDart"],
    silhouette: "f15e",
    accent: "#f0a35e",
  },
  moth: {
    id: "moth",
    code: "F-22A",
    name: "Raptor",
    role: "Stealth air superiority",
    maker: "Lockheed Martin",
    callsign: "RAPTOR 3",
    hp: 56,
    blurb: "Supercruise, thrust vectoring, and a radar return the size of a marble. When it is in the picture, the picture ends.",
    play: "Evasion and setup. Low-Observable Skin grants 1 Evasion on turn 1 and every third turn after.",
    relic: "mothDust",
    deck: [...copies("gunBurst", 3), ...copies("flarePop", 4), "fade", "silentPing", "holdFire"],
    silhouette: "f22",
    accent: "#c3b0ff",
  },
  lattice: {
    id: "lattice",
    code: "EA-18G",
    name: "Growler",
    role: "Electronic warfare",
    maker: "Boeing",
    callsign: "GROWLER 4",
    hp: 74,
    blurb: "A Super Hornet that traded guns for jamming pods. It fights the other aircraft's instruments first and the aircraft second.",
    play: "Jam, Locked, and card draw. ALQ-99 Pods jam the lead enemy every turn.",
    relic: "spectrumMast",
    deck: [...copies("gunBurst", 3), ...copies("flarePop", 3), "noiseBarrage", "designator", ...copies("patchCycle", 2)],
    silhouette: "ea18g",
    accent: "#8ebfff",
  },
  hog: {
    id: "hog",
    code: "A-10C",
    name: "Thunderbolt II",
    role: "Close air support",
    maker: "Fairchild Republic",
    callsign: "HOG 5",
    hp: 96,
    blurb: "A seven-barrel cannon with an airplane built around it, a titanium tub around the pilot, and enough redundancy to come home on half a wing.",
    play: "Plating, multi-hit guns, and patience. Plating soaks hits like Shield but carries over between turns; Titanium Tub starts every fight armored.",
    relic: "titaniumTub",
    deck: [...copies("gunBurst", 3), ...copies("brrt", 2), ...copies("flarePop", 3), ...copies("bathtub", 2)],
    silhouette: "a10",
    accent: "#a9d36b",
  },
};

export const JET_ORDER: JetId[] = ["kite", "bulwark", "moth", "lattice", "hog"];

export function unlockBlurb(id: JetId, stats: Pick<MetaStats, "mysteries" | "deepest">): string {
  if (id === "kite") return "On the line from the first briefing.";
  if (id === "bulwark") return "Defeat the Act 1 boss, the Phantom “Graue Eule”.";
  if (id === "moth") return "Win a full sortie — clear Act 3.";
  if (id === "hog") return "Reach Act 3, the Glass Meridian, with any jet.";
  return `Resolve 5 mystery events across sorties (${stats.mysteries}/5).`;
}
