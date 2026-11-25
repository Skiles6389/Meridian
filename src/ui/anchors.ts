/*
 * Where things are on each chase-camera sprite, read off the art: the gun muzzle, the weapon
 * stations, the countermeasure dispensers and so on. Every value is a percentage of the sprite's
 * box, x from the left and y from the top. Effects start from these points, so a burst leaves the
 * jet's real gun port and a missile comes off the pylon it was hanging on.
 *
 * Front-quarter views are drawn nose-left; the renderer mirrors the anchors with the sprite.
 */

export type StoreKind =
  /** A light air-to-air missile on a rail or pylon. */
  | "aam"
  /** A heavy missile on an inboard pylon. */
  | "agm"
  /** A rocket pod: it stays on the wing and fires from where it hangs. */
  | "pod"
  /** An internal weapons bay: nothing hangs outside, and the door opens to launch. */
  | "bay";

export type Xy = [number, number];
/** `mount` is "tip" for a wingtip rail, where the missile sits on the wing instead of hanging under it. */
export type Station = [x: number, y: number, kind: StoreKind, mount?: "tip"];

export interface SpriteAnchors {
  /** The airframe's wingspan in metres: the sprite is that wide, which sets the scale of what hangs on it. */
  span?: number;
  /** How high above the wings the painting was seen from, in metres. Forward-pointing stores lean in to match. */
  lift?: number;
  /** Whether the muzzle is a blast port in plain view, so one is drawn where the gun fires from. */
  port?: boolean;
  /** The gun muzzle. */
  gun: Xy;
  /** Weapon stations, in the order they fire. */
  pylons: Station[];
  /** Flare dispensers. */
  flares?: Xy[];
  /** Where chaff leaves the tail. */
  chaff?: Xy;
  /** Jamming pods and antennas. */
  pods?: Xy[];
  /** Wingtips, for vapour. */
  tips?: Xy[];
  /** Under the fuselage, where bombs fall from. */
  belly?: Xy;
  /** The radome. */
  nose?: Xy;
}

export const ANCHORS: Record<string, SpriteAnchors> = {
  /* ------------------------------------------------ player jets, from behind */
  // F-16C: M61 port on the left strake beside the canopy; Sidewinders on the wingtip rails and AMRAAMs on the outer pylons.
  "f16-rear": {
    span: 10,
    port: true,
    gun: [45.2, 51.4],
    pylons: [[3.6, 65.8, "aam", "tip"], [96.4, 66.1, "aam", "tip"], [12.8, 68.6, "aam"], [87.2, 68.6, "aam"]],
    flares: [[45, 86], [55, 86]],
    chaff: [50, 90],
    tips: [[3, 68], [97, 68.6]],
    belly: [50, 92],
    nose: [50, 42],
  },
  // F-15E: M61 in the right wing root.
  "f15e-rear": {
    span: 13.05,
    lift: 4.4,
    port: true,
    gun: [61, 44],
    pylons: [[11.5, 65.3, "aam"], [88.5, 65.3, "aam"], [19.5, 64.6, "agm"], [80.5, 64.8, "agm"]],
    flares: [[41, 91], [59, 91]],
    chaff: [50, 91.5],
    tips: [[4, 63.5], [96, 63.5]],
    belly: [50, 92.2],
    nose: [50, 10],
  },
  // F-22A: M61 above the right wing root; everything else rides in the belly bays.
  "f22-rear": {
    span: 13.56,
    lift: 4.4,
    port: true,
    gun: [57, 31],
    pylons: [[45.5, 86.6, "bay"], [54.5, 86.4, "bay"]],
    flares: [[37, 84], [63, 84]],
    chaff: [50, 87.4],
    tips: [[4, 65], [96, 65]],
    belly: [50, 88.4],
    nose: [50, 6],
  },
  // EA-18G: nose gun position; wingtip receiver pods and underwing jammers are part of the art.
  "ea18g-rear": {
    span: 13.62,
    gun: [50, 24],
    pylons: [[12, 64.2, "agm"], [88, 64.2, "agm"]],
    flares: [[43, 89], [57, 89]],
    chaff: [50, 95],
    pods: [[5, 61], [95, 61], [21, 77], [80, 77]],
    tips: [[4, 61], [96, 61]],
    belly: [50, 96],
    nose: [50, 18],
  },
  // A-10C: GAU-8 under the nose, a touch left of the centreline; flares in the gear pods.
  "a10-rear": {
    span: 17.53,
    gun: [49.3, 8],
    pylons: [[15.6, 64.5, "agm"], [84.4, 64.5, "agm"], [9.5, 52.8, "aam"], [90.5, 52.8, "aam"], [23, 67.6, "pod"], [77, 67.6, "pod"]],
    flares: [[35.5, 69], [64.5, 69]],
    chaff: [50, 92],
    tips: [[4, 52], [96, 52]],
    belly: [50, 93],
    nose: [50, 5],
  },

  /* --------------------------------------------------- enemies, from behind */
  // F-104G: M61 low on the left of the forward fuselage.
  "f104-rear": { span: 7.6, gun: [46.5, 42], pylons: [[20, 70.8, "aam"], [80, 70.8, "aam"]] },
  // Alpha Jet: 27 mm gun pod on the centreline.
  "alphajet-rear": { span: 9.1, gun: [50, 97], pylons: [[19.5, 69.5, "aam"], [81, 69.5, "aam"]] },
  // F-4F: M61 under the nose.
  "f4f-rear": { span: 11.7, gun: [50, 27], pylons: [[17, 76.8, "aam"], [83, 76.8, "aam"]] },
  // MiG-29G: GSh-30-1 in the left wing root.
  "mig29-rear": { span: 11.4, port: true, gun: [46.7, 31], pylons: [[16.5, 67.4, "aam"], [83.5, 67.4, "aam"], [10.2, 68.2, "aam"], [89.8, 68.2, "aam"]] },
  // Tornado: 27 mm Mauser low on the right of the forward fuselage.
  "tornado-rear": { span: 13.9, gun: [53.5, 38], pylons: [[20, 71, "aam"], [80, 71, "aam"]] },
  // Typhoon: 27 mm Mauser in the right wing root.
  "typhoon-rear": { span: 11.1, lift: 4.4, port: true, gun: [58, 43], pylons: [[16.4, 81.2, "aam"], [83.6, 81.4, "aam"], [9.6, 83.2, "aam"], [90.5, 83.8, "aam"]] },
  // F-35A: GAU-22 above the left wing root; internal bays.
  "f35-rear": { span: 10.7, gun: [42.5, 30], pylons: [[44.5, 83.4, "bay"], [55.5, 83.6, "bay"]] },
  "f4f_boss-rear": { span: 11.7, lift: 4.4, gun: [50, 5], pylons: [[13, 67, "aam"], [87, 67, "aam"]] },
  "typhoon_boss-rear": { span: 11.1, lift: 4.4, port: true, gun: [57.5, 33], pylons: [[12.5, 80.5, "aam"], [87.5, 80.5, "aam"]] },
  "f35_boss-rear": { span: 10.7, gun: [43, 27], pylons: [[43, 87, "bay"], [57, 87, "bay"]] },

  /* ---------------------------------------- enemies, from the front quarter */
  "f104-front": { gun: [33, 75], pylons: [[70.5, 79, "aam"], [81.5, 77.5, "aam"]] },
  "alphajet-front": { gun: [35, 94], pylons: [[76, 70, "aam"], [13, 68, "aam"]] },
  "f4f-front": { gun: [22, 79], pylons: [[84, 71, "aam"], [63, 76, "aam"]] },
  "mig29-front": { gun: [31, 60], pylons: [[72, 75, "aam"], [84, 79, "aam"]] },
  "tornado-front": { gun: [27, 84], pylons: [[70, 74, "aam"], [60, 81, "aam"]] },
  "typhoon-front": { gun: [36, 52], pylons: [[62, 85, "aam"], [74, 85, "aam"]] },
  "f35-front": { gun: [38, 52], pylons: [[45, 91, "bay"], [32, 88, "bay"]] },
  "f4f_boss-front": { gun: [10, 92], pylons: [[62, 84, "aam"], [72, 82, "aam"]] },
  "typhoon_boss-front": { gun: [36, 63], pylons: [[56, 81, "aam"], [68, 81, "aam"]] },
  "f35_boss-front": { gun: [38, 62], pylons: [[40, 85, "bay"], [28, 86, "bay"]] },
};

/** Used for a sprite with no entry, so a new airframe still fires from somewhere sensible. */
export const FALLBACK_ANCHORS: SpriteAnchors = { gun: [50, 40], pylons: [[30, 70, "aam"], [70, 70, "aam"]] };

export function anchorsOf(sprite: string): SpriteAnchors {
  return ANCHORS[sprite] ?? FALLBACK_ANCHORS;
}
