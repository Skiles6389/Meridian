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

/**
 * Internal ids (kite, bulwark, moth, lattice) predate the real-aircraft reskin.
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
    hp: 70,
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
    hp: 86,
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
    hp: 64,
    blurb: "Supercruise, thrust vectoring, and a radar return the size of a marble. When it is in the picture, the picture ends.",
    play: "Evasion and setup. Low-Observable Skin grants 1 Evasion at the start of every turn.",
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
};

export const JET_ORDER: JetId[] = ["kite", "bulwark", "moth", "lattice"];

export function unlockBlurb(id: JetId, mysteries: number): string {
  if (id === "kite") return "On the line from the first briefing.";
  if (id === "bulwark") return "Defeat the Act 1 boss, the Phantom “Graue Eule”.";
  if (id === "moth") return "Win a full sortie — clear Act 3.";
  return `Resolve 5 mystery events across sorties (${mysteries}/5).`;
}
